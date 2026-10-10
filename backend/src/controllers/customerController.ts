import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/customerService.js';

export const getCustomers = asyncHandler(async (req, res) => {
  const result = await service.getCustomers(req.query);
  res.json(result);
});

export const createCustomer = asyncHandler(async (req, res) => {
  const result = await service.createCustomer(req.body);
  res.status(201).json(result);
});

export const getCustomer = asyncHandler(async (req, res) => {
  const result = await service.getCustomer(req.params);
  res.json(result);
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const result = await service.updateCustomer(req.params, req.body);
  res.json(result);
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const result = await service.deleteCustomer(req.params);
  res.json(result);
});

export const getCustomerVehicles = asyncHandler(async (req, res) => {
  const result = await service.getCustomerVehicles(req.params);
  res.json(result);
});

export const getCustomerJobCards = asyncHandler(async (req, res) => {
  const result = await service.getCustomerJobCards(req.params);
  res.json(result);
});

export const assignAdvisor = asyncHandler(async (req, res) => {
  const result = await service.assignAdvisor(req.params, req.body);
  res.json(result);
});
