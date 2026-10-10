import { serviceRevision, approvalExpired } from '../utils/jobApproval.js';
import crypto from 'crypto';
import JobCard, {
  JOB_STATUS,
  STATUS_VALUES,
  PRIORITIES,
  PAYMENT_STATUSES,
  BOOKING_SOURCES,
  PAYMENT_MODES,
  APPROVAL_METHODS,
  APPROVAL_STATUS_VALUES,
  LINE_ITEM_TYPES,
  LINE_ITEM_TAX_TYPES,
  LINE_ITEM_DISCOUNT_TYPES,
  LINE_ITEM_UNITS,
} from '../models/JobCard.js';
import { generateJobCardNumber } from '../utils/generators.js';
import {
  computeJobCardTotals,
  computeLineItem,
  derivePaymentStatus,
  type JobCardTotals,
} from '../utils/jobCardMath.js';
import { sendCustomerUpdate, type NotificationChannel } from './notifications.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const SORTABLE = [
  'jobCardNumber',
  'status',
  'createdAt',
  'service.priority',
  'service.estimatedDelivery',
  'vehicle.registrationNumber',
];

const number = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * The six dashboard tabs map onto more granular stored statuses. Each tab is
 * requested as a comma separated `status` list, e.g. status=Pending%20Parts,Pending%20Approval.
 */
export const WORKFLOW_GROUPS = Object.freeze({
  All: [],
  New: [JOB_STATUS.NEW],
  Open: [JOB_STATUS.PENDING_PARTS, JOB_STATUS.PENDING_APPROVAL, JOB_STATUS.ON_HOLD],
  'Work In Progress': [JOB_STATUS.IN_PROGRESS],
  'Ready For Delivery': [JOB_STATUS.READY],
  Completed: [JOB_STATUS.DELIVERED],
  Cancelled: [JOB_STATUS.CANCELLED],
});

/** Parse `status` (single value or comma separated list) into an array. */
function parseStatusFilter(raw) {
  if (!raw) return null;
  const allowed: string[] = STATUS_VALUES;
  const values = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => allowed.includes(s));
  if (!values.length) return null;
  return values;
}

/** Identity of a line item's *inputs* — used to decide whether to restamp "updated by". */
function lineSignature(line: any): string {
  return [
    line?.name,
    line?.type,
    line?.hsnSacCode,
    line?.unit,
    line?.qty,
    line?.price,
    line?.taxType,
    line?.taxRate,
    line?.discountType,
    line?.discountValue,
    line?.packageId,
  ]
    .map((v) => (v === undefined || v === null ? '' : String(v)))
    .join('|');
}

/**
 * Whitelist and normalise the service list, then attach the derived money
 * columns. Rows are stamped with the user who actually changed them, which is
 * what the "Updated By" audit column reads.
 */
export function normaliseServiceLines(
  input: unknown,
  who: string,
  existing: any[] = []
): Record<string, unknown>[] | null {
  if (!Array.isArray(input)) return null;
  const now = new Date();

  return input
    .filter((line: any) => line && String(line.name ?? '').trim())
    .map((line: any, index: number) => {
      const taxType = LINE_ITEM_TAX_TYPES.includes(line.taxType)
        ? line.taxType
        : number(line.taxRate) > 0
        ? 'GST'
        : 'None';

      const base: Record<string, unknown> = {
        assignedMechanic: line.assignedMechanic || null,
        catalogId: line.catalogId || undefined,
        name: String(line.name).trim(),
        type: LINE_ITEM_TYPES.includes(line.type) ? line.type : 'service',
        description: line.description || undefined,
        hsnSacCode: line.hsnSacCode ? String(line.hsnSacCode).toUpperCase().trim() : undefined,
        partNumber: line.partNumber || undefined,
        brand: line.brand || undefined,
        unit: LINE_ITEM_UNITS.includes(line.unit) ? line.unit : 'nos',
        qty: Math.max(number(line.qty), 0),
        price: Math.max(number(line.price), 0),
        taxType,
        taxRate: clamp(number(line.taxRate), 0, 100),
        discountType: LINE_ITEM_DISCOUNT_TYPES.includes(line.discountType) ? line.discountType : 'none',
        discountValue: Math.max(number(line.discountValue), 0),
        packageId: line.packageId || undefined,
        packageName: line.packageName || undefined,
        isPackageHeader: Boolean(line.isPackageHeader),
        coreItem: Boolean(line.coreItem),
        stockAvailable: line.stockAvailable === undefined || line.stockAvailable === null ? null : number(line.stockAvailable),
      };

      const previous = existing[index];
      const changed = !previous || lineSignature(previous) !== lineSignature(base);
      base.updatedBy = line.updatedBy || (changed ? who : previous?.updatedBy) || who;
      base.updatedAt = changed ? now : previous?.updatedAt || now;

      return { ...base, ...computeLineItem(base as any) };
    });
}

