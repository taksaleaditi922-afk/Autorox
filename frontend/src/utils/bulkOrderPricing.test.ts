import { describe, expect, it } from 'vitest';
import { calculateOrderLine, calculateOrderTotals } from '../../../shared/partOrderPricing.mjs';
import { calculateInventoryPriceTotals, discountAmountFromPercent } from './inventoryPriceCalculations';
const sample = { unitPrice: 100, quantity: 5, discountType: 'Percentage' as const, discountValue: 10, taxPercent: 18 };
describe('shared bulk order pricing', () => {
  it('matches Inventory and applies GST after discount: 500 - 50 + 81 = 531', () => {
    expect(calculateOrderLine(sample)).toEqual(calculateInventoryPriceTotals(100, 5, discountAmountFromPercent(100, 10), 18));
    expect(calculateOrderTotals([sample])).toEqual({ subtotal: 500, discountTotal: 50, taxAmount: 81, totalAmount: 531 });
  });
  it('treats amount discounts as per-unit amounts, matching Add Part', () => {
    expect(calculateOrderLine({ ...sample, discountType: 'Amount', discountValue: 10 }).totalAmount).toBe(531);
  });
  it('rounds each displayed amount and the aggregate to cents', () => {
    const line = { unitPrice: 19.99, quantity: 3, taxPercent: 18, discountValue: 7.5 };
    const totals = calculateOrderTotals([line, line]);
    expect(totals).toEqual({ subtotal: 119.94, discountTotal: 9, taxAmount: 19.98, totalAmount: 130.92 });
    expect(totals.totalAmount).toBe(Math.round((totals.subtotal - totals.discountTotal + totals.taxAmount) * 100) / 100);
  });
  it('allows zero rates and rejects invalid quantities, tax and excessive discounts', () => {
    expect(calculateOrderLine({ unitPrice: 0, quantity: 1 }).totalAmount).toBe(0);
    for (const patch of [{ quantity: 0 }, { quantity: -2 }, { unitPrice: NaN }, { taxPercent: 101 }, { discountValue: 101 }, { discountType: 'Amount', discountValue: 101 }]) expect(() => calculateOrderLine({ ...sample, ...patch })).toThrow();
  });
});
