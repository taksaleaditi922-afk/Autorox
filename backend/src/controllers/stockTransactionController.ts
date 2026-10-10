import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/stockTransactionService.js';
import { addStock, reduceStock } from '../services/stockService.js';

export const getStockTransactions = asyncHandler(async (req, res) => {
  const result = await service.getStockTransactions(req.query);
  res.json(result);
});

export const getProductTransactions = asyncHandler(async (req, res) => {
  const result = await service.getProductTransactions(req.params);
  res.json(result);
});

export const createStockTransaction = asyncHandler(async (req, res) => {
  const result = await service.createStockTransaction(req.body, req.user);
  res.status(201).json(result);
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
  res.status(201).json({
    success: true,
    data: result.product.toSafeJSON(),
    movement: result.movement.toSafeJSON(),
  });
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
  res.status(201).json({
    success: true,
    data: result.product.toSafeJSON(),
    movement: result.movement.toSafeJSON(),
  });
});
