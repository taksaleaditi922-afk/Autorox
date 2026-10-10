import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/stockTransactionService.js';

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
