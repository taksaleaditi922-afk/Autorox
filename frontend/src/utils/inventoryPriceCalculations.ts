import { calculatePriceTotals } from '../../../shared/partOrderPricing.mjs';

export interface InventoryPriceTotals {
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export function calculateInventoryPriceTotals(
  rate: number,
  quantity: number,
  discountPerItem: number,
  taxPercent: number,
): InventoryPriceTotals {
  return calculatePriceTotals(rate, quantity, discountPerItem, taxPercent);
}

export function discountAmountFromPercent(rate: number, percent: number): number {
  return rate * (percent / 100);
}

export function discountPercentFromAmount(rate: number, amount: number): number {
  return rate === 0 ? 0 : (amount / rate) * 100;
}

export function getProfitPerItem(
  purchaseRate: number,
  purchaseDiscount: number,
  saleRate: number,
  saleDiscount: number,
): number {
  return saleRate - saleDiscount - (purchaseRate - purchaseDiscount);
}
