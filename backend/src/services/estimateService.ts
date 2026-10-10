import Estimate, { ESTIMATE_STATUSES } from '../models/Estimate.js';
import JobCard, { JOB_STATUS } from '../models/JobCard.js';
import { generateEstimateNumber } from '../utils/generators.js';
import ApiError from '../utils/ApiError.js';

const computeTotals = (parts, labor, other, discount, taxRate) => {
  const partsTotal = (parts || []).reduce((s, p) => s + p.unitCost * p.quantity, 0);
  const laborTotal = (labor || []).reduce((s, l) => s + l.hours * l.hourlyRate, 0);
  const otherTotal = (other || []).reduce((s, o) => s + o.amount, 0);
  const preDiscount = partsTotal + laborTotal + otherTotal;

  let discountAmount = 0;
  if (discount && discount.value) {
    if (discount.type === 'Percentage') {
      discountAmount = (preDiscount * discount.value) / 100;
    } else {
      discountAmount = discount.value;
    }
  }
  const taxable = Math.max(preDiscount - discountAmount, 0);
  const taxAmount = (taxable * (taxRate || 0)) / 100;
  const grandTotal = taxable + taxAmount;

  return {
    partsTotal,
    laborTotal,
    otherTotal,
    subtotal: preDiscount,
    discountAmount,
    taxable,
    taxAmount,
    grandTotal,
  };
};

/** Never return the stored identity number or a storage path to a client. */
const maskEstimate = (estimate) =>
  typeof estimate?.toMaskedJSON === 'function' ? estimate.toMaskedJSON() : estimate;

// POST /api/estimates
export const createEstimate = async (payload: any, actor: any): Promise<any> => {
  const body = payload;
  if (!body.jobCardId) throw new ApiError(400, 'jobCardId is required');
  const jobCard = await JobCard.findById(body.jobCardId);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  const parts = body.items?.parts || [];
  const labor = body.items?.labor || [];
  const other = body.items?.other || [];
  const discount = body.discount || { type: 'Fixed', value: 0 };
  const taxRate = body.tax?.rate ?? 18;

  const totals = computeTotals(parts, labor, other, discount, taxRate);

  const estimate = new Estimate({
    jobCardId: body.jobCardId,
    estimateNumber: body.estimateNumber || generateEstimateNumber(),
    status: body.status || 'Draft',
    items: { parts, labor, other },
    subtotal: totals.subtotal,
    discount: { ...discount },
    tax: { rate: taxRate, amount: totals.taxAmount },
    grandTotal: totals.grandTotal,
    validUntil: body.validUntil || null,
    notes: body.notes,
    terms: body.terms,
    approvalHistory: [
      { status: body.status || 'Draft', by: actor?.email || 'System', at: new Date() },
    ],
    createdBy: actor?.email || 'System',
  });
  await estimate.save();
  return { success: true, data: maskEstimate(estimate) };
};

// GET /api/estimates?q=&status=&jobCardId=&page=&limit=
export const getEstimates = async (filters: any): Promise<any> => {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 20));

  const filter: Record<string, any> = {};
  if (filters.jobCardId) filter.jobCardId = filters.jobCardId;
  if (filters.status && ESTIMATE_STATUSES.includes(filters.status)) filter.status = filters.status;
  if (filters.q) {
    const safe = String(filters.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [
      { estimateNumber: rx },
      { 'customer.name': rx },
      { 'customer.phone': rx },
      { 'vehicle.registrationNumber': rx },
    ];
  }

  const [estimates, total] = await Promise.all([
    Estimate.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('jobCardId', 'jobCardNumber vehicle customer'),
    Estimate.countDocuments(filter),
  ]);

  return {
    success: true,
    data: estimates.map(maskEstimate),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

// GET /api/estimates/:id
export const getEstimate = async (routeParams: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id).populate(
    'jobCardId',
    'jobCardNumber vehicle customer'
  );
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  return { success: true, data: maskEstimate(estimate) };
};

// PUT /api/estimates/:id
export const updateEstimate = async (routeParams: any, payload: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (estimate.status === 'Converted to Invoice') {
    throw new ApiError(400, 'Cannot modify an estimate that has been converted to invoice');
  }
  const b = payload;
  if (b.items) estimate.items = b.items;
  if (b.discount) estimate.discount = b.discount;
  if (b.tax != null) estimate.tax = b.tax;
  if (b.notes !== undefined) estimate.notes = b.notes;
  if (b.terms !== undefined) estimate.terms = b.terms;
  if (b.validUntil) estimate.validUntil = b.validUntil;

  const totals = computeTotals(
    estimate.items?.parts,
    estimate.items?.labor,
    estimate.items?.other,
    estimate.discount,
    estimate.tax?.rate ?? 18
  );
  estimate.subtotal = totals.subtotal;
  estimate.tax.amount = totals.taxAmount;
  estimate.grandTotal = totals.grandTotal;
  await estimate.save();
  return { success: true, data: maskEstimate(estimate) };
};

// PATCH /api/estimates/:id/approve
export const approveEstimate = async (routeParams: any, actor: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  estimate.status = 'Approved';
  estimate.approvedBy = actor?.email || 'Customer';
  estimate.approvedAt = new Date();
  estimate.approvalHistory.push({ status: 'Approved', by: actor?.email || 'Customer', at: new Date() });
  await estimate.save();
  if (estimate.jobCardId) {
    await JobCard.findByIdAndUpdate(estimate.jobCardId, {
      'estimate.estimateId': estimate._id,
      'estimate.status': 'Approved',
      'estimate.totalAmount': estimate.grandTotal,
    });
  }
  return { success: true, data: maskEstimate(estimate) };
};

// PATCH /api/estimates/:id/reject
export const rejectEstimate = async (routeParams: any, actor: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  estimate.status = 'Rejected';
  estimate.approvalHistory.push({ status: 'Rejected', by: actor?.email || 'Customer', at: new Date() });
  await estimate.save();
  return { success: true, data: maskEstimate(estimate) };
};

// POST /api/estimates/:id/send-email
export const sendEstimateEmail = async (routeParams: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id).populate('jobCardId');
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  return { success: true, message: 'Estimate forwarded to customer for approval (email integration pending)' };
};

// POST /api/estimates/:id/convert-invoice
export const convertToInvoice = async (routeParams: any, actor: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (!['Approved', 'Accepted'].includes(estimate.status)) {
    throw new ApiError(400, 'Only approved or accepted estimates can be converted to invoices');
  }
  estimate.status = 'Converted to Invoice';
  estimate.approvalHistory.push({
    status: 'Converted to Invoice',
    by: actor?.email || 'System',
    at: new Date(),
  });
  await estimate.save();
  if (estimate.jobCardId) {
    await JobCard.findByIdAndUpdate(estimate.jobCardId, {
      'estimate.estimateId': estimate._id,
      'estimate.status': 'Converted to Invoice',
      'estimate.totalAmount': estimate.grandTotal,
      status: JOB_STATUS.IN_PROGRESS,
    });
  }
  return { success: true, data: maskEstimate(estimate), message: 'Estimate converted to invoice' };
};
