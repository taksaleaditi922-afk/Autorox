import StockTransaction from '../models/StockTransaction.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { addStock, reduceStock } from '../services/stockService.js';

// GET /api/stock-transactions?productId=&type=&from=&to=&page=&limit=
export const getStockTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.productId) filter.productId = req.query.productId;
  if (req.query.type) filter.transactionType = req.query.type;
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(req.query.from) : new Date(0);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    if (req.query.to) to.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: from, $lte: to };
  }

  const [data, total] = await Promise.all([
    StockTransaction.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('productId', 'productCode productName')
      .populate('recordedBy', 'username email'),
    StockTransaction.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: data.map((transaction) => transaction.toSafeJSON()),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/stock-transactions/:productId
export const getProductTransactions = asyncHandler(async (req, res) => {
  const transactions = await StockTransaction.find({ productId: req.params.productId })
    .sort('-createdAt')
    .populate('productId', 'productCode productName')
    .populate('recordedBy', 'username email');
  res.json({ success: true, data: transactions.map((transaction) => transaction.toSafeJSON()) });
});

// POST /api/stock-transactions
export const createStockTransaction = asyncHandler(async (req, res) => {
  const { productId, transactionType, quantity, reference, notes, reason, unitPrice } = req.body;
  if (!productId || !transactionType || quantity == null) {
    throw new ApiError(400, 'productId, transactionType, and quantity are required');
  }
  const action = Number(quantity) < 0 ? reduceStock : addStock;
  const result = await action({
    productId,
    transactionType,
    quantity: Math.abs(Number(quantity)),
    reference,
    notes,
    reason,
    unitPrice,
    employeeId: req.user?._id || null,
  });
  res.status(201).json({
    success: true,
    data: result.movement.toSafeJSON(),
    product: result.product.toSafeJSON(),
  });
});

export const addProductStock = asyncHandler(async (req, res) => {
  const result = await addStock({
    productId: req.params.productId,
    quantity: req.body.quantity,
    unitPrice: req.body.purchasePrice,
    note: req.body.note,
    reason: req.body.reason || 'purchase',
    transactionType: req.body.transactionType || 'Add',
    reference: req.body.reference,
    employeeId: req.user?._id || null,
  });
  res.status(201).json({ success: true, data: result.product.toSafeJSON(), movement: result.movement.toSafeJSON() });
});

export const reduceProductStock = asyncHandler(async (req, res) => {
  const result = await reduceStock({
    productId: req.params.productId,
    quantity: req.body.quantity,
    note: req.body.note,
    reason: req.body.reason,
    transactionType: req.body.transactionType || 'Reduce',
    reference: req.body.reference,
    employeeId: req.user?._id || null,
  });
  res.status(201).json({ success: true, data: result.product.toSafeJSON(), movement: result.movement.toSafeJSON() });
});
