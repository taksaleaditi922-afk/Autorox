// ---------------------------------------------------------------------------
// Tests for the estimate calculation engine.
//
// The engine is the only place money is produced, so these cover the tax,
// discount, rounding and advance rules plus the documented edge cases
// (₹0 items, 100% discounts, decimal quantities, large quantities, negative
// input and multiple tax rates).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAX_CONFIG,
  EMPTY_TOTALS,
  calculateDiscount,
  calculateLineItem,
  calculateLineItems,
  calculateTax,
  computeEstimateTotals,
  formatMoney,
  formatSignedMoney,
  fromPaise,
  maxAllowedAdvance,
  roundMoney,
  sanitizeAmount,
  sanitizeQuantity,
  splitTax,
  sumAdvances,
  sumItemType,
  toPaise,
} from './estimateMath';
import type { AdvancePayment, EstimateLineItem } from '../services/estimate/types';

function item(overrides: Partial<EstimateLineItem> = {}): EstimateLineItem {
  return {
    id: 'item-1',
    type: 'service',
    name: 'Brake Pad Replacement',
    unit: 'Job',
    quantity: 1,
    rate: 2500,
    discountType: 'none',
    discountValue: 0,
    taxType: 'GST',
    taxRate: 18,
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    total: 0,
    ...overrides,
  };
}

