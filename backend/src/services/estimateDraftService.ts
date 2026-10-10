// ---------------------------------------------------------------------------
// 4-step estimate workflow controller.
//
// Every write path re-runs the tax engine and re-derives all totals. Values sent
// by the client are only ever treated as inputs.
// ---------------------------------------------------------------------------

import path from 'path';
import fs from 'fs';

import Estimate from '../models/Estimate.js';
import { getEstimateBusinessConfig, DEFAULT_ESTIMATE_CONFIG } from '../config/estimateConfig.js';
import {
  BOOKING_SOURCES,
  INSPECTION_TEMPLATE,
  LABOUR_CATALOG,
  PACKAGE_CATALOG,
  PART_CATALOG,
  SERVICE_CATALOG,
  TAX_RATES,
  UNITS,
} from '../data/estimateCatalog.js';
import { uploadDir } from '../middleware/upload.js';
import { computeEstimateTotals, calculateLineItems, maxAllowedAdvance, roundMoney } from '../utils/estimateMath.js';
import {
  peekNextEstimateNumber,
  withEstimateNumber,
} from '../utils/estimateNumbering.js';
import {
  sanitizeCustomer,
  sanitizeDocuments,
  sanitizeIdentityProof,
  sanitizeInsurance,
  sanitizeInspection,
  sanitizeLineItems,
  sanitizeMetadata,
  sanitizePayments,
  sanitizePickup,
  sanitizeVehicle,
} from '../utils/estimatePayload.js';
import { buildEstimateDocument } from './estimateDocument.js';
import ApiError from '../utils/ApiError.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recalculate a document in place. The only producer of money values. */
function applyTotals(doc: any, config: any): void {
  const taxConfig = { supplyType: config.supplyType };
  const plainItems = (doc.lineItems || []).map((item: any) =>
    typeof item?.toObject === 'function' ? item.toObject() : item
  );
  doc.lineItems = calculateLineItems(plainItems, taxConfig) as any;
  doc.totals = computeEstimateTotals(doc.lineItems, doc.payments || [], config, taxConfig);

  // Mirror onto the legacy columns so older screens keep showing real numbers.
  doc.subtotal = doc.totals.subtotal;
  doc.grandTotal = doc.totals.grandTotal;
  if (!doc.tax) doc.tax = { rate: config.defaultTaxRate, amount: 0 };
  doc.tax.amount = doc.totals.taxTotal;
  doc.validUntil = doc.metadata?.validUntil || doc.validUntil || null;
}

/** Never return the store path or a raw identity number to a client. */
function forResponse(doc: any) {
  const obj = typeof doc.toMaskedJSON === 'function' ? doc.toMaskedJSON() : doc.toObject();
  obj.id = String(obj._id);
  for (const item of obj.lineItems || []) {
    delete item.storageKey;
  }
  // Files are streamed through an authenticated route; `url` is deliberately
  // left empty so no component can accidentally hotlink the raw storage path.
  for (const category of obj.inspection || []) {
    for (const item of category.items || []) {
      for (const media of item.media || []) {
        media.downloadUrl = `/api/estimates/${obj._id}/media/${media.id}`;
      }
    }
  }
  if (obj.insurance?.document) {
    delete obj.insurance.document.storageKey;
    obj.insurance.document.downloadUrl = `/api/estimates/${obj._id}/media/${obj.insurance.document.id}`;
  }
  if (obj.identityProof?.document) {
    delete obj.identityProof.document.storageKey;
    obj.identityProof.document.downloadUrl = `/api/estimates/${obj._id}/media/${obj.identityProof.document.id}`;
  }
  return obj;
}

/** Build the workflow sections of an estimate from a request body. */
function buildWorkflowFields(body: any, existing: any = null) {
  const fields: Record<string, any> = {};
  if (body.vehicle !== undefined) fields.vehicle = sanitizeVehicle(body.vehicle);
  if (body.customer !== undefined) fields.customer = sanitizeCustomer(body.customer);
  if (body.insurance !== undefined) fields.insurance = sanitizeInsurance(body.insurance);
  if (body.documents !== undefined) fields.documents = sanitizeDocuments(body.documents);
  if (body.identityProof !== undefined) {
    fields.identityProof = sanitizeIdentityProof(body.identityProof, existing?.identityProof);
  }
  if (body.pickup !== undefined) fields.pickup = sanitizePickup(body.pickup);
  if (body.bookingSource !== undefined) {
    fields.bookingSource = BOOKING_SOURCES.includes(body.bookingSource) ? body.bookingSource : 'Other';
  }
  if (body.complaint !== undefined) fields.complaint = String(body.complaint).slice(0, 4000);
  if (body.notes !== undefined) fields.notes = String(body.notes).slice(0, 4000);
  if (body.terms !== undefined) fields.terms = String(body.terms).slice(0, 4000);
  const inspection = sanitizeInspection(body.inspection);
  if (inspection) fields.inspection = inspection;
  const lineItems = sanitizeLineItems(body.lineItems);
  if (lineItems) fields.lineItems = lineItems;
  const payments = sanitizePayments(body.payments);
  if (payments) fields.payments = payments;
  return fields;
}

