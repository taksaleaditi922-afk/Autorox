// ---------------------------------------------------------------------------
// Estimate calculation engine — AUTHORITATIVE COPY.
//
// The client has an equivalent module (frontend/src/utils/estimateMath.ts) used
// purely for live preview. Financial values submitted by the client are never
// trusted: every draft save, advance payment and estimate generation path runs
// the numbers through this module again before they are persisted.
//
// All money math runs on integer paise so there is no floating point drift.
// ---------------------------------------------------------------------------

export type DiscountType = 'percentage' | 'fixed' | 'none';
export type TaxType = 'GST' | 'CGST_SGST' | 'IGST' | 'NONE';
export type SupplyType = 'intra' | 'inter';

export interface TaxConfig {
  supplyType: SupplyType;
}

export const DEFAULT_TAX_CONFIG: TaxConfig = { supplyType: 'intra' };

export interface TaxEngineInput {
  quantity: number | string;
  rate: number | string;
  discountType?: DiscountType;
  discountValue?: number | string;
  taxType?: TaxType;
  taxRate?: number | string;
}

export interface TaxComponentBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
}

export interface LineItemCalculation {
  quantity: number;
  rate: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface EstimateTotals {
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  advancePaid: number;
  balanceDue: number;
}

/** Shape the engine needs from a persisted line item. */
export interface LineItemLike extends TaxEngineInput {
  type?: string;
  taxType?: TaxType;
  taxRate?: number | string;
}

export interface PaymentLike {
  amount?: number | string;
}

export interface BusinessConfigLike {
  roundOffEnabled?: boolean;
  advanceMaxPercent?: number;
  allowAdvanceExceedingTotal?: boolean;
  supplyType?: SupplyType;
  defaultTaxRate?: number;
}

export const PAISE = 100;

export function toPaise(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * PAISE);
}

export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / PAISE;
}

export function roundMoney(value: number | string | null | undefined): number {
  return fromPaise(toPaise(value));
}

