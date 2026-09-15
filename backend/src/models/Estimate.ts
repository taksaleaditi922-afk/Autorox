import mongoose from 'mongoose';
import { DOCUMENT_TYPES, SERVICE_TYPES } from './JobCard.js';

export const ESTIMATE_STATUSES = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Rejected',
  'Converted to Invoice',
];

const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
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

const estimateSchema = new mongoose.Schema(
  {
    jobCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', required: true },
    estimateNumber: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ESTIMATE_STATUSES, default: 'Draft' },
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
    createdBy: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

estimateSchema.index({ jobCardId: 1 });
estimateSchema.index({ status: 1 });

const Estimate = mongoose.model('Estimate', estimateSchema);
export default Estimate;