/** Server-side validation gate before an estimate number is locked in. */
function assertGeneratable(doc: any): string[] {
  const messages: string[] = [];

  if (!doc.customer?.name?.trim()) messages.push('Customer name is required');
  if (!doc.customer?.phone?.trim()) messages.push('Customer phone number is required');
  if (!doc.vehicle?.registrationNumber?.trim()) messages.push('Vehicle registration number is required');
  if (!doc.lineItems?.length) messages.push('At least one service, part or labour item must be added');

  (doc.lineItems || []).forEach((item: any, index: number) => {
    if (!(Number(item.quantity) > 0)) messages.push(`Item ${index + 1} (${item.name}) must have a quantity greater than zero`);
    if (Number(item.rate) < 0) messages.push(`Item ${index + 1} (${item.name}) cannot have a negative rate`);
    if (Number(item.discountAmount) > Number(item.subtotal) + 0.001) {
      messages.push(`Item ${index + 1} (${item.name}) discount exceeds the line amount`);
    }
    if (Number(item.taxRate) < 0) messages.push(`Item ${index + 1} (${item.name}) has an invalid tax rate`);
  });

  const totals = doc.totals || {};
  if (Number(totals.grandTotal) < 0) messages.push('Estimate total cannot be negative');
  if (Number(totals.discountTotal) > Number(totals.subtotal) + 0.001) {
    messages.push('Total discount cannot exceed the subtotal');
  }

  const config = DEFAULT_ESTIMATE_CONFIG;
  const cap = maxAllowedAdvance(Number(totals.grandTotal) || 0, config);
  if (Number.isFinite(cap) && Number(totals.advancePaid) > cap + 0.001) {
    messages.push('Advance paid exceeds the maximum allowed for this estimate');
  }

  return messages;
}

function paginate<T>(items: T[], page: number, limit: number) {
  const safeLimit = Math.max(1, Math.min(limit || 10, 100));
  const safePage = Math.max(1, page || 1);
  const start = (safePage - 1) * safeLimit;
  return {
    data: items.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / safeLimit)),
    },
  };
}

// ---------------------------------------------------------------------------
// Configuration & catalog
// ---------------------------------------------------------------------------

export const getEstimateConfig = async (): Promise<any> => {
  const config = await getEstimateBusinessConfig();
  return {
    success: true,
    data: {
      ...config,
      bookingSources: BOOKING_SOURCES,
      units: UNITS,
      taxRates: TAX_RATES,
    },
  };
};

export const getNextEstimateNumber = async (): Promise<any> => {
  const config = await getEstimateBusinessConfig();
  const estimateNumber = await peekNextEstimateNumber(config.estimatePrefix, new Date().getFullYear());
  return { success: true, data: { estimateNumber } };
};

function catalogSearch<T>(
  items: T[],
  query: any,
  textOf: (item: T) => string,
  priceOf: (item: T) => number,
  filters: ((item: T) => boolean)[] = []
) {
  const q = String(query.q || '').trim().toLowerCase();
  const minPrice = query.minPrice === undefined || query.minPrice === '' ? null : Number(query.minPrice);
  const maxPrice = query.maxPrice === undefined || query.maxPrice === '' ? null : Number(query.maxPrice);

  const filtered = items.filter((item) => {
    if (q && !textOf(item).toLowerCase().includes(q)) return false;
    if (query.category && !textOf(item).toLowerCase().includes(String(query.category).toLowerCase())) return false;
    const price = priceOf(item);
    if (minPrice !== null && Number.isFinite(minPrice) && price < minPrice) return false;
    if (maxPrice !== null && Number.isFinite(maxPrice) && price > maxPrice) return false;
    return filters.every((fn) => fn(item));
  });

  return paginate(filtered, Number(query.page) || 1, Number(query.limit) || 10);
}

export const getCatalogServices = async (filters: any): Promise<any> => {
  const result = catalogSearch(
    SERVICE_CATALOG,
    filters,
    (s) => `${s.name} ${s.category} ${s.description || ''} ${s.hsnSacCode || ''}`,
    (s) => s.rate
  );
  return { success: true, ...result };
};

