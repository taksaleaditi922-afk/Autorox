import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/inventoryService.js';

export const getInventory = asyncHandler(async (req, res) => res.json(await service.getInventory(req.query)));
export const getStats = asyncHandler(async (_req, res) => res.json(await service.getStats()));
export const getInsights = asyncHandler(async (_req, res) => res.json(await service.getInsights()));
export const getAlerts = asyncHandler(async (_req, res) => res.json(await service.getAlerts()));
export const getOrders = asyncHandler(async (req, res) => res.json(await service.getOrders(req.query)));
export const getInward = asyncHandler(async (req, res) => res.json(await service.getMovementRecords('Inward', req.query)));
export const getIssued = asyncHandler(async (req, res) => res.json(await service.getMovementRecords('Issued', req.query)));
export const getReturns = asyncHandler(async (req, res) => res.json(await service.getMovementRecords('Purchase Return', req.query)));
