import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Estimate document.
//
// Two shapes coexist:
//   1. The legacy job-card estimate — jobCardId + items.{parts,labor,other}
//   2. The 4-step service estimate — vehicle, customer, inspection, lineItems,
//      payments and server calculated totals.
// Both share the estimateNumber / status / approvalHistory columns, so the
// existing list, approval and convert-to-invoice flows keep working.
// ---------------------------------------------------------------------------

export const ESTIMATE_STATUSES = [
  // 4-step workflow lifecycle
  'Draft',
  'Review',
  'Pending Approval',
  'Generated',
  'Sent',
  'Accepted',
  'Rejected',
  'Cancelled',
  'Expired',
  // legacy
  'Approved',
  'Converted to Invoice',
];

export const VEHICLE_TYPES = ['4W', '2W'];
export const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Other'];
export const INSPECTION_STATUSES = ['good', 'attention', 'critical', 'na'];
export const LINE_ITEM_TYPES = ['service', 'package', 'part', 'labour', 'custom'];
export const DISCOUNT_TYPES = ['percentage', 'fixed', 'none'];
export const TAX_TYPES = ['GST', 'CGST_SGST', 'IGST', 'NONE'];
export const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
export const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Driving License', 'Passport', 'Voter ID', 'Other'];
export const MEDIA_SCOPES = ['inspection', 'insurance', 'identity', 'other'];

// ---------------------------------------------------------------------------
// Legacy job-card estimate line items
// ---------------------------------------------------------------------------

const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, default: 0 },
    supplier: { type: String, trim: true },
    estimatedDelivery: { type: Date, default: null },
  },
  { _id: false }
);

const laborSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    hours: { type: Number, required: true, min: 0 },
    hourlyRate: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, default: 0 },
    technician: { type: String, trim: true },
  },
  { _id: false }
);

const otherChargeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Vehicle & customer
// ---------------------------------------------------------------------------

const vehicleSchema = new mongoose.Schema(
  {
    id: { type: String },
    type: { type: String, enum: VEHICLE_TYPES, default: '4W' },
    registrationNumber: { type: String, uppercase: true, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    variant: { type: String, trim: true, default: '' },
    year: { type: Number, default: null },
    fuelType: { type: String, enum: [...FUEL_TYPES, ''], default: '' },
    engineNumber: { type: String, trim: true, default: '' },
    chassisNumber: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    odometer: { type: Number, default: null },
    fuelMeter: { type: Number, default: null },
    evBatteryCapacity: { type: String, trim: true, default: '' },
    evChargerType: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    id: { type: String },
    name: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    alternatePhone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    gstNumber: { type: String, uppercase: true, trim: true, default: '' },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Documents & media (stored by opaque key — never served from a public path)
// ---------------------------------------------------------------------------

const mediaSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
    kind: { type: String, enum: ['photo', 'video', 'document'], default: 'photo' },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    /**
     * Storage key on disk / object storage. Resolved only through an
     * authenticated endpoint, so it is never a public URL.
     */
    storageKey: { type: String, trim: true, default: '' },
    scope: { type: String, enum: MEDIA_SCOPES, default: 'inspection' },
    itemId: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const uploadedDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    storageKey: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const insuranceSchema = new mongoose.Schema(
  {
    company: { type: String, trim: true, default: '' },
    policyNumber: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    document: { type: uploadedDocumentSchema, default: null },
  },
  { _id: false }
);

const complianceDocumentSchema = new mongoose.Schema(
  {
    expiryDate: { type: Date, default: null },
    setReminder: { type: Boolean, default: false },
  },
  { _id: false }
);

const documentsSchema = new mongoose.Schema(
  {
    rc: { type: complianceDocumentSchema, default: () => ({}) },
    puc: { type: complianceDocumentSchema, default: () => ({}) },
    license: { type: complianceDocumentSchema, default: () => ({}) },
  },
  { _id: false }
);

const identityProofSchema = new mongoose.Schema(
  {
    idType: { type: String, enum: [...ID_PROOF_TYPES, ''], default: '' },
    /**
     * Stored in full for compliance verification but only ever returned masked
     * (see toMaskedJSON) so sensitive numbers are never exposed back to clients.
     */
    idNumber: { type: String, trim: true, default: '' },
    /** Last 4 characters, safe to return. */
    idLast4: { type: String, trim: true, default: '' },
    document: { type: uploadedDocumentSchema, default: null },
  },
  { _id: false }
);

const pickupSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    address: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    preferredDate: { type: Date, default: null },
    preferredTime: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

const inspectionItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    categoryId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: INSPECTION_STATUSES, default: 'na' },
    notes: { type: String, trim: true, default: '' },
    media: { type: [mediaSchema], default: [] },
    /** Line item ids raised from this defect — keeps recommendations traceable. */
    linkedServiceIds: { type: [String], default: [] },
  },
  { _id: false }
);

const inspectionCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isCustom: { type: Boolean, default: false },
    items: { type: [inspectionItemSchema], default: [] },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

const packageContentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: LINE_ITEM_TYPES, default: 'service' },
    quantity: { type: Number, default: 1 },
    rate: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: LINE_ITEM_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    hsnSacCode: { type: String, trim: true, default: '' },
    partNumber: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    unit: { type: String, trim: true, default: 'Pcs' },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: DISCOUNT_TYPES, default: 'none' },
    discountValue: { type: Number, default: 0, min: 0 },
    taxType: { type: String, enum: TAX_TYPES, default: 'GST' },
    taxRate: { type: Number, default: 18, min: 0 },
    // Derived — always overwritten by the server side tax engine.
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    packageContents: { type: [packageContentSchema], default: [] },
    inspectionItemId: { type: String, trim: true, default: '' },
    inspectionItemName: { type: String, trim: true, default: '' },
    inspectionCategoryName: { type: String, trim: true, default: '' },
    catalogId: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: PAYMENT_MODES, default: 'Cash' },
    date: { type: Date, default: Date.now },
    reference: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    recordedBy: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const totalsSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
  },
  { _id: false }
);

const metadataSchema = new mongoose.Schema(
  {
    estimateNumber: { type: String, trim: true, default: '' },
    estimateDate: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },
    createdBy: { type: String, trim: true, default: '' },
    lastSavedAt: { type: Date, default: null },
    generatedAt: { type: Date, default: null },
    revision: { type: Number, default: 1 },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------------

const estimateSchema = new mongoose.Schema(
  {
    // Optional now: a 4-step estimate starts from a vehicle/customer, not a job card.
    jobCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', required: false, default: null },
    estimateNumber: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ESTIMATE_STATUSES, default: 'Draft' },

    // --- 4-step workflow ---
    vehicle: { type: vehicleSchema, default: () => ({}) },
    customer: { type: customerSchema, default: () => ({}) },
    insurance: { type: insuranceSchema, default: () => ({}) },
    documents: { type: documentsSchema, default: () => ({}) },
    identityProof: { type: identityProofSchema, default: () => ({}) },
    pickup: { type: pickupSchema, default: () => ({}) },
    bookingSource: { type: String, trim: true, default: 'Walk-in' },
    complaint: { type: String, trim: true, default: '' },

    inspection: { type: [inspectionCategorySchema], default: [] },
    lineItems: { type: [lineItemSchema], default: [] },
    payments: { type: [paymentSchema], default: [] },
    totals: { type: totalsSchema, default: () => ({}) },
    metadata: { type: metadataSchema, default: () => ({}) },

    // --- legacy job-card items ---
    items: {
      parts: { type: [partSchema], default: [] },
      labor: { type: [laborSchema], default: [] },
      other: { type: [otherChargeSchema], default: [] },
    },
    subtotal: { type: Number, default: 0 },
    discount: {
      type: { type: String, enum: ['Fixed', 'Percentage'], default: 'Fixed' },
      value: { type: Number, default: 0 },
      reason: { type: String, trim: true },
    },
    tax: {
      rate: { type: Number, default: 18 },
      amount: { type: Number, default: 0 },
    },
    grandTotal: { type: Number, default: 0 },
    validUntil: { type: Date, default: null },
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },

    approvalHistory: [
      {
        status: { type: String, enum: ESTIMATE_STATUSES, trim: true },
        by: { type: String, trim: true },
        at: { type: Date, default: Date.now },
        notes: { type: String, trim: true },
      },
    ],
    shareHistory: [
      {
        channel: { type: String, trim: true },
        by: { type: String, trim: true },
        at: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

estimateSchema.index({ jobCardId: 1 });
estimateSchema.index({ status: 1 });
estimateSchema.index({ createdAt: -1 });
estimateSchema.index({ 'customer.phone': 1 });
estimateSchema.index({ 'vehicle.registrationNumber': 1 });

/** Mask the identity proof before it leaves the server. */
estimateSchema.methods.toMaskedJSON = function () {
  const obj = this.toObject();
  if (obj.identityProof) {
    const num = String(obj.identityProof.idNumber || '');
    obj.identityProof = {
      ...obj.identityProof,
      idNumber: num ? `${'X'.repeat(Math.max(0, num.length - 4))}${num.slice(-4)}` : '',
    };
  }
  return obj;
};

const Estimate = mongoose.model('Estimate', estimateSchema);
export default Estimate;
