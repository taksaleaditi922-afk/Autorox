import { calculateInventoryPriceTotals } from './inventoryPriceCalculations';

export const emptyBulkPart = () => ({
  productCode: '', productName: '', vehicleType: '4W', partType: '', brand: '', hsn: '', category: '', subCategory: '', quantity: '1', unit: 'Units',
  purchaseRate: '', purchaseDiscountPercent: '', purchaseDiscountAmount: '', purchaseTaxType: 'NONE', purchaseTaxPercent: '',
  saleRate: '', saleDiscountPercent: '', saleDiscountAmount: '', saleTaxType: 'NONE', saleTaxPercent: '',
});
export type BulkPartForm = ReturnType<typeof emptyBulkPart>;
export function bulkPartTotals(form: BulkPartForm, sale = false) {
  const prefix = sale ? 'sale' : 'purchase';
  return calculateInventoryPriceTotals(Number(form[`${prefix}Rate`]) || 0, sale ? 1 : Number(form.quantity) || 0, Number(form[`${prefix}DiscountAmount`]) || 0, form[`${prefix}TaxType`] === 'NONE' ? 0 : Number(form[`${prefix}TaxPercent`]) || 0);
}
export function prepareBulkPart(form: BulkPartForm) {
  if (!form.productCode.trim() || !form.productName.trim() || !form.partType || !form.unit.trim()) throw new Error('Enter the part number, name, type and unit.');
  if (!['2W', '4W'].includes(form.vehicleType) || !['OEM', 'Aftermarket', 'Other'].includes(form.partType)) throw new Error('Select a valid vehicle and part type.');
  const quantity = Number(form.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be greater than zero.');
  for (const prefix of ['purchase', 'sale'] as const) {
    const rate = Number(form[`${prefix}Rate`]), discount = Number(form[`${prefix}DiscountAmount`]), percent = Number(form[`${prefix}DiscountPercent`]);
    if (form[`${prefix}Rate`] === '' || !Number.isFinite(rate) || rate < 0) throw new Error(`Enter a valid ${prefix} rate.`);
    if (!Number.isFinite(discount) || discount < 0 || discount > rate || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error(`Enter a valid ${prefix} discount.`);
    if (!['NONE', 'GST', 'IGST'].includes(form[`${prefix}TaxType`]) || (form[`${prefix}TaxType`] !== 'NONE' && !['0', '5', '12', '18', '28'].includes(form[`${prefix}TaxPercent`]))) throw new Error(`Select a valid ${prefix} tax rate.`);
  }
  const purchaseTax = form.purchaseTaxType === 'NONE' ? 0 : Number(form.purchaseTaxPercent);
  const saleTax = form.saleTaxType === 'NONE' ? 0 : Number(form.saleTaxPercent);
  return {
    payload: {
      productCode: form.productCode.trim(), productName: form.productName.trim(), vehicleType: form.vehicleType, partType: form.partType,
      brand: form.brand.trim(), hsn: form.hsn.trim(), category: form.category.trim(), subCategory: form.subCategory.trim(),
      inventory: { quantity: 0, unit: form.unit.trim(), minimumLevel: 5 },
      pricing: { costPrice: Number(form.purchaseRate), sellingPrice: Number(form.saleRate), tax: saleTax,
        purchaseTaxType: form.purchaseTaxType, purchaseTaxPercent: purchaseTax, purchaseDiscountAmount: Number(form.purchaseDiscountAmount) || 0,
        saleTaxType: form.saleTaxType, saleTaxPercent: saleTax, saleDiscountAmount: Number(form.saleDiscountAmount) || 0 },
    },
    orderLine: { quantity, unitPrice: Number(form.purchaseRate), hsn: form.hsn.trim(), unit: form.unit.trim(), taxPercent: purchaseTax, discountType: 'Amount' as const, discountValue: Number(form.purchaseDiscountAmount) || 0 },
  };
}