export const getCatalogPackages = async (filters: any): Promise<any> => {
  const result = catalogSearch(
    PACKAGE_CATALOG,
    filters,
    (p) => `${p.name} ${p.description || ''}`,
    (p) => p.price
  );
  return { success: true, ...result };
};

export const getCatalogParts = async (filters: any): Promise<any> => {
  const result = catalogSearch(
    PART_CATALOG,
    filters,
    (p) => `${p.name} ${p.partNumber} ${p.brand} ${p.category || ''} ${p.hsnCode}`,
    (p) => p.rate,
    [filters.brand ? (p: any) => p.brand === filters.brand : () => true]
  );
  return { success: true, ...result };
};

export const getCatalogLabour = async (filters: any): Promise<any> => {
  const result = catalogSearch(
    LABOUR_CATALOG,
    filters,
    (l) => `${l.description} ${l.sacCode}`,
    (l) => l.rate
  );
  return { success: true, ...result };
};

export const getInspectionTemplate = async (): Promise<any> => {
  return { success: true, data: INSPECTION_TEMPLATE };
};

/**
 * Custom inspection categories belong to the estimate being built, so this
 * endpoint validates and echoes them back for the client to attach. Persisting
 * a workshop-wide template is a separate, configuration-level concern.
 */
export const createInspectionCategory = async (payload: any): Promise<any> => {
  const name = String(payload?.name || '').trim();
  if (!name) throw new ApiError(400, 'Category name is required');
  const items = Array.isArray(payload?.items) ? payload.items.map((i: unknown) => String(i)) : [];
  return {
    success: true,
    data: {
      id: `cat-custom-${Date.now().toString(36)}`,
      name,
      description: String(payload?.description || ''),
      sortOrder: Number(payload?.sortOrder) || 99,
      isActive: payload?.isActive !== false,
      isCustom: true,
      items,
    },
  };
};

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

export const createDraft = async (payload: any, actor: any): Promise<any> => {
  const config = await getEstimateBusinessConfig();
  const body = payload || {};

  const estimate = await withEstimateNumber(
    async (estimateNumber) => {
      const doc = new Estimate({
        jobCardId: body.jobCardId || null,
        estimateNumber,
        status: 'Draft',
        ...buildWorkflowFields(body),
        metadata: {
          estimateNumber,
          estimateDate: new Date(),
          validUntil: new Date(Date.now() + config.validUntilDays * 86400000),
          createdBy: actor?.email || 'System',
          revision: 1,
        },
        createdBy: actor?.email || 'System',
        approvalHistory: [{ status: 'Draft', by: actor?.email || 'System', at: new Date() }],
      });
      applyTotals(doc, config);
      await doc.save();
      return doc;
    },
    { prefix: config.estimatePrefix }
  );

  return { success: true, data: forResponse(estimate) };
};

export const updateDraft = async (routeParams: any, payload: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (['Converted to Invoice', 'Accepted', 'Cancelled'].includes(estimate.status)) {
    throw new ApiError(400, `An estimate with status "${estimate.status}" can no longer be edited`);
  }

  const config = await getEstimateBusinessConfig();
  const body = payload || {};
  const fields = buildWorkflowFields(body, estimate);
  Object.assign(estimate, fields);

  const incomingRevision = Number(body?.metadata?.revision);
  if (Number.isFinite(incomingRevision) && incomingRevision > estimate.metadata.revision) {
    estimate.metadata.revision = incomingRevision;
  }
  estimate.metadata.lastSavedAt = new Date();
  estimate.metadata.validUntil =
    estimate.metadata.validUntil || new Date(Date.now() + config.validUntilDays * 86400000);

  applyTotals(estimate, config);
  await estimate.save();

  return { success: true, data: forResponse(estimate) };
};

