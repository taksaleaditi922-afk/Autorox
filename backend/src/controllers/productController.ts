import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/productService.js';

export const getProducts = asyncHandler(async (req, res) => {
  const result = await service.getProducts(req.query);
  res.json(result);
});

export const createProduct = asyncHandler(async (req, res) => {
  const result = await service.createProduct(req.body);
  res.status(201).json(result);
});

export const getProduct = asyncHandler(async (req, res) => {
  const result = await service.getProduct(req.params);
  res.json(result);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const result = await service.updateProduct(req.params, req.body);
  res.json(result);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const result = await service.deleteProduct(req.params);
  res.json(result);
});

export const updateStock = asyncHandler(async (req, res) => {
  const result = await service.updateStock(req.params, req.body, req.user);
  res.json(result);
});

export const checkStock = asyncHandler(async (req, res) => {
  const result = await service.checkStock(req.params);
  res.json(result);
});
