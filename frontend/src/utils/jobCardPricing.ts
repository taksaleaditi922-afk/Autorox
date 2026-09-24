// ---------------------------------------------------------------------------
// Job card pricing engine (frontend).
//
// One implementation of the money math, used by Step 3, Step 4 and the order
// summary so the review table can never disagree with the editor. All math runs
// on integer paise; the backend mirrors this file in
// backend/src/utils/jobCardMath.ts and recalculates every total before saving.
// ---------------------------------------------------------------------------

export const MONEY_PAISE = 100;

/** Tax treatment of a single line item. `None` ignores the rate. */
export const LINE_TAX_TYPES = ['None', 'GST', 'IGST'] as const;
export const LINE_DISCOUNT_TYPES = ['none', 'percent', 'flat'] as const;
export const LINE_UNITS = ['nos', 'set', 'pair', 'ltr', 'kg', 'gm', 'hr', 'km', 'job', 'sqft'] as const;

export const DEFAULT_TAX_RATE = 18;

import type { JobCardStaff } from './jobCard';

export type JobCardTaxType = (typeof LINE_TAX_TYPES)[number];
export type JobCardDiscountType = (typeof LINE_DISCOUNT_TYPES)[number];

/** Every status the customer approval flow can be in. */
export const APPROVAL_STATUSES = ['not_sent', 'awaiting', 'approved', 'changes_requested', 'skipped'] as const;
export type JobCardApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  not_sent: 'Not sent',
  awaiting: 'Awaiting approval',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  skipped: 'Approval skipped',
};

export const APPROVAL_STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  not_sent: 'default',
  awaiting: 'info',
  approved: 'success',
  changes_requested: 'warning',
  skipped: 'default',
};

/** One billable row on the service list. */
export interface JobCardLineItem {
  catalogId?: string;
  name: string;
  /** service | package | part | labour | custom */
  type: string;
  description?: string;
  hsnSacCode?: string;
  partNumber?: string;
  brand?: string;
  unit?: string;
  qty: number;
  price: number;
  taxType?: string;
  taxRate?: number;
  discountType?: string;
  discountValue?: number;

  // Package expansion.
  packageId?: string;
  packageName?: string;
  isPackageHeader?: boolean;
  coreItem?: boolean;

  /** Stock snapshot captured when the part was added. */
  stockAvailable?: number | null;

  /** Mechanic assigned to this specific line item. */
  assignedMechanic?: JobCardStaff;

  // Audit trail.
  updatedBy?: string;
  updatedAt?: string;

  // Derived — recomputed by `computeLineItem`, never edited directly.
  subtotal?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxAmount?: number;
  total?: number;
}

export interface JobCardLineCalculation {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export interface JobCardTotals {
  subtotal: number;
  /** Sum of the per-line discounts. */
  lineDiscount: number;
  /** Order level discount (orderSummary.discount). */
  discount: number;
  tax: number;
  advanceDeducted: number;
  total: number;
  grandTotal: number;
  balanceDue: number;
}

/** Row percentages that stay readable in a narrow cell. */
export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toPaise(value: unknown): number {
  return Math.round(toNumber(value) * MONEY_PAISE);
}

export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / MONEY_PAISE;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sanitizeAmount(value: unknown): number {
  const n = toNumber(value);
  return n < 0 ? 0 : n;
}

export function sanitizeQuantity(value: unknown): number {
  const n = toNumber(value);
  return n < 0 ? 0 : n;
}

/** Legacy rows without a tax type apply tax whenever a rate is set. */
export function resolveTaxType(item: Pick<JobCardLineItem, 'taxType' | 'taxRate'> | undefined): string {
  const raw = item?.taxType;
  if (typeof raw === 'string' && (LINE_TAX_TYPES as readonly string[]).includes(raw)) return raw;
  return toNumber(item?.taxRate) > 0 ? 'GST' : 'None';
}

export function resolveDiscountType(item: Pick<JobCardLineItem, 'discountType'> | undefined): string {
  const raw = item?.discountType;
  if (typeof raw === 'string' && (LINE_DISCOUNT_TYPES as readonly string[]).includes(raw)) return raw;
  return 'none';
}

/** A discount never exceeds the line subtotal; a percentage is clamped to 100. */
export function calculateDiscount(subtotalPaise: number, discountType: string, discountValue: unknown): number {
  const base = Math.max(0, Math.round(subtotalPaise));
  if (discountType === 'none' || !discountType) return 0;
  const value = sanitizeAmount(discountValue);
  if (value <= 0) return 0;
  if (discountType === 'percent') {
    const pct = Math.min(value, 100);
    return Math.min(Math.round((base * toPaise(pct)) / (100 * MONEY_PAISE)), base);
  }
  return Math.min(toPaise(value), base);
}

/** Derived amounts for one row: subtotal -> discount -> taxable -> tax -> total. */
export function computeLineItem(item: JobCardLineItem): JobCardLineCalculation {
  const quantity = sanitizeQuantity(item?.qty);
  const rate = sanitizeAmount(item?.price);

  const subtotalPaise = Math.round((toPaise(quantity) * toPaise(rate)) / MONEY_PAISE);
  const discountPaise = calculateDiscount(subtotalPaise, resolveDiscountType(item), item?.discountValue);
  const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);

