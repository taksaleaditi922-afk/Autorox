import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/settingsService.js';

export const getSettings = asyncHandler(async (req, res) => {
  const result = await service.getSettings();
  res.json(result);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const result = await service.updateSettings(req.body);
  res.json(result);
});

export const getServiceTypes = asyncHandler(async (req, res) => {
  const result = await service.getServiceTypes();
  res.json(result);
});

export const createServiceType = asyncHandler(async (req, res) => {
  const result = await service.createServiceType(req.body);
  res.status(201).json(result);
});

export const deleteServiceType = asyncHandler(async (req, res) => {
  const result = await service.deleteServiceType(req.params);
  res.json(result);
});
