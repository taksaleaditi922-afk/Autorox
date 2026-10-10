import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/estimateService.js';

export const createEstimate = asyncHandler(async (req, res) => {
  const result = await service.createEstimate(req.body, req.user);
  res.status(201).json(result);
});

export const getEstimates = asyncHandler(async (req, res) => {
  const result = await service.getEstimates(req.query);
  res.json(result);
});

export const getEstimate = asyncHandler(async (req, res) => {
  const result = await service.getEstimate(req.params);
  res.json(result);
});

export const updateEstimate = asyncHandler(async (req, res) => {
  const result = await service.updateEstimate(req.params, req.body);
  res.json(result);
});

export const approveEstimate = asyncHandler(async (req, res) => {
  const result = await service.approveEstimate(req.params, req.user);
  res.json(result);
});

export const rejectEstimate = asyncHandler(async (req, res) => {
  const result = await service.rejectEstimate(req.params, req.user);
  res.json(result);
});

export const sendEstimateEmail = asyncHandler(async (req, res) => {
  const result = await service.sendEstimateEmail(req.params);
  res.json(result);
});

export const convertToInvoice = asyncHandler(async (req, res) => {
  const result = await service.convertToInvoice(req.params, req.user);
  res.json(result);
});
