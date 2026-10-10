import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/documentService.js';

export const uploadDocument = asyncHandler(async (req, res) => {
  const result = await service.uploadDocument(req.params, req.body, req.user, req.file);
  res.status(201).json(result);
});

export const getDocuments = asyncHandler(async (req, res) => {
  const result = await service.getDocuments(req.params);
  res.json(result);
});

export const getDocumentFile = asyncHandler(async (req, res) => {
  const file = await service.getDocumentFile(req.params);
  res.type(file.mimeType || 'application/octet-stream');
  res.sendFile(file.absolutePath);
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const result = await service.deleteDocument(req.params);
  res.json(result);
});

export const printJobCard = asyncHandler(async (req, res) => {
  const result = await service.printJobCard(req.params);
  res.json(result);
});
