import mongoose from 'mongoose';

// Purchase orders are independent records; stock changes are recorded when goods arrive.
const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  vendorName: { type: String, required: true, trim: true },
  vendorPhone: String,
  orderDate: { type: Date, default: Date.now },
  expectedDelivery: Date,
  status: { type: String, enum: ['Pending', 'In Transit', 'Partial', 'Delivered', 'Cancelled'], default: 'Pending' },
  itemsCount: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  notes: String,
}, { timestamps: true });

export default mongoose.model('PurchaseOrder', schema);
