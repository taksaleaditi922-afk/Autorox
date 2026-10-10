// Shared by Inventory, bulk-order previews, and the backend. Amount discounts are per unit.
export function calculatePriceTotals(rate, quantity, discountPerItem, taxPercent) {
  const subtotal = rate * quantity;
  const discountTotal = discountPerItem * quantity;
  const taxableAmount = subtotal - discountTotal;
  const taxAmount = taxableAmount * (taxPercent / 100);
  return { subtotal, discountTotal, taxableAmount, taxAmount, totalAmount: taxableAmount + taxAmount };
}
export const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
export function calculateOrderLine(line) {
  const rate = Number(line.unitPrice), quantity = Number(line.quantity);
  const discount = Number(line.discountValue || 0), tax = Number(line.taxPercent || 0);
  if (![rate, quantity, discount, tax].every(Number.isFinite) || rate < 0 || quantity <= 0 || discount < 0 || tax < 0 || tax > 100) throw new Error('Invalid rate, quantity, discount or tax');
  if (!['Percentage', 'Amount'].includes(line.discountType || 'Percentage')) throw new Error('Invalid discount type');
  const discountPerItem = line.discountType === 'Amount' ? discount : rate * discount / 100;
  if (discountPerItem > rate || (line.discountType !== 'Amount' && discount > 100)) throw new Error('Discount exceeds the price');
  const values = calculatePriceTotals(rate, quantity, discountPerItem, tax);
  const subtotal = roundMoney(values.subtotal), discountTotal = roundMoney(values.discountTotal);
  const taxAmount = roundMoney(values.taxAmount);
  const totalAmount = roundMoney(subtotal - discountTotal + taxAmount);
  if (![subtotal, discountTotal, taxAmount, totalAmount].every(Number.isFinite)) throw new Error('Order value is too large');
  return { subtotal, discountTotal, taxableAmount: roundMoney(subtotal - discountTotal), taxAmount, totalAmount };
}
export function calculateOrderTotals(lines) {
  return lines.reduce((sum, line) => {
    const result = calculateOrderLine(line);
    return { subtotal: roundMoney(sum.subtotal + result.subtotal), discountTotal: roundMoney(sum.discountTotal + result.discountTotal), taxAmount: roundMoney(sum.taxAmount + result.taxAmount), totalAmount: roundMoney(sum.totalAmount + result.totalAmount) };
  }, { subtotal: 0, discountTotal: 0, taxAmount: 0, totalAmount: 0 });
}
