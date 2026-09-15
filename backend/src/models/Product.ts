import mongoose from 'mongoose';

const pricingSchema = new mongoose.Schema(
  {
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 18, min: 0 },
  },
  { _id: false }
);

const inventorySchema = new mongoose.Schema(
  {
    quantity: { type: Number, default: 0, min: 0 },
    minimumLevel: { type: Number, default: 0, min: 0 },
    unit: { type: String, trim: true, default: 'Units' },
    location: { type: String, trim: true },
  },
  { _id: false }
);

const supplierSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    supplierName: { type: String, trim: true },
    supplierPhone: { type: String, trim: true },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    productCode: { type: String, required: true, trim: true, unique: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    pricing: { type: pricingSchema, default: () => ({}) },
    inventory: { type: inventorySchema, default: () => ({}) },
    supplier: { type: supplierSchema, default: () => ({}) },
    images: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);


productSchema.index({ productName: 'text', description: 'text' });
productSchema.index({ 'inventory.quantity': 1 });
productSchema.index({ category: 1, isActive: 1 });

productSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    productCode: this.productCode,
    productName: this.productName,
    category: this.category,
    description: this.description,
    pricing: this.pricing,
    inventory: this.inventory,
    supplier: this.supplier,
    images: this.images,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Product = mongoose.model('Product', productSchema);
export default Product;