  const taxType = resolveTaxType(item);
  const taxRate = taxType === 'None' ? 0 : sanitizeAmount(item?.taxRate);
  const taxPaise = taxRate <= 0 ? 0 : Math.round((taxablePaise * toPaise(taxRate)) / (100 * MONEY_PAISE));

  return {
    subtotal: fromPaise(subtotalPaise),
    discountAmount: fromPaise(discountPaise),
    taxableAmount: fromPaise(taxablePaise),
    taxAmount: fromPaise(taxPaise),
    total: fromPaise(taxablePaise + taxPaise),
  };
}

/** Attach the derived columns to every row. */
export function computeLineItems(items: JobCardLineItem[] | undefined): JobCardLineItem[] {
  return (items || []).map((item) => ({ ...item, ...computeLineItem(item) }));
}

export interface JobCardTotalsInput {
  lineItems?: JobCardLineItem[];
  /** Order level discount. */
  discount?: unknown;
  advance?: unknown;
}

/** Job card totals: subtotal -> line discounts -> order discount -> tax -> grand total -> advance. */
export function computeJobCardTotals(input: JobCardTotalsInput = {}): JobCardTotals {
  const lines = input.lineItems || [];

  let subtotalPaise = 0;
  let lineDiscountPaise = 0;
  let taxablePaise = 0;
  let taxPaise = 0;

  for (const line of lines) {
    const calc = computeLineItem(line);
    subtotalPaise += toPaise(calc.subtotal);
    lineDiscountPaise += toPaise(calc.discountAmount);
    taxablePaise += toPaise(calc.taxableAmount);
    taxPaise += toPaise(calc.taxAmount);
  }

  const taxable = fromPaise(taxablePaise);
  const tax = fromPaise(taxPaise);
  const orderDiscount = Math.min(sanitizeAmount(input.discount), taxable);
  const total = round2(Math.max(taxable - orderDiscount, 0) + tax);
  const advanceDeducted = round2(sanitizeAmount(input.advance));

  return {
    subtotal: round2(fromPaise(subtotalPaise)),
    lineDiscount: fromPaise(lineDiscountPaise),
    discount: round2(orderDiscount),
    tax,
    advanceDeducted,
    total,
    grandTotal: total,
    balanceDue: round2(total - advanceDeducted),
  };
}

export function derivePaymentStatus(totals: Pick<JobCardTotals, 'total' | 'balanceDue'>): string {
  if (totals.total > 0 && totals.balanceDue <= 0) return 'Paid';
  return 'Pending';
}

/** Canonical empty row, so every field has a defined default. */
export function createLineItem(patch: Partial<JobCardLineItem> = {}): JobCardLineItem {
  return {
    name: '',
    type: 'custom',
    unit: 'nos',
    qty: 1,
    price: 0,
    taxType: 'GST',
    taxRate: DEFAULT_TAX_RATE,
    discountType: 'none',
    discountValue: 0,
    ...patch,
  };
}

/** True when a part's quantity is above the stock captured when it was added. */
export function isStockShort(line: JobCardLineItem): boolean {
  if (line.type !== 'part') return false;
  const stock = line.stockAvailable;
  if (stock === null || stock === undefined) return false;
  return sanitizeQuantity(line.qty) > stock;
}

/** Human readable discount, e.g. "10%" or "₹150". */
export function discountLabel(line: JobCardLineItem): string {
  const type = resolveDiscountType(line);
  const value = sanitizeAmount(line.discountValue);
  if (type === 'none' || value <= 0) return '—';
  if (type === 'percent') return `${value}%`;
  return `₹${value}`;
}

export default {
  computeLineItem,
  computeLineItems,
  computeJobCardTotals,
  derivePaymentStatus,
  createLineItem,
  isStockShort,
  calculateDiscount,
  resolveTaxType,
  resolveDiscountType,
  discountLabel,
  DEFAULT_TAX_RATE,
};
