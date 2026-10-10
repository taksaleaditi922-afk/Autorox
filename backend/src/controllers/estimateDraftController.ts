import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/estimateDraftService.js';

export const getEstimateConfig = asyncHandler(async (req, res) => {
  const result = await service.getEstimateConfig();
  res.json(result);
});

export const getNextEstimateNumber = asyncHandler(async (req, res) => {
  const result = await service.getNextEstimateNumber();
  res.json(result);
});

export const getCatalogServices = asyncHandler(async (req, res) => {
  const result = await service.getCatalogServices(req.query);
  res.json(result);
});

export const getCatalogPackages = asyncHandler(async (req, res) => {
  const result = await service.getCatalogPackages(req.query);
  res.json(result);
});

export const getCatalogParts = asyncHandler(async (req, res) => {
  const result = await service.getCatalogParts(req.query);
  res.json(result);
});

export const getCatalogLabour = asyncHandler(async (req, res) => {
  const result = await service.getCatalogLabour(req.query);
  res.json(result);
});

export const getInspectionTemplate = asyncHandler(async (req, res) => {
  const result = await service.getInspectionTemplate();
  res.json(result);
});

export const createInspectionCategory = asyncHandler(async (req, res) => {
  const result = await service.createInspectionCategory(req.body);
  res.status(201).json(result);
});

export const createDraft = asyncHandler(async (req, res) => {
  const result = await service.createDraft(req.body, req.user);
  res.status(201).json(result);
});

export const updateDraft = asyncHandler(async (req, res) => {
  const result = await service.updateDraft(req.params, req.body);
  res.json(result);
});

export const deleteEstimate = asyncHandler(async (req, res) => {
  const result = await service.deleteEstimate(req.params);
  res.json(result);
});

export const generateEstimate = asyncHandler(async (req, res) => {
  const result = await service.generateEstimate(req.params, req.body, req.user);
  res.json(result);
});

export const getPayments = asyncHandler(async (req, res) => {
  const result = await service.getPayments(req.params);
  res.json(result);
});

export const addPayment = asyncHandler(async (req, res) => {
  const result = await service.addPayment(req.params, req.body, req.user);
  res.status(201).json(result);
});

export const deletePayment = asyncHandler(async (req, res) => {
  const result = await service.deletePayment(req.params);
  res.json(result);
});

export const uploadEstimateMedia = asyncHandler(async (req, res) => {
  const result = await service.uploadEstimateMedia(req.params, req.body, req.user, req.file);
  res.status(201).json(result);
});

export const downloadEstimateMedia = asyncHandler(async (req, res) => {
  const result = await service.downloadEstimateMedia(req.params, req.user);
  res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(result.name)}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(result.absolute);
});

export const deleteEstimateMedia = asyncHandler(async (req, res) => {
  const result = await service.deleteEstimateMedia(req.params);
  res.json(result);
});

export const renderEstimatePdf = asyncHandler(async (req, res) => {
  const result = await service.renderEstimatePdf(req.params);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(result);
});

export const shareEstimate = asyncHandler(async (req, res) => {
  const result = await service.shareEstimate(req.params, req.body, req.user);
  res.json(result);
});