export const deleteEstimate = async (routeParams: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (['Converted to Invoice', 'Accepted'].includes(estimate.status)) {
    throw new ApiError(400, 'An accepted or invoiced estimate cannot be deleted');
  }
  await estimate.deleteOne();
  return { success: true, message: 'Estimate deleted' };
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export const generateEstimate = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (['Converted to Invoice', 'Accepted'].includes(estimate.status)) {
    throw new ApiError(400, `Estimate is already ${estimate.status}`);
  }

  const config = await getEstimateBusinessConfig();

  // Apply the latest client payload (if any) before validating.
  if (payload && Object.keys(payload).length) {
    Object.assign(estimate, buildWorkflowFields(payload, estimate));
  }
  applyTotals(estimate, config);

  const problems = assertGeneratable(estimate);
  if (problems.length) {
    throw new ApiError(422, 'Cannot generate estimate', true, problems);
  }

  estimate.status = 'Generated';
  estimate.metadata.generatedAt = new Date();
  estimate.metadata.estimateNumber = estimate.estimateNumber;
  estimate.metadata.revision = (estimate.metadata.revision || 1) + 1;
  // Mongoose initialises array paths to [], so no guard is needed here.
  estimate.approvalHistory.push({
    status: 'Generated',
    by: actor?.email || 'System',
    at: new Date(),
  });
  await estimate.save();

  return {
    success: true,
    data: forResponse(estimate),
    // Sent so the client can detect (and show) any drift vs its preview.
    serverTotals: estimate.totals,
  };
};

// ---------------------------------------------------------------------------
// Advance payments
// ---------------------------------------------------------------------------

export const getPayments = async (routeParams: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id).select('payments totals');
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  return { success: true, data: estimate.payments || [] };
};

