import { describe, expect, it } from 'vitest';
import { buildInvoiceHtml, invoiceFromCounterSale, invoiceFromSale } from './invoicePrintService';

describe('invoice print service', () => {
  it('normalizes and renders a stored bill as a tax invoice', () => {
    const invoice = invoiceFromSale({
      billNumber: 'INV-1001',
      billDate: '2026-10-01T10:00:00.000Z',
      customer: { name: 'Ravi Kumar', phone: '9876543210' },
      items: [{ productName: 'Brake Pad', productCode: 'BP-1', quantity: 2, unitPrice: 1000, totalPrice: 2000, tax: 18, taxAmount: 360 }],
      billing: { subtotal: 2000, discountAmount: 0, taxAmount: 360, grandTotal: 2360 },
      payment: { status: 'Paid', amountPaid: 2360, balance: 0, method: 'UPI' },
    });
    const html = buildInvoiceHtml(invoice);

    expect(html).toContain('TAX INVOICE');
    expect(html).toContain('INV-1001');
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('Brake Pad');
    expect(html).toContain('Print / Save as PDF');
  });

  it('uses the assigned counter-sale invoice number and paid balance', () => {
    const invoice = invoiceFromCounterSale({
      invoiceNumber: 'S26-1769-0015',
      date: '15/09/2026',
      customerName: 'Manmeet Singh',
      contactNumber: '8825048214',
      paymentStatus: 'PAID',
      items: [{ name: 'Periodic service', qty: 1, price: 4500 }],
      total: 4500,
    });

    expect(invoice.invoiceNumber).toBe('S26-1769-0015');
    expect(invoice.amountPaid).toBe(4500);
    expect(invoice.balanceDue).toBe(0);
  });

  it('escapes customer and item content in the printable document', () => {
    const invoice = invoiceFromCounterSale({
      invoiceNumber: 'INV-XSS',
      date: '01/10/2026',
      customerName: '<script>alert(1)</script>',
      paymentStatus: 'PAID',
      items: [{ name: '<img src=x>', qty: 1, price: 100 }],
      total: 100,
    });
    const html = buildInvoiceHtml(invoice);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
  });
});
