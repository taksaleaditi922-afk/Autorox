import type { PartOrder, PurchaseInvoice } from './partOrdersService';
import type { PrintableInvoice } from './invoicePrintService';
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export function purchaseInvoiceForPrint(invoice: PurchaseInvoice, primaryColor: string, order?: PartOrder): PrintableInvoice {
  return {
    documentTitle: 'PURCHASE INVOICE', partyLabel: 'Vendor', personLabel: 'Vendor', signatureLabel: 'Vendor Signature',
    documentFooter: 'Computer generated purchase invoice', primaryColor,
    invoiceNumber: invoice.invoiceNumber, date: invoice.date, status: order?.status || 'Pending',
    customer: { name: invoice.vendor.name || 'Not specified', phone: invoice.vendor.phone },
    items: invoice.items.map(item => ({ name: item.partName, code: item.partNumber, hsnSacCode: item.hsn, unit: item.unit, rate: item.unitPrice, quantity: item.quantity, taxRate: item.taxPercent, taxAmount: item.taxAmount, total: item.totalAmount ?? item.quantity * item.unitPrice })),
    subtotal: invoice.subtotal, discount: invoice.discountTotal, tax: invoice.taxAmount, grandTotal: invoice.totalAmount,
    amountPaid: 0, balanceDue: invoice.totalAmount,
    notes: invoice.billNumber ? `Vendor bill: ${invoice.billNumber}` : 'Purchase order invoice',
  };
}
