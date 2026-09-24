// ---------------------------------------------------------------------------
// Tests for the AUTHORITATIVE server-side money engine.
//
// Totals arriving from the client are never trusted, so these pin down the
// guarantees the generate/draft endpoints rely on: integer-paise math, a
// clamped discount, a data-driven tax split and a capped advance.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  calculateLineItem,
  calculateTax,
  computeEstimateTotals,
  fromPaise,
  formatMoney,
  maxAllowedAdvance,
  roundMoney,
  sanitizeAmount,
  sanitizeQuantity,
  splitTax,
  sumAdvances,
  toPaise,
} from './estimateMath.js';
import type { LineItemLike, PaymentLike } from './estimateMath.js';

function item(overrides: Partial<LineItemLike> = {}): LineItemLike {
  return {
    type: 'service',
    quantity: 1,
    rate: 1000,
    discountType: 'none',
    discountValue: 0,
    taxType: 'GST',
    taxRate: 18,
    ...overrides,
  };
}

describe('integer paise maths', () => {
  it('converts without floating point drift', () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(19.99)).toBe(1999);
    expect(fromPaise(1999)).toBe(19.99);
    expect(roundMoney(19.999)).toBe(20);
  });

  it('neutralises hostile input', () => {
    expect(toPaise('abc')).toBe(0);
    expect(toPaise(Number.NaN)).toBe(0);
    expect(sanitizeAmount(-99)).toBe(0);
    expect(sanitizeQuantity(0)).toBe(1);
    expect(sanitizeQuantity(-4, 1)).toBe(1);
    expect(sanitizeQuantity('2.5')).toBe(2.5);
  });
});

describe('tax engine', () => {
  it('splits intra-state GST into CGST + SGST', () => {
    expect(splitTax(180000, 'GST', 'intra')).toEqual({ cgst: 900, sgst: 900, igst: 0, taxTotal: 1800 });
  });

  it('routes an inter-state supply to IGST', () => {
    expect(splitTax(180000, 'GST', 'inter')).toEqual({ cgst: 0, sgst: 0, igst: 1800, taxTotal: 1800 });
  });

  it('applies no tax for the NONE type', () => {
    expect(calculateTax(item({ taxType: 'NONE' })).taxAmount).toBe(0);
  });

  it('computes the documented example (10% discount, 18% GST)', () => {
    const calc = calculateTax(
      item({ quantity: 1, rate: 10000, discountType: 'percentage', discountValue: 10 }),
      { supplyType: 'intra' }
    );

    expect(calc.subtotal).toBe(10000);
    expect(calc.discountAmount).toBe(1000);
    expect(calc.taxableAmount).toBe(9000);
    expect(calc.cgst).toBe(810);
    expect(calc.sgst).toBe(810);
    expect(calc.total).toBe(10620);
  });

  it('clamps a discount to the line amount and a percentage to 100', () => {
    expect(calculateTax(item({ rate: 500, discountType: 'fixed', discountValue: 999999 })).discountAmount).toBe(500);
    expect(calculateTax(item({ rate: 500, discountType: 'percentage', discountValue: 500 })).discountAmount).toBe(500);
  });

  it('treats a negative rate, quantity or tax rate as zero', () => {
    expect(calculateTax(item({ rate: -100 })).subtotal).toBe(0);
    expect(calculateTax(item({ quantity: -2 })).subtotal).toBe(0);
    expect(calculateTax(item({ taxRate: -18 })).taxAmount).toBe(0);
  });

  it('handles decimal quantities exactly', () => {
    expect(calculateTax(item({ quantity: 2.5, rate: 100.1, taxType: 'NONE' })).subtotal).toBe(250.25);
  });

  it('recalculates derived columns and keeps the inputs', () => {
    const result = calculateLineItem(item({ quantity: 3, rate: 1000 }));
    expect(result.subtotal).toBe(3000);
    expect(result.total).toBe(3540);
    expect(result.quantity).toBe(3);
    expect(result.rate).toBe(1000);
  });
});