/** Recalculate the money columns for a set of lines. The server is authoritative. */
function computeMoney(
  lines: any[],
  orderSummary: { discount?: unknown; paymentTerms?: string } | undefined,
  advanceAmount: unknown
): {
  orderSummary: JobCardTotals & { paymentTerms: string };
  paymentStatus: string;
  grandTotal: number;
} {
  const totals = computeJobCardTotals({
    services: lines || [],
    discount: number(orderSummary?.discount),
    advance: number(advanceAmount),
  });
  return {
    orderSummary: { ...totals, paymentTerms: orderSummary?.paymentTerms || '' },
    paymentStatus: derivePaymentStatus(totals),
    grandTotal: totals.total,
  };
}

/** Approval block for a brand new job card. Any client supplied token is ignored. */
function buildInitialApproval(input: any) {
  const source = input || {};
  const status = APPROVAL_STATUS_VALUES.includes(source.status) ? source.status : 'not_sent';
  return {
    status,
    approvedBy: source.approvedBy || '',
    method: APPROVAL_METHODS.includes(source.method) ? source.method : 'Verbal',
    reference: source.reference || '',
    notes: source.notes || '',
    approvedAt: source.approvedAt ? new Date(source.approvedAt) : null,
    sharedAt: null,
    channels: [],
    respondedAt: null,
    response: '',
    history: status === 'skipped' ? [{ action: 'Approval skipped', at: new Date() }] : [],
  };
}

// GET /api/jobcards?status=&priority=&advisor=&type=&insurance=&q=&from=&to=&page=&limit=&sort=
export const getJobCards = async (filters: any): Promise<any> => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};
  const statuses = parseStatusFilter(filters.status);
  if (statuses) {
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  if (filters.paymentStatus && PAYMENT_STATUSES.includes(filters.paymentStatus)) {
    filter.paymentStatus = filters.paymentStatus;
  }
  if (filters.source && BOOKING_SOURCES.includes(filters.source)) {
    filter.source = filters.source;
  }
  if (filters.priority && PRIORITIES.includes(filters.priority)) {
    filter['service.priority'] = filters.priority;
  }
  if (filters.advisor) {
    filter['advisor.advisorId'] = filters.advisor;
  }
  if (filters.type) {
    filter['service.type'] = filters.type;
  }
  if (filters.insurance === 'true' || filters.insurance === 'false') {
    filter['insurance.isClaim'] = filters.insurance === 'true';
  }
  if (filters.from || filters.to) {
    const from = filters.from ? new Date(filters.from) : new Date(0);
    const to = filters.to ? new Date(filters.to) : new Date();
    filter.createdAt = { $gte: from, $lte: to };
  }
  if (filters.q) {
    const q = filters.q.trim();
    filter.$or = [
      { jobCardNumber: { $regex: q, $options: 'i' } },
      { 'vehicle.registrationNumber': { $regex: q.toUpperCase(), $options: 'i' } },
      { 'vehicle.chassisNumber': { $regex: q.toUpperCase(), $options: 'i' } },
      { 'customer.name': { $regex: q, $options: 'i' } },
      { 'customer.phone': { $regex: q, $options: 'i' } },
    ];
  }

  const sortField = SORTABLE.includes(filters.sort) ? filters.sort : '-createdAt';
  const sort: Record<string, 1 | -1> = {
    [sortField.replace(/^-/, '')]: sortField.startsWith('-') ? -1 : 1,
  };

  const [items, total] = await Promise.all([
    JobCard.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('advisor.advisorId', 'name email phone'),
    JobCard.countDocuments(filter),
  ]);

  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// GET /api/jobcards/stats
// Live counts for the dashboard tabs. A parallel running total means the tab
// badges stay correct even as the table applies its own filters.
export const getJobCardStats = async (): Promise<any> => {
  const [byStatus, total] = await Promise.all([
    JobCard.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    JobCard.countDocuments({}),
  ]);

  const statusCounts = {};
  for (const status of STATUS_VALUES) statusCounts[status] = 0;
  for (const row of byStatus) {
    if (row?._id) statusCounts[row._id] = row.count;
  }

  const groups = {};
  for (const [group, statuses] of Object.entries(WORKFLOW_GROUPS)) {
    groups[group] = statuses.length
      ? statuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0)
      : total;
  }

  return { success: true, data: { total, byStatus: statusCounts, groups } };
};

