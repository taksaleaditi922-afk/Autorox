// ---------------------------------------------------------------------------
// Estimate calculation engine (frontend)
//
// All money math runs on integer paise so the UI never shows floating point
// drift. The backend has an equivalent module
// (backend/src/utils/estimateMath.ts) which is the authoritative copy: totals
// sent from this client are always recalculated server-side before an estimate
// number is issued.
// ---------------------------------------------------------------------------

import type {
  AdvancePayment,
  DiscountType,
  EstimateBusinessConfig,
  EstimateLineItem,
  EstimateTotals,
  SupplyType,
  TaxType,
} from '../services/estimate/types';

export const PAISE = 100;

/** Convert an arbitrary numeric-ish value to integer paise. */
export function toPaise(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * PAISE);
}

/** Convert integer paise back to a 2-decimal number. */
export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / PAISE;
}

/** Round any value to 2 decimals without float noise. */
export function roundMoney(value: number | string | null | undefined): number {
  return fromPaise(toPaise(value));
}

/** Never allow a negative or non-finite amount into the engine. */
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

export interface TaxConfig {
  /** 'intra' => CGST+SGST split, 'inter' => IGST. */
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

/**
 * Split a tax total into CGST/SGST/IGST based on tax type + supply type.
 * GST is state-driven; an explicit CGST_SGST/IGST type always wins.
 */
export function splitTax(taxAmountPaise: number, taxType: TaxType, supplyType: SupplyType): TaxComponentBreakdown {
  if (taxType === 'NONE') {
    return { cgst: 0, sgst: 0, igst: 0, taxTotal: 0 };
  }
  if (taxType === 'IGST' || (taxType === 'GST' && supplyType === 'inter')) {
    return { cgst: 0, sgst: 0, igst: fromPaise(taxAmountPaise), taxTotal: fromPaise(taxAmountPaise) };
  }
  // GST (intra-state) || CGST_SGST
  const cgstPaise = Math.round(taxAmountPaise / 2);
  const sgstPaise = taxAmountPaise - cgstPaise;
  return {
    cgst: fromPaise(cgstPaise),
    sgst: fromPaise(sgstPaise),
    igst: 0,
    taxTotal: fromPaise(taxAmountPaise),
  };
}

/**
 * Discount engine. A discount can never exceed the line subtotal and a
 * percentage above 100 is clamped to 100.
 */
export function calculateDiscount(subtotalPaise: number, discountType: DiscountType, discountValue: number | string): number {
  const base = Math.max(0, Math.round(subtotalPaise));
  if (discountType === 'none') return 0;
  const value = sanitizeAmount(discountValue);
  if (value <= 0) return 0;

  if (discountType === 'percentage') {
    const pct = Math.min(value, 100);
    return Math.min(Math.round((base * toPaise(pct)) / (100 * PAISE)), base);
  }
  // fixed
  return Math.min(toPaise(value), base);
}

/**
 * The reusable tax engine.
 * calculateTax(lineItem, taxConfig) -> derived amounts for a single line item.
 */
export function calculateTax(
  lineItem: TaxEngineInput,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): LineItemCalculation {
  const quantity = sanitizeQuantity(lineItem.quantity, 0);
  const rate = sanitizeAmount(lineItem.rate);

  const qtyPaise = toPaise(quantity);
  const ratePaise = toPaise(rate);
  const subtotalPaise = Math.round((qtyPaise * ratePaise) / PAISE);

  const discountPaise = calculateDiscount(
    subtotalPaise,
    lineItem.discountType || 'none',
    lineItem.discountValue ?? 0
  );
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

/** Recompute every derived column of a line item, leaving inputs untouched. */
export function calculateLineItem(
  item: EstimateLineItem,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): EstimateLineItem {
  const calc = calculateTax(item, taxConfig);
  return {
    ...item,
    quantity: calc.quantity,
    subtotal: calc.subtotal,
    discountAmount: calc.discountAmount,
    taxableAmount: calc.taxableAmount,
    taxAmount: calc.taxAmount,
    total: calc.total,
  };
}

export function calculateLineItems(
  items: EstimateLineItem[],
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): EstimateLineItem[] {
  return (items || []).map((item) => calculateLineItem(item, taxConfig));
}

export const EMPTY_TOTALS: EstimateTotals = {
  subtotal: 0,
  discountTotal: 0,
  taxableAmount: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  taxTotal: 0,
  roundOff: 0,
  grandTotal: 0,
  advancePaid: 0,
  balanceDue: 0,
};

export function sumAdvances(payments: AdvancePayment[] | undefined): number {
  return fromPaise((payments || []).reduce((sum, p) => sum + toPaise(sanitizeAmount(p?.amount)), 0));
}

/**
 * Estimate totals: subtotal -> discount -> taxable -> tax split -> round off ->
 * grand total -> advance -> balance due.
 */
export function computeEstimateTotals(
  items: EstimateLineItem[],
  payments: AdvancePayment[] = [],
  config?: Partial<EstimateBusinessConfig>,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): EstimateTotals {
  const calculated = calculateLineItems(items, taxConfig);

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
    const split = splitTax(toPaise(item.taxAmount), item.taxType || 'NONE', taxConfig.supplyType);
    cgstPaise += toPaise(split.cgst);
    sgstPaise += toPaise(split.sgst);
    igstPaise += toPaise(split.igst);
  }

  const taxTotalPaise = cgstPaise + sgstPaise + igstPaise;
  const grossPaise = taxablePaise + taxTotalPaise;

  const roundOffEnabled = config?.roundOffEnabled !== false;
  const roundedGrossPaise = roundOffEnabled ? Math.round(grossPaise / PAISE) * PAISE : grossPaise;
  const roundOffPaise = roundedGrossPaise - grossPaise;
  const grandTotalPaise = roundedGrossPaise;

  const advancePaise = toPaise(sumAdvances(payments));
  const balancePaise = grandTotalPaise - advancePaise;

  return {
    subtotal: fromPaise(subtotalPaise),
    discountTotal: fromPaise(discountPaise),
    taxableAmount: fromPaise(taxablePaise),
    cgst: fromPaise(cgstPaise),
    sgst: fromPaise(sgstPaise),
    igst: fromPaise(igstPaise),
    taxTotal: fromPaise(taxTotalPaise),
    roundOff: fromPaise(roundOffPaise),
    grandTotal: fromPaise(grandTotalPaise),
    advancePaid: fromPaise(advancePaise),
    balanceDue: fromPaise(balancePaise),
  };
}

/**
 * Highest advance the business rules allow for a given grand total.
 * Returns Infinity when the configuration explicitly allows overpayment.
 */
export function maxAllowedAdvance(grandTotal: number, config?: Partial<EstimateBusinessConfig>): number {
  if (config?.allowAdvanceExceedingTotal) return Number.POSITIVE_INFINITY;
  const pct = config?.advanceMaxPercent ?? 100;
  const cap = roundMoney((sanitizeAmount(grandTotal) * Math.min(Math.max(pct, 0), 100)) / 100);
  return cap;
}

/** Indian currency formatting, e.g. ₹1,25,450.00 */
export function formatMoney(value: number | null | undefined, currency = 'INR'): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Compact signed money used for discount / round-off rows. */
export function formatSignedMoney(value: number | null | undefined, currency = 'INR'): string {
  const n = Number(value) || 0;
  if (n === 0) return formatMoney(0, currency);
  return `${n > 0 ? '+' : '-'}${formatMoney(Math.abs(n), currency)}`;
}

export function sumItemType(items: EstimateLineItem[], type: EstimateLineItem['type']): number {
  return fromPaise(
    (items || [])
      .filter((i) => i.type === type)
      .reduce((sum, i) => sum + toPaise(i.total), 0)
  );
}
