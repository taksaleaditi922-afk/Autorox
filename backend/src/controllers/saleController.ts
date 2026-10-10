import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/saleService.js';

export const getSales = asyncHandler(async (req, res) => {
  const result = await service.getSales(req.query);
  res.json(result);
});

export const createSale = asyncHandler(async (req, res) => {
  const result = await service.createSale(req.body, req.user);
  res.status(201).json(result);
});

export const getSale = asyncHandler(async (req, res) => {
  const result = await service.getSale(req.params);
  res.json(result);
});

export const updateSale = asyncHandler(async (req, res) => {
  const result = await service.updateSale(req.params, req.body, req.user);
  res.json(result);
});

export const deleteSale = asyncHandler(async (req, res) => {
  const result = await service.deleteSale(req.params, req.user);
  res.json(result);
});

export const updateSaleStatus = asyncHandler(async (req, res) => {
  const result = await service.updateSaleStatus(req.params, req.body, req.user);
  res.json(result);
});

export const recordPayment = asyncHandler(async (req, res) => {
  const result = await service.recordPayment(req.params, req.body, req.user);
  res.json(result);
});

export const getPaymentHistory = asyncHandler(async (req, res) => {
  const result = await service.getPaymentHistory(req.params);
  res.json(result);
});

export const getInvoice = asyncHandler(async (req, res) => {
  const result = await service.getInvoice(req.params);
  res.json(result);
});