describe('estimate totals', () => {
  it('is all zero for no items', () => {
    const totals = computeEstimateTotals([]);
    expect(totals.grandTotal).toBe(0);
    expect(totals.balanceDue).toBe(0);
  });

  it('follows subtotal -> discount -> taxable -> tax -> round off -> grand total', () => {
    const totals = computeEstimateTotals([
      item({ rate: 10000, discountType: 'percentage', discountValue: 10 }),
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
    });
  });

  it('aggregates mixed tax rates and types', () => {
    const totals = computeEstimateTotals([
      item({ rate: 1000, taxType: 'GST', taxRate: 18 }),
      item({ rate: 2000, taxType: 'IGST', taxRate: 12 }),
      item({ rate: 500, taxType: 'NONE', taxRate: 18 }),
    ]);

    expect(totals.subtotal).toBe(3500);
    expect(totals.cgst).toBe(90);
    expect(totals.sgst).toBe(90);
    expect(totals.igst).toBe(240);
    expect(totals.taxTotal).toBe(420);
    expect(totals.grandTotal).toBe(3920);
  });

  it('rounds to the nearest rupee and reports the round-off', () => {
    const totals = computeEstimateTotals([item({ rate: 8469.15 })], [], { roundOffEnabled: true });

    expect(totals.taxTotal).toBe(1524.45);
    expect(totals.roundOff).toBe(0.4);
    expect(totals.grandTotal).toBe(9994);
    expect(totals.grandTotal - totals.roundOff).toBeCloseTo(totals.taxableAmount + totals.taxTotal, 10);
  });

  it('can leave the total unrounded', () => {
    expect(computeEstimateTotals([item({ rate: 8469.15 })], [], { roundOffEnabled: false }).grandTotal).toBe(9993.6);
  });

  it('derives the balance due from every recorded advance', () => {
    const payments: PaymentLike[] = [{ amount: 10000 }, { amount: 500 }];
    const totals = computeEstimateTotals([item({ rate: 10000 })], payments);

    expect(totals.grandTotal).toBe(11800);
    expect(totals.advancePaid).toBe(10500);
    expect(totals.balanceDue).toBe(1300);
  });

  it('takes the supply type from the business config when no tax config is given', () => {
    const totals = computeEstimateTotals([item({ rate: 1000 })], [], { supplyType: 'inter' });

    expect(totals.igst).toBe(180);
    expect(totals.cgst).toBe(0);
  });

  it('never returns a negative grand total', () => {
    expect(computeEstimateTotals([item({ rate: -100, quantity: -1, taxRate: -18 })]).grandTotal).toBe(0);
  });
});

describe('advance handling', () => {
  it('sums payments and ignores junk amounts', () => {
    expect(sumAdvances([{ amount: 100 }, { amount: '50' }, { amount: 'x' }, { amount: -25 }])).toBe(150);
    expect(sumAdvances(undefined)).toBe(0);
  });

  it('caps the advance at the configured percentage of the total', () => {
    expect(maxAllowedAdvance(10000, { advanceMaxPercent: 50, allowAdvanceExceedingTotal: false })).toBe(5000);
    expect(maxAllowedAdvance(10000, { advanceMaxPercent: 100, allowAdvanceExceedingTotal: false })).toBe(10000);
  });

  it('only allows an overpayment when the business explicitly permits it', () => {
    expect(maxAllowedAdvance(10000, { allowAdvanceExceedingTotal: true })).toBe(Number.POSITIVE_INFINITY);
    expect(maxAllowedAdvance(10000, { allowAdvanceExceedingTotal: false })).toBe(10000);
  });
});

describe('currency formatting', () => {
  it('formats Indian amounts with two decimals', () => {
    expect(formatMoney(125450).replace(/\u00a0/g, ' ')).toBe('₹1,25,450.00');
  });

  it('degrades gracefully', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });
});
