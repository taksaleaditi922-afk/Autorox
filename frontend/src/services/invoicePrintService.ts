import { computeLineItem, computeOrderSummary, type JobCardFormState } from '../utils/jobCard';
import {
  resolveJobCardDocumentConfig,
  type JobCardDocumentConfig,
} from './jobCard/documentService';

export interface PrintableInvoiceItem {
  name: string;
  code?: string;
  hsnSacCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
}

export interface PrintableInvoice {
  documentTitle?: string;
  partyLabel?: string;
  personLabel?: string;
  signatureLabel?: string;
  documentFooter?: string;
  primaryColor?: string;
  invoiceNumber: string;
  date: string | Date;
  status: string;
  customer: { name: string; phone?: string; email?: string; address?: string; gstNumber?: string };
  vehicle?: { registrationNumber?: string; description?: string };
  advisor?: string;
  items: PrintableInvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod?: string;
  notes?: string;
}

export interface OpenInvoiceOptions {
  autoPrint?: boolean;
}

const numeric = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeHtml = (input: unknown): string =>
  String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const display = (input: unknown, fallback = '—'): string => {
  const value = String(input ?? '').trim();
  return value ? escapeHtml(value) : fallback;
};

const formatMoney = (amount: unknown, currency = 'INR'): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric(amount));

