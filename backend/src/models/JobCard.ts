import mongoose from 'mongoose';

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

const vehicleInfoSchema = new mongoose.Schema(
  {
    registrationNumber: { type: String, required: true, uppercase: true, trim: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    color: { type: String, trim: true },
    fuelType: { type: String, trim: true },
    odometerReading: { type: Number, required: true },
    vin: { type: String, uppercase: true, trim: true },
  },
  { _id: false }
);

const customerInfoSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SERVICE_TYPES, default: SERVICE_TYPES[0] },
    description: { type: String, required: true, maxlength: 500 },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    createdDate: { type: Date, default: Date.now },
    estimatedDelivery: { type: Date, required: true },
    actualDelivery: { type: Date, default: null },
    specialInstructions: { type: String, trim: true },
  },
  { _id: false }
);

const insuranceSchema = new mongoose.Schema(
  {
    isClaim: { type: Boolean, default: false },
    companyName: { type: String, trim: true },
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
  },
  { _id: false }
);

const jobCardSchema = new mongoose.Schema(
  {
    jobCardNumber: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: STATUS_VALUES, default: JOB_STATUS.NEW },
    isDraft: { type: Boolean, default: false },
    vehicle: { type: vehicleInfoSchema, required: true },
    vehicleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    customer: { type: customerInfoSchema, required: true },
    service: { type: serviceSchema, required: true },
    insurance: { type: insuranceSchema, default: () => ({}) },
    corporate: { type: corporateSchema, default: () => ({}) },
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
  { timestamps: true }
);

jobCardSchema.index({ 'vehicle.registrationNumber': 1 });
jobCardSchema.index({ status: 1 });
jobCardSchema.index({ 'service.priority': 1 });
jobCardSchema.index({ 'service.estimatedDelivery': 1 });
jobCardSchema.index({ createdAt: -1 });
jobCardSchema.index({ 'advisor.advisorId': 1 });

const JobCard = mongoose.model('JobCard', jobCardSchema);
export default JobCard;