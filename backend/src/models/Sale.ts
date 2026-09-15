import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productCode: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 18, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const advisorSchema = new mongoose.Schema(
  {
    advisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advisor', default: null },
    name: { type: String, trim: true },
  },
  { _id: false }
);

const billingSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ['Percentage', 'Fixed'], default: 'Fixed' },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    afterDiscount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 18, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const paymentEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, trim: true },
    paidBy: { type: String, trim: true },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Invoice', 'Pending', 'Paid', 'Cancelled'],
      default: 'Invoice',
    },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    method: { type: String, trim: true },
    transactionId: { type: String, trim: true },
    paidDate: { type: Date, default: null },
    paymentHistory: { type: [paymentEntrySchema], default: [] },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    billNumber: { type: String, required: true, unique: true, trim: true },
    billDate: { type: Date, default: Date.now },
    customer: { type: customerSchema, required: true },
    advisor: { type: advisorSchema, default: () => ({}) },
    items: { type: [itemSchema], default: [] },
    billing: { type: billingSchema, default: () => ({}) },
    payment: { type: paymentSchema, default: () => ({}) },
    jobCardLinked: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', default: null },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);


saleSchema.index({ 'customer.name': 'text', 'customer.phone': 'text' });
saleSchema.index({ 'payment.status': 1 });
saleSchema.index({ billDate: -1 });
saleSchema.index({ 'advisor.advisorId': 1 });
saleSchema.index({ jobCardLinked: 1 });

saleSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    billNumber: this.billNumber,
    billDate: this.billDate,
    customer: this.customer,
    advisor: this.advisor,
    items: this.items,
    billing: this.billing,
    payment: this.payment,
    jobCardLinked: this.jobCardLinked,
    notes: this.notes,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const SALE_STATUSES = Object.freeze(['Invoice', 'Pending', 'Paid', 'Cancelled']);

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
export { SALE_STATUSES };
