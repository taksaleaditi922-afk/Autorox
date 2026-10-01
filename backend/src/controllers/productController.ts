import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import Settings from '../models/Settings.js';
import { addStock, reduceStock, runMongoTransaction } from '../services/stockService.js';
import StockTransaction from '../models/StockTransaction.js';

const SORT_FIELDS = {
  productCode: 'productCode',
  productName: 'productName',
  category: 'category',
  vehicleType: 'vehicleType',
  partType: 'partType',
  'inventory.quantity': 'inventory.quantity',
  'inventory.minimumLevel': 'inventory.minimumLevel',
  'inventory.location': 'inventory.location',
  'pricing.costPrice': 'pricing.costPrice',
  'pricing.sellingPrice': 'pricing.sellingPrice',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const presentProduct = (product) => product.toSafeJSON ? product.toSafeJSON() : {
  ...product,
  id: product._id,
};

const addAgeData = async (products) => {
  if (!products.length) return [];
  const ids = products.map((product) => product._id);
  const ages = await StockTransaction.aggregate([
    { $match: { productId: { $in: ids }, quantity: { $gt: 0 } } },
    {
      $group: {
        _id: '$productId',
        firstStockInDate: { $min: '$createdAt' },
        oldestRemainingStockDate: {
          $min: { $cond: [{ $gt: ['$remainingQuantity', 0] }, '$createdAt', null] },
        },
      },
    },
  ]);
  const ageMap = new Map(ages.map((age) => [String(age._id), age]));
  return products.map((product) => {
    const data = presentProduct(product);
    const age = ageMap.get(String(product._id));
    return {
      ...data,
      firstStockInDate: age?.firstStockInDate || product.createdAt,
      oldestRemainingStockDate: age?.oldestRemainingStockDate || (product.inventory?.quantity > 0 ? product.createdAt : null),
    };
  });
};

// GET /api/products?q=&category=&inStock=&page=&limit=&sort=&fields=
export const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const settings = await Settings.getSingleton();
  const defaultThreshold = settings.inventory?.lowStockThreshold ?? 5;
  const filter = { isActive: true, deletedAt: null };
  if (req.query.q) {
    filter.$or = [
      { productName: { $regex: req.query.q.trim(), $options: 'i' } },
      { productCode: { $regex: req.query.q.trim(), $options: 'i' } },
      { barcode: { $regex: req.query.q.trim(), $options: 'i' } },
    ];
  }
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.subCategory) filter.subCategory = req.query.subCategory;
  if (req.query.vehicleType) filter.vehicleType = req.query.vehicleType;
  if (req.query.partType) filter.partType = req.query.partType;
  if (req.query.location) filter['inventory.location'] = req.query.location;
  if (req.query.inStock === 'true') {
    filter['inventory.quantity'] = { $gt: 0 };
  }
  if (req.query.outOfStock === 'true' || req.query.stockStatus === 'out-of-stock') {
    filter['inventory.quantity'] = 0;
  }
  if (req.query.stockStatus === 'in-stock') {
    filter['inventory.quantity'] = { $gt: 0 };
  }
  if (req.query.reorderLevel === 'true' || req.query.stockStatus === 'low-stock') {
    filter.$expr = {
      $and: [
        { $gt: [{ $ifNull: ['$inventory.quantity', 0] }, 0] },
        {
          $lte: [
            { $ifNull: ['$inventory.quantity', 0] },
            { $ifNull: ['$inventory.minimumLevel', defaultThreshold] },
          ],
        },
      ],
    };
  }
  if (req.query.minStock !== undefined) {
    filter['inventory.quantity'] = { ...filter['inventory.quantity'], $gte: parseInt(req.query.minStock, 10) };
  }
  if (req.query.maxStock !== undefined) {
    filter['inventory.quantity'] = { ...filter['inventory.quantity'], $lte: parseInt(req.query.maxStock, 10) };
  }
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    filter['pricing.costPrice'] = {};
    if (req.query.minPrice !== undefined) filter['pricing.costPrice'].$gte = Number(req.query.minPrice);
    if (req.query.maxPrice !== undefined) filter['pricing.costPrice'].$lte = Number(req.query.maxPrice);
  }

  const sortField = SORT_FIELDS[req.query.sort] || 'productName';
  const sort = { [sortField]: req.query.order === 'desc' ? -1 : 1 };

  const [data, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: await addAgeData(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /api/products
export const createProduct = asyncHandler(async (req, res) => {
  const {
    productCode, partNumber, productName, barcode, vehicleType, category, subCategory,
    partType, remark, description, pricing, inventory, supplier, images,
  } = req.body;
  const resolvedCode = String(productCode || partNumber || '').trim();
  if (!resolvedCode || !productName) {
    throw new ApiError(400, 'Product code and product name are required');
  }
  if (pricing?.sellingPrice != null && pricing.sellingPrice < 0) {
    throw new ApiError(400, 'Selling price cannot be negative');
  }
  if (pricing?.costPrice != null && pricing.costPrice < 0) {
    throw new ApiError(400, 'Purchase price cannot be negative');
  }
  const duplicateQuery = [{ productCode: resolvedCode }];
  if (barcode?.trim()) duplicateQuery.push({ barcode: barcode.trim() });
  const duplicate = await Product.findOne({ $or: duplicateQuery });
  if (duplicate?.productCode === resolvedCode) throw new ApiError(409, 'Part number already exists');
  if (barcode?.trim() && duplicate?.barcode === barcode.trim()) throw new ApiError(409, 'Barcode already exists');

  const openingQuantity = Number(inventory?.quantity || 0);
  const product = new Product({
    productCode: resolvedCode,
    productName,
    barcode: barcode?.trim() || undefined,
    vehicleType,
    category,
    subCategory,
    partType,
    remark,
    description,
    pricing: pricing || {},
    inventory: { ...(inventory || {}), quantity: 0 },
    supplier: supplier || {},
    images: images || [],
    employeeId: req.user?._id || null,
    employeeName: req.user?.username || req.user?.email || 'User',
  });
  await runMongoTransaction(async (session) => {
      await product.save(session ? { session } : undefined);
      if (openingQuantity > 0) {
        await addStock({
          productId: product._id,
          quantity: openingQuantity,
          unitPrice: pricing?.costPrice || 0,
          transactionType: 'Opening',
          reason: 'opening',
          note: 'Opening stock',
          employeeId: req.user?._id || null,
        }, { session });
      }
  });
  const created = await Product.findById(product._id);
  res.status(201).json({ success: true, data: (await addAgeData([created]))[0] });
});

// GET /api/products/:id
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, deletedAt: null });
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: (await addAgeData([product]))[0] });
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
  if (b.barcode?.trim() && b.barcode.trim() !== product.barcode) {
    const duplicateBarcode = await Product.findOne({ barcode: b.barcode.trim(), _id: { $ne: product._id }, deletedAt: null });
    if (duplicateBarcode) throw new ApiError(409, 'Barcode already exists');
  }
  if (b.productCode) product.productCode = b.productCode;
  if (b.productName) product.productName = b.productName;
  if (b.barcode !== undefined) product.barcode = b.barcode?.trim() || undefined;
  if (b.vehicleType !== undefined) product.vehicleType = b.vehicleType;
  if (b.category != null) product.category = b.category;
  if (b.subCategory != null) product.subCategory = b.subCategory;
  if (b.partType != null) product.partType = b.partType;
  if (b.remark != null) product.remark = b.remark;
  if (b.description != null) product.description = b.description;
  if (b.pricing) Object.assign(product.pricing, b.pricing);
  if (b.inventory) {
    const { quantity: _ignoredQuantity, ...inventoryDetails } = b.inventory;
    Object.assign(product.inventory, inventoryDetails);
  }
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
  product.deletedAt = new Date();
  product.isActive = false;
  await product.save();
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
  if (quantity != null && quantity !== stockBefore) {
    const change = {
      productId: product._id,
      quantity: Math.abs(Number(quantity) - stockBefore),
      transactionType: 'Adjustment',
      reason: 'correction',
      note: notes || 'Stock quantity corrected through legacy endpoint',
      employeeId: req.user?._id || null,
    };
    if (Number(quantity) > stockBefore) await addStock(change);
    else await reduceStock(change);
  }
  if (minimumLevel != null) product.inventory.minimumLevel = minimumLevel;
  if (location != null) product.inventory.location = location;
  if (unit != null) product.inventory.unit = unit;
  await product.save();
  const updated = await Product.findById(product._id);
  res.json({
    success: true,
    data: updated.toSafeJSON(),
    change: { stockBefore, stockAfter: updated.inventory.quantity },
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
