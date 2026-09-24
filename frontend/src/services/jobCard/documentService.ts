// ---------------------------------------------------------------------------
// Job card document service.
//
// Every "print" action in the job card module goes through here. Instead of
// printing the React page (which drags the sidebar, sticky footers and dialogs
// into the output) each document is built as a self-contained A4 HTML sheet and
// opened in its own window — the same approach the estimate module uses in
// services/estimate/pdfService.ts. The exact markup can later be handed to a
// headless renderer on the server without changing anything above this module.
// ---------------------------------------------------------------------------

import { formatMoney } from '../../utils/estimateMath';
import { computeJobCardTotals, computeLineItem } from '../../utils/jobCardPricing';
import { DEFAULT_BUSINESS_CONFIG } from '../estimate/config';

export type JobCardDocumentId =
  | 'proforma-invoice'
  | 'inspection-report'
  | 'inspection-media'
  | 'work-order'
  | 'advance-receipt'
  | 'customer-complaint'
  | 'customer-identity'
  | 'gate-pass';

export interface JobCardDocumentOption {
  id: JobCardDocumentId;
  label: string;
  description: string;
}

/** Documents offered by the print menu (mirrors the workshop workflow). */
export const JOB_CARD_DOCUMENTS: JobCardDocumentOption[] = [
  { id: 'proforma-invoice', label: 'Proforma Invoice', description: 'Itemised cost estimate before final billing' },
  { id: 'inspection-report', label: 'Inspection Report', description: 'Vehicle condition checklist' },
  { id: 'inspection-media', label: 'Inspection Media', description: 'Photos & videos captured during inspection' },
  { id: 'work-order', label: 'Work Order', description: 'Authorisation to begin the job' },
  { id: 'advance-receipt', label: 'Advance Payment Receipt', description: 'Deposit received against the job' },
  { id: 'customer-complaint', label: 'Customer Complaint', description: 'Reported issue & special instructions' },
  { id: 'customer-identity', label: 'Customer Identity Document', description: 'Identity proof on record' },
];

export const GATE_PASS_DOCUMENT: JobCardDocumentOption = {
  id: 'gate-pass',
  label: 'Gate Pass',
  description: 'Vehicle release authorisation',
};

const ALL_DOCUMENTS: JobCardDocumentOption[] = [...JOB_CARD_DOCUMENTS, GATE_PASS_DOCUMENT];

export function documentLabel(id: JobCardDocumentId): string {
  return ALL_DOCUMENTS.find((doc) => doc.id === id)?.label || 'Document';
}

// ---------------------------------------------------------------------------
// Business configuration
// ---------------------------------------------------------------------------

export interface JobCardDocumentConfig {
  company: { name: string; address: string; phone: string; email: string; gstNumber: string };
  currency: string;
  terms: string[];
}

const env = (key: string): string | undefined => (import.meta as any)?.env?.[key];

