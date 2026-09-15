import JobCard, { DOCUMENT_TYPES } from '../models/JobCard.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// POST /api/jobcards/:id/documents  (multipart: file, type metadata)
export const uploadDocument = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  if (!req.file) throw new ApiError(400, 'No file uploaded');

  const type = req.body?.type;
  const docType = DOCUMENT_TYPES.includes(type) ? type : 'Other';

  const doc = {
    name: req.file.originalname,
    type: docType,
    uploadedBy: req.user?.email || 'System',
    uploadedAt: new Date(),
    filePath: req.file.path,
    mimeType: req.file.mimetype,
    size: req.file.size,
  };
  jobCard.documents = jobCard.documents || [];
  jobCard.documents.push(doc);
  await jobCard.save();
  res.status(201).json({ success: true, data: doc });
});

// GET /api/jobcards/:id/documents
export const getDocuments = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  res.json({ success: true, data: jobCard.documents || [] });
});

// DELETE /api/jobcards/:id/documents/:docId
export const deleteDocument = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  jobCard.documents = (jobCard.documents || []).filter(
    (d) => d._id.toString() !== req.params.docId
  );
  await jobCard.save();
  res.json({ success: true, message: 'Document removed' });
});

// POST /api/jobcards/:id/print — returns printable job card (used with browser print)
export const printJobCard = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  res.json({ success: true, data: jobCard });
});