export const addPayment = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (['Converted to Invoice', 'Cancelled'].includes(estimate.status)) {
    throw new ApiError(400, `Cannot add an advance to a ${estimate.status} estimate`);
  }

  const config = await getEstimateBusinessConfig();
  const amount = roundMoney(Number(payload?.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(422, 'Advance amount must be greater than zero');
  }

  const paymentDate = payload?.date ? new Date(payload.date) : new Date();
  if (Number.isNaN(paymentDate.getTime())) throw new ApiError(422, 'Payment date is invalid');
  if (paymentDate.getTime() > Date.now() + 86400000) {
    throw new ApiError(422, 'Payment date cannot be in the future');
  }

  // Totals are recomputed from scratch — the client's numbers are ignored.
  applyTotals(estimate, config);

  const cap = maxAllowedAdvance(estimate.totals.grandTotal, config);
  const alreadyPaid = estimate.totals.advancePaid || 0;
  if (Number.isFinite(cap) && alreadyPaid + amount > cap + 0.001) {
    const remaining = Math.max(0, cap - alreadyPaid);
    throw new ApiError(
      422,
      `Advance cannot exceed the estimate total. Maximum additional amount is ${remaining.toFixed(2)}`
    );
  }

  const payment = {
    id: `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    amount,
    mode: payload?.mode || 'Cash',
    date: paymentDate,
    reference: String(payload?.reference || ''),
    notes: String(payload?.notes || ''),
    recordedBy: actor?.email || 'System',
    createdAt: new Date(),
  };
  estimate.payments.push(payment as any);
  applyTotals(estimate, config);
  estimate.metadata.lastSavedAt = new Date();
  await estimate.save();

  return { success: true, data: payment, totals: estimate.totals };
};

export const deletePayment = async (routeParams: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  const before = estimate.payments.length;
  estimate.payments = estimate.payments.filter((p: any) => p.id !== routeParams.paymentId) as any;
  if (estimate.payments.length === before) throw new ApiError(404, 'Payment not found');

  const config = await getEstimateBusinessConfig();
  applyTotals(estimate, config);
  await estimate.save();
  return { success: true, data: estimate.totals };
};

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** Locate a media record (inspection item or a document slot) by id. */
function findMedia(estimate: any, mediaId: string) {
  for (const category of estimate.inspection || []) {
    for (const item of category.items || []) {
      const media = (item.media || []).find((m: any) => m.id === mediaId);
      if (media) return { media, container: item.media, scope: 'inspection' as const };
    }
  }
  if (estimate.insurance?.document?.id === mediaId) {
    return { media: estimate.insurance.document, container: null, scope: 'insurance' as const };
  }
  if (estimate.identityProof?.document?.id === mediaId) {
    return { media: estimate.identityProof.document, container: null, scope: 'identity' as const };
  }
  return null;
}

export const uploadEstimateMedia = async (routeParams: any, payload: any, actor: any, uploadedFile: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (!uploadedFile) throw new ApiError(400, 'No file uploaded');

  const scope = String(payload?.scope || 'inspection');
  const itemId = String(payload?.itemId || '');
  const kind = uploadedFile.mimetype?.startsWith('video/') ? 'video' : uploadedFile.mimetype?.startsWith('image/') ? 'photo' : 'document';

  // Keep only the file name: the absolute path must never leave the server.
  const storageKey = path.basename(uploadedFile.path);
  const mediaId = `media-${Date.now().toString(36)}-${Math.round(Math.random() * 1e6)}`;

  const media = {
    id: mediaId,
    name: uploadedFile.originalname,
    kind,
    mimeType: uploadedFile.mimetype,
    size: uploadedFile.size,
    storageKey,
    scope,
    itemId,
    uploadedAt: new Date(),
    uploadedBy: actor?.email || 'System',
  };

  if (scope === 'insurance') {
    estimate.insurance.document = {
      id: mediaId,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      storageKey,
      uploadedAt: media.uploadedAt,
    };
  } else if (scope === 'identity') {
    estimate.identityProof.document = {
      id: mediaId,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      storageKey,
      uploadedAt: media.uploadedAt,
    };
  } else {
    if (!itemId) throw new ApiError(400, 'itemId is required for inspection media');
    let target: any = null;
    for (const category of estimate.inspection || []) {
      const found = (category.items || []).find((i: any) => i.id === itemId);
      if (found) {
        target = found;
        break;
      }
    }
    if (!target) throw new ApiError(404, 'Inspection item not found on this estimate');
    target.media.push(media as any);
  }

  estimate.metadata.lastSavedAt = new Date();
  await estimate.save();

  return {
    success: true,
    data: {
      ...media,
      storageKey: undefined,
      downloadUrl: `/api/estimates/${estimate._id}/media/${mediaId}`,
    },
  };
};

/**
 * Media is streamed through this authenticated route — files are never exposed
 * on a public path. Insurance and identity documents are restricted further.
 */
export const downloadEstimateMedia = async (routeParams: any, actor: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');

  const found = findMedia(estimate, routeParams.mediaId);
  if (!found) throw new ApiError(404, 'File not found on this estimate');

  if (found.scope !== 'inspection') {
    const allowed = ['Admin', 'Service Manager', 'Service Advisor'];
    if (actor?.role && !allowed.includes(actor.role)) {
      throw new ApiError(403, 'Your role is not permitted to view customer documents');
    }
  }

  const key = path.basename(String(found.media.storageKey || ''));
  if (!key) throw new ApiError(404, 'File is no longer available');
  const absolute = path.join(uploadDir, key);
  if (!fs.existsSync(absolute)) throw new ApiError(404, 'File is no longer available');

  return { absolute, mimeType: found.media.mimeType, name: found.media.name || key };
};

export const deleteEstimateMedia = async (routeParams: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');

  const found = findMedia(estimate, routeParams.mediaId);
  if (!found) throw new ApiError(404, 'File not found on this estimate');

  if (found.scope === 'insurance') estimate.insurance.document = null;
  else if (found.scope === 'identity') estimate.identityProof.document = null;
  else if (found.container) {
    const index = found.container.findIndex((m: any) => m.id === routeParams.mediaId);
    if (index >= 0) found.container.splice(index, 1);
  }

  await estimate.save();

  const key = path.basename(String(found.media.storageKey || ''));
  if (key) {
    const absolute = path.join(uploadDir, key);
    fs.promises.unlink(absolute).catch(() => undefined);
  }

  return { success: true, message: 'File removed' };
};

// ---------------------------------------------------------------------------
// Document (PDF / print)
// ---------------------------------------------------------------------------

/** Returns print-ready A4 HTML. Wire a headless renderer here for raw PDF. */
export const renderEstimatePdf = async (routeParams: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (!estimate.lineItems?.length) {
    throw new ApiError(400, 'Add at least one item before generating a document');
  }
  const config = await getEstimateBusinessConfig();
  const html = buildEstimateDocument((estimate as any).toMaskedJSON(), config);
  return html;
};

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export const shareEstimate = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const estimate = await Estimate.findById(routeParams.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');

  const channel = String(payload?.channel || 'manual');
  estimate.shareHistory.push({ channel, by: actor?.email || 'System', at: new Date() });

  if (['Generated', 'Pending Approval', 'Review'].includes(estimate.status)) {
    estimate.status = 'Sent';
    estimate.approvalHistory.push({ status: 'Sent', by: actor?.email || 'System', at: new Date() });
  }
  await estimate.save();

  return { success: true, data: { status: estimate.status, channel }, message: `Estimate shared via ${channel}` };
};

export default {
  getEstimateConfig,
  getNextEstimateNumber,
  getCatalogServices,
  getCatalogPackages,
  getCatalogParts,
  getCatalogLabour,
  getInspectionTemplate,
  createInspectionCategory,
  createDraft,
  updateDraft,
  deleteEstimate,
  generateEstimate,
  getPayments,
  addPayment,
  deletePayment,
  uploadEstimateMedia,
  downloadEstimateMedia,
  deleteEstimateMedia,
  renderEstimatePdf,
  shareEstimate,
};