/** Business details printed on the document; env vars win over the defaults. */
export function resolveJobCardDocumentConfig(
  overrides: Partial<JobCardDocumentConfig> = {}
): JobCardDocumentConfig {
  const base = DEFAULT_BUSINESS_CONFIG;
  return {
    currency: overrides.currency || base.currency,
    terms: overrides.terms?.length ? overrides.terms : base.terms,
    company: {
      name: env('VITE_BUSINESS_NAME') || overrides.company?.name || base.company.name,
      address: env('VITE_BUSINESS_ADDRESS') || overrides.company?.address || base.company.address,
      phone: env('VITE_BUSINESS_PHONE') || overrides.company?.phone || base.company.phone,
      email: env('VITE_BUSINESS_EMAIL') || overrides.company?.email || base.company.email,
      gstNumber: env('VITE_BUSINESS_GST') || overrides.company?.gstNumber || base.company.gstNumber,
    },
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function value(value: unknown, fallback = '—'): string {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text ? escapeHtml(text) : fallback;
}

function fmtDate(input: unknown): string {
  if (!input) return '—';
  const d = new Date(input as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(input: unknown): string {
  if (!input) return '—';
  const d = new Date(input as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function money(amount: unknown, currency: string): string {
  return formatMoney(Number(amount) || 0, currency);
}

function lines(jobCard: any) {
  return (jobCard?.services || jobCard?.lineItems || []).map((line: any) => ({
    ...line,
    ...computeLineItem(line),
  }));
}

function advanceRecorded(jobCard: any): number {
  const entries: any[] = Array.isArray(jobCard?.advances) ? jobCard.advances : [];
  const total = entries.reduce((sum, entry) => sum + (Number(entry?.amount) || 0), 0);
  return total || Number(jobCard?.advance?.amount) || Number(jobCard?.intake?.advanceAmount) || 0;
}

function totalsFor(jobCard: any) {
  const summary = jobCard?.orderSummary || {};
  const advance = Number(summary.advanceDeducted) || advanceRecorded(jobCard);
  const totals = computeJobCardTotals({ lineItems: jobCard?.services || [], discount: summary.discount, advance });
  return { ...totals, paymentTerms: summary.paymentTerms || '' };
}

function vehicleLabel(jobCard: any): string {
  const v = jobCard?.vehicle || {};
  return [v.make || v.brand, v.model].filter(Boolean).join(' ') || '—';
}

function odometer(jobCard: any): string {
  const v = jobCard?.vehicle || {};
  const value = v.odometerReading ?? v.odometer;
  return value === undefined || value === null || value === '' ? '—' : `${Number(value).toLocaleString('en-IN')} km`;
}

function complaintText(jobCard: any): string {
  return jobCard?.intake?.complaint || jobCard?.service?.description || '';
}

// ---------------------------------------------------------------------------
// Shared document chrome
// ---------------------------------------------------------------------------

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; background: #f1f5f9; }
  .sheet { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 14mm 12mm; background: #fff; }
  h1, h2, h3, h4, p { margin: 0; }
  .muted { color: #64748b; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; gap: 16px; }
  .header .garage h1 { font-size: 20px; }
  .header .garage p { margin: 3px 0; font-size: 11px; color: #475569; }
  .header .meta { text-align: right; font-size: 11px; }
  .header .meta .doc-no { font-size: 15px; font-weight: 700; }
  .header .meta .doc-type { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  .section { margin-top: 16px; }
  .section > h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 16px; font-size: 11px; }
  .grid .label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  .grid .value { font-weight: 600; word-break: break-word; }
  .span-2 { grid-column: span 2; }
  .span-4 { grid-column: span 4; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f8fafc; color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .totals { width: 64mm; margin-left: auto; font-size: 11px; }
  .totals .line { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 6px; font-size: 14px; font-weight: 700; }
  .totals .balance { background: #f8fafc; font-weight: 700; padding: 6px 8px; border-radius: 4px; margin-top: 6px; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 9px; font-weight: 700; border: 1px solid currentColor; }
  .good { color: #059669; } .attention { color: #b45309; } .critical { color: #dc2626; } .na { color: #64748b; }
  .media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .media-item { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; font-size: 10px; }
  .media-item img { width: 100%; height: 90px; object-fit: cover; border-radius: 4px; }
  .media-item .placeholder { height: 90px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #94a3b8; border-radius: 4px; font-size: 9px; }
  ol.terms { margin: 0; padding-left: 16px; font-size: 10px; color: #475569; }
  ol.terms li { margin-bottom: 3px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 34px; font-size: 10px; }
  .signatures .line { border-top: 1px solid #94a3b8; padding-top: 4px; width: 60mm; text-align: center; color: #475569; }
  .footer { margin-top: 18px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  .note { font-size: 10px; color: #475569; }
  .toolbar { width: 210mm; margin: 12px auto 0; display: flex; gap: 8px; justify-content: flex-end; }
  .toolbar button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
  .toolbar button.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
  @page { size: A4; margin: 8mm; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; padding: 0; width: auto; min-height: auto; }
    .no-print { display: none !important; }
  }
`;

function headerBlock(jobCard: any, config: JobCardDocumentConfig, docType: string, docNumber: string): string {
  return `
    <div class="header">
      <div class="garage">
        <h1>${value(config.company.name)}</h1>
        <p>${value(config.company.address)}</p>
        <p>${value(config.company.phone)} &nbsp;|&nbsp; ${value(config.company.email)}</p>
        <p>GSTIN: ${value(config.company.gstNumber)}</p>
      </div>
      <div class="meta">
        <div class="doc-type">${value(docType)}</div>
        <div class="doc-no">${value(docNumber)}</div>
        <div class="muted">Job Card: ${value(jobCard?.jobCardNumber, 'DRAFT')}</div>
        <div>Date: ${fmtDate(jobCard?.createdAt || new Date())}</div>
        <div>Status: ${value(jobCard?.status, 'New')}</div>
      </div>
    </div>`;
}

function customerBlock(jobCard: any): string {
  const c = jobCard?.customer || {};
  return `
    <div class="section">
      <h3>Customer</h3>
      <div class="grid">
        <div><div class="label">Name</div><div class="value">${value(c.name)}</div></div>
        <div><div class="label">Type</div><div class="value">${value(c.type, 'Individual')}</div></div>
        <div><div class="label">Phone</div><div class="value">${value(c.phone)}</div></div>
        <div><div class="label">Email</div><div class="value">${value(c.email)}</div></div>
        ${c.gstNumber ? `<div><div class="label">GSTIN</div><div class="value">${value(c.gstNumber)}</div></div>` : ''}
        <div class="span-4"><div class="label">Address</div><div class="value">${value(c.address)}</div></div>
      </div>
    </div>`;
}

function vehicleBlock(jobCard: any): string {
  const v = jobCard?.vehicle || {};
  return `
    <div class="section">
      <h3>Vehicle</h3>
      <div class="grid">
        <div><div class="label">Registration</div><div class="value">${value(v.registrationNumber)}</div></div>
        <div><div class="label">Vehicle</div><div class="value">${value(vehicleLabel(jobCard))}</div></div>
        <div><div class="label">Fuel</div><div class="value">${value(v.fuelType)}</div></div>
        <div><div class="label">Odometer</div><div class="value">${odometer(jobCard)}</div></div>
        <div><div class="label">Year</div><div class="value">${value(v.year)}</div></div>
        <div><div class="label">Colour</div><div class="value">${value(v.color)}</div></div>
        <div><div class="label">Engine No</div><div class="value">${value(v.engineNumber)}</div></div>
        <div><div class="label">Chassis No</div><div class="value">${value(v.chassisNumber || v.vin)}</div></div>
      </div>
    </div>`;
}

function itemsTable(jobCard: any, config: JobCardDocumentConfig): string {
  const rows = lines(jobCard)
    .map((item: any) => {
      const discount = item.discountAmount > 0 ? money(item.discountAmount, config.currency) : '—';
      const tax = !item.taxRate || item.taxType === 'None' ? 'No Tax' : `${item.taxRate}% ${item.taxType}`;
      return `<tr>
        <td><strong>${value(item.name, 'Item')}</strong>${
          item.description ? `<div class="muted" style="font-size:9px">${value(item.description)}</div>` : ''
        }${item.partNumber ? `<div class="muted" style="font-size:9px">Part: ${value(item.partNumber)}</div>` : ''}</td>
        <td>${value(item.type)}</td>
        <td class="num">${value(item.qty, '0')} ${value(item.unit, '')}</td>
        <td class="num">${money(item.price, config.currency)}</td>
        <td class="num">${discount}</td>
        <td class="num">${tax}</td>
        <td class="num">${money(item.total, config.currency)}</td>
      </tr>`;
    })
    .join('');
  return `
    <div class="section">
      <h3>Services, Parts &amp; Labour</h3>
      <table>
        <thead><tr><th>Item</th><th>Type</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Discount</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="muted">No items</td></tr>'}</tbody>
      </table>
    </div>`;
}

function totalsBlock(jobCard: any, config: JobCardDocumentConfig): string {
  const t = totalsFor(jobCard);
  return `
    <div class="section">
      <h3>Financial Summary</h3>
      <div class="totals">
        <div class="line"><span>Subtotal</span><span>${money(t.subtotal, config.currency)}</span></div>
        ${t.lineDiscount ? `<div class="line"><span>Line Discounts</span><span>-${money(t.lineDiscount, config.currency)}</span></div>` : ''}
        ${t.discount ? `<div class="line"><span>Order Discount</span><span>-${money(t.discount, config.currency)}</span></div>` : ''}
        <div class="line"><span>Tax</span><span>${money(t.tax, config.currency)}</span></div>
        <div class="line grand"><span>Grand Total</span><span>${money(t.grandTotal, config.currency)}</span></div>
        ${
          t.advanceDeducted
            ? `<div class="line"><span>Advance Paid</span><span>-${money(t.advanceDeducted, config.currency)}</span></div>
               <div class="line balance"><span>Balance Due</span><span>${money(t.balanceDue, config.currency)}</span></div>`
            : ''
        }
      </div>
      ${t.paymentTerms ? `<p class="note" style="margin-top:8px">Payment terms: ${value(t.paymentTerms)}</p>` : ''}
    </div>`;
}

function advancesBlock(jobCard: any, config: JobCardDocumentConfig): string {
  const entries: any[] = Array.isArray(jobCard?.advances) ? jobCard.advances.filter((e) => Number(e?.amount) > 0) : [];
  const single = jobCard?.advance;
  if (!entries.length && !(Number(single?.amount) > 0)) {
    return `
      <div class="section">
        <h3>Advance Payments</h3>
        <p class="note">No advance payment recorded.</p>
      </div>`;
  }
  const rows = (entries.length ? entries : [single])
    .map(
      (entry: any) => `<tr>
        <td>${fmtDate(entry.recordedAt || entry.date || jobCard?.createdAt)}</td>
        <td>${value(entry.paymentMode || entry.mode, 'Cash')}</td>
        <td>${value(entry.reference || '—')}</td>
        <td>${value(entry.recordedBy || '—')}</td>
        <td class="num">${money(entry.amount, config.currency)}</td>
      </tr>`
    )
    .join('');
  return `
    <div class="section">
      <h3>Advance Payments</h3>
      <table>
        <thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th>Recorded By</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function termsBlock(config: JobCardDocumentConfig): string {
  return `
    <div class="section">
      <h3>Terms &amp; Conditions</h3>
      <ol class="terms">${(config.terms || []).map((term) => `<li>${value(term)}</li>`).join('')}</ol>
    </div>`;
}

function signaturesBlock(left = 'Authorised Signature', right = 'Customer Signature'): string {
  return `<div class="signatures"><div class="line">${value(left)}</div><div class="line">${value(right)}</div></div>`;
}

function footerBlock(jobCard: any, config: JobCardDocumentConfig, note: string): string {
  return `<div class="footer">${value(note)} ${value(config.company.name)} — ${value(config.company.phone)} · Job ${value(
    jobCard?.jobCardNumber,
    'DRAFT'
  )}</div>`;
}

function sheet(jobCard: any, config: JobCardDocumentConfig, docType: string, docNumber: string, body: string, footerNote: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${value(docNumber)} — ${value(docType)}</title>
<style>${STYLES}</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()" class="primary">Print / Save as PDF</button>
    <button onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    ${headerBlock(jobCard, config, docType, docNumber)}
    ${body}
    ${footerBlock(jobCard, config, footerNote)}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Individual documents
// ---------------------------------------------------------------------------

const CONDITION_BADGE: Record<string, { cls: string; label: string }> = {
  Good: { cls: 'good', label: '✓ Good' },
  Average: { cls: 'attention', label: '⚠ Average' },
  'Needs Attention': { cls: 'critical', label: '🔴 Needs Attention' },
  'Not Applicable': { cls: 'na', label: '— N/A' },
};

function proformaInvoice(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const t = totalsFor(jobCard);
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    ${itemsTable(jobCard, config)}
    ${totalsBlock(jobCard, config)}
    <div class="section">
      <h3>Amount in Words</h3>
      <p class="note">${value(amountInWords(t.grandTotal))} only</p>
    </div>
    ${termsBlock(config)}
    ${signaturesBlock('Authorised Signatory', 'Customer Acceptance')}
  `;
  return sheet(jobCard, config, 'Proforma Invoice', number, body, 'This is a computer generated proforma invoice. Tax as applicable.');
}

function workOrder(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const service = jobCard?.service || {};
  const delivery = jobCard?.estimatedDelivery || {};
  const delivered = delivery.date || service.estimatedDelivery;
  const supervisor = jobCard?.supervisor?.name;
  const advisor = jobCard?.advisor?.name;
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    <div class="section">
      <h3>Work Details</h3>
      <div class="grid">
        <div><div class="label">Service Type</div><div class="value">${value(service.type)}</div></div>
        <div><div class="label">Priority</div><div class="value">${value(service.priority)}</div></div>
        <div><div class="label">Estimated Delivery</div><div class="value">${fmtDate(delivered)}${
          delivery.time ? ` · ${value(delivery.time)}` : ''
        }</div></div>
        <div><div class="label">Supervisor</div><div class="value">${value(supervisor)}</div></div>
        <div><div class="label">Service Advisor</div><div class="value">${value(advisor)}</div></div>
        <div class="span-4"><div class="label">Reported Issue</div><div class="value">${value(complaintText(jobCard))}</div></div>
        ${
          service.specialInstructions
            ? `<div class="span-4"><div class="label">Special Instructions</div><div class="value">${value(service.specialInstructions)}</div></div>`
            : ''
        }
      </div>
    </div>
    ${itemsTable(jobCard, config)}
    <div class="section">
      <h3>Authorisation</h3>
      <p class="note">I authorise ${value(config.company.name)} to carry out the listed work on the vehicle above. Additional work will be
      quoted for approval before it is started.</p>
    </div>
    ${signaturesBlock('Customer Authorisation', 'Service Advisor')}
  `;
  return sheet(jobCard, config, 'Work Order', number, body, 'This is a computer generated work order.');
}

function inspectionReport(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const entries: any[] = Array.isArray(jobCard?.inspectionReport) ? jobCard.inspectionReport : [];
  const counts = { good: 0, average: 0, attention: 0, na: 0 };
  const rows = entries
    .map((entry: any) => {
      const badge = CONDITION_BADGE[entry.condition] || { cls: 'na', label: entry.condition || '—' };
      if (entry.condition === 'Good') counts.good += 1;
      else if (entry.condition === 'Average') counts.average += 1;
      else if (entry.condition === 'Needs Attention') counts.attention += 1;
      else counts.na += 1;
      return `<tr>
        <td><strong>${value(entry.item, 'Item')}</strong></td>
        <td><span class="badge ${badge.cls}">${value(badge.label)}</span></td>
        <td>${value(entry.notes)}</td>
        <td class="num">${entry.photoUrl ? 'Yes' : '—'}</td>
      </tr>`;
    })
    .join('');
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    <div class="section">
      <h3>Inspection Summary</h3>
      <div class="grid">
        <div><div class="label">✓ Good</div><div class="value good">${counts.good}</div></div>
        <div><div class="label">⚠ Average</div><div class="value attention">${counts.average}</div></div>
        <div><div class="label">🔴 Needs Attention</div><div class="value critical">${counts.attention}</div></div>
        <div><div class="label">— N/A</div><div class="value na">${counts.na}</div></div>
      </div>
    </div>
    <div class="section">
      <h3>Checklist</h3>
      <table>
        <thead><tr><th>Item</th><th>Condition</th><th>Notes</th><th class="num">Photo</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">No inspection recorded.</td></tr>'}</tbody>
      </table>
    </div>
    ${
      entries.some((entry) => entry.condition === 'Needs Attention')
        ? `<div class="section"><h3>Recommendations</h3><p class="note">Items marked "Needs Attention" should be attended to at the earliest. Ask your advisor for a quote.</p></div>`
        : ''
    }
    ${signaturesBlock('Inspected By', 'Customer Acknowledgement')}
  `;
  return sheet(jobCard, config, 'Inspection Report', number, body, 'This is a computer generated inspection report.');
}

function inspectionMedia(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const entries: any[] = Array.isArray(jobCard?.inspectionReport) ? jobCard.inspectionReport : [];
  const withMedia = entries.filter((entry) => entry.photoUrl);
  const items = entries.length
    ? entries
        .map(
          (entry: any) => `<div class="media-item">
            ${
              entry.photoUrl
                ? `<img src="${value(entry.photoUrl)}" alt="${value(entry.item)}" />`
                : `<div class="placeholder">No media</div>`
            }
            <div style="margin-top:4px"><strong>${value(entry.item, 'Item')}</strong></div>
            <div class="muted">${value(entry.condition)}${entry.notes ? ` · ${value(entry.notes)}` : ''}</div>
          </div>`
        )
        .join('')
    : '<p class="note">No inspection media captured.</p>';
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    <div class="section">
      <h3>Media Summary</h3>
      <div class="grid">
        <div><div class="label">Checklist Points</div><div class="value">${entries.length}</div></div>
        <div><div class="label">Attachments</div><div class="value">${withMedia.length}</div></div>
        <div class="span-2"><div class="label">Captured From</div><div class="value">${fmtDate(jobCard?.createdAt)}</div></div>
      </div>
    </div>
    <div class="section">
      <h3>Photos &amp; Videos</h3>
      <div class="media-grid">${items}</div>
    </div>
  `;
  return sheet(jobCard, config, 'Inspection Media', number, body, 'This is a computer generated media sheet.');
}

function advanceReceipt(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const t = totalsFor(jobCard);
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    ${advancesBlock(jobCard, config)}
    <div class="section">
      <h3>Payment Summary</h3>
      <div class="totals">
        <div class="line grand"><span>Order Total</span><span>${money(t.grandTotal, config.currency)}</span></div>
        <div class="line"><span>Advance Received</span><span>${money(t.advanceDeducted, config.currency)}</span></div>
        <div class="line balance"><span>Balance Due</span><span>${money(t.balanceDue, config.currency)}</span></div>
      </div>
    </div>
    <div class="section">
      <h3>Declaration</h3>
      <p class="note">Received the advance amount shown above against the job card mentioned. This receipt is valid subject to realisation of payment.</p>
    </div>
    ${signaturesBlock('Received By', 'Customer Signature')}
  `;
  return sheet(jobCard, config, 'Advance Payment Receipt', number, body, 'This is a computer generated receipt.');
}

function customerComplaint(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const service = jobCard?.service || {};
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    <div class="section">
      <h3>Reported Complaint</h3>
      <p class="note" style="white-space:pre-wrap">${value(complaintText(jobCard), 'No complaint captured.')}</p>
    </div>
    <div class="section">
      <h3>Job Classification</h3>
      <div class="grid">
        <div><div class="label">Service Type</div><div class="value">${value(service.type)}</div></div>
        <div><div class="label">Priority</div><div class="value">${value(service.priority)}</div></div>
        <div><div class="label">Booking Source</div><div class="value">${value(jobCard?.source, 'N/A')}</div></div>
        <div><div class="label">Logged On</div><div class="value">${fmtDateTime(jobCard?.createdAt)}</div></div>
        ${
          service.specialInstructions
            ? `<div class="span-4"><div class="label">Special Instructions</div><div class="value">${value(service.specialInstructions)}</div></div>`
            : ''
        }
      </div>
    </div>
    <div class="section">
      <h3>Customer Acknowledgement</h3>
      <p class="note">The complaint above was reported by the customer and recorded by the workshop. Any additional findings will be communicated before work begins.</p>
    </div>
    ${signaturesBlock('Recorded By', 'Customer Signature')}
  `;
  return sheet(jobCard, config, 'Customer Complaint', number, body, 'This is a computer generated complaint record.');
}

function customerIdentity(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const c = jobCard?.customer || {};
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    <div class="section">
      <h3>Identity Proof</h3>
      <div class="grid">
        <div><div class="label">ID Type</div><div class="value">${value(c.idProofType || 'ID Proof')}</div></div>
        <div class="span-2"><div class="label">ID Number</div><div class="value">${value(c.idProofNumber)}</div></div>
        <div><div class="label">Verified On</div><div class="value">${fmtDate(jobCard?.createdAt)}</div></div>
      </div>
      ${
        c.idProofUrl
          ? `<div style="margin-top:10px"><img src="${value(c.idProofUrl)}" alt="Identity document" style="max-width:100%;max-height:120mm;border:1px solid #e2e8f0;border-radius:6px" /></div>`
          : '<p class="note" style="margin-top:8px">No scanned copy attached. Please keep the physical document on file.</p>'
      }
    </div>
    <div class="section">
      <h3>Declaration</h3>
      <p class="note">The identity details above were provided by the customer for the purpose of this service transaction and are held in confidence.</p>
    </div>
    ${signaturesBlock('Verified By', 'Customer Signature')}
  `;
  return sheet(jobCard, config, 'Customer Identity Document', number, body, 'This is a computer generated identity record.');
}

function gatePass(jobCard: any, config: JobCardDocumentConfig, number: string): string {
  const gate = jobCard?.gatePass || {};
  const body = `
    ${customerBlock(jobCard)}
    ${vehicleBlock(jobCard)}
    <div class="section">
      <h3>Release Details</h3>
      <div class="grid">
        <div><div class="label">Gate Pass No</div><div class="value">${value(gate.number)}</div></div>
        <div><div class="label">Issued On</div><div class="value">${fmtDateTime(gate.createdAt || new Date())}</div></div>
        <div><div class="label">Job Status</div><div class="value">${value(jobCard?.status)}</div></div>
        <div><div class="label">Payment Status</div><div class="value">${value(jobCard?.paymentStatus, 'Pending')}</div></div>
      </div>
    </div>
    ${itemsTable(jobCard, config)}
    <div class="section">
      <h3>Declaration</h3>
      <p class="note">The vehicle described above is being released to the customer. The workshop is not responsible for items left in the vehicle after delivery.</p>
    </div>
    ${signaturesBlock('Released By', 'Received By (Customer)')}
  `;
  return sheet(jobCard, config, 'Gate Pass', number, body, 'This is a computer generated gate pass.');
}

/** Number printed on a document; falls back to a deterministic job-card prefix. */
export function documentNumber(id: JobCardDocumentId, jobCard: any): string {
  const jc = jobCard?.jobCardNumber || 'DRAFT';
  switch (id) {
    case 'proforma-invoice':
      return jobCard?.invoice?.number || `PI-${jc}`;
    case 'inspection-report':
      return `IR-${jc}`;
    case 'inspection-media':
      return `IM-${jc}`;
    case 'work-order':
      return `WO-${jc}`;
    case 'advance-receipt':
      return `AR-${jc}`;
    case 'customer-complaint':
      return `CC-${jc}`;
    case 'customer-identity':
      return `CID-${jc}`;
    case 'gate-pass':
      return jobCard?.gatePass?.number || `GP-${jc}`;
    default:
      return jc;
  }
}

/** Build the printable HTML for one document. */
export function buildJobCardDocument(
  id: JobCardDocumentId,
  jobCard: any,
  config: JobCardDocumentConfig = resolveJobCardDocumentConfig()
): string {
  const number = documentNumber(id, jobCard);
  switch (id) {
    case 'inspection-report':
      return inspectionReport(jobCard, config, number);
    case 'inspection-media':
      return inspectionMedia(jobCard, config, number);
    case 'work-order':
      return workOrder(jobCard, config, number);
    case 'advance-receipt':
      return advanceReceipt(jobCard, config, number);
    case 'customer-complaint':
      return customerComplaint(jobCard, config, number);
    case 'customer-identity':
      return customerIdentity(jobCard, config, number);
    case 'gate-pass':
      return gatePass(jobCard, config, number);
    case 'proforma-invoice':
    default:
      return proformaInvoice(jobCard, config, number);
  }
}

export interface OpenDocumentOptions {
  /** Open the browser print dialog as soon as the document renders. */
  autoPrint?: boolean;
}

/** Open a document in its own window (print / save as PDF from there). */
export function openJobCardDocument(
  id: JobCardDocumentId,
  jobCard: any,
  config: JobCardDocumentConfig = resolveJobCardDocumentConfig(),
  options: OpenDocumentOptions = {}
): Window | null {
  const html = buildJobCardDocument(id, jobCard, config);
  // No `noopener` here: the document must be written into the new window.
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    throw new Error('Your browser blocked the document window. Allow pop-ups to preview the document.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (options.autoPrint) {
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        /* the toolbar print button stays available */
      }
    }, 350);
  }
  return win;
}

/** Download a document as a standalone .html file. */
export function downloadJobCardDocument(
  id: JobCardDocumentId,
  jobCard: any,
  config: JobCardDocumentConfig = resolveJobCardDocumentConfig()
): string {
  const number = documentNumber(id, jobCard).replace(/[^\w.-]+/g, '-');
  const filename = `${number}-${id}.html`;
  const blob = new Blob([buildJobCardDocument(id, jobCard, config)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}

/** WhatsApp message that accompanies a shared document. */
export function buildDocumentMessage(
  id: JobCardDocumentId,
  jobCard: any,
  config: JobCardDocumentConfig = resolveJobCardDocumentConfig()
): string {
  const c = jobCard?.customer || {};
  const t = totalsFor(jobCard);
  const first = String(c.name || 'Customer').split(' ')[0];
  return [
    `Hello ${first},`,
    '',
    `Sharing the ${documentLabel(id)} for your vehicle ${vehicleLabel(jobCard)} (${jobCard?.vehicle?.registrationNumber || '—'}).`,
    `Job Card: ${jobCard?.jobCardNumber || 'DRAFT'}`,
    `Amount: ${money(t.grandTotal, config.currency)}`,
    '',
    `${config.company.name} · ${config.company.phone}`,
  ].join('\n');
}

/** Open WhatsApp with the document reference (deep link, no server needed). */
export function openDocumentOnWhatsApp(
  id: JobCardDocumentId,
  jobCard: any,
  config: JobCardDocumentConfig = resolveJobCardDocumentConfig()
): boolean {
  const digits = String(jobCard?.customer?.phone || '').replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!phone) return false;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildDocumentMessage(id, jobCard, config))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Very small number-to-words used by the proforma invoice footer. */
function amountInWords(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded === 0) return 'Zero Rupees';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (n: number): string => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const threeDigits = (n: number): string => (n < 100 ? twoDigits(n) : `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}`);

  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const rest = rounded % 1000;
  const parts = [
    crore ? `${threeDigits(crore)} Crore` : '',
    lakh ? `${threeDigits(lakh)} Lakh` : '',
    thousand ? `${threeDigits(thousand)} Thousand` : '',
    rest ? threeDigits(rest) : '',
  ].filter(Boolean);
  return `${parts.join(' ')} Rupees`;
}

export default {
  JOB_CARD_DOCUMENTS,
  GATE_PASS_DOCUMENT,
  documentLabel,
  documentNumber,
  resolveJobCardDocumentConfig,
  buildJobCardDocument,
  openJobCardDocument,
  downloadJobCardDocument,
  buildDocumentMessage,
  openDocumentOnWhatsApp,
};
