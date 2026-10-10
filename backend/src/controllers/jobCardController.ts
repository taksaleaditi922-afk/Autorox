import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/jobCardService.js';

export const getJobCards = asyncHandler(async (req, res) => {
  const result = await service.getJobCards(req.query);
  res.json(result);
});

export const getJobCardStats = asyncHandler(async (req, res) => {
  const result = await service.getJobCardStats();
  res.json(result);
});

export const createJobCard = asyncHandler(async (req, res) => {
  const result = await service.createJobCard(req.body, req.user);
  res.status(201).json(result);
});

export const getJobCard = asyncHandler(async (req, res) => {
  const result = await service.getJobCard(req.params);
  res.json(result);
});

export const updateJobCard = asyncHandler(async (req, res) => {
  const result = await service.updateJobCard(req.params, req.body, req.user);
  res.json(result);
});

export const deleteJobCard = asyncHandler(async (req, res) => {
  const result = await service.deleteJobCard(req.params, req.query, req.user);
  res.json(result);
});

export const updateJobCardStatus = asyncHandler(async (req, res) => {
  const result = await service.updateJobCardStatus(req.params, req.body, req.user);
  res.json(result);
});

export const assignAdvisor = asyncHandler(async (req, res) => {
  const result = await service.assignAdvisor(req.params, req.body, req.user);
  res.json(result);
});

export const recordAdvance = asyncHandler(async (req, res) => {
  const result = await service.recordAdvance(req.params, req.body, req.user);
  res.json(result);
});

export const shareApproval = asyncHandler(async (req, res) => {
  const result = await service.shareApproval(req.params, req.body, req.user);
  res.json(result);
});

export const updateApproval = asyncHandler(async (req, res) => {
  const result = await service.updateApproval(req.params, req.body, req.user);
  res.json(result);
});
