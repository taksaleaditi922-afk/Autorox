import { describe, expect, it } from 'vitest';
import {
  calculateInventoryPriceTotals,
  discountAmountFromPercent,
  discountPercentFromAmount,
  getProfitPerItem,
} from './inventoryPriceCalculations';

describe('inventory price calculations', () => {
  it('calculates subtotal, per-item discount, tax and total', () => {
    const discountPerItem = discountAmountFromPercent(100, 10);
    const totals = calculateInventoryPriceTotals(100, 5, discountPerItem, 18);

    expect(totals).toEqual({
      subtotal: 500,
      discountTotal: 50,
      taxableAmount: 450,
      taxAmount: 81,
      totalAmount: 531,
    });
  });

  it('converts a per-item discount in both directions', () => {
    expect(discountAmountFromPercent(100, 10)).toBe(10);
    expect(discountPercentFromAmount(100, 10)).toBe(10);
    expect(discountPercentFromAmount(0, 10)).toBe(0);
  });

  it('calculates per-item profit after discounts', () => {
    expect(getProfitPerItem(100, 10, 150, 15)).toBe(45);
  });
});
