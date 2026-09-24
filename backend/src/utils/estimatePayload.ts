// ---------------------------------------------------------------------------
// Payload sanitisation.
//
// The client is treated as untrusted: every numeric field is coerced and
// clamped, every id is stringified, and derived money columns are stripped so
// the tax engine is the only thing that can produce totals.
// ---------------------------------------------------------------------------

import { toPaise, fromPaise, sanitizeAmount, sanitizeQuantity } from './estimateMath.js';
import {
  DISCOUNT_TYPES,
  FUEL_TYPES,
  ID_PROOF_TYPES,
  INSPECTION_STATUSES,
  LINE_ITEM_TYPES,
  MEDIA_SCOPES,
  PAYMENT_MODES,
  TAX_TYPES,
  VEHICLE_TYPES,
} from '../models/Estimate.js';

const str = (value: unknown, fallback = ''): string =>
  value === null || value === undefined ? fallback : String(value).trim();

const optionalNumber = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = str(value) as T;
  return allowed.includes(v) ? v : fallback;
}

// ---------------------------------------------------------------------------
// Vehicle / customer
// ---------------------------------------------------------------------------

export function sanitizeVehicle(raw: any = {}) {
  return {
    id: str(raw.id) || undefined,
    type: pick(raw.type, VEHICLE_TYPES, '4W'),
    registrationNumber: str(raw.registrationNumber).toUpperCase().replace(/[^A-Z0-9]/g, ''),
    brand: str(raw.brand),
    model: str(raw.model),
    variant: str(raw.variant),
    year: optionalNumber(raw.year),
    fuelType: pick(raw.fuelType, [...FUEL_TYPES, ''] as const, ''),
    engineNumber: str(raw.engineNumber),
    chassisNumber: str(raw.chassisNumber),
    color: str(raw.color),
    odometer: optionalNumber(raw.odometer),
    fuelMeter: optionalNumber(raw.fuelMeter),
    evBatteryCapacity: str(raw.evBatteryCapacity),
    evChargerType: str(raw.evChargerType),
  };
}

/** Digits only, with a leading country code dropped — stored as a 10-digit number. */
function normalizePhone(value: unknown): string {
  const digits = str(value).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function sanitizeCustomer(raw: any = {}) {
  const phone = normalizePhone(raw.phone);
  return {
    id: str(raw.id) || undefined,
    name: str(raw.name),
    phone,
    alternatePhone: str(raw.alternatePhone),
    email: str(raw.email).toLowerCase(),
    address: str(raw.address),
    city: str(raw.city),
    state: str(raw.state),
    pincode: str(raw.pincode).replace(/\D/g, '').slice(0, 6),
    gstNumber: str(raw.gstNumber).toUpperCase(),
  };
}

// ---------------------------------------------------------------------------
// Documents & media
// ---------------------------------------------------------------------------

export function sanitizeUploadedDocument(raw: any) {
  if (!raw) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name),
    mimeType: str(raw.mimeType),
    size: Number(raw.size) || 0,
    storageKey: str(raw.storageKey),
    uploadedAt: parseDate(raw.uploadedAt) || new Date(),
  };
}

export function sanitizeMediaItem(raw: any = {}) {
  return {
    id: str(raw.id),
    name: str(raw.name),
    kind: pick(raw.kind, ['photo', 'video', 'document'] as const, 'photo'),
    mimeType: str(raw.mimeType),
    size: Number(raw.size) || 0,
    storageKey: str(raw.storageKey),
    scope: pick(raw.scope, MEDIA_SCOPES as readonly string[], 'inspection') as any,
    itemId: str(raw.itemId),
    uploadedAt: parseDate(raw.uploadedAt) || new Date(),
  };
}

export function sanitizeInsurance(raw: any = {}) {
  return {
    company: str(raw.company),
    policyNumber: str(raw.policyNumber),
    startDate: parseDate(raw.startDate),
    expiryDate: parseDate(raw.expiryDate),
    document: sanitizeUploadedDocument(raw.document),
  };
}

function sanitizeCompliance(raw: any = {}) {
  return {
    expiryDate: parseDate(raw?.expiryDate),
    setReminder: Boolean(raw?.setReminder),
  };
}

export function sanitizeDocuments(raw: any = {}) {
  return {
    rc: sanitizeCompliance(raw.rc),
    puc: sanitizeCompliance(raw.puc),
    license: sanitizeCompliance(raw.license),
  };
}

/**
 * Identity numbers are write-only: once stored, the client only ever sends the
 * masked value back. Anything containing a mask character keeps the stored
 * number untouched.
 */
export function sanitizeIdentityProof(raw: any = {}, existing?: any) {
  const incoming = str(raw.idNumber);
  const isMasked = /X/i.test(incoming);
  const idNumber = isMasked ? str(existing?.idNumber) : incoming;
  return {
    idType: pick(raw.idType, [...ID_PROOF_TYPES, ''] as const, ''),
    idNumber,
    idLast4: idNumber ? idNumber.slice(-4) : '',
    document: sanitizeUploadedDocument(raw.document) || existing?.document || null,
  };
}