// POST /api/jobcards
export const createJobCard = async (payload: any, actor: any): Promise<any> => {
  const body = payload;
  const who = actor?.email || actor?.username || 'System';

  const jobCardNumber = body.jobCardNumber || generateJobCardNumber();
  const isDraft = body.isDraft === true || body.submitMode === 'draft';

  const existing = await JobCard.findOne({
    'vehicle.registrationNumber': body?.vehicle?.registrationNumber?.toUpperCase(),
    isDraft: false,
  });
  if (existing && !isDraft) {
    throw new ApiError(
      409,
      `A job card already exists for registration ${body.vehicle.registrationNumber}. Please create a new one.`
    );
  }

  const lines = normaliseServiceLines(body.services, who) || [];
  const advanceAmount = number(body?.advance?.amount ?? body?.intake?.advanceAmount);
  const money = computeMoney(lines, body?.orderSummary, advanceAmount + (body.advances || []).reduce((sum: number, entry: any) => sum + number(entry.amount), 0));
  if (money.orderSummary.balanceDue < 0) throw new ApiError(400, 'Advances cannot exceed the grand total');

  const statusHistory = [
    {
      status: JOB_STATUS.NEW,
      changedBy: who,
      changedAt: new Date(),
      notes: isDraft ? 'Job card saved as draft' : 'Job card created',
    },
  ];

  const jobCard = new JobCard({
    ...body,
    services: lines,
    financials: { grandTotal: money.grandTotal, totalAdvancePaid: money.orderSummary.advanceDeducted, balanceDue: money.orderSummary.balanceDue },
    orderSummary: money.orderSummary,
    grandTotal: money.grandTotal,
    paymentStatus: body.paymentStatus && PAYMENT_STATUSES.includes(body.paymentStatus) ? body.paymentStatus : money.paymentStatus,
    advance: {
      amount: advanceAmount,
      paymentMode: PAYMENT_MODES.includes(body?.advance?.paymentMode) ? body.advance.paymentMode : 'Cash',
      reference: body?.advance?.reference || '',
      recordedAt: advanceAmount > 0 ? new Date() : null,
      recordedBy: advanceAmount > 0 ? who : '',
    },
    approval: buildInitialApproval(body.approval),
    jobCardNumber,
    isDraft,
    status: JOB_STATUS.NEW,
    statusHistory,
    audit: [{ action: isDraft ? 'Created (draft)' : 'Created', by: who, at: new Date() }],
    createdBy: who,
    updatedBy: who,
    ...(body.advisor?.advisorId ? { advisor: body.advisor } : {}),
  });

  await jobCard.save();

  syncExternalCounts(jobCard).catch(() => {});

  return { success: true, data: jobCard };
};

// GET /api/jobcards/:id
export const getJobCard = async (routeParams: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id).populate('advisor.advisorId');
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  return { success: true, data: jobCard };
};

// Fields that can be replaced wholesale from the request body on update.
// `approval` is deliberately absent — it is merged through applyApprovalPatch so
// every status change is recorded in the approval history.
const SUBDOCUMENT_FIELDS = [
  'insurance',
  'corporate',
  'intake',
  'orderSummary',
  'gatePass',
  'feedback',
  'invoice',
];
const ARRAY_FIELDS = ['inspectionReport', 'reminders'];
const SCALAR_FIELDS = ['notes', 'source', 'paymentStatus', 'isDraft'];

