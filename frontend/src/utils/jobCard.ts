// ---------------------------------------------------------------------------
// Job card module — option lists, wizard form shape and the pure helpers that
// convert between the API document and the six-step form.
//
// The money math lives in ./jobCardPricing (shared with Steps 3 and 4) and is
// re-exported here so the rest of the module has a single import surface.
// ---------------------------------------------------------------------------

import {
  computeJobCardTotals,
  derivePaymentStatus,
  resolveTaxType,
  toNumber,
  type JobCardLineItem,
  type JobCardTotals,
} from './jobCardPricing';

export {
  APPROVAL_STATUSES,
  APPROVAL_STATUS_COLORS,
  APPROVAL_STATUS_LABELS,
  DEFAULT_TAX_RATE,
  LINE_DISCOUNT_TYPES,
  LINE_TAX_TYPES,
  LINE_UNITS,
  computeLineItem,
  computeLineItems,
  createLineItem,
  derivePaymentStatus,
  discountLabel,
  isStockShort,
  resolveDiscountType,
  resolveTaxType,
} from './jobCardPricing';
export type { JobCardLineItem, JobCardTotals } from './jobCardPricing';

export const JOB_STATUS_OPTIONS = [
  'New',
  'In Progress',
  'Pending Parts',
  'Pending Approval',
  'Ready for Delivery',
  'Delivered',
  'On Hold',
  'Cancelled',
];

export const VEHICLE_TYPES = ['4W', '2W'];
export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];
export const CUSTOMER_TYPES = ['Individual', 'Company'];
export const BOOKING_SOURCES = ['Walk-in', 'Referral', 'Online', 'N/A'];
export const PAYMENT_STATUSES = ['Paid', 'Partially Paid', 'Pending', 'Overdue'];
export const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
export const INSPECTION_CONDITIONS = ['Good', 'Average', 'Needs Attention', 'Not Applicable'];
export const LINE_ITEM_TYPES = ['service', 'package', 'part', 'labour', 'custom'] as const;
export const SERVICE_TYPE_OPTIONS = [
  'Maintenance',
  'Repair',
  'Paint',
  'Inspection',
  'Alignment',
  'Diagnostics',
  'Detailing',
  'Other',
];
export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
export const REMINDER_TYPES = ['Next Service', 'Insurance Renewal', 'Feedback Request', 'Custom'];
export const REMINDER_CHANNELS = ['SMS', 'WhatsApp', 'Email'];
// 'Link' records a sign-off made through the public approval link.
export const APPROVAL_METHODS = ['Signature', 'OTP', 'Verbal', 'WhatsApp', 'Link'];

/** The checklist a fresh inspection starts from. Technicians can add or drop rows. */
export const INSPECTION_CHECKLIST = [
  'Engine',
  'Brakes',
  'Tires',
  'Lights',
  'Fluids',
  'Body',
  'Battery',
  'Suspension',
  'AC / Cooling',
  'Electricals',
];

export const PAYMENT_STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  Paid: 'success',
  'Partially Paid': 'info',
  Pending: 'warning',
  Overdue: 'error',
};

/**
 * Dashboard tabs. A tab groups one or more stored statuses (e.g. "Open" covers
 * the waiting-for-approval / parts states) and the server filters with a comma
 * separated `status` list.
 */
export const STATUS_TABS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'All', label: 'All', statuses: [] },
  { key: 'New', label: 'New', statuses: ['New'] },
  { key: 'Open', label: 'Open', statuses: ['Pending Parts', 'Pending Approval', 'On Hold'] },
  { key: 'Work In Progress', label: 'Work In Progress', statuses: ['In Progress'] },
  { key: 'Ready For Delivery', label: 'Ready For Delivery', statuses: ['Ready for Delivery'] },
  { key: 'Completed', label: 'Completed', statuses: ['Delivered'] },
  { key: 'Cancelled', label: 'Cancelled', statuses: ['Cancelled'] },
];

export const JOB_CARD_STEPS = [
  { key: 'vehicle-client', label: 'Vehicle & Client Details', short: 'Vehicle & Client' },
  { key: 'inspection', label: 'Inspection Report', short: 'Inspection' },
  { key: 'services', label: 'Services, Packages & Parts', short: 'Services' },
  { key: 'approval', label: 'Service List Approval', short: 'Approval' },
  { key: 'summary', label: 'Order Summary', short: 'Summary' },
  { key: 'reminder', label: 'Set Reminder', short: 'Reminder' },
] as const;