export function sanitizePickup(raw: any = {}) {
  return {
    enabled: Boolean(raw.enabled),
    address: str(raw.address),
    contactPerson: str(raw.contactPerson),
    phone: normalizePhone(raw.phone),
    preferredDate: parseDate(raw.preferredDate),
    preferredTime: str(raw.preferredTime),
    notes: str(raw.notes),
  };
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

export function sanitizeInspection(raw: unknown) {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((category: any, categoryIndex: number) => {
    const items = Array.isArray(category?.items) ? category.items : [];
    return {
      id: str(category?.id) || `cat-${categoryIndex}`,
      name: str(category?.name) || `Category ${categoryIndex + 1}`,
      description: str(category?.description),
      sortOrder: Number(category?.sortOrder) || categoryIndex,
      isActive: category?.isActive !== false,
      isCustom: Boolean(category?.isCustom),
      items: items.map((item: any, itemIndex: number) => ({
        id: str(item?.id) || `insp-${categoryIndex}-${itemIndex}`,
        categoryId: str(item?.categoryId) || str(category?.id) || `cat-${categoryIndex}`,
        name: str(item?.name) || `Item ${itemIndex + 1}`,
        status: pick(item?.status, INSPECTION_STATUSES as readonly string[], 'na') as any,
        notes: str(item?.notes).slice(0, 2000),
        media: Array.isArray(item?.media) ? item.media.map(sanitizeMediaItem) : [],
        linkedServiceIds: Array.isArray(item?.linkedServiceIds)
          ? item.linkedServiceIds.map((id: unknown) => str(id)).filter(Boolean)
          : [],
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Line items — derived money columns are intentionally discarded
// ---------------------------------------------------------------------------

export function sanitizeLineItem(raw: any = {}, index = 0) {
  const discountType =
    raw.discountType === undefined || raw.discountType === 'none'
      ? 'none'
      : pick(raw.discountType, DISCOUNT_TYPES as readonly string[], 'none');
  const taxType = pick(raw.taxType, TAX_TYPES as readonly string[], 'GST');

  const discountValue = sanitizeAmount(raw.discountValue);
  const taxRate = sanitizeAmount(raw.taxRate);

  return {
    id: str(raw.id) || `item-${index}`,
    type: pick(raw.type, LINE_ITEM_TYPES as readonly string[], 'custom') as any,
    name: str(raw.name) || `Item ${index + 1}`,
    description: str(raw.description),
    hsnSacCode: str(raw.hsnSacCode),
    partNumber: str(raw.partNumber),
    brand: str(raw.brand),
    unit: str(raw.unit) || 'Pcs',
    // Quantity must be greater than zero; anything else is coerced to 1 so a
    // malformed payload can never produce a negative or zero-total line.
    quantity: sanitizeQuantity(raw.quantity, 1),
    rate: sanitizeAmount(raw.rate),
    discountType,
    discountValue: discountType === 'percentage' ? Math.min(discountValue, 100) : discountValue,
    taxType,
    taxRate,
    packageContents: Array.isArray(raw.packageContents)
      ? raw.packageContents.map((c: any) => ({
          name: str(c?.name),
          type: pick(c?.type, LINE_ITEM_TYPES as readonly string[], 'service'),
          quantity: sanitizeQuantity(c?.quantity, 1),
          rate: sanitizeAmount(c?.rate),
          taxRate: sanitizeAmount(c?.taxRate),
        }))
      : [],
    inspectionItemId: str(raw.inspectionItemId),
    inspectionItemName: str(raw.inspectionItemName),
    inspectionCategoryName: str(raw.inspectionCategoryName),
    catalogId: str(raw.catalogId),
  };
}

export function sanitizeLineItems(raw: unknown) {
  if (!Array.isArray(raw)) return undefined;
  // Guard against absurd payloads (a 5000 row estimate is a bug, not a quote).
  return raw.slice(0, 500).map((item, index) => sanitizeLineItem(item, index));
}

export function sanitizePayments(raw: unknown) {
  if (!Array.isArray(raw)) return undefined;
  return raw.slice(0, 200).map((p: any, index: number) => {
    const amount = sanitizeAmount(p?.amount);
    return {
      id: str(p?.id) || `pay-${index}`,
      amount: fromPaise(toPaise(amount)),
      mode: pick(p?.mode, PAYMENT_MODES as readonly string[], 'Cash') as any,
      date: parseDate(p?.date) || new Date(),
      reference: str(p?.reference),
      notes: str(p?.notes),
      recordedBy: str(p?.recordedBy) || undefined,
      createdAt: parseDate(p?.createdAt) || new Date(),
    };
  });
}

export function sanitizeMetadata(raw: any = {}, existing: any = {}) {
  return {
    estimateNumber: str(existing?.estimateNumber) || str(raw.estimateNumber),
    estimateDate: parseDate(raw.estimateDate) || parseDate(existing?.estimateDate) || new Date(),
    validUntil: parseDate(raw.validUntil) || parseDate(existing?.validUntil),
    createdBy: str(raw.createdBy) || str(existing?.createdBy),
    lastSavedAt: new Date(),
    generatedAt: parseDate(existing?.generatedAt),
    revision: Number(existing?.revision) || 1,
  };
}

export default {
  sanitizeVehicle,
  sanitizeCustomer,
  sanitizeDocuments,
  sanitizeIdentityProof,
  sanitizeInsurance,
  sanitizeInspection,
  sanitizeLineItem,
  sanitizeLineItems,
  sanitizeMediaItem,
  sanitizeMetadata,
  sanitizePayments,
  sanitizePickup,
  parseDate,
};