function payment(amount: number): AdvancePayment {
  return {
    id: `pay-${amount}`,
    amount,
    mode: 'Cash',
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('paise conversion helpers', () => {
  it('rounds to whole paise instead of drifting on floats', () => {
    expect(toPaise(0.1)).toBe(10);
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise('1234.565')).toBe(123457);
    expect(fromPaise(123457)).toBe(1234.57);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('treats non-numeric input as zero', () => {
    expect(toPaise(undefined)).toBe(0);
    expect(toPaise(null)).toBe(0);
    expect(toPaise('abc')).toBe(0);
    expect(toPaise(Number.NaN)).toBe(0);
    expect(fromPaise(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('never lets a negative amount or non-positive quantity into the engine', () => {
    expect(sanitizeAmount(-500)).toBe(0);
    expect(sanitizeAmount('x')).toBe(0);
    expect(sanitizeAmount(12.5)).toBe(12.5);
    expect(sanitizeQuantity(0)).toBe(1);
    expect(sanitizeQuantity(-2)).toBe(1);
    expect(sanitizeQuantity(0, 0)).toBe(0);
    expect(sanitizeQuantity('3')).toBe(3);
  });
});

describe('splitTax', () => {
  it('splits a GST amount into equal CGST/SGST for an intra-state supply', () => {
    expect(splitTax(180000, 'GST', 'intra')).toEqual({ cgst: 900, sgst: 900, igst: 0, taxTotal: 1800 });
  });

  it('puts the whole amount on IGST for an inter-state supply', () => {
    expect(splitTax(180000, 'GST', 'inter')).toEqual({ cgst: 0, sgst: 0, igst: 1800, taxTotal: 1800 });
  });

  it('honours an explicit CGST_SGST / IGST type over the supply type', () => {
    expect(splitTax(180000, 'CGST_SGST', 'inter').cgst).toBe(900);
    expect(splitTax(180000, 'IGST', 'intra').igst).toBe(1800);
    expect(splitTax(180000, 'NONE', 'intra')).toEqual({ cgst: 0, sgst: 0, igst: 0, taxTotal: 0 });
  });

  it('keeps an odd paise amount whole by pushing the remainder into SGST', () => {
    const split = splitTax(101, 'GST', 'intra');
    expect(split.cgst + split.sgst).toBeCloseTo(1.01, 10);
  });
});

describe('calculateDiscount', () => {
  it('computes a percentage discount', () => {
    expect(calculateDiscount(toPaise(10000), 'percentage', 10)).toBe(toPaise(1000));
  });

  it('computes a fixed discount', () => {
    expect(calculateDiscount(toPaise(10000), 'fixed', 1500)).toBe(toPaise(1500));
  });

  it('returns zero for no discount', () => {
    expect(calculateDiscount(toPaise(10000), 'none', 10)).toBe(0);
    expect(calculateDiscount(toPaise(10000), 'percentage', 0)).toBe(0);
    expect(calculateDiscount(toPaise(10000), 'fixed', -50)).toBe(0);
  });

  it('clamps a percentage above 100 to the full amount', () => {
    expect(calculateDiscount(toPaise(10000), 'percentage', 500)).toBe(toPaise(10000));
    expect(calculateDiscount(toPaise(10000), 'percentage', 100)).toBe(toPaise(10000));
  });

  it('never lets a discount exceed the line amount', () => {
    expect(calculateDiscount(toPaise(5000), 'fixed', 999999)).toBe(toPaise(5000));
  });
});

describe('calculateTax', () => {
  it('calculates an intra-state GST line (spec example: 10% off, 18% GST)', () => {
    const calc = calculateTax(
      { quantity: 1, rate: 10000, discountType: 'percentage', discountValue: 10, taxType: 'GST', taxRate: 18 },
      DEFAULT_TAX_CONFIG
    );

    expect(calc).toMatchObject({
      subtotal: 10000,
      discountAmount: 1000,
      taxableAmount: 9000,
      taxAmount: 1620,
      cgst: 810,
      sgst: 810,
      igst: 0,
      total: 10620,
    });
  });

  it('calculates an inter-state IGST line', () => {
    const calc = calculateTax(
      { quantity: 2, rate: 5000, taxType: 'GST', taxRate: 18 },
      { supplyType: 'inter' }
    );

    expect(calc.igst).toBe(1800);
    expect(calc.cgst).toBe(0);
    expect(calc.sgst).toBe(0);
    expect(calc.total).toBe(11800);
  });

  it('applies no tax when the type is NONE', () => {
    const calc = calculateTax({ quantity: 1, rate: 3000, taxType: 'NONE', taxRate: 18 });
    expect(calc.taxAmount).toBe(0);
    expect(calc.total).toBe(3000);
  });

  it('handles decimal quantities without float drift', () => {
    const calc = calculateTax({ quantity: 2.5, rate: 100.1, taxType: 'NONE' });
    expect(calc.subtotal).toBe(250.25);
    expect(calc.total).toBe(250.25);
  });

  it('handles very large quantities exactly', () => {
    const calc = calculateTax({ quantity: 1000000, rate: 999.99, taxType: 'NONE' });
    expect(calc.subtotal).toBe(999990000);
  });

  it('handles a zero-value item', () => {
    const calc = calculateTax({ quantity: 1, rate: 0, taxType: 'GST', taxRate: 18 });
    expect(calc.subtotal).toBe(0);
    expect(calc.taxAmount).toBe(0);
    expect(calc.total).toBe(0);
  });

  it('handles a 100% discount', () => {
    const calc = calculateTax({
      quantity: 1,
      rate: 5000,
      discountType: 'percentage',
      discountValue: 100,
      taxType: 'GST',
      taxRate: 18,
    });
    expect(calc.discountAmount).toBe(5000);
    expect(calc.taxableAmount).toBe(0);
    expect(calc.taxAmount).toBe(0);
    expect(calc.total).toBe(0);
  });

  it('ignores a negative rate, discount or tax rate (no refunds)', () => {
    expect(calculateTax({ quantity: 1, rate: -500 }).subtotal).toBe(0);
    expect(calculateTax({ quantity: 1, rate: 5000, discountType: 'fixed', discountValue: -100 }).discountAmount).toBe(0);
    expect(calculateTax({ quantity: 1, rate: 5000, taxType: 'GST', taxRate: -18 }).taxAmount).toBe(0);
    expect(calculateTax({ quantity: -3, rate: 5000 }).subtotal).toBe(0);
  });

  it('defaults a missing quantity to zero and a missing tax type to no tax', () => {
    const calc = calculateTax({ quantity: undefined as unknown as number, rate: 500 });
    expect(calc.subtotal).toBe(0);
    expect(calc.taxAmount).toBe(0);
  });
});

describe('calculateLineItem / calculateLineItems', () => {
  it('refreshes only the derived columns', () => {
    const input = item({ quantity: 3, rate: 1000, taxRate: 18, inspectionItemId: 'insp-1' });
    const result = calculateLineItem(input);

    expect(result.subtotal).toBe(3000);
    expect(result.taxAmount).toBe(540);
    expect(result.total).toBe(3540);
    // Inputs and provenance survive.
    expect(result.quantity).toBe(3);
    expect(result.inspectionItemId).toBe('insp-1');
    expect(result.id).toBe(input.id);
  });

  it('maps over a list, tolerating undefined', () => {
    expect(calculateLineItems([item({ rate: 100, taxType: 'NONE' })])[0].total).toBe(100);
    expect(calculateLineItems(undefined as unknown as EstimateLineItem[])).toEqual([]);
  });
});

describe('sumAdvances', () => {
  it('adds multiple advances', () => {
    expect(sumAdvances([payment(500), payment(1500)])).toBe(2000);
  });

  it('ignores empty, negative and malformed amounts', () => {
    expect(sumAdvances([])).toBe(0);
    expect(sumAdvances(undefined)).toBe(0);
    expect(sumAdvances([payment(-100), payment(250)])).toBe(250);
    expect(sumAdvances([{ amount: 'nope' } as unknown as AdvancePayment])).toBe(0);
  });
});

describe('computeEstimateTotals', () => {
  it('returns all-zero totals for an empty estimate', () => {
    expect(computeEstimateTotals([])).toEqual(EMPTY_TOTALS);
  });

  it('aggregates subtotal, discount, taxable amount and the tax split', () => {
    const totals = computeEstimateTotals([
      item({ id: 'a', rate: 10000, discountType: 'percentage', discountValue: 10, taxType: 'GST', taxRate: 18 }),
    ]);

    expect(totals).toMatchObject({
      subtotal: 10000,
      discountTotal: 1000,
      taxableAmount: 9000,
      cgst: 810,
      sgst: 810,
      igst: 0,
      taxTotal: 1620,
      roundOff: 0,
      grandTotal: 10620,
      advancePaid: 0,
      balanceDue: 10620,
    });
  });

  it('mixes multiple tax rates and types in one estimate', () => {
    const totals = computeEstimateTotals([
      item({ id: 'a', type: 'service', rate: 1000, taxType: 'GST', taxRate: 18 }), // intra -> 90/90
      item({ id: 'b', type: 'part', rate: 2000, taxType: 'IGST', taxRate: 12 }), // -> 240 igst
      item({ id: 'c', type: 'labour', rate: 500, taxType: 'NONE', taxRate: 18 }), // -> 0
    ]);

    expect(totals.subtotal).toBe(3500);
    expect(totals.cgst).toBe(90);
    expect(totals.sgst).toBe(90);
    expect(totals.igst).toBe(240);
    expect(totals.taxTotal).toBe(420);
    expect(totals.grandTotal).toBe(3920);
  });

  it('rounds the grand total and reports the round-off when enabled', () => {
    const totals = computeEstimateTotals(
      [item({ rate: 8469.15, taxType: 'GST', taxRate: 18, discountType: 'none' })],
      [],
      { roundOffEnabled: true }
    );

    expect(totals.taxTotal).toBe(1524.45);
    expect(totals.roundOff).toBe(0.4);
    expect(totals.grandTotal).toBe(9994);
    // Round-off always reconciles the gross to the grand total.
    expect(totals.grandTotal - totals.roundOff).toBeCloseTo(totals.taxableAmount + totals.taxTotal, 10);
  });

  it('leaves the grand total unrounded when round-off is disabled', () => {
    const totals = computeEstimateTotals(
      [item({ rate: 8469.15, taxType: 'GST', taxRate: 18 })],
      [],
      { roundOffEnabled: false }
    );

    expect(totals.roundOff).toBe(0);
    expect(totals.grandTotal).toBe(9993.6);
  });

  it('subtracts multiple advances from the grand total', () => {
    const totals = computeEstimateTotals(
      [item({ rate: 10000, taxType: 'GST', taxRate: 18 })],
      [payment(10000), payment(2000)]
    );

    expect(totals.grandTotal).toBe(11800);
    expect(totals.advancePaid).toBe(12000);
    expect(totals.balanceDue).toBe(-200);
  });

  it('follows the supply type passed in the tax config', () => {
    const totals = computeEstimateTotals(
      [item({ rate: 1000, taxType: 'GST', taxRate: 18 })],
      [],
      {},
      { supplyType: 'inter' }
    );

    expect(totals.igst).toBe(180);
    expect(totals.cgst).toBe(0);
    expect(totals.sgst).toBe(0);
  });

  it('keeps totals internally consistent for a large multi-line estimate', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      item({ id: `i-${i}`, rate: 1234.56 + i, quantity: 1 + (i % 3), taxType: 'GST', taxRate: 18 })
    );
    const totals = computeEstimateTotals(items);

    expect(roundMoney(totals.subtotal - totals.discountTotal)).toBe(totals.taxableAmount);
    expect(roundMoney(totals.cgst + totals.sgst + totals.igst)).toBe(totals.taxTotal);
    // Round-off is enabled by default, so the grand total is the gross rounded
    // to the nearest rupee.
    expect(totals.grandTotal).toBe(Math.round(roundMoney(totals.taxableAmount + totals.taxTotal)));
  });

  it('never produces a negative grand total from negative input', () => {
    const totals = computeEstimateTotals([item({ rate: -500, quantity: -1, taxRate: -18 })]);
    expect(totals.grandTotal).toBe(0);
    expect(totals.subtotal).toBe(0);
  });
});

describe('maxAllowedAdvance', () => {
  it('allows the full total when the cap is 100%', () => {
    expect(maxAllowedAdvance(50000, { advanceMaxPercent: 100, allowAdvanceExceedingTotal: false })).toBe(50000);
  });

  it('applies a lower percentage cap', () => {
    expect(maxAllowedAdvance(10000, { advanceMaxPercent: 25, allowAdvanceExceedingTotal: false })).toBe(2500);
  });

  it('returns Infinity when overpayment is explicitly permitted', () => {
    expect(maxAllowedAdvance(10000, { allowAdvanceExceedingTotal: true })).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats missing configuration as a full-total cap', () => {
    expect(maxAllowedAdvance(1000)).toBe(1000);
    expect(maxAllowedAdvance(-100)).toBe(0);
  });
});

describe('sumItemType', () => {
  it('totals only the requested item type', () => {
    const items = calculateLineItems([
      item({ id: 'a', type: 'service', rate: 1000, taxType: 'NONE' }),
      item({ id: 'b', type: 'part', rate: 2000, taxType: 'NONE' }),
      item({ id: 'c', type: 'part', rate: 500, taxType: 'NONE' }),
    ]);

    expect(sumItemType(items, 'part')).toBe(2500);
    expect(sumItemType(items, 'service')).toBe(1000);
    expect(sumItemType(items, 'labour')).toBe(0);
  });
});

describe('money formatting', () => {
  it('formats Indian currency with 2 decimals', () => {
    expect(formatMoney(125450).replace(/\u00a0/g, ' ')).toBe('₹1,25,450.00');
  });

  it('shows a dash for values that are not numbers', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });

  it('signs the discount and round-off rows', () => {
    const minus = formatSignedMoney(-1000).replace(/\u00a0/g, ' ');
    const plus = formatSignedMoney(250).replace(/\u00a0/g, ' ');
    expect(minus).toBe('-₹1,000.00');
    expect(plus).toBe('+₹250.00');
    expect(formatSignedMoney(0).replace(/\u00a0/g, ' ')).toBe('₹0.00');
  });
});
