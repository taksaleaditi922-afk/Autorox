import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/products?q=&category=&inStock=&page=&limit=&sort=&fields=
export const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  if (req.query.q) {
    filter.$or = [
      { productName: { $regex: req.query.q.trim(), $options: 'i' } },
      { productCode: { $regex: req.query.q.trim(), $options: 'i' } },
      { description: { $regex: req.query.q.trim(), $options: 'i' } },
    ];
  }
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.inStock === 'true') {
    filter['inventory.quantity'] = { $gt: 0 };
  }
  if (req.query.minStock !== undefined) {
    filter['inventory.quantity'] = { ...filter['inventory.quantity'], $gte: parseInt(req.query.minStock, 10) };
  }

  const sortField = req.query.sort || 'productName';
  const sort = { [sortField]: req.query.order === 'desc' ? -1 : 1 };

  const fields = req.query.fields || 'productCode productName category pricing inventory supplier createdAt';
  const [data, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).select(fields),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /api/products
export const createProduct = asyncHandler(async (req, res) => {
  const { productCode, productName, category, description, pricing, inventory, supplier, images } = req.body;
  if (!productCode || !productName) {
    throw new ApiError(400, 'Product code and product name are required');
  }
  if (pricing?.sellingPrice != null && pricing.sellingPrice < 0) {
    throw new ApiError(400, 'Selling price cannot be negative');
  }
  const product = new Product({
    productCode,
    productName,
    category,
    description,
    pricing: pricing || {},
    inventory: inventory || {},
    supplier: supplier || {},
    images: images || [],
  });
  await product.save();
  res.status(201).json({ success: true, data: product.toSafeJSON() });
});

// GET /api/products/:id
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: product.toSafeJSON() });
});

// PUT /api/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const b = req.body;
  if (b.productCode && b.productCode !== product.productCode) {
    const dup = await Product.findOne({ productCode: b.productCode, _id: { $ne: product._id } });
    if (dup) throw new ApiError(409, 'Product code already exists');
  }
  if (b.productCode) product.productCode = b.productCode;
  if (b.productName) product.productName = b.productName;
  if (b.category != null) product.category = b.category;
  if (b.description != null) product.description = b.description;
  if (b.pricing) Object.assign(product.pricing, b.pricing);
  if (b.inventory) Object.assign(product.inventory, b.inventory);
  if (b.supplier) Object.assign(product.supplier, b.supplier);
  if (b.images) product.images = b.images;
  if (b.isActive != null) product.isActive = b.isActive;
  await product.save();
  res.json({ success: true, data: product.toSafeJSON() });
});

// DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.inventory.quantity > 0) {
    throw new ApiError(400, 'Cannot delete a product with remaining stock. Adjust inventory first.');
  }
  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});

// PATCH /api/products/:id/stock
export const updateStock = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const { quantity, minimumLevel, location, unit, notes } = req.body;
  if (quantity != null && quantity < 0) {
    throw new ApiError(400, 'Quantity cannot be negative');
  }
  const stockBefore = product.inventory.quantity;
  if (quantity != null) product.inventory.quantity = quantity;
  if (minimumLevel != null) product.inventory.minimumLevel = minimumLevel;
  if (location != null) product.inventory.location = location;
  if (unit != null) product.inventory.unit = unit;
  await product.save();
  res.json({
    success: true,
    data: product.toSafeJSON(),
    change: { stockBefore, stockAfter: product.inventory.quantity },
    notes,
  });
});

// GET /api/products/check-stock/:id
// Returns available stock and product info for selling
export const checkStock = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({
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
  });
});