// PUT /api/jobcards/:id
export const updateJobCard = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  const who = actor?.email || 'System';
  const patch = payload;
  const previousRevision = serviceRevision(jobCard);

  if (patch.jobCardNumber && patch.jobCardNumber !== jobCard.jobCardNumber) {
    throw new ApiError(400, 'Job card number cannot be changed');
  }

  if (patch.service) {
    Object.assign(jobCard.service, {
      type: patch.service.type ?? jobCard.service.type,
      description: patch.service.description ?? jobCard.service.description,
      estimatedDelivery: patch.service.estimatedDelivery ?? jobCard.service.estimatedDelivery,
      priority: patch.service.priority ?? jobCard.service.priority,
      specialInstructions: patch.service.specialInstructions ?? jobCard.service.specialInstructions,
    });
  }
  if (patch.vehicle) {
    Object.assign(jobCard.vehicle, {
      type: patch.vehicle.type ?? jobCard.vehicle.type,
      registrationNumber: patch.vehicle.registrationNumber ?? jobCard.vehicle.registrationNumber,
      make: patch.vehicle.make ?? jobCard.vehicle.make,
      model: patch.vehicle.model ?? jobCard.vehicle.model,
      year: patch.vehicle.year ?? jobCard.vehicle.year,
      color: patch.vehicle.color ?? jobCard.vehicle.color,
      fuelType: patch.vehicle.fuelType ?? jobCard.vehicle.fuelType,
      odometerReading: patch.vehicle.odometerReading ?? jobCard.vehicle.odometerReading,
      fuelMeter: patch.vehicle.fuelMeter ?? jobCard.vehicle.fuelMeter,
      chassisNumber: patch.vehicle.chassisNumber ?? jobCard.vehicle.chassisNumber,
      engineNumber: patch.vehicle.engineNumber ?? jobCard.vehicle.engineNumber,
      vin: patch.vehicle.vin ?? jobCard.vehicle.vin,
    });
  }
  if (patch.customer) {
    Object.assign(jobCard.customer, {
      type: patch.customer.type ?? jobCard.customer.type,
      name: patch.customer.name ?? jobCard.customer.name,
      email: patch.customer.email ?? jobCard.customer.email,
      phone: patch.customer.phone ?? jobCard.customer.phone,
      alternatePhone: patch.customer.alternatePhone ?? jobCard.customer.alternatePhone,
      address: patch.customer.address ?? jobCard.customer.address,
      gstNumber: patch.customer.gstNumber ?? jobCard.customer.gstNumber,
      idProofNumber: patch.customer.idProofNumber ?? jobCard.customer.idProofNumber,
      idProofUrl: patch.customer.idProofUrl ?? jobCard.customer.idProofUrl,
    });
  }
  if (patch.advisor) jobCard.advisor = { ...jobCard.advisor, ...patch.advisor };

  // Service list — replaced wholesale, then re-priced server side.
  let lineItemsChanged = false;
  if (patch.services !== undefined) {
    const before = ((jobCard.services as any[]) || []).map(lineSignature).join('\u0001');
    const lines = normaliseServiceLines(patch.services, who, jobCard.services as any[]);
    if (lines) {
      const after = lines.map(lineSignature).join('\u0001');
      lineItemsChanged = before !== after;
      jobCard.services = lines as any;
    }
  }

  for (const field of SUBDOCUMENT_FIELDS) {
    if (patch[field]) jobCard[field] = { ...(jobCard[field]?.toObject?.() || jobCard[field] || {}), ...patch[field] };
  }
  for (const field of ARRAY_FIELDS) {
    if (Array.isArray(patch[field])) jobCard[field] = patch[field];
  }
  for (const field of SCALAR_FIELDS) {
    if (patch[field] !== undefined) jobCard[field] = patch[field];
  }

  // Advance is stored on its own subdocument and mirrored onto intake for older
  // consumers that still read `intake.advanceAmount`.
  if (patch.advance && patch.advance.amount !== undefined) {
    applyAdvance(jobCard, patch.advance, who);
  }

  // Approval status changes go through the audited path.
  // Generic saves must not overwrite a customer decision with stale form state.
  if (patch.approval && !jobCard.approval?.token) {
    applyApprovalPatch(jobCard, patch.approval, who);
  }

  if (patch.supervisor !== undefined) jobCard.supervisor = patch.supervisor;
  if (Array.isArray(patch.advances)) jobCard.advances = patch.advances;
  if (patch.estimatedDelivery) jobCard.estimatedDelivery = patch.estimatedDelivery;

  // Always re-price: the server owns subtotal / tax / total / balance.
  const advanceAmount = number(jobCard.advance?.amount ?? jobCard.intake?.advanceAmount);
  const money = computeMoney(jobCard.services as any[], jobCard.orderSummary, advanceAmount + (Array.from(jobCard.advances || []) as any[]).reduce((sum: number, entry: any) => sum + number(entry.amount), 0));
  if (money.orderSummary.balanceDue < 0) throw new ApiError(400, 'Advances cannot exceed the grand total');
  jobCard.financials = { grandTotal: money.grandTotal, totalAdvancePaid: money.orderSummary.advanceDeducted, balanceDue: money.orderSummary.balanceDue };
  jobCard.orderSummary = money.orderSummary;
  jobCard.grandTotal = money.grandTotal;
  if (patch.paymentStatus === undefined) jobCard.paymentStatus = money.paymentStatus;

  if (serviceRevision(jobCard) !== previousRevision && jobCard.approval?.token) {
    if (jobCard.approval.status === 'approved') throw new ApiError(409, 'Approved services are locked. Create a revised job card for additional work.');
    jobCard.approval.token = undefined;
    jobCard.approval.status = 'not_sent';
    jobCard.approval.respondedAt = null;
    jobCard.approval.approvedAt = null;
    jobCard.approval.response = '';
    jobCard.approval.history.push({ action: 'Service list revised; previous link invalidated', by: who, at: new Date() });
  }

  if (lineItemsChanged) {
    jobCard.audit.push({
      action: 'Service list updated',
      by: who,
      at: new Date(),
      details: `${(jobCard.services || []).length} item(s) · total ₹${money.grandTotal}`,
    });
  }

  jobCard.updatedBy = who;
  jobCard.audit.push({ action: 'Updated', by: who, at: new Date() });
  await jobCard.save();
  return { success: true, data: jobCard };
};

