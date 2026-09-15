import StockTransaction from '../models/StockTransaction.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

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
    filter.recordedAt = { $gte: from, $lte: to };
  }

  const [data, total] = await Promise.all([
    StockTransaction.find(filter)
      .sort('-recordedAt')
      .skip(skip)
      .limit(limit)
      .populate('productId', 'productCode productName'),
    StockTransaction.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/stock-transactions/:productId
export const getProductTransactions = asyncHandler(async (req, res) => {
  const transactions = await StockTransaction.find({ productId: req.params.productId })
    .sort('-recordedAt')
    .populate('productId', 'productCode productName');
  res.json({ success: true, data: transactions });
});

// POST /api/stock-transactions
export const createStockTransaction = asyncHandler(async (req, res) => {
  const { productId, transactionType, quantity, reference, notes } = req.body;
  if (!productId || !transactionType || quantity == null) {
    throw new ApiError(400, 'productId, transactionType, and quantity are required');
  }
  const txn = new StockTransaction({
    productId,
    transactionType,
    quantity,
    reference: reference || {},
    notes,
    recordedBy: req.user?._id || null,
  });
  await txn.save();
  res.status(201).json({ success: true, data: txn.toSafeJSON() });
});