export function sanitizeAmount(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function sanitizeQuantity(value: number | string | null | undefined, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/** Split a tax total into CGST/SGST/IGST based on tax type + supply type. */
export function splitTax(
  taxAmountPaise: number,
  taxType: TaxType,
  supplyType: SupplyType
): TaxComponentBreakdown {
  if (taxType === 'NONE') {
    return { cgst: 0, sgst: 0, igst: 0, taxTotal: 0 };
  }
  if (taxType === 'IGST' || (taxType === 'GST' && supplyType === 'inter')) {
    return { cgst: 0, sgst: 0, igst: fromPaise(taxAmountPaise), taxTotal: fromPaise(taxAmountPaise) };
  }
  const cgstPaise = Math.round(taxAmountPaise / 2);
  const sgstPaise = taxAmountPaise - cgstPaise;
  return {
    cgst: fromPaise(cgstPaise),
    sgst: fromPaise(sgstPaise),
    igst: 0,
    taxTotal: fromPaise(taxAmountPaise),
  };
}

/** Discount engine — clamped so a discount can never exceed the taxable base. */
export function calculateDiscount(
  subtotalPaise: number,
  discountType: DiscountType | undefined,
  discountValue: number | string | undefined
): number {
  const base = Math.max(0, Math.round(subtotalPaise));
  if (!discountType || discountType === 'none') return 0;
  const value = sanitizeAmount(discountValue);
  if (value <= 0) return 0;

  if (discountType === 'percentage') {
    const pct = Math.min(value, 100);
    return Math.min(Math.round((base * toPaise(pct)) / (100 * PAISE)), base);
  }
  return Math.min(toPaise(value), base);
}

/** calculateTax(lineItem, taxConfig) — reusable, UI-independent tax engine. */
export function calculateTax(
  lineItem: TaxEngineInput,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): LineItemCalculation {
  const quantity = sanitizeQuantity(lineItem.quantity, 0);
  const rate = sanitizeAmount(lineItem.rate);

  const subtotalPaise = Math.round((toPaise(quantity) * toPaise(rate)) / PAISE);
  const discountPaise = calculateDiscount(subtotalPaise, lineItem.discountType, lineItem.discountValue);
  const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);

  const taxType: TaxType = lineItem.taxType || 'NONE';
  const taxRate = sanitizeAmount(lineItem.taxRate);
  const taxPaise =
    taxType === 'NONE' || taxRate <= 0
      ? 0
      : Math.round((taxablePaise * toPaise(taxRate)) / (100 * PAISE));

  const split = splitTax(taxPaise, taxType, taxConfig.supplyType);

  return {
    quantity,
    rate,
    subtotal: fromPaise(subtotalPaise),
    discountAmount: fromPaise(discountPaise),
    taxableAmount: fromPaise(taxablePaise),
    taxAmount: split.taxTotal,
    total: fromPaise(taxablePaise + taxPaise),
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst,
  };
}

/** A line item with the derived money columns the engine just produced. */
export type CalculatedLineItem<T extends LineItemLike> = T & LineItemCalculation;

/** Recalculate a single line item, keeping its inputs and refreshing all derived columns. */
export function calculateLineItem<T extends LineItemLike>(
  item: T,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): CalculatedLineItem<T> {
  const calc = calculateTax(item, taxConfig);
  // The spread of a generic T cannot be proven to satisfy `T & calculation`,
  // so the intersection is asserted once here.
  return {
    ...item,
    quantity: calc.quantity,
    rate: calc.rate,
    subtotal: calc.subtotal,
    discountAmount: calc.discountAmount,
    taxableAmount: calc.taxableAmount,
    taxAmount: calc.taxAmount,
    total: calc.total,
  } as CalculatedLineItem<T>;
}

export function calculateLineItems<T extends LineItemLike>(
  items: T[] | undefined,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): CalculatedLineItem<T>[] {
  return (items || []).map((item) => calculateLineItem(item, taxConfig));
}

export function sumAdvances(payments: PaymentLike[] | undefined): number {
  return fromPaise(
    (payments || []).reduce((sum, p) => sum + toPaise(sanitizeAmount(p?.amount)), 0)
  );
}

/**
 * Estimate totals aggregation:
 * subtotal -> discount -> taxable -> CGST/SGST/IGST -> round off -> grand total
 * -> advance paid -> balance due.
 */
export function computeEstimateTotals(
  items: LineItemLike[] | undefined,
  payments: PaymentLike[] = [],
  config?: BusinessConfigLike,
  taxConfig?: TaxConfig
): EstimateTotals {
  const effectiveTaxConfig: TaxConfig =
    taxConfig || { supplyType: config?.supplyType || 'intra' };
  const calculated = calculateLineItems(items, effectiveTaxConfig);

  let subtotalPaise = 0;
  let discountPaise = 0;
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  for (const item of calculated) {
    subtotalPaise += toPaise(item.subtotal);
    discountPaise += toPaise(item.discountAmount);
    taxablePaise += toPaise(item.taxableAmount);
    const split = splitTax(toPaise(item.taxAmount), item.taxType || 'NONE', effectiveTaxConfig.supplyType);
    cgstPaise += toPaise(split.cgst);
    sgstPaise += toPaise(split.sgst);
    igstPaise += toPaise(split.igst);
  }

  const taxTotalPaise = cgstPaise + sgstPaise + igstPaise;
  const grossPaise = taxablePaise + taxTotalPaise;

  const roundOffEnabled = config?.roundOffEnabled !== false;
  const grandTotalPaise = roundOffEnabled ? Math.round(grossPaise / PAISE) * PAISE : grossPaise;

  const advancePaise = toPaise(sumAdvances(payments));

  return {
    subtotal: fromPaise(subtotalPaise),
    discountTotal: fromPaise(discountPaise),
    taxableAmount: fromPaise(taxablePaise),
    cgst: fromPaise(cgstPaise),
    sgst: fromPaise(sgstPaise),
    igst: fromPaise(igstPaise),
    taxTotal: fromPaise(taxTotalPaise),
    roundOff: fromPaise(grandTotalPaise - grossPaise),
    grandTotal: fromPaise(grandTotalPaise),
    advancePaid: fromPaise(advancePaise),
    balanceDue: fromPaise(grandTotalPaise - advancePaise),
  };
}

/** Indian currency formatting, e.g. ₹1,25,450.00 — used by the PDF/print output. */
export function formatMoney(value: number | null | undefined, currency = 'INR'): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Highest advance the business rules allow for a grand total. */
export function maxAllowedAdvance(
  grandTotal: number,
  config?: BusinessConfigLike
): number {
  if (config?.allowAdvanceExceedingTotal) return Number.POSITIVE_INFINITY;
  const pct = config?.advanceMaxPercent ?? 100;
  return roundMoney((sanitizeAmount(grandTotal) * Math.min(Math.max(pct, 0), 100)) / 100);
}