/** Record (or clear, with amount 0) the advance against the order. */
function applyAdvance(jobCard: any, input: any, who: string) {
  const amount = Math.max(number(input.amount), 0);
  jobCard.advance = {
    amount,
    paymentMode: PAYMENT_MODES.includes(input.paymentMode) ? input.paymentMode : jobCard.advance?.paymentMode || 'Cash',
    reference: input.reference || '',
    recordedAt: amount > 0 ? new Date() : null,
    recordedBy: amount > 0 ? who : '',
  };
  if (jobCard.intake) jobCard.intake.advanceAmount = amount;
  jobCard.audit.push({
    action: amount > 0 ? 'Advance recorded' : 'Advance cleared',
    by: who,
    at: new Date(),
    details: amount > 0 ? `₹${amount} via ${jobCard.advance.paymentMode}` : undefined,
  });
}

/** Merge an approval patch, keeping the audit history in step with the status. */
function applyApprovalPatch(jobCard: any, patch: any, who: string) {
  const approval = jobCard.approval || {};
  approval.history = approval.history || [];
  const now = new Date();

  if (patch.status !== undefined) {
    if (!APPROVAL_STATUS_VALUES.includes(patch.status)) {
      throw new ApiError(400, `Approval status must be one of: ${APPROVAL_STATUS_VALUES.join(', ')}`);
    }
    // A stale client sending the default 'not_sent' must not undo a share.
    const nextStatus =
      patch.status === 'not_sent' && approval.status && approval.status !== 'not_sent'
        ? approval.status
        : patch.status;

    if (nextStatus !== approval.status) {
      approval.respondedAt = null;
      approval.method = patch.method && patch.method !== 'Link' ? patch.method : 'Verbal';
      approval.history.push({ action: `Status set to ${nextStatus}`, by: who, at: now });
    }
    approval.status = nextStatus;
    if (nextStatus === 'approved') {
      approval.approvedAt = patch.approvedAt ? new Date(patch.approvedAt) : now;
    }
    if (nextStatus === 'changes_requested' && patch.response) approval.response = patch.response;
  }

  for (const field of ['approvedBy', 'reference', 'notes', 'response']) {
    if (patch[field] !== undefined) approval[field] = patch[field];
  }
  if (patch.method !== undefined && APPROVAL_METHODS.includes(patch.method)) approval.method = patch.method;
  if (patch.approvedAt !== undefined && patch.approvedAt) approval.approvedAt = new Date(patch.approvedAt);

  jobCard.approval = approval;
}

