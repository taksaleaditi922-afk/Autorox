import mongoose from 'mongoose';

const pricingSchema = new mongoose.Schema(
  {
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 18, min: 0 },
    purchaseTaxType: { type: String, enum: ['NONE', 'GST', 'IGST'] },
    purchaseTaxPercent: { type: Number, min: 0, max: 100 },
    purchaseDiscountAmount: { type: Number, min: 0 },
    saleTaxType: { type: String, enum: ['NONE', 'GST', 'IGST'] },
    saleTaxPercent: { type: Number, min: 0, max: 100 },
    saleDiscountAmount: { type: Number, min: 0 },
  },
  { _id: false }
);

const inventorySchema = new mongoose.Schema(
  {
    quantity: { type: Number, default: 0, min: 0 },
    minimumLevel: { type: Number, default: 5, min: 0 },
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
    brand: { type: String, trim: true },
    hsn: { type: String, trim: true },
    barcode: { type: String, trim: true, default: undefined },
    vehicleType: { type: String, enum: ['2W', '4W'], default: undefined },
    category: { type: String, trim: true },
    subCategory: { type: String, trim: true },
    partType: { type: String, enum: ['OEM', 'Aftermarket', 'Other'], default: 'Other' },
    remark: { type: String, trim: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, trim: true },
    description: { type: String, trim: true },
    pricing: { type: pricingSchema, default: () => ({}) },
    inventory: { type: inventorySchema, default: () => ({}) },
    supplier: { type: supplierSchema, default: () => ({}) },
    images: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);


productSchema.index({ productName: 'text', description: 'text' });
productSchema.index({ 'inventory.quantity': 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ vehicleType: 1, partType: 1 });
productSchema.index({ deletedAt: 1 });

productSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    productCode: this.productCode,
    productName: this.productName,
    brand: this.brand,
    hsn: this.hsn,
    barcode: this.barcode,
    vehicleType: this.vehicleType,
    category: this.category,
    subCategory: this.subCategory,
    partType: this.partType,
    remark: this.remark,
    employeeId: this.employeeId,
    employeeName: this.employeeName,
    description: this.description,
    pricing: this.pricing,
    inventory: this.inventory,
    supplier: this.supplier,
    images: this.images,
    isActive: this.isActive,
    deletedAt: this.deletedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Product = mongoose.model('Product', productSchema);
export default Product;
