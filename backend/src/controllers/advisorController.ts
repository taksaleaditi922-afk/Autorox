import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/advisorService.js';

export const getAdvisors = asyncHandler(async (req, res) => {
  const result = await service.getAdvisors(req.query);
  res.json(result);
});

export const createAdvisor = asyncHandler(async (req, res) => {
  const result = await service.createAdvisor(req.body);
  res.status(201).json(result);
});

export const getAdvisor = asyncHandler(async (req, res) => {
  const result = await service.getAdvisor(req.params);
  res.json(result);
});

export const updateAdvisor = asyncHandler(async (req, res) => {
  const result = await service.updateAdvisor(req.params, req.body);
  res.json(result);
});

export const toggleAdvisorStatus = asyncHandler(async (req, res) => {
  const result = await service.toggleAdvisorStatus(req.params, req.body);
  res.json(result);
});

export const getAdvisorWorkload = asyncHandler(async (req, res) => {
  const result = await service.getAdvisorWorkload(req.params);
  res.json(result);
});

export const getAdvisorCustomers = asyncHandler(async (req, res) => {
  const result = await service.getAdvisorCustomers(req.params);
  res.json(result);
});
