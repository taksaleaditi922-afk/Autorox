import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/vehicleService.js';

export const getVehicles = asyncHandler(async (req, res) => {
  const result = await service.getVehicles(req.query);
  res.json(result);
});

export const createVehicle = asyncHandler(async (req, res) => {
  const result = await service.createVehicle(req.body);
  res.status(201).json(result);
});

export const lookupVehicleByReg = asyncHandler(async (req, res) => {
  const result = await service.lookupVehicleByReg(req.params);
  res.json(result);
});

export const getVehicleByReg = asyncHandler(async (req, res) => {
  const result = await service.getVehicleByReg(req.params);
  res.json(result);
});

export const getVehicle = asyncHandler(async (req, res) => {
  const result = await service.getVehicle(req.params);
  res.json(result);
});

export const updateVehicle = asyncHandler(async (req, res) => {
  const result = await service.updateVehicle(req.params, req.body);
  res.json(result);
});
