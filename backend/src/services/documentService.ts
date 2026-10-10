import JobCard, { DOCUMENT_TYPES } from '../models/JobCard.js';
import ApiError from '../utils/ApiError.js';
import fs from 'node:fs';
import path from 'node:path';

// POST /api/jobcards/:id/documents  (multipart: file, type metadata)
export const uploadDocument = async (routeParams: any, payload: any, actor: any, uploadedFile: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  if (!uploadedFile) throw new ApiError(400, 'No file uploaded');

  const type = payload?.type;
  const docType = DOCUMENT_TYPES.includes(type) ? type : 'Other';

  const doc = {
    name: uploadedFile.originalname,
    type: docType,
    uploadedBy: actor?.email || 'System',
    uploadedAt: new Date(),
    filePath: uploadedFile.path,
    mimeType: uploadedFile.mimetype,
    size: uploadedFile.size,
  };
  jobCard.documents.push(doc);
  await jobCard.save();
  return { success: true, data: doc };
};

// GET /api/jobcards/:id/documents
export const getDocuments = async (routeParams: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  return { success: true, data: jobCard.documents || [] };
};

export const getDocumentFile = async (routeParams: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  const document = jobCard.documents?.id(routeParams.docId);
  if (!document) throw new ApiError(404, 'Document not found');
  const absolutePath = path.resolve(document.filePath);
  if (!fs.existsSync(absolutePath)) throw new ApiError(404, 'Stored file not found');
  return { absolutePath, mimeType: document.mimeType };
};

// DELETE /api/jobcards/:id/documents/:docId
export const deleteDocument = async (routeParams: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  jobCard.set('documents', (jobCard.documents || []).filter(
    (d) => d._id.toString() !== routeParams.docId
  ));
  await jobCard.save();
  return { success: true, message: 'Document removed' };
};

// POST /api/jobcards/:id/print — returns printable job card (used with browser print)
export const printJobCard = async (routeParams: any): Promise<any> => {
  const jobCard = await JobCard.findById(routeParams.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  return { success: true, data: jobCard };
};