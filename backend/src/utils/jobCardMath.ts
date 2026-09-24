// ---------------------------------------------------------------------------
// Job card pricing engine (authoritative copy).
//
// All money math runs on integer paise so a job card can never accumulate
// floating point drift. The frontend mirrors this in
// frontend/src/utils/jobCardPricing.ts — the client shows the same numbers while
// typing, but totals arriving from a client are always recalculated here before
// they are stored, so a stale or hand-edited payload cannot produce a wrong
// invoice.
// ---------------------------------------------------------------------------

export const MONEY_PAISE = 100;

/** Tax treatment of a single line item. `None` means the rate is ignored. */
export const LINE_TAX_TYPES = Object.freeze(['None', 'GST', 'IGST']);
export const LINE_DISCOUNT_TYPES = Object.freeze(['none', 'percent', 'flat']);
export const LINE_UNITS = Object.freeze(['nos', 'set', 'pair', 'ltr', 'kg', 'gm', 'hr', 'km', 'job', 'sqft']);

export const DEFAULT_TAX_RATE = 18;

/** Every status the customer-facing approval link can be in. */
export const APPROVAL_STATUSES = Object.freeze([
  'not_sent',
  'awaiting',
  'approved',
  'changes_requested',
  'skipped',
]);

export interface JobCardLineInput {
  name?: string;
  type?: string;
  hsnSacCode?: string;
  unit?: string;
  qty?: number | string;
  price?: number | string;
  taxType?: string;
  taxRate?: number | string;
  discountType?: string;
  discountValue?: number | string;
  [key: string]: unknown;
}

export interface JobCardLineComputed {
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
  /** Order level discount, as stored on orderSummary.discount. */
  discount: number;
  tax: number;
  advanceDeducted: number;
  total: number;
  grandTotal: number;
  balanceDue: number;
}

function toNumber(value: unknown): number {
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

/** Never let a negative or non-finite amount into the engine. */
export function sanitizeAmount(value: unknown): number {
  const n = toNumber(value);
  return n < 0 ? 0 : n;
}

export function sanitizeQuantity(value: unknown): number {
  const n = toNumber(value);
  return n < 0 ? 0 : n;
}

/** Blank or legacy line items fall back to "apply tax when a rate is set". */
export function resolveTaxType(item: JobCardLineInput | undefined): string {
  const raw = item?.taxType;
  if (typeof raw === 'string' && LINE_TAX_TYPES.includes(raw)) return raw;
  return toNumber(item?.taxRate) > 0 ? 'GST' : 'None';
}

export function resolveDiscountType(item: JobCardLineInput | undefined): string {
  const raw = item?.discountType;
  if (typeof raw === 'string' && LINE_DISCOUNT_TYPES.includes(raw)) return raw;
  return 'none';
}

/**
 * Discount engine. A discount can never exceed the line subtotal, and a
 * percentage above 100 is clamped to 100.
 */
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

/** Derived amounts for one line item: subtotal -> discount -> taxable -> tax -> total. */
export function computeLineItem(item: JobCardLineInput): JobCardLineComputed {
  const quantity = sanitizeQuantity(item?.qty);
  const rate = sanitizeAmount(item?.price);

  const qtyPaise = toPaise(quantity);
  const ratePaise = toPaise(rate);
  const subtotalPaise = Math.round((qtyPaise * ratePaise) / MONEY_PAISE);

  const discountPaise = calculateDiscount(subtotalPaise, resolveDiscountType(item), item?.discountValue);
  const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);

  const taxType = resolveTaxType(item);
  const taxRate = taxType === 'None' ? 0 : sanitizeAmount(item?.taxRate);
  const taxPaise =
    taxRate <= 0 ? 0 : Math.round((taxablePaise * toPaise(taxRate)) / (100 * MONEY_PAISE));

  return {
    subtotal: fromPaise(subtotalPaise),
    discountAmount: fromPaise(discountPaise),
    taxableAmount: fromPaise(taxablePaise),
    taxAmount: fromPaise(taxPaise),
    total: fromPaise(taxablePaise + taxPaise),
  };
}

/** Recompute every derived column, leaving the item's inputs untouched. */
export function computeLineItems<T extends JobCardLineInput>(items: T[] | undefined): (T & JobCardLineComputed)[] {
  return (items || []).map((item) => ({ ...item, ...computeLineItem(item) }));
}

export interface JobCardTotalsInput {
  /** Stored job card line items (`services`). */
  services?: JobCardLineInput[];
  /** Wizard line items. Either key is accepted so both callers share the engine. */
  lineItems?: JobCardLineInput[];
  /** Order level discount. */
  discount?: number | string;
  /** Advance recorded against the order (`advance.amount` preferred). */
  advance?: number | string | { amount?: number | string };
  /** Legacy location of the advance, kept for older documents. */
  advanceAmount?: number | string;
}

/**
 * Job card totals: subtotal -> line discounts -> order discount -> tax ->
 * grand total -> advance -> balance due.
 */
export function computeJobCardTotals(input: JobCardTotalsInput = {}): JobCardTotals {
  const lines = input.services?.length ? input.services : input.lineItems || [];

  let subtotalPaise = 0;
  let lineDiscountPaise = 0;
  let taxablePaise = 0;
  let taxPaise = 0;

  for (const line of lines) {
    const computed = computeLineItem(line);
    subtotalPaise += toPaise(computed.subtotal);
    lineDiscountPaise += toPaise(computed.discountAmount);
    taxablePaise += toPaise(computed.taxableAmount);
    taxPaise += toPaise(computed.taxAmount);
  }

  const subtotal = fromPaise(subtotalPaise);
  const lineDiscount = fromPaise(lineDiscountPaise);
  const taxable = fromPaise(taxablePaise);
  const tax = fromPaise(taxPaise);

  // Order level discount can never eat into the tax or go below zero.
  const requestedOrderDiscount = sanitizeAmount(input.discount);
  const orderDiscount = Math.min(requestedOrderDiscount, taxable);

  const total = round2(Math.max(taxable - orderDiscount, 0) + tax);
  const advanceRaw = typeof input.advance === 'object' && input.advance !== null ? input.advance.amount : input.advance;
  const advanceAmount = input.advance !== undefined ? advanceRaw : input.advanceAmount;
  const advanceDeducted = round2(sanitizeAmount(advanceAmount));

  return {
    subtotal: round2(subtotal),
    lineDiscount,
    discount: round2(orderDiscount),
    tax,
    advanceDeducted,
    total,
    grandTotal: total,
    balanceDue: round2(total - advanceDeducted),
  };
}

/** Payment state derived from the totals when it is not set explicitly. */
export function derivePaymentStatus(totals: Pick<JobCardTotals, 'total' | 'balanceDue'>): string {
  if (totals.total > 0 && totals.balanceDue <= 0) return 'Paid';
  return 'Pending';
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default {
  computeLineItem,
  computeLineItems,
  computeJobCardTotals,
  derivePaymentStatus,
  resolveTaxType,
  resolveDiscountType,
  calculateDiscount,
  DEFAULT_TAX_RATE,
  LINE_TAX_TYPES,
  LINE_DISCOUNT_TYPES,
  LINE_UNITS,
  APPROVAL_STATUSES,
};
