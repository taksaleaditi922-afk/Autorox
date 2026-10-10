import { describe, expect, it } from 'vitest';
import { buildInvoiceHtml } from './invoicePrintService';
import { purchaseInvoiceForPrint } from './purchaseInvoiceService';
const invoice = { invoiceNumber: 'PI-TEST', date: '2026-10-05', generatedAt: '2026-10-05', vendor: { id: null, name: 'Vendor <script>' }, items: [{ productId: 'p', partName: 'Brake pad', partNumber: 'BP1', quantity: 5, unitPrice: 100, taxPercent: 18, taxAmount: 81, discountTotal: 50, totalAmount: 531 }], subtotal: 500, discountTotal: 50, taxAmount: 81, totalAmount: 531 };
describe('purchase invoice printing', () => {
  it('renders the stored invoice totals and vendor using the website primary color', () => {
    const printable = purchaseInvoiceForPrint(invoice, '#0f172a');
    expect(printable.grandTotal).toBe(531);
    expect(printable.items[0].total).toBe(531);
    const html = buildInvoiceHtml(printable);
    expect(html).toContain('PURCHASE INVOICE');
    expect(html).toContain('PI-TEST');
    expect(html).toContain('Vendor &lt;script&gt;');
    expect(html).toContain('Vendor Signature');
    expect(html).toContain('background:#0f172a');
    expect(html).not.toContain('TAX INVOICE');
    expect(html).not.toContain('<script>');
  });
});
