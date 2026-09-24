import mongoose from 'mongoose';
import { APPROVAL_STATUSES, LINE_DISCOUNT_TYPES, LINE_TAX_TYPES, LINE_UNITS } from '../utils/jobCardMath.js';

export const JOB_STATUS = Object.freeze({
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  PENDING_PARTS: 'Pending Parts',
  PENDING_APPROVAL: 'Pending Approval',
  READY: 'Ready for Delivery',
  DELIVERED: 'Delivered',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
});

export const STATUS_VALUES = Object.values(JOB_STATUS);

export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const SERVICE_TYPES = [
  'Maintenance',
  'Repair',
  'Paint',
  'Inspection',
  'Alignment',
  'Diagnostics',
  'Detailing',
  'Other',
];
export const DOCUMENT_TYPES = [
  'Invoice',
  'Image',
  'Insurance',
  'Receipt',
  'Approval',
  'Service Record',
  'Other',
];

export const VEHICLE_TYPES = ['4W', '2W'];
export const CUSTOMER_TYPES = ['Individual', 'Company'];
export const BOOKING_SOURCES = ['Walk-in', 'Referral', 'Online', 'N/A'];
export const PAYMENT_STATUSES = ['Paid', 'Partially Paid', 'Pending', 'Overdue'];
export const INSPECTION_CONDITIONS = ['Good', 'Average', 'Needs Attention', 'Not Applicable'];
export const LINE_ITEM_TYPES = ['service', 'package', 'part', 'labour', 'custom'];
export const REMINDER_TYPES = ['Next Service', 'Insurance Renewal', 'Feedback Request', 'Custom'];
export const REMINDER_CHANNELS = ['SMS', 'WhatsApp', 'Email'];
// 'Link' is recorded when the customer signs off through the public approval link.
export const APPROVAL_METHODS = ['Signature', 'OTP', 'Verbal', 'WhatsApp', 'Link'];
export const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

// The billing fields on a line item are shared with the pricing engine
// (utils/jobCardMath.ts) so the stored values can never drift from the math.
export const LINE_ITEM_TAX_TYPES = [...LINE_TAX_TYPES];
export const LINE_ITEM_DISCOUNT_TYPES = [...LINE_DISCOUNT_TYPES];
export const LINE_ITEM_UNITS = [...LINE_UNITS];
export const APPROVAL_STATUS_VALUES = [...APPROVAL_STATUSES];

const vehicleInfoSchema = new mongoose.Schema(
  {
    type: { type: String, enum: VEHICLE_TYPES, default: '4W' },
    registrationNumber: { type: String, required: true, uppercase: true, trim: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    year: { type: Number },
    color: { type: String, trim: true },
    fuelType: { type: String, trim: true },
    odometerReading: { type: Number, required: true },
    fuelMeter: { type: Number, min: 0, max: 100 },
    chassisNumber: { type: String, uppercase: true, trim: true },
    engineNumber: { type: String, uppercase: true, trim: true },
    // Kept for backwards compatibility with records created before chassisNumber.
    vin: { type: String, uppercase: true, trim: true },
  },
  { _id: false }
);

const customerInfoSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    type: { type: String, enum: CUSTOMER_TYPES, default: 'Individual' },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, uppercase: true, trim: true },
    idProofNumber: { type: String, trim: true },
    idProofUrl: { type: String, trim: true },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SERVICE_TYPES, default: SERVICE_TYPES[0] },
    description: { type: String, maxlength: 500, default: '' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    createdDate: { type: Date, default: Date.now },
    estimatedDelivery: { type: Date, default: Date.now },
    actualDelivery: { type: Date, default: null },
    specialInstructions: { type: String, trim: true },
  },
  { _id: false }
);

const insuranceSchema = new mongoose.Schema(
  {
    isClaim: { type: Boolean, default: false },
    companyName: { type: String, trim: true },
    policyNumber: { type: String, trim: true },
    expiryDate: { type: Date, default: null },
    reminderDate: { type: Date, default: null },
    fileUrl: { type: String, trim: true },
    claimNumber: { type: String, trim: true },
    accidentDate: { type: Date, default: null },
    accidentDescription: { type: String, trim: true },
  },
  { _id: false }
);

