import { describe, expect, it } from 'vitest';
import {
  computeJobCardTotals,
  computeLineItem,
  createLineItem,
  discountLabel,
  isStockShort,
  resolveDiscountType,
  resolveTaxType,
} from './jobCardPricing';

describe('computeLineItem', () => {
  it('multiplies quantity by rate and applies GST', () => {
    const line = computeLineItem({ name: 'Oil', type: 'service', qty: 2, price: 100, taxType: 'GST', taxRate: 18 });
    expect(line.subtotal).toBe(200);
    expect(line.taxAmount).toBe(36);
    expect(line.total).toBe(236);
  });

  it('ignores the rate when the tax type is None', () => {
    const line = computeLineItem({ name: 'Wash', type: 'service', qty: 1, price: 500, taxType: 'None', taxRate: 18 });
    expect(line.taxAmount).toBe(0);
    expect(line.total).toBe(500);
  });

  it('treats a legacy row with a rate but no tax type as taxable', () => {
    expect(computeLineItem({ name: 'Old', type: 'service', qty: 1, price: 100, taxRate: 18 }).taxAmount).toBe(18);
    expect(computeLineItem({ name: 'Old', type: 'service', qty: 1, price: 100, taxRate: 0 }).taxAmount).toBe(0);
  });

  it('applies a percentage discount before tax', () => {
    const line = computeLineItem({
      name: 'Service',
      type: 'service',
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

  it('caps a flat discount at the line subtotal', () => {
    const line = computeLineItem({
      name: 'Filter',
      type: 'part',
      qty: 1,
      price: 200,
      taxType: 'None',
      discountType: 'flat',
      discountValue: 500,
    });
    expect(line.discountAmount).toBe(200);
    expect(line.total).toBe(0);
  });

  it('is paise safe for fractional quantities', () => {
    expect(computeLineItem({ name: 'Oil', type: 'service', qty: 0.5, price: 33.33, taxType: 'None' }).subtotal).toBe(16.67);
  });
});

describe('computeJobCardTotals', () => {
  it('separates the line discounts from the order level discount', () => {
    const totals = computeJobCardTotals({
      lineItems: [
        { name: 'Filter', type: 'part', qty: 1, price: 400, taxType: 'None', discountType: 'percent', discountValue: 25 },
      ],
      discount: 50,
      advance: 100,
    });
    expect(totals.subtotal).toBe(400);
    expect(totals.lineDiscount).toBe(100);
    expect(totals.discount).toBe(50);
    expect(totals.grandTotal).toBe(250);
    expect(totals.balanceDue).toBe(150);
  });

  it('keeps the order discount inside the taxable value', () => {
    const totals = computeJobCardTotals({
      lineItems: [{ name: 'Wash', type: 'service', qty: 1, price: 100, taxType: 'None' }],
      discount: 9999,
    });
    expect(totals.discount).toBe(100);
    expect(totals.grandTotal).toBe(0);
    expect(totals.balanceDue).toBe(0);
  });
});

describe('helpers', () => {
  it('flags a part above its captured stock', () => {
    const line = createLineItem({ name: 'Pad', type: 'part', qty: 3, stockAvailable: 2 });
    expect(isStockShort(line)).toBe(true);
    expect(isStockShort(createLineItem({ name: 'Pad', type: 'part', qty: 1, stockAvailable: 2 }))).toBe(false);
  });

  it('never warns for a service row', () => {
    expect(isStockShort(createLineItem({ name: 'Wash', type: 'service', qty: 99, stockAvailable: 1 }))).toBe(false);
  });

  it('defaults a new row to GST at the standard rate', () => {
    const line = createLineItem();
    expect(line.taxType).toBe('GST');
    expect(line.taxRate).toBe(18);
    expect(line.qty).toBe(1);
  });

  it('labels discounts for the review table', () => {
    expect(discountLabel(createLineItem({ discountType: 'percent', discountValue: 10 }))).toBe('10%');
    expect(discountLabel(createLineItem({ discountType: 'flat', discountValue: 150 }))).toBe('₹150');
    expect(discountLabel(createLineItem({ discountType: 'none', discountValue: 10 }))).toBe('—');
  });

  it('normalises unknown tax and discount types', () => {
    expect(resolveTaxType({ taxType: 'VAT', taxRate: 5 })).toBe('GST');
    expect(resolveDiscountType({ discountType: 'half' })).toBe('none');
  });
});
