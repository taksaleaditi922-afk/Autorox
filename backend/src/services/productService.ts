import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import mongoose from 'mongoose';
import StockTransaction from '../models/StockTransaction.js';

// GET /api/products?q=&category=&inStock=&page=&limit=&sort=&fields=
export const getProducts = async (filters: any): Promise<any> => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = { isActive: true, deletedAt: null };
  if (filters.q) {
    filter.$or = [
      { productName: { $regex: filters.q.trim(), $options: 'i' } },
      { productCode: { $regex: filters.q.trim(), $options: 'i' } },
      { brand: { $regex: filters.q.trim(), $options: 'i' } },
      { barcode: { $regex: filters.q.trim(), $options: 'i' } },
      { description: { $regex: filters.q.trim(), $options: 'i' } },
    ];
  }
  if (filters.category) {
    filter.category = filters.category;
  }
  if (filters.inStock === 'true') {
    filter['inventory.quantity'] = { $gt: 0 };
  }
  if (filters.minStock !== undefined) {
    filter['inventory.quantity'] = { ...filter['inventory.quantity'], $gte: parseInt(filters.minStock, 10) };
  }

  const sortField = filters.sort || 'productName';
  const sort: Record<string, 1 | -1> = { [sortField]: filters.order === 'desc' ? -1 : 1 };

  const fields = filters.fields || 'productCode productName brand hsn barcode vehicleType category subCategory partType remark pricing inventory supplier createdAt';
  const [data, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).select(fields),
    Product.countDocuments(filter),
  ]);

  return {
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// POST /api/products
export const createProduct = async (payload: any): Promise<any> => {
  const {
    productCode, productName, brand, hsn, barcode, vehicleType, category, subCategory,
    partType, remark, description, pricing, inventory, supplier, images, employeeId, employeeName,
  } = payload;
  if (!productCode || !productName) {
    throw new ApiError(400, 'Product code and product name are required');
  }
  if (pricing?.sellingPrice != null && pricing.sellingPrice < 0) {
    throw new ApiError(400, 'Selling price cannot be negative');
  }
  const product = new Product({
    productCode,
    productName,
    brand,
    hsn,
    barcode,
    vehicleType,
    category,
    subCategory,
    partType,
    remark,
    description,
    pricing: pricing || {},
    inventory: inventory || {},
    supplier: supplier || {},
    images: images || [],
    employeeId,
    employeeName,
  });
  await product.save();
  return { success: true, data: product.toSafeJSON() };
};

// GET /api/products/:id
export const getProduct = async (routeParams: any): Promise<any> => {
  const product = await Product.findById(routeParams.id);
  if (!product) throw new ApiError(404, 'Product not found');
  return { success: true, data: product.toSafeJSON() };
};

// PUT /api/products/:id
export const updateProduct = async (routeParams: any, payload: any): Promise<any> => {
  const product = await Product.findById(routeParams.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const b = payload;
  if (b.productCode && b.productCode !== product.productCode) {
    const dup = await Product.findOne({ productCode: b.productCode, _id: { $ne: product._id } });
    if (dup) throw new ApiError(409, 'Product code already exists');
  }
  if (b.productCode) product.productCode = b.productCode;
  if (b.productName) product.productName = b.productName;
  if (b.brand != null) product.brand = b.brand;
  if (b.hsn != null) product.hsn = b.hsn;
  if (b.barcode != null) product.barcode = b.barcode;
  if (b.vehicleType != null) product.vehicleType = b.vehicleType;
  if (b.category != null) product.category = b.category;
  if (b.subCategory != null) product.subCategory = b.subCategory;
  if (b.partType != null) product.partType = b.partType;
  if (b.remark != null) product.remark = b.remark;
  if (b.employeeId != null) product.employeeId = b.employeeId;
  if (b.employeeName != null) product.employeeName = b.employeeName;
  if (b.description != null) product.description = b.description;
  if (b.pricing) Object.assign(product.pricing, b.pricing);
  if (b.inventory) Object.assign(product.inventory, b.inventory);
  if (b.supplier) Object.assign(product.supplier, b.supplier);
  if (b.images) product.images = b.images;
  if (b.isActive != null) product.isActive = b.isActive;
  await product.save();
  return { success: true, data: product.toSafeJSON() };
};

// DELETE /api/products/:id
export const deleteProduct = async (routeParams: any): Promise<any> => {
  const product = await Product.findById(routeParams.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.inventory.quantity > 0) {
    throw new ApiError(400, 'Cannot delete a product with remaining stock. Adjust inventory first.');
  }
  await product.deleteOne();
  return { success: true, message: 'Product deleted' };
};

// PATCH /api/products/:id/stock
export const updateStock = async (routeParams: any, payload: any, actor: any): Promise<any> => mongoose.connection.transaction(async session => {
  const product = await Product.findById(routeParams.id).session(session);
  if (!product) throw new ApiError(404, 'Product not found');
  const { quantity, minimumLevel, location, unit, notes } = payload;
  for (const [field, value] of Object.entries({ quantity, minimumLevel })) {
    if (value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new ApiError(400, `${field} must be a non-negative number`);
  }
  const stockBefore = product.inventory.quantity;
  if (quantity != null) product.inventory.quantity = quantity;
  if (minimumLevel != null) product.inventory.minimumLevel = minimumLevel;
  if (location != null) product.inventory.location = location;
  if (unit != null) product.inventory.unit = unit;
  if (quantity != null && Number(quantity) !== stockBefore) {
    product.lastMovementDate = new Date();
    await StockTransaction.create([{
      productId: product._id, transactionType: 'Adjustment', quantity: Number(quantity) - stockBefore,
      stockBefore, stockAfter: Number(quantity), notes, recordedBy: actor?._id || null,
      unitCost: product.pricing.costPrice,
    }], { session });
  }
  await product.save({ session });
  return {
    success: true,
    data: product.toSafeJSON(),
    change: { stockBefore, stockAfter: product.inventory.quantity },
    notes,
  };
});

// GET /api/products/check-stock/:id
// Returns available stock and product info for selling
export const checkStock = async (routeParams: any): Promise<any> => {
  const product = await Product.findById(routeParams.id);
  if (!product) throw new ApiError(404, 'Product not found');
  return {
    success: true,
    data: {
      id: product._id,
      productCode: product.productCode,
      productName: product.productName,
      sellingPrice: product.pricing?.sellingPrice || 0,
      tax: product.pricing?.tax || 18,
      availableQuantity: product.inventory.quantity,
      unit: product.inventory.unit || 'Units',
    },
  };
};
