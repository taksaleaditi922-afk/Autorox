export interface PricingLine { unitPrice: number | string; quantity: number | string; discountType?: 'Percentage' | 'Amount'; discountValue?: number | string; taxPercent?: number | string }
export interface PriceTotals { subtotal: number; discountTotal: number; taxableAmount: number; taxAmount: number; totalAmount: number }
export function calculatePriceTotals(rate: number, quantity: number, discountPerItem: number, taxPercent: number): PriceTotals;
export function roundMoney(value: number): number;
export function calculateOrderLine(line: PricingLine): PriceTotals;
export function calculateOrderTotals(lines: PricingLine[]): Omit<PriceTotals, 'taxableAmount'>;
