import { describe, expect, it } from 'vitest';
import { bulkPartTotals, emptyBulkPart, prepareBulkPart } from './bulkPartCreation';
const sample = () => ({ ...emptyBulkPart(), productCode: ' NEW-1 ', productName: 'Wheel', partType: 'OEM', brand: 'Example', hsn: '8708', unit: 'Set', quantity: '5', purchaseRate: '100', purchaseDiscountPercent: '10', purchaseDiscountAmount: '10', purchaseTaxType: 'GST', purchaseTaxPercent: '18', saleRate: '150' });
describe('creating a part from bulk order details', () => {
  it('creates zero stock and carries requested quantity, purchase pricing and metadata into the order', () => {
    const result = prepareBulkPart(sample());
    expect(result.payload.inventory).toEqual({ quantity: 0, unit: 'Set', minimumLevel: 5 });
    expect(result.payload).toMatchObject({ productCode: 'NEW-1', brand: 'Example', hsn: '8708', pricing: { purchaseTaxType: 'GST', purchaseTaxPercent: 18, purchaseDiscountAmount: 10 } });
    expect(result.orderLine).toEqual({ quantity: 5, unitPrice: 100, hsn: '8708', unit: 'Set', taxPercent: 18, discountType: 'Amount', discountValue: 10 });
  });
  it('calculates purchase totals for quantity and sale totals for a single item', () => {
    expect(bulkPartTotals(sample())).toMatchObject({ subtotal: 500, discountTotal: 50, taxAmount: 81, totalAmount: 531 });
    expect(bulkPartTotals(sample(), true)).toMatchObject({ subtotal: 150, totalAmount: 150 });
  });
  it('supports custom units and no tax', () => {
    const result = prepareBulkPart({ ...sample(), unit: 'Bottle', purchaseTaxType: 'NONE' });
    expect(result.orderLine).toMatchObject({ unit: 'Bottle', taxPercent: 0 });
    expect(result.payload.pricing.tax).toBe(0);
  });
  it.each([{ quantity: '0' }, { quantity: '-1' }, { purchaseRate: '' }, { saleRate: '' }, { purchaseDiscountAmount: '101' }, { purchaseTaxPercent: '' }, { productName: '' }, { partType: '' }])('rejects incomplete or invalid fields %j', patch => {
    expect(() => prepareBulkPart({ ...sample(), ...patch })).toThrow();
  });
});