export interface JobCardInspectionEntry {
  item: string;
  condition: string;
  notes: string;
  photoUrl?: string;
}

export interface JobCardReminder {
  type: string;
  dueDate: string;
  channel: string;
  notes?: string;
}

/** Staff member (supervisor / mechanic) picked from the team roster. */
export interface JobCardStaff {
  staffId: string;
  name: string;
  assignedAt?: string;
}

/** Advance payment recorded against the job card. */
export interface JobCardAdvance {
  amount: number;
  paymentMode: string;
  reference: string;
  recordedAt: string;
  recordedBy: string;
}

/** Estimated delivery with optional customer notification flag. */
export interface JobCardEstimatedDelivery {
  date: string;
  time: string;
  lastUpdatedBy?: string;
  notifiedCustomer?: boolean;
  notifyCustomerRequested?: boolean;
}

export interface JobCardFormState {
  vehicleType: string;
  vehicle: {
    registrationNumber: string;
    brand: string;
    model: string;
    year: string;
    chassisNumber: string;
    engineNumber: string;
    fuelType: string;
    odometer: string;
    fuelMeter: string;
  };
  insurance: {
    company: string;
    policyNumber: string;
    expiryDate: string;
    reminderDate: string;
    fileUrl: string;
  };
  customer: {
    type: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    gstNumber: string;
    idProofNumber: string;
    idProofUrl: string;
  };
  source: string;
  intake: {
    complaint: string;
    pickupRequested: boolean;
    pickupAddress: string;
    pickupDate: string;
    advanceAmount: string;
    advancePaymentMode: string;
  };
  serviceType: string;
  priority: string;
  estimatedDelivery: JobCardEstimatedDelivery;
  inspectionReport: JobCardInspectionEntry[];
  lineItems: JobCardLineItem[];
  approval: {
    status: string;
    approvedBy: string;
    method: string;
    reference: string;
    notes: string;
    approvedAt: string;
    sharedAt: string;
    respondedAt: string;
    response: string;
    channels: string[];
    token?: string;
    history?: { action: string; by?: string; at?: string; note?: string; channel?: string }[];
  };
  /** Advance recorded against the service list at Step 3 / Step 4. */
  advance: {
    amount: string;
    paymentMode: string;
    reference: string;
  };
  /** Multiple advances recorded at Step 5 (Order Summary). */
  advances: JobCardAdvance[];
  /** Job-level supervisor assignment. */
  supervisor: JobCardStaff | null;
  orderSummary: {
    discount: string;
    paymentTerms: string;
  };
  reminders: JobCardReminder[];
  notes: string;
  updateToCustomer: boolean;
}

export function emptyInspectionReport(): JobCardInspectionEntry[] {
  return INSPECTION_CHECKLIST.map((item) => ({ item, condition: 'Good', notes: '', photoUrl: '' }));
}

export function createEmptyJobCardForm(): JobCardFormState {
  return {
    vehicleType: '4W',
    vehicle: {
      registrationNumber: '',
      brand: '',
      model: '',
      year: '',
      chassisNumber: '',
      engineNumber: '',
      fuelType: 'Petrol',
      odometer: '',
      fuelMeter: '',
    },
    insurance: { company: '', policyNumber: '', expiryDate: '', reminderDate: '', fileUrl: '' },
    customer: {
      type: 'Individual',
      name: '',
      phone: '',
      email: '',
      address: '',
      gstNumber: '',
      idProofNumber: '',
      idProofUrl: '',
    },
    source: 'Walk-in',
    intake: {
      complaint: '',
      pickupRequested: false,
      pickupAddress: '',
      pickupDate: '',
      advanceAmount: '',
      advancePaymentMode: 'Cash',
    },
    serviceType: 'Maintenance',
    priority: 'Medium',
    estimatedDelivery: { date: '', time: '', notifiedCustomer: false },
    inspectionReport: emptyInspectionReport(),
    lineItems: [],
    approval: {
      status: 'not_sent',
      approvedBy: '',
      method: 'Verbal',
      reference: '',
      notes: '',
      approvedAt: '',
      sharedAt: '',
      respondedAt: '',
      response: '',
      channels: [],
      history: [],
    },
    advance: { amount: '', paymentMode: 'Cash', reference: '' },
    advances: [],
    supervisor: null,
    orderSummary: { discount: '', paymentTerms: '' },
    reminders: [],
    notes: '',
    updateToCustomer: true,
  };
}