const corporateSchema = new mongoose.Schema(
  {
    isCorporate: { type: Boolean, default: false },
    name: { type: String, trim: true },
  },
  { _id: false }
);

const intakeSchema = new mongoose.Schema(
  {
    complaint: { type: String, trim: true },
    pickupRequested: { type: Boolean, default: false },
    pickupAddress: { type: String, trim: true },
    pickupDate: { type: Date, default: null },
    advanceAmount: { type: Number, default: 0, min: 0 },
    advancePaymentMode: { type: String, enum: PAYMENT_MODES, default: 'Cash' },
  },
  { _id: false }
);

const inspectionEntrySchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true },
    condition: { type: String, enum: INSPECTION_CONDITIONS, default: 'Good' },
    notes: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
    inspectedBy: { type: String, trim: true },
    inspectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One billable row on the service list. Only the inputs are stored — subtotal,
// discount/tax amounts and total are derived by utils/jobCardMath.ts and kept
// here so a job card can be reprinted exactly as it was approved.
const staffAssignmentSchema = new mongoose.Schema({ staffId: String, name: String, assignedAt: Date }, { _id: false });

const serviceLineSchema = new mongoose.Schema(
  {
    assignedMechanic: { type: staffAssignmentSchema, default: null },
    catalogId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: LINE_ITEM_TYPES, default: 'service' },
    description: { type: String, trim: true },
    hsnSacCode: { type: String, uppercase: true, trim: true },
    partNumber: { type: String, trim: true },
    brand: { type: String, trim: true },
    unit: { type: String, enum: LINE_ITEM_UNITS, default: 'nos' },
    qty: { type: Number, default: 1, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    taxType: { type: String, enum: LINE_ITEM_TAX_TYPES, default: 'None' },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    discountType: { type: String, enum: LINE_ITEM_DISCOUNT_TYPES, default: 'none' },
    discountValue: { type: Number, default: 0, min: 0 },

    // Derived (recalculated on every write).
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // Package expansion — a package header keeps its components, and a component
    // remembers the package it came from so removing one can be flagged.
    packageId: { type: String, trim: true },
    packageName: { type: String, trim: true },
    isPackageHeader: { type: Boolean, default: false },
    coreItem: { type: Boolean, default: false },

    // Stock snapshot captured when the item was added, used for the over-quantity warning.
    stockAvailable: { type: Number, default: null },

    // Audit trail for the row.
    updatedBy: { type: String, trim: true },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const approvalHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    by: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    channel: { type: String, trim: true },
  },
  { _id: false }
);

const approvalSchema = new mongoose.Schema(
  {
    /** not_sent | awaiting | approved | changes_requested | skipped */
    status: { type: String, enum: APPROVAL_STATUS_VALUES, default: 'not_sent' },
    approvedBy: { type: String, trim: true },
    approvedAt: { type: Date, default: null },
    method: { type: String, enum: APPROVAL_METHODS, default: 'Verbal' },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
    /** When the itemised list was last sent to the customer. */
    sharedAt: { type: Date, default: null },
    generatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    revision: { type: String },
    /** Channels the list was sent on, e.g. ['WhatsApp','SMS']. */
    channels: { type: [String], default: [] },
    /** When the customer responded through the public link. */
    respondedAt: { type: Date, default: null },
    /** The customer's comment when they request changes. */
    response: { type: String, trim: true },
    /** Opaque token behind the read-only customer link. */
    token: { type: String, trim: true, index: true },
    history: { type: [approvalHistorySchema], default: [] },
  },
  { _id: false }
);

// A partial payment recorded against the order (deposit / advance).
const advanceSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    paymentMode: { type: String, enum: PAYMENT_MODES, default: 'Cash' },
    reference: { type: String, trim: true },
    recordedAt: { type: Date, default: null },
    recordedBy: { type: String, trim: true },
  },
  { _id: false }
);

const orderSummarySchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0 },
    lineDiscount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    advanceDeducted: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentTerms: { type: String, trim: true },
  },
  { _id: false }
);

const reminderSchema = new mongoose.Schema(
  {
    type: { type: String, enum: REMINDER_TYPES, default: 'Next Service' },
    dueDate: { type: Date, default: null },
    channel: { type: String, enum: REMINDER_CHANNELS, default: 'SMS' },
    notes: { type: String, trim: true },
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
  },
  { _id: false }
);

const gatePassSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true },
    createdAt: { type: Date, default: null },
    url: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    requestedAt: { type: Date, default: null },
    givenAt: { type: Date, default: null },
    rating: { type: Number, min: 0, max: 5 },
    comment: { type: String, trim: true },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true },
    status: { type: String, trim: true, default: 'Draft' },
    url: { type: String, trim: true },
    issuedAt: { type: Date, default: null },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_VALUES, required: true },
    changedBy: { type: String, trim: true, default: 'System' },
    changedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: DOCUMENT_TYPES, default: 'Other' },
  uploadedBy: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now },
  filePath: { type: String, required: true, trim: true },
  mimeType: { type: String, trim: true },
  size: { type: Number, default: 0 },
});

const auditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true },
    by: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    /** Free text detail, e.g. the line item that changed. */
    details: { type: String, trim: true },
  },
  { _id: false }
);

const jobCardSchema = new mongoose.Schema(
  {
    jobCardNumber: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: STATUS_VALUES, default: JOB_STATUS.NEW },
    isDraft: { type: Boolean, default: false },
    source: { type: String, enum: BOOKING_SOURCES, default: 'Walk-in' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    vehicle: { type: vehicleInfoSchema, required: true },
    vehicleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    customer: { type: customerInfoSchema, required: true },
    service: { type: serviceSchema, required: true },
    insurance: { type: insuranceSchema, default: () => ({}) },
    corporate: { type: corporateSchema, default: () => ({}) },
    intake: { type: intakeSchema, default: () => ({}) },
    inspectionReport: { type: [inspectionEntrySchema], default: [] },
    services: { type: [serviceLineSchema], default: [] },
    approval: { type: approvalSchema, default: () => ({}) },
    orderSummary: { type: orderSummarySchema, default: () => ({}) },
    /** Final payable amount across the service list (mirror of orderSummary.total). */
    grandTotal: { type: Number, default: 0 },
    supervisor: { type: staffAssignmentSchema, default: null },
    advances: { type: [advanceSchema], default: [] },
    estimatedDelivery: { date: String, time: String, lastUpdatedBy: String, notifiedCustomer: Boolean, notifyCustomerRequested: Boolean },
    financials: { grandTotal: Number, totalAdvancePaid: Number, balanceDue: Number },
    advance: { type: advanceSchema, default: () => ({}) },
    reminders: { type: [reminderSchema], default: [] },
    gatePass: { type: gatePassSchema, default: () => ({}) },
    feedback: { type: feedbackSchema, default: () => ({}) },
    invoice: { type: invoiceSchema, default: () => ({}) },
    advisor: {
      advisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advisor', default: null },
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    statusHistory: [statusHistorySchema],
    estimate: {
      estimateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estimate', default: null },
      status: { type: String, trim: true },
      totalAmount: { type: Number, default: 0 },
    },
    documents: [documentSchema],
    notes: { type: String, trim: true },
    audit: [auditEntrySchema],
    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

jobCardSchema.index({ 'vehicle.registrationNumber': 1 });
jobCardSchema.index({ 'vehicle.chassisNumber': 1 });
jobCardSchema.index({ status: 1 });
jobCardSchema.index({ paymentStatus: 1 });
jobCardSchema.index({ 'service.priority': 1 });
jobCardSchema.index({ 'service.estimatedDelivery': 1 });
jobCardSchema.index({ createdAt: -1 });
jobCardSchema.index({ 'advisor.advisorId': 1 });

const JobCard = mongoose.model('JobCard', jobCardSchema);
export default JobCard;
