import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/analyticsService.js';

export const dashboard = asyncHandler(async (req, res) => {
  const result = await service.dashboard(req.query);
  res.json(result);
});

export const statusDistribution = asyncHandler(async (req, res) => {
  const result = await service.statusDistribution();
  res.json(result);
});

export const serviceTypeDistribution = asyncHandler(async (req, res) => {
  const result = await service.serviceTypeDistribution();
  res.json(result);
});

export const advisorPerformance = asyncHandler(async (req, res) => {
  const result = await service.advisorPerformance();
  res.json(result);
});