/** Trim a value to YYYY-MM-DD for <input type="date">. */
export function toDateInput(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const number = (value: unknown): number => toNumber(value);

/**
 * Parts + labour + line discounts + order discount + tax − advance.
 * Delegates to the shared pricing engine so Step 3, Step 4 and the order
 * summary can never disagree about the grand total.
 */
export function computeOrderSummary(
  form: Pick<JobCardFormState, 'lineItems' | 'orderSummary' | 'intake'> & Partial<Pick<JobCardFormState, 'advance' | 'advances'>>
): JobCardTotals {
  // A advance recorded at Step 4 wins over the intake field captured at Step 1.
  const advanceDeducted =
    (toNumber(form.advance?.amount) || toNumber(form.intake?.advanceAmount)) +
    (form.advances || []).reduce((sum, entry) => sum + Math.round(entry.amount * 100) / 100, 0);

  return computeJobCardTotals({
    lineItems: form.lineItems,
    discount: form.orderSummary?.discount,
    advance: advanceDeducted,
  });
}

/** Map a stored job card (API document) onto the wizard form. */
export function mapJobCardToForm(jc: any): JobCardFormState {
  const base = createEmptyJobCardForm();
  if (!jc) return base;
  const vehicle = jc.vehicle || {};
  const insurance = jc.insurance || {};
  const customer = jc.customer || {};
  const intake = jc.intake || {};
  const approval = jc.approval || {};
  const summary = jc.orderSummary || {};

  return {
    ...base,
    vehicleType: vehicle.type || base.vehicleType,
    vehicle: {
      ...base.vehicle,
      registrationNumber: vehicle.registrationNumber || '',
      brand: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year ? String(vehicle.year) : '',
      chassisNumber: vehicle.chassisNumber || vehicle.vin || '',
      engineNumber: vehicle.engineNumber || '',
      fuelType: vehicle.fuelType || base.vehicle.fuelType,
      odometer: vehicle.odometerReading !== undefined && vehicle.odometerReading !== null ? String(vehicle.odometerReading) : '',
      fuelMeter: vehicle.fuelMeter !== undefined && vehicle.fuelMeter !== null ? String(vehicle.fuelMeter) : '',
    },
    insurance: {
      company: insurance.companyName || '',
      policyNumber: insurance.policyNumber || '',
      expiryDate: toDateInput(insurance.expiryDate),
      reminderDate: toDateInput(insurance.reminderDate),
      fileUrl: insurance.fileUrl || '',
    },
    customer: {
      type: customer.type || base.customer.type,
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      gstNumber: customer.gstNumber || '',
      idProofNumber: customer.idProofNumber || '',
      idProofUrl: customer.idProofUrl || '',
    },
    source: jc.source || base.source,
    intake: {
      complaint: intake.complaint || jc.service?.description || '',
      pickupRequested: Boolean(intake.pickupRequested),
      pickupAddress: intake.pickupAddress || '',
      pickupDate: toDateInput(intake.pickupDate),
      advanceAmount: intake.advanceAmount ? String(intake.advanceAmount) : '',
      advancePaymentMode: intake.advancePaymentMode || base.intake.advancePaymentMode,
    },
    serviceType: jc.service?.type || base.serviceType,
    priority: jc.service?.priority || base.priority,
    estimatedDelivery: jc.estimatedDelivery?.date ? { ...base.estimatedDelivery, ...jc.estimatedDelivery } : (jc.service?.estimatedDelivery
      ? { date: toDateInput(jc.service.estimatedDelivery), time: '', notifiedCustomer: false }
      : base.estimatedDelivery),
    inspectionReport:
      Array.isArray(jc.inspectionReport) && jc.inspectionReport.length
        ? jc.inspectionReport.map((entry: any) => ({
            item: entry.item,
            condition: entry.condition || 'Good',
            notes: entry.notes || '',
            photoUrl: entry.photoUrl || '',
          }))
        : base.inspectionReport,
    lineItems:
      Array.isArray(jc.services) && jc.services.length
        ? jc.services.map((line: any) => ({
            catalogId: line.catalogId,
            name: line.name,
            type: line.type || 'service',
            description: line.description || '',
            hsnSacCode: line.hsnSacCode || '',
            partNumber: line.partNumber || '',
            brand: line.brand || '',
            unit: line.unit || 'nos',
            qty: number(line.qty) || 1,
            price: number(line.price),
            // Legacy rows persisted before taxType existed: infer it from the rate.
            taxType: line.taxType || (number(line.taxRate) > 0 ? 'GST' : 'None'),
            taxRate: number(line.taxRate),
            discountType: line.discountType || 'none',
            discountValue: number(line.discountValue),
            packageId: line.packageId || undefined,
            packageName: line.packageName || undefined,
            isPackageHeader: Boolean(line.isPackageHeader),
            coreItem: Boolean(line.coreItem),
            stockAvailable: line.stockAvailable ?? null,
            assignedMechanic: line.assignedMechanic,
        updatedBy: line.updatedBy || '',
            updatedAt: line.updatedAt || '',
          }))
        : [],
    approval: {
      status: approval.status || (approval.approvedBy ? 'approved' : 'not_sent'),
      approvedBy: approval.approvedBy || '',
      method: approval.method || base.approval.method,
      reference: approval.reference || '',
      notes: approval.notes || '',
      approvedAt: toDateInput(approval.approvedAt),
      sharedAt: approval.sharedAt || '',
      respondedAt: approval.respondedAt || '',
      response: approval.response || '',
      channels: Array.isArray(approval.channels) ? approval.channels : [],
      token: approval.token || undefined,
      history: Array.isArray(approval.history)
        ? approval.history.map((entry: any) => ({
            action: entry.action,
            by: entry.by,
            at: entry.at,
            note: entry.note,
            channel: entry.channel,
          }))
        : [],
    },
    advance: {
      amount: jc.advance?.amount
        ? String(jc.advance.amount)
        : intake.advanceAmount
        ? String(intake.advanceAmount)
        : '',
      paymentMode: jc.advance?.paymentMode || intake.advancePaymentMode || base.advance.paymentMode,
      reference: jc.advance?.reference || '',
    },
    advances: Array.isArray(jc.advances)
      ? jc.advances.map((a: any) => ({
          amount: number(a.amount),
          paymentMode: a.paymentMode || 'Cash',
          reference: a.reference || '',
          recordedAt: a.recordedAt || new Date().toISOString(),
          recordedBy: a.recordedBy || '',
        }))
      : [],
    supervisor: jc.supervisor
      ? { staffId: jc.supervisor.staffId, name: jc.supervisor.name, assignedAt: jc.supervisor.assignedAt }
      : null,
    orderSummary: {
      discount: summary.discount ? String(summary.discount) : '',
      paymentTerms: summary.paymentTerms || '',
    },
    reminders: Array.isArray(jc.reminders)
      ? jc.reminders.map((r: any) => ({
          type: r.type || 'Next Service',
          dueDate: toDateInput(r.dueDate),
          channel: r.channel || 'SMS',
          notes: r.notes || '',
        }))
      : [],
    notes: jc.notes || '',
    updateToCustomer: true,
  };
}

/** ISO timestamp for a date + time pair, or null when the date is unset/invalid. */
function isoOrNull(date: string, time?: string): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T${time || '00:00'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Build an API-shaped job card from the wizard form so documents (proforma
 * invoice, inspection report, work order …) can be generated from the
 * not-yet-saved form as well as from a stored job card.
 */
export function buildDocumentJobCard(
  form: JobCardFormState,
  options: { reference?: string; createdAt?: string; createdBy?: string } = {}
): any {
  const payload = buildJobCardPayload(form) as any;
  return {
    jobCardNumber: options.reference || 'DRAFT',
    createdAt: options.createdAt || new Date().toISOString(),
    createdBy: options.createdBy,
    status: form.approval.status === 'approved' ? 'In Progress' : 'New',
    ...payload,
    advances: payload.advances || [],
    advance: payload.advance || {},
    estimatedDelivery: form.estimatedDelivery,
    supervisor: payload.supervisor,
    advisor: options.createdBy ? { name: options.createdBy } : undefined,
    invoice: {},
    gatePass: {},
  };
}

/** Convert the wizard form into the API payload. */
export function buildJobCardPayload(form: JobCardFormState): Record<string, unknown> {
  const totals = computeOrderSummary(form);
  return {
    source: form.source,
    paymentStatus: derivePaymentStatus(totals),
    vehicle: {
      type: form.vehicleType,
      registrationNumber: form.vehicle.registrationNumber.trim().toUpperCase(),
      make: form.vehicle.brand.trim(),
      model: form.vehicle.model.trim(),
      year: form.vehicle.year ? number(form.vehicle.year) : undefined,
      chassisNumber: form.vehicle.chassisNumber.trim().toUpperCase(),
      engineNumber: form.vehicle.engineNumber.trim().toUpperCase(),
      fuelType: form.vehicle.fuelType,
      odometerReading: number(form.vehicle.odometer),
      fuelMeter: form.vehicle.fuelMeter === '' ? undefined : number(form.vehicle.fuelMeter),
    },
    customer: {
      type: form.customer.type,
      name: form.customer.name.trim(),
      phone: form.customer.phone.trim(),
      email: form.customer.email.trim().toLowerCase(),
      address: form.customer.address.trim(),
      gstNumber: form.customer.type === 'Company' ? form.customer.gstNumber.trim().toUpperCase() : '',
      idProofNumber: form.customer.idProofNumber.trim(),
      idProofUrl: form.customer.idProofUrl,
    },
    corporate:
      form.customer.type === 'Company'
        ? { isCorporate: true, name: form.customer.name.trim() }
        : { isCorporate: false, name: '' },
    insurance: {
      companyName: form.insurance.company.trim(),
      policyNumber: form.insurance.policyNumber.trim(),
      expiryDate: form.insurance.expiryDate || null,
      reminderDate: form.insurance.reminderDate || null,
      fileUrl: form.insurance.fileUrl.trim(),
    },
    intake: {
      complaint: form.intake.complaint.trim(),
      pickupRequested: form.intake.pickupRequested,
      pickupAddress: form.intake.pickupAddress.trim(),
      pickupDate: form.intake.pickupDate || null,
      advanceAmount: number(form.advance.amount) || number(form.intake.advanceAmount),
      advancePaymentMode: form.advance.amount ? form.advance.paymentMode : form.intake.advancePaymentMode,
    },
    service: {
      type: form.serviceType,
      priority: form.priority,
      description: form.intake.complaint.trim() || 'General service',
      estimatedDelivery: isoOrNull(form.estimatedDelivery.date, form.estimatedDelivery.time),
      specialInstructions: form.notes.trim(),
    },
    inspectionReport: form.inspectionReport
      .filter((entry) => entry.item.trim())
      .map((entry) => ({
        item: entry.item.trim(),
        condition: entry.condition,
        notes: entry.notes.trim(),
        photoUrl: entry.photoUrl || '',
      })),
    services: form.lineItems
      .filter((line) => line.name.trim())
      .map((line) => ({
        catalogId: line.catalogId,
        name: line.name.trim(),
        type: line.type,
        description: line.description || '',
        hsnSacCode: line.hsnSacCode || '',
        partNumber: line.partNumber || '',
        brand: line.brand || '',
        unit: line.unit || 'nos',
        qty: number(line.qty),
        price: number(line.price),
        // Must match what the pricing engine used, or the server would price the
        // row differently to the screen. Legacy rows fall back to "taxed".
        taxType: resolveTaxType(line),
        taxRate: number(line.taxRate),
        discountType: line.discountType || 'none',
        discountValue: number(line.discountValue),
        packageId: line.packageId,
        packageName: line.packageName,
        isPackageHeader: Boolean(line.isPackageHeader),
        coreItem: Boolean(line.coreItem),
        stockAvailable: line.stockAvailable ?? null,
        assignedMechanic: line.assignedMechanic,
        updatedBy: line.updatedBy || undefined,
      })),
    approval: {
      status: form.approval.status,
      approvedBy: form.approval.approvedBy.trim(),
      method: form.approval.method,
      reference: form.approval.reference.trim(),
      notes: form.approval.notes.trim(),
      approvedAt: form.approval.approvedAt || null,
    },
    advance: {
      amount: number(form.advance.amount) || number(form.intake.advanceAmount),
      paymentMode: form.advance.paymentMode,
      reference: form.advance.reference.trim(),
    },
    advances: form.advances.map((a) => ({
      amount: a.amount,
      paymentMode: a.paymentMode,
      reference: a.reference,
      recordedAt: a.recordedAt,
      recordedBy: a.recordedBy,
    })),
    supervisor: form.supervisor
      ? { staffId: form.supervisor.staffId, name: form.supervisor.name, assignedAt: form.supervisor.assignedAt }
      : null,
    estimatedDelivery: form.estimatedDelivery,
    financials: { grandTotal: totals.total, totalAdvancePaid: totals.advanceDeducted, balanceDue: totals.balanceDue },
    grandTotal: totals.total,
    orderSummary: {
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      advanceDeducted: totals.advanceDeducted,
      total: totals.total,
      balanceDue: totals.balanceDue,
      paymentTerms: form.orderSummary.paymentTerms.trim(),
    },
    reminders: form.reminders
      .filter((r) => r.dueDate || r.notes)
      .map((r) => ({
        type: r.type,
        dueDate: r.dueDate || null,
        channel: r.channel,
        notes: r.notes || '',
      })),
    notes: form.notes.trim(),
  };
}
