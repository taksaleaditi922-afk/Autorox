import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/publicApprovalService.js';

export const getPublicApproval = asyncHandler(async (req, res) => {
  const result = await service.getPublicApproval(req.params);
  res.set('Cache-Control', 'no-store');
  res.json(result);
});

export const respondPublicApproval = asyncHandler(async (req, res) => {
  const result = await service.respondPublicApproval(req.params, req.body);
  res.set('Cache-Control', 'no-store');
  res.json(result);
});