const formatDate = (input: string | Date): string => {
  if (typeof input === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(input)) return escapeHtml(input);
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return display(input);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

export function invoiceFromSale(sale: any): PrintableInvoice {
  const items = (sale?.items || []).map((item: any) => ({
    name: item.productName || item.name || 'Item',
    code: item.productCode,
    hsnSacCode: item.hsnSacCode,
    quantity: numeric(item.quantity ?? item.qty) || 1,
    unit: item.unit || 'nos',
    rate: numeric(item.unitPrice ?? item.price ?? item.rate),
    taxRate: numeric(item.tax ?? item.taxRate),
    taxAmount: numeric(item.taxAmount),
    total: numeric(item.totalPrice) + numeric(item.taxAmount),
  }));
  const billing = sale?.billing || {};
  const payment = sale?.payment || {};
  const grandTotal = numeric(billing.grandTotal) || items.reduce((sum: number, item: PrintableInvoiceItem) => sum + item.total, 0);
  const amountPaid = numeric(payment.amountPaid);
  return {
    invoiceNumber: sale?.invoiceNumber || sale?.billNumber || 'DRAFT-INVOICE',
    date: sale?.billDate || sale?.date || new Date(),
    status: payment.status || sale?.paymentStatus || (amountPaid >= grandTotal ? 'Paid' : 'Pending'),
    customer: {
      name: sale?.customer?.name || sale?.customerName || 'Walk-in Customer',
      phone: sale?.customer?.phone || sale?.contactNumber,
      email: sale?.customer?.email,
      address: sale?.customer?.address,
      gstNumber: sale?.customer?.gstNumber,
    },
    advisor: sale?.advisor?.name,
    items,
    subtotal: numeric(billing.subtotal) || items.reduce((sum: number, item: PrintableInvoiceItem) => sum + item.rate * item.quantity, 0),
    discount: numeric(billing.discountAmount),
    tax: numeric(billing.taxAmount) || items.reduce((sum: number, item: PrintableInvoiceItem) => sum + numeric(item.taxAmount), 0),
    grandTotal,
    amountPaid,
    balanceDue: payment.balance === undefined ? Math.max(0, grandTotal - amountPaid) : numeric(payment.balance),
    paymentMethod: payment.method,
    notes: sale?.notes,
  };
}

export function invoiceFromCounterSale(sale: any): PrintableInvoice {
  const items = (sale?.items || []).map((item: any) => ({
    name: item.name || item.productName || 'Item',
    quantity: numeric(item.qty ?? item.quantity) || 1,
    unit: item.unit || 'nos',
    rate: numeric(item.price ?? item.unitPrice),
    taxRate: numeric(item.taxRate ?? item.tax),
    taxAmount: numeric(item.taxAmount),
    total: numeric(item.total) || numeric(item.totalPrice) || numeric(item.price ?? item.unitPrice) * (numeric(item.qty ?? item.quantity) || 1),
  }));
  const total = numeric(sale?.total) || items.reduce((sum: number, item: PrintableInvoiceItem) => sum + item.total, 0);
  const paid = sale?.paymentStatus === 'PAID' ? total : numeric(sale?.amountPaid);
  return {
    invoiceNumber: sale?.invoiceNumber || 'DRAFT-INVOICE',
    date: sale?.date || new Date(),
    status: sale?.paymentStatus === 'PAID' ? 'Paid' : 'Not Paid',
    customer: { name: sale?.customerName || 'Walk-in Customer', phone: sale?.contactNumber },
    items,
    subtotal: total,
    discount: 0,
    tax: items.reduce((sum: number, item: PrintableInvoiceItem) => sum + numeric(item.taxAmount), 0),
    grandTotal: total,
    amountPaid: paid,
    balanceDue: Math.max(0, total - paid),
    paymentMethod: sale?.paymentMethod,
  };
}

export function invoiceFromJobCardForm(
  form: JobCardFormState,
  options: { reference?: string; date?: string; grandTotal?: number } = {}
): PrintableInvoice {
  const totals = computeOrderSummary(form);
  const items = form.lineItems.map((line) => {
    const calculated = computeLineItem(line);
    return {
      name: line.name || 'Item',
      code: line.partNumber,
      hsnSacCode: line.hsnSacCode,
      quantity: numeric(line.qty) || 1,
      unit: line.unit || 'nos',
      rate: numeric(line.price),
      taxRate: numeric(line.taxRate),
      taxAmount: calculated.taxAmount,
      total: calculated.total,
    };
  });
  const grandTotal = options.grandTotal ?? totals.grandTotal;
  const extraDiscount = Math.max(0, totals.grandTotal - grandTotal);
  const amountPaid = totals.advanceDeducted;
  return {
    invoiceNumber: options.reference ? `INV-${options.reference}` : 'DRAFT-INVOICE',
    date: options.date || new Date().toISOString(),
    status: amountPaid >= grandTotal ? 'Paid' : amountPaid > 0 ? 'Partially Paid' : 'Pending',
    customer: {
      name: form.customer.name || 'Walk-in Customer',
      phone: form.customer.phone,
      email: form.customer.email,
      address: form.customer.address,
      gstNumber: form.customer.gstNumber,
    },
    vehicle: {
      registrationNumber: form.vehicle.registrationNumber,
      description: [form.vehicle.brand, form.vehicle.model].filter(Boolean).join(' '),
    },
    items,
    subtotal: totals.subtotal,
    discount: totals.lineDiscount + totals.discount + extraDiscount,
    tax: totals.tax,
    grandTotal,
    amountPaid,
    balanceDue: Math.max(0, grandTotal - amountPaid),
    paymentMethod: form.orderSummary.paymentMethod,
    notes: form.orderSummary.remarks || form.notes,
  };
}

export function buildInvoiceHtml(
  invoice: PrintableInvoice,
  config: JobCardDocumentConfig = resolveJobCardDocumentConfig()
): string {
  const rows = invoice.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${display(item.name)}</strong>${item.code ? `<div class="muted">${display(item.code)}</div>` : ''}</td>
      <td>${display(item.hsnSacCode)}</td>
      <td class="number">${numeric(item.quantity)} ${display(item.unit, '')}</td>
      <td class="number">${formatMoney(item.rate, config.currency)}</td>
      <td class="number">${item.taxRate ? `${numeric(item.taxRate)}%` : '—'}${item.taxAmount ? `<div class="muted">${formatMoney(item.taxAmount, config.currency)}</div>` : ''}</td>
      <td class="number"><strong>${formatMoney(item.total, config.currency)}</strong></td>
    </tr>`).join('');
  const vehicle = invoice.vehicle?.registrationNumber || invoice.vehicle?.description
    ? `<div class="detail"><span>Vehicle</span><strong>${display([invoice.vehicle?.registrationNumber, invoice.vehicle?.description].filter(Boolean).join(' · '))}</strong></div>`
    : '';
  const terms = (config.terms || []).map((term) => `<li>${display(term)}</li>`).join('');

  const primaryColor = /^#[a-f\d]{3,8}$/i.test(invoice.primaryColor || '') ? invoice.primaryColor : '#bd0926';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${display(invoice.invoiceNumber)} - Invoice</title>
  <style>
    *{box-sizing:border-box} body{margin:0;background:#eef1f5;color:#111827;font-family:Inter,"Segoe UI",Arial,sans-serif}
    .toolbar{width:210mm;max-width:calc(100% - 24px);margin:12px auto 0;display:flex;justify-content:flex-end;gap:8px}
    button{font:inherit;padding:9px 16px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;cursor:pointer} button.primary{background:${primaryColor};color:#fff;border-color:${primaryColor}}
    .sheet{width:210mm;min-height:297mm;margin:12px auto;padding:13mm 12mm;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.1)}
    .header{display:flex;justify-content:space-between;gap:24px;padding-bottom:14px;border-bottom:2px solid ${primaryColor}}.brand h1{margin:0;font-size:24px}.brand p,.muted{color:#64748b}.brand p{margin:3px 0;font-size:11px}.invoice{text-align:right}.invoice h2{margin:0;color:${primaryColor};letter-spacing:.08em}.invoice strong{display:block;margin-top:5px;font-size:16px}.invoice div{font-size:11px;margin-top:3px}
    .parties{display:grid;grid-template-columns:1.3fr 1fr;gap:18px;margin-top:18px}.panel{border:1px solid #e2e8f0;border-radius:7px;padding:11px}.panel h3{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:0 0 8px}.detail{display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:5px}.detail span{color:#64748b}.detail strong{text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:18px;font-size:10.5px}th{text-align:left;background:#f8fafc;color:#475569;text-transform:uppercase;letter-spacing:.04em;font-size:9px;padding:8px 6px;border-bottom:1px solid #cbd5e1}td{padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}.number{text-align:right;white-space:nowrap}
    .bottom{display:grid;grid-template-columns:1fr 72mm;gap:24px;margin-top:18px}.notes h3,.terms h3{font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:.06em}.notes p,.terms ol{font-size:10px;color:#475569;padding-left:16px}.totals{font-size:11px}.total-row{display:flex;justify-content:space-between;padding:4px 0}.grand{font-size:15px;font-weight:800;border-top:2px solid #111827;margin-top:5px;padding-top:8px}.balance{background:#f8fafc;padding:7px;margin-top:5px;font-weight:700}.status{display:inline-block;padding:3px 8px;border:1px solid #15803d;border-radius:12px;color:#15803d;font-size:9px;font-weight:700}
    .signatures{display:flex;justify-content:space-between;margin-top:46px;font-size:10px}.signature{width:62mm;border-top:1px solid #94a3b8;text-align:center;padding-top:5px;color:#64748b}.footer{text-align:center;border-top:1px solid #e2e8f0;margin-top:22px;padding-top:7px;font-size:9px;color:#94a3b8}
    @page{size:A4;margin:8mm}@media print{body{background:#fff}.no-print{display:none!important}.sheet{margin:0;padding:0;width:auto;min-height:auto;box-shadow:none}}
    @media(max-width:760px){.sheet{width:100%;margin:0;padding:18px}.toolbar{width:auto}.parties,.bottom{grid-template-columns:1fr}.header{flex-direction:column}.invoice{text-align:left}}
  </style>
</head>
<body>
  <div class="toolbar no-print"><button class="primary" onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div>
  <main class="sheet">
    <header class="header"><div class="brand"><h1>${display(config.company.name)}</h1><p>${display(config.company.address)}</p><p>${display(config.company.phone)} · ${display(config.company.email)}</p><p>GSTIN: ${display(config.company.gstNumber)}</p></div><div class="invoice"><h2>${display(invoice.documentTitle || 'TAX INVOICE')}</h2><strong>${display(invoice.invoiceNumber)}</strong><div>Date: ${formatDate(invoice.date)}</div><div><span class="status">${display(invoice.status)}</span></div></div></header>
    <section class="parties"><div class="panel"><h3>${display(invoice.partyLabel || 'Bill To')}</h3><div class="detail"><span>${display(invoice.personLabel || 'Customer')}</span><strong>${display(invoice.customer.name)}</strong></div><div class="detail"><span>Mobile</span><strong>${display(invoice.customer.phone)}</strong></div>${invoice.customer.email ? `<div class="detail"><span>Email</span><strong>${display(invoice.customer.email)}</strong></div>` : ''}${invoice.customer.address ? `<div class="detail"><span>Address</span><strong>${display(invoice.customer.address)}</strong></div>` : ''}${invoice.customer.gstNumber ? `<div class="detail"><span>GSTIN</span><strong>${display(invoice.customer.gstNumber)}</strong></div>` : ''}</div><div class="panel"><h3>Invoice Details</h3>${vehicle}${invoice.advisor ? `<div class="detail"><span>Advisor</span><strong>${display(invoice.advisor)}</strong></div>` : ''}<div class="detail"><span>Payment Method</span><strong>${display(invoice.paymentMethod)}</strong></div></div></section>
    <table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="number">Qty</th><th class="number">Rate</th><th class="number">Tax</th><th class="number">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No invoice items</td></tr>'}</tbody></table>
    <section class="bottom"><div><div class="notes"><h3>Notes</h3><p>${display(invoice.notes, 'Thank you for your business.')}</p></div><div class="terms"><h3>Terms &amp; Conditions</h3><ol>${terms}</ol></div></div><div class="totals"><div class="total-row"><span>Subtotal</span><strong>${formatMoney(invoice.subtotal, config.currency)}</strong></div><div class="total-row"><span>Discount</span><strong>-${formatMoney(invoice.discount, config.currency)}</strong></div><div class="total-row"><span>Tax</span><strong>${formatMoney(invoice.tax, config.currency)}</strong></div><div class="total-row grand"><span>Grand Total</span><span>${formatMoney(invoice.grandTotal, config.currency)}</span></div><div class="total-row"><span>Amount Paid</span><strong>${formatMoney(invoice.amountPaid, config.currency)}</strong></div><div class="total-row balance"><span>Balance Due</span><span>${formatMoney(invoice.balanceDue, config.currency)}</span></div></div></section>
    <section class="signatures"><div class="signature">Authorised Signatory</div><div class="signature">${display(invoice.signatureLabel || 'Customer Signature')}</div></section>
    <footer class="footer">${display(invoice.documentFooter || 'Computer generated tax invoice')} · ${display(config.company.name)} · ${display(config.company.phone)}</footer>
  </main>
</body>
</html>`;
}

export function openInvoicePrint(
  invoice: PrintableInvoice,
  options: OpenInvoiceOptions = {},
  config: JobCardDocumentConfig = resolveJobCardDocumentConfig()
): Window {
  const popup = window.open('', '_blank', 'width=920,height=1000');
  if (!popup) throw new Error('Your browser blocked the invoice window. Allow pop-ups and try again.');
  popup.document.open();
  popup.document.write(buildInvoiceHtml(invoice, config));
  popup.document.close();
  if (options.autoPrint !== false) {
    window.setTimeout(() => {
      try {
        popup.focus();
        popup.print();
      } catch {
        // The invoice window retains its Print / Save as PDF button.
      }
    }, 350);
  }
  return popup;
}

export default {
  invoiceFromSale,
  invoiceFromCounterSale,
  invoiceFromJobCardForm,
  buildInvoiceHtml,
  openInvoicePrint,
};
