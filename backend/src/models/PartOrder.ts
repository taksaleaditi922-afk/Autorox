import mongoose from 'mongoose';
const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  partName: { type: String, required: true }, partNumber: { type: String, required: true },
  vehicleType: String, partType: String,
  quantity: { type: Number, required: true, min: 0.001 },
  unitPrice: { type: Number, required: true, min: 0 },
  hsn: String, unit: String,
  taxPercent: { type: Number, default: 0 },
  discountType: { type: String, enum: ['Percentage', 'Amount'], default: 'Percentage' },
  discountValue: { type: Number, default: 0 },
  taxAmount: Number, discountTotal: Number, totalAmount: Number,
}, { _id: false });
const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  vendorId: { type: String, default: null },
  vendorName: { type: String, default: '' }, vendorPhone: String,
  customerName: String, notes: String,
  status: { type: String, enum: ['Pending', 'Received', 'Cancelled'], default: 'Pending' },
  orderDate: { type: Date, default: Date.now }, expectedDelivery: Date, receivedDate: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bulk: { type: Boolean, default: false },
  items: { type: [itemSchema], required: true }, totalAmount: { type: Number, required: true },
  isDraft: { type: Boolean, default: false }, finalizedAt: Date,
  subtotal: Number, discountTotal: Number, taxAmount: Number,
  managePurchase: { type: Boolean, default: false }, billNumber: String, billDate: Date,
  invoice: { type: mongoose.Schema.Types.Mixed, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ status: 1, orderDate: -1 });
export default mongoose.model('PartOrder', schema);
