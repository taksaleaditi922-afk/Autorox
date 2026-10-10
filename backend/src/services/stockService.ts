import mongoose from 'mongoose';
import Product from '../models/Product.js';
import StockTransaction from '../models/StockTransaction.js';
import ApiError from '../utils/ApiError.js';

export const STOCK_CHANGE_TYPES = Object.freeze({
  ADD: 'ADD',
  REDUCE: 'REDUCE',
});

const activeProduct = (productId) => ({
  _id: productId,
  isActive: true,
  deletedAt: null,
});

const transactionUnavailable = (error) => /Transaction numbers are only allowed|replica set|mongos/i.test(String(error?.message || error));

export const runMongoTransaction = async (work) => {
  const session = await mongoose.startSession();
  let result;
  try {
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
    } catch (error) {
      if (!transactionUnavailable(error)) throw error;
      result = await work(null);
    }
    return result;
  } finally {
    await session.endSession();
  }
};

const consumeOldestStock = async (productId, quantity, session) => {
  let remaining = quantity;
  const lots = await StockTransaction.find({
    productId,
    quantity: { $gt: 0 },
    remainingQuantity: { $gt: 0 },
  }).sort({ createdAt: 1 }).session(session);

  for (const lot of lots) {
    if (remaining <= 0) break;
    const used = Math.min(lot.remainingQuantity, remaining);
    lot.remainingQuantity -= used;
    remaining -= used;
    await lot.save({ session });
  }
};

export const applyStockChangeInSession = async (input, session) => {
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, 'Quantity must be greater than zero');
  }
  if (!mongoose.isValidObjectId(input.productId)) {
    throw new ApiError(400, 'Invalid product id');
  }

  const isReduce = input.changeType === STOCK_CHANGE_TYPES.REDUCE;
  const query = activeProduct(input.productId);
  if (isReduce) query['inventory.quantity'] = { $gte: quantity };

  const update: Record<string, Record<string, number>> = {
    $inc: { 'inventory.quantity': isReduce ? -quantity : quantity },
  };
  if (!isReduce && input.unitPrice != null) {
    const price = Number(input.unitPrice);
    if (!Number.isFinite(price) || price < 0) throw new ApiError(400, 'Purchase price cannot be negative');
    update.$set = { 'pricing.costPrice': price };
  }

  // Returning the pre-update document gives an exact balance even when two
  // requests arrive together. The conditional reduce prevents stock < 0.
  const before = await Product.findOneAndUpdate(query, update, {
    new: false,
    runValidators: true,
    session,
  });

  if (!before) {
    const existsQuery = Product.findOne(activeProduct(input.productId));
    const exists = session ? await existsQuery.session(session) : await existsQuery;
    if (!exists) throw new ApiError(404, 'Product not found');
    throw new ApiError(400, `Reduction exceeds available stock of ${exists.inventory?.quantity ?? 0}`);
  }

  const stockBefore = Number(before.inventory?.quantity || 0);
  const stockAfter = stockBefore + (isReduce ? -quantity : quantity);
  if (isReduce) await consumeOldestStock(before._id, quantity, session);

  let movement;
  try {
    [movement] = await StockTransaction.create([{
    productId: before._id,
    transactionType: input.transactionType || (isReduce ? 'Reduce' : 'Add'),
    quantity: isReduce ? -quantity : quantity,
    reference: input.reference || {},
    stockBefore,
    stockAfter,
    unitPrice: input.unitPrice != null ? Number(input.unitPrice) : before.pricing?.costPrice ?? null,
    reason: input.reason || '',
    notes: input.note || input.notes || '',
    remainingQuantity: isReduce ? 0 : quantity,
    recordedBy: input.employeeId || null,
    }], session ? { session } : undefined);
  } catch (error) {
    if (!session) {
      await Product.updateOne(
        { _id: before._id },
        { $inc: { 'inventory.quantity': isReduce ? quantity : -quantity } },
      );
    }
    throw error;
  }

  before.inventory.quantity = stockAfter;
  if (!isReduce && input.unitPrice != null) before.pricing.costPrice = Number(input.unitPrice);
  return { product: before, movement };
};

export const applyStockChange = async (
  input: any,
  options: { session?: mongoose.ClientSession | null } = {},
) => {
  if (Object.prototype.hasOwnProperty.call(options, 'session')) return applyStockChangeInSession(input, options.session);
  return runMongoTransaction((session) => applyStockChangeInSession(input, session));
};

export const addStock = (input, options = {}) => applyStockChange({
  ...input,
  changeType: STOCK_CHANGE_TYPES.ADD,
}, options);

export const reduceStock = (input, options = {}) => applyStockChange({
  ...input,
  changeType: STOCK_CHANGE_TYPES.REDUCE,
}, options);

export default { addStock, reduceStock, applyStockChange, applyStockChangeInSession };