// DELETE /api/jobcards/:id
export const deleteJobCard = async (routeParams: any, filters: any, actor: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  const deletable =
    jobCard.isDraft || jobCard.status === JOB_STATUS.NEW || jobCard.status === JOB_STATUS.CANCELLED;
  const force = filters.force === 'true' || filters.force === '1';
  const isAdmin = actor?.role === 'Admin';
  if (!deletable && !(force && isAdmin)) {
    throw new ApiError(
      400,
      'Only draft, New or Cancelled job cards can be deleted. An administrator can force delete.'
    );
  }

  await jobCard.deleteOne();
  return { success: true, message: 'Job card deleted' };
};

// PATCH /api/jobcards/:id/status
export const updateJobCardStatus = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const { status, notes } = payload;
  if (!status || !STATUS_VALUES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${STATUS_VALUES.join(', ')}`);
  }
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  jobCard.status = status;
  jobCard.statusHistory.push({
    status,
    changedBy: actor?.email || 'System',
    changedAt: new Date(),
    notes: notes || `Status changed to ${status}`,
  });
  if (status === JOB_STATUS.DELIVERED && !jobCard.service.actualDelivery) {
    jobCard.service.actualDelivery = new Date();
  }
  jobCard.updatedBy = actor?.email || 'System';
  await jobCard.save();
  return { success: true, data: jobCard, message: `Status updated to ${status}` };
};

// PATCH /api/jobcards/:id/assign-advisor
export const assignAdvisor = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const { advisorId, name, phone } = payload;
  if (!advisorId) throw new ApiError(400, 'advisorId is required');
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  jobCard.advisor = {
    advisorId,
    name: name || jobCard.advisor?.name,
    phone: phone || jobCard.advisor?.phone,
  };
  jobCard.updatedBy = actor?.email || 'System';
  jobCard.audit.push({
    action: 'Advisor assigned',
    by: actor?.email || 'System',
    at: new Date(),
  });
  await jobCard.save();
  return { success: true, data: jobCard };
};

// PATCH /api/jobcards/:id/advance
// Records a partial payment (deposit) against the order. Sending 0 clears it.
export const recordAdvance = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  const who = actor?.email || 'System';
  if (payload?.amount === undefined) throw new ApiError(400, 'Advance amount is required');

  applyAdvance(jobCard, payload, who);

  const money = computeMoney(jobCard.services as any[], jobCard.orderSummary, number(jobCard.advance?.amount) + (Array.from(jobCard.advances || []) as any[]).reduce((sum: number, entry: any) => sum + number(entry.amount), 0));
  if (money.orderSummary.balanceDue < 0) throw new ApiError(400, 'Advances cannot exceed the grand total');
  jobCard.financials = { grandTotal: money.grandTotal, totalAdvancePaid: money.orderSummary.advanceDeducted, balanceDue: money.orderSummary.balanceDue };
  jobCard.orderSummary = money.orderSummary;
  jobCard.grandTotal = money.grandTotal;
  jobCard.paymentStatus = money.paymentStatus;
  jobCard.updatedBy = who;
  await jobCard.save();

  return { success: true, data: jobCard, message: 'Advance recorded' };
};

// POST /api/jobcards/:id/approval/share
// Generates (or reuses) the public approval token and sends the itemised list.
export const shareApproval = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  if (!jobCard.services?.length) {
    throw new ApiError(400, 'Add at least one service or part before sharing the list');
  }

  const who = actor?.email || 'System';
  const channels: NotificationChannel[] = Array.isArray(payload?.channels) && payload.channels.length
    ? payload.channels.filter((c: string) => ['SMS', 'WhatsApp', 'Email'].includes(c))
    : ['WhatsApp'];
  const now = new Date();

  const approval: any = jobCard.approval || {};
  if (!jobCard.customer?.phone) throw new ApiError(400, 'Customer mobile number is required');
  const decided = ['approved', 'changes_requested'].includes(approval.status);
  const reuse = Boolean(approval.token && (decided || !approvalExpired(approval)));
  const token = reuse ? approval.token : crypto.randomBytes(24).toString('hex');

  jobCard.approval = {
    ...(approval.toObject?.() || approval),
    token,
    status: decided && reuse ? approval.status : 'awaiting',
    generatedAt: reuse ? approval.generatedAt || approval.sharedAt : now,
    expiresAt: reuse ? approval.expiresAt || new Date(new Date(approval.sharedAt).getTime() + 7 * 86400000) : new Date(now.getTime() + 7 * 86400000),
    viewedAt: reuse ? approval.viewedAt : null,
    revision: serviceRevision(jobCard),
    sharedAt: reuse ? approval.sharedAt : now,
    channels,
    history: [
      ...(approval.history || []),
      ...(!reuse ? [{ action: 'Approval link generated', by: who, at: now }] : []),
      { action: 'Shared to customer', by: who, at: now, channel: channels.join(', '), note: payload?.message || undefined },
    ],
  };

  // Sharing implies the customer now has a say, so the card moves to Pending Approval.
  if (!decided && (jobCard.status === JOB_STATUS.NEW || jobCard.status === JOB_STATUS.ON_HOLD)) {
    jobCard.status = JOB_STATUS.PENDING_APPROVAL;
    jobCard.statusHistory.push({
      status: JOB_STATUS.PENDING_APPROVAL,
      changedBy: who,
      changedAt: now,
      notes: 'Service list sent to the customer for approval',
    });
  }

  jobCard.updatedBy = who;
  jobCard.audit.push({
    action: 'Service list shared',
    by: who,
    at: now,
    details: `${(jobCard.services || []).length} item(s) via ${channels.join(', ')}`,
  });
  await jobCard.save();

  const link = `${env.publicUrl.replace(/\/$/, '')}/approval/${token}`;
  const delivery = await sendCustomerUpdate({
    to: jobCard.customer?.phone,
    email: jobCard.customer?.email,
    customerName: jobCard.customer?.name,
    jobCardNumber: jobCard.jobCardNumber,
    channels,
    reference: jobCard.jobCardNumber,
    link,
    body: `${env.business.name} - Job ${jobCard.jobCardNumber}. Hi ${jobCard.customer?.name || 'there'}, please review and approve the service list for ${jobCard.vehicle?.registrationNumber || 'your vehicle'} (₹${jobCard.grandTotal}): ${link}`,
  });

  return {
    success: true,
    data: {
      token,
      link,
      status: jobCard.approval.status,
      sharedAt: jobCard.approval.sharedAt,
      delivery,
      jobCard,
    },
  };
};

// PATCH /api/jobcards/:id/approval
// Records the outcome (approved / changes requested / skipped) from the desk.
export const updateApproval = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  const who = actor?.email || 'System';
  if (payload?.status === undefined) throw new ApiError(400, 'Approval status is required');

  applyApprovalPatch(jobCard, payload, who);

  if (jobCard.approval.status === 'approved' && jobCard.status === JOB_STATUS.PENDING_APPROVAL) {
    jobCard.status = JOB_STATUS.IN_PROGRESS;
    jobCard.statusHistory.push({
      status: JOB_STATUS.IN_PROGRESS,
      changedBy: who,
      changedAt: new Date(),
      notes: 'Customer approved the service list',
    });
  }

  jobCard.updatedBy = who;
  jobCard.audit.push({ action: `Approval ${jobCard.approval.status}`, by: who, at: new Date() });
  await jobCard.save();

  return { success: true, data: jobCard, message: 'Approval updated' };
};

// Keep customer/vehicle counters in sync (best effort, non-critical)
async function syncExternalCounts(jobCard) {
  try {
    const { default: Customer } = await import('../models/Customer.js');
    const { default: Vehicle } = await import('../models/Vehicle.js');
    if (jobCard.customer?.customerId) {
      await Customer.findByIdAndUpdate(jobCard.customer.customerId, {
        $inc: { totalJobCards: 1 },
      });
    }
    if (jobCard.vehicleRef) {
      const vehicle = await Vehicle.findById(jobCard.vehicleRef);
      if (vehicle) {
        vehicle.serviceHistory = vehicle.serviceHistory || [];
        vehicle.serviceHistory.push(jobCard._id);
        vehicle.totalServiceCount = (vehicle.totalServiceCount || 0) + 1;
        vehicle.lastServiceDate = new Date();
        await vehicle.save();
      }
    }
  } catch (err) {
    console.error('syncExternalCounts failed', err.message);
  }
}
