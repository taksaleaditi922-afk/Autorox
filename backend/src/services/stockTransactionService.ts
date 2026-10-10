import StockTransaction from '../models/StockTransaction.js';
import ApiError from '../utils/ApiError.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

// GET /api/stock-transactions?productId=&type=&from=&to=&page=&limit=
export const getStockTransactions = async (filters: any): Promise<any> => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 50, 200);
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};
  if (filters.productId) filter.productId = filters.productId;
  if (filters.type) filter.transactionType = filters.type;
  if (filters.from || filters.to) {
    const from = filters.from ? new Date(filters.from) : new Date(0);
    const to = filters.to ? new Date(filters.to) : new Date();
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

  return {
    success: true,
    data: data.map(row => row.toSafeJSON()),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// GET /api/stock-transactions/:productId
export const getProductTransactions = async (routeParams: any): Promise<any> => {
  const transactions = await StockTransaction.find({ productId: routeParams.productId })
    .sort('-recordedAt')
    .populate('productId', 'productCode productName');
  return { success: true, data: transactions.map(row => row.toSafeJSON()) };
};

// POST /api/stock-transactions
export const createStockTransaction = async (payload: any, actor: any): Promise<any> => {
  const { productId, transactionType, reference, notes } = payload;
  const quantity = Number(payload.quantity);
  if (!productId || !transactionType || quantity == null) {
    throw new ApiError(400, 'productId, transactionType, and quantity are required');
  }
  if (!['Inward', 'Issued', 'Purchase Return', 'Adjustment'].includes(transactionType)) {
    throw new ApiError(400, 'Unsupported stock movement type');
  }
  if (!Number.isFinite(quantity) || quantity === 0) throw new ApiError(400, 'Quantity must be a non-zero number');
  if (transactionType === 'Inward' && quantity < 0) throw new ApiError(400, 'Inward quantity must be positive');
  if (['Issued', 'Purchase Return'].includes(transactionType) && quantity > 0) throw new ApiError(400, 'Outgoing quantity must be negative');

  return mongoose.connection.transaction(async session => {
    const product = await Product.findById(productId).session(session);
    if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
    const stockBefore = product.inventory.quantity;
    const stockAfter = stockBefore + quantity;
    if (stockAfter < 0) throw new ApiError(400, 'Insufficient stock');
    product.inventory.quantity = stockAfter;
    product.lastMovementDate = new Date();
    if (transactionType === 'Inward') product.lastPurchaseDate = product.lastMovementDate;
    await product.save({ session });
    const [txn] = await StockTransaction.create([{
      productId, transactionType, quantity, reference: reference || {}, notes,
      stockBefore, stockAfter, unitCost: product.pricing.costPrice, recordedBy: actor?._id || null,
    }], { session });
    return { success: true, data: txn.toSafeJSON() };
  });
};
