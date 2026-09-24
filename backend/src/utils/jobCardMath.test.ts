// ---------------------------------------------------------------------------
// Tests for the job card pricing engine.
//
// Covers the paths Step 3 / Step 4 depend on: per-line discount caps, tax types,
// the order level discount clamp and the advance -> balance calculation.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  calculateDiscount,
  computeJobCardTotals,
  computeLineItem,
  derivePaymentStatus,
  resolveDiscountType,
  resolveTaxType,
} from './jobCardMath.js';

describe('computeLineItem', () => {
  it('multiplies quantity by rate and applies GST', () => {
    const line = computeLineItem({ qty: 2, price: 100, taxType: 'GST', taxRate: 18 });
    expect(line.subtotal).toBe(200);
    expect(line.discountAmount).toBe(0);
    expect(line.taxAmount).toBe(36);
    expect(line.total).toBe(236);
  });

  it('ignores the rate when the tax type is None', () => {
    const line = computeLineItem({ qty: 1, price: 500, taxType: 'None', taxRate: 18 });
    expect(line.taxAmount).toBe(0);
    expect(line.total).toBe(500);
  });

  it('treats a legacy line item with a rate but no tax type as taxable', () => {
    const line = computeLineItem({ qty: 1, price: 100, taxRate: 18 });
    expect(line.taxAmount).toBe(18);
  });

  it('applies a percentage discount before tax', () => {
    const line = computeLineItem({
      qty: 1,
      price: 1000,
      taxType: 'GST',
      taxRate: 18,
      discountType: 'percent',
      discountValue: 10,
    });
    expect(line.discountAmount).toBe(100);
    expect(line.taxableAmount).toBe(900);
    expect(line.taxAmount).toBe(162);
    expect(line.total).toBe(1062);
  });

  it('applies a flat discount and never exceeds the subtotal', () => {
    const line = computeLineItem({
      qty: 1,
      price: 200,
      taxType: 'None',
      discountType: 'flat',
      discountValue: 500,
    });
    expect(line.discountAmount).toBe(200);
    expect(line.total).toBe(0);
  });

  it('handles fractional quantities without float drift', () => {
    const line = computeLineItem({ qty: 0.5, price: 33.33, taxType: 'None' });
    expect(line.subtotal).toBe(16.67);
  });
});

describe('calculateDiscount', () => {
  it('clamps a percentage above 100', () => {
    expect(calculateDiscount(10000, 'percent', 250)).toBe(10000);
  });

  it('returns zero for the none type', () => {
    expect(calculateDiscount(10000, 'none', 50)).toBe(0);
  });
});

describe('resolveTaxType / resolveDiscountType', () => {
  it('normalises unknown values', () => {
    expect(resolveTaxType({ taxType: 'VAT', taxRate: 5 })).toBe('GST');
    expect(resolveTaxType({})).toBe('None');
    expect(resolveDiscountType({ discountType: 'half' })).toBe('none');
    expect(resolveDiscountType({ discountType: 'flat' })).toBe('flat');
  });
});

describe('computeJobCardTotals', () => {
  it('sums the lines, subtracts the order discount and the advance', () => {
    const totals = computeJobCardTotals({
      services: [
        { name: 'Oil change', qty: 2, price: 100, taxType: 'GST', taxRate: 18 },
        { name: 'Wash', qty: 1, price: 500, taxType: 'None' },
      ],
      discount: 100,
      advance: { amount: 150 },
    });

    expect(totals.subtotal).toBe(700);
    expect(totals.lineDiscount).toBe(0);
    expect(totals.tax).toBe(36);
    expect(totals.discount).toBe(100);
    expect(totals.total).toBe(636);
    expect(totals.grandTotal).toBe(636);
    expect(totals.balanceDue).toBe(486);
  });

  it('reports the per-line discounts separately from the order discount', () => {
    const totals = computeJobCardTotals({
      lineItems: [{ name: 'Filter', qty: 1, price: 400, taxType: 'None', discountType: 'percent', discountValue: 25 }],
      advanceAmount: 50,
    });

    expect(totals.subtotal).toBe(400);
    expect(totals.lineDiscount).toBe(100);
    expect(totals.total).toBe(300);
    expect(totals.advanceDeducted).toBe(50);
    expect(totals.balanceDue).toBe(250);
  });

  it('never lets the order discount push the total below zero', () => {
    const totals = computeJobCardTotals({
      lineItems: [{ name: 'Wash', qty: 1, price: 100, taxType: 'None' }],
      discount: 9999,
    });
    expect(totals.discount).toBe(100);
    expect(totals.total).toBe(0);
  });

  it('prefers the advance object over the legacy intake amount', () => {
    const totals = computeJobCardTotals({
      lineItems: [{ name: 'Wash', qty: 1, price: 100, taxType: 'None' }],
      advance: { amount: 80 },
      advanceAmount: 10,
    });
    expect(totals.advanceDeducted).toBe(80);
  });

  it('is empty and safe for a job card with no items', () => {
    const totals = computeJobCardTotals({});
    expect(totals.grandTotal).toBe(0);
    expect(totals.balanceDue).toBe(0);
  });
});

describe('derivePaymentStatus', () => {
  it('marks the order paid once the advance covers the total', () => {
    expect(derivePaymentStatus({ total: 100, balanceDue: 0 })).toBe('Paid');
  });

  it('keeps it pending while a balance remains', () => {
    expect(derivePaymentStatus({ total: 100, balanceDue: 100 })).toBe('Pending');
  });
});
