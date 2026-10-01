import mongoose from 'mongoose';

const referenceSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true },
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    number: { type: String, trim: true },
  },
  { _id: false }
);

const stockTransactionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    transactionType: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    reference: { type: referenceSchema, default: () => ({}) },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    unitPrice: { type: Number, default: null, min: 0 },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },
    remainingQuantity: { type: Number, default: 0, min: 0 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ productId: 1, createdAt: -1 });
stockTransactionSchema.index({ transactionType: 1 });
stockTransactionSchema.index({ 'reference.number': 1 });

stockTransactionSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    productId: this.productId,
    transactionType: this.transactionType,
    quantity: this.quantity,
    reference: this.reference,
    stockBefore: this.stockBefore,
    stockAfter: this.stockAfter,
    unitPrice: this.unitPrice,
    reason: this.reason,
    notes: this.notes,
    remainingQuantity: this.remainingQuantity,
    recordedBy: this.recordedBy,
    recordedAt: this.createdAt,
    createdAt: this.createdAt,
  };
};

const StockTransaction = mongoose.model('StockTransaction', stockTransactionSchema);
export default StockTransaction;
