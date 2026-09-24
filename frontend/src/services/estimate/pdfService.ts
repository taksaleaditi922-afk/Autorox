// ---------------------------------------------------------------------------
// PDF / print service.
//
// The document is built as a self-contained A4 print stylesheet so it renders
// identically in the browser print dialog and can be handed to a headless
// renderer on the server (GET /api/estimates/:id/pdf) without rewriting the
// layout. Swapping in a real PDF engine means replacing openPrintWindow() with
// a download of the server-rendered file — the markup stays the same.
// ---------------------------------------------------------------------------

import { formatMoney } from '../../utils/estimateMath';
import { INSPECTION_STATUS_META } from './config';
import type { EstimateBusinessConfig, EstimateState } from './types';

export interface PrintOptions {
  /** Open the browser print dialog as soon as the preview opens. */
  autoPrint?: boolean;
  /** Quote number shown in the header; defaults to the metadata number. */
  estimateNumber?: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inspectionSummaryRows(state: EstimateState) {
  const counts = { good: 0, attention: 0, critical: 0, na: 0 };
  for (const category of state.inspection || []) {
    for (const item of category.items || []) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
  }
  return counts;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; background: #f1f5f9; }
  .sheet { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 14mm 12mm; background: #fff; }
  h1, h2, h3, h4 { margin: 0; }
  .muted { color: #64748b; }
  .row { display: flex; justify-content: space-between; gap: 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
  .header .garage { max-width: 60%; }
  .header .garage h1 { font-size: 20px; }
  .header .garage p { margin: 3px 0; font-size: 11px; color: #475569; }
  .header .meta { text-align: right; font-size: 11px; }
  .header .meta .doc-no { font-size: 15px; font-weight: 700; }
  .section { margin-top: 16px; }
  .section > h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 16px; font-size: 11px; }
  .grid .label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  .grid .value { font-weight: 600; word-break: break-word; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f8fafc; color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .totals { width: 62mm; margin-left: auto; font-size: 11px; }
  .totals .line { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 6px; font-size: 14px; font-weight: 700; }
  .totals .balance { background: #f8fafc; font-weight: 700; padding: 6px 8px; border-radius: 4px; margin-top: 6px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: 700; border: 1px solid currentColor; }
  .good { color: #059669; } .attention { color: #b45309; } .critical { color: #dc2626; } .na { color: #64748b; }
  .issue { font-size: 10px; margin-bottom: 4px; }
  .issue .note { color: #475569; }
  ol.terms { margin: 0; padding-left: 16px; font-size: 10px; color: #475569; }
  ol.terms li { margin-bottom: 3px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 34px; font-size: 10px; }
  .signatures .line { border-top: 1px solid #94a3b8; padding-top: 4px; width: 60mm; text-align: center; color: #475569; }
  .footer { margin-top: 18px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  @page { size: A4; margin: 8mm; }
  @media print { body { background: #fff; } .sheet { margin: 0; padding: 0; width: auto; min-height: auto; box-shadow: none; } .no-print { display: none !important; } }
  .toolbar { width: 210mm; margin: 12px auto 0; display: flex; gap: 8px; justify-content: flex-end; }
  .toolbar button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
  .toolbar button.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
`;

/** Build the printable estimate document. */
export function buildPrintableHtml(
  state: EstimateState,
  config: EstimateBusinessConfig,
  options: PrintOptions = {}
): string {
  const number = options.estimateNumber || state.metadata?.estimateNumber || 'DRAFT';
  const totals = state.totals;
  const counts = inspectionSummaryRows(state);
  const issues = (state.inspection || []).flatMap((category) =>
    (category.items || [])
      .filter((i) => i.status === 'attention' || i.status === 'critical')
      .map((i) => ({ category: category.name, item: i }))
  );

  const itemRows = (state.lineItems || [])
    .map((item) => {
      const discount =
        item.discountAmount > 0
          ? item.discountType === 'percentage'
            ? `${item.discountValue}%`
            : formatMoney(item.discountAmount, config.currency)
          : '—';
      const tax =
        item.taxType === 'NONE' || !item.taxRate ? 'No Tax' : `${item.taxRate}% ${item.taxType === 'GST' ? 'GST' : item.taxType}`;
      const trace = item.inspectionItemName
        ? `<div class="muted" style="font-size:9px">From inspection: ${escapeHtml(item.inspectionItemName)}</div>`
        : '';
      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong>${item.description ? `<div class="muted" style="font-size:9px">${escapeHtml(item.description)}</div>` : ''}${trace}
            ${item.type === 'package' && item.packageContents?.length
              ? `<div class="muted" style="font-size:9px">Includes: ${item.packageContents.map((c) => escapeHtml(c.name)).join(', ')}</div>`
              : ''}
          </td>
          <td>${escapeHtml(item.type)}</td>
          <td class="num">${item.quantity} ${escapeHtml(item.unit || '')}</td>
          <td class="num">${formatMoney(item.rate, config.currency)}</td>
          <td class="num">${discount}</td>
          <td class="num">${tax}</td>
          <td class="num">${formatMoney(item.total, config.currency)}</td>
        </tr>`;
    })
    .join('');

  const payments = (state.payments || []).length
    ? `
      <div class="section">
        <h3>Advance Payment</h3>
        <table>
          <thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${(state.payments || [])
              .map(
                (p) => `<tr>
                  <td>${formatDate(p.date)}</td>
                  <td>${escapeHtml(p.mode)}</td>
                  <td>${escapeHtml(p.reference || '—')}</td>
                  <td class="num">${formatMoney(p.amount, config.currency)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : '';

  const taxLabel = totals.igst > 0 ? `IGST` : 'CGST';
  const taxRows =
    totals.igst > 0
      ? `<div class="line"><span>IGST</span><span>${formatMoney(totals.igst, config.currency)}</span></div>`
      : `<div class="line"><span>CGST</span><span>${formatMoney(totals.cgst, config.currency)}</span></div>
         <div class="line"><span>SGST</span><span>${formatMoney(totals.sgst, config.currency)}</span></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(number)} — Estimate</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()" class="primary">Print / Save as PDF</button>
    <button onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div class="garage">
        <h1>${escapeHtml(config.company.name)}</h1>
        <p>${escapeHtml(config.company.address)}</p>
        <p>${escapeHtml(config.company.phone)} &nbsp;|&nbsp; ${escapeHtml(config.company.email)}</p>
        <p>GSTIN: ${escapeHtml(config.company.gstNumber)}</p>
      </div>
      <div class="meta">
        <div class="doc-no">${escapeHtml(number)}</div>
        <div class="muted">Service Estimate</div>
        <div>Date: ${formatDate(state.metadata?.estimateDate)}</div>
        <div>Valid until: ${formatDate(state.metadata?.validUntil)}</div>
        <div>Status: ${escapeHtml(state.status)}</div>
      </div>
    </div>

    <div class="section">
      <h3>Customer</h3>
      <div class="grid">
        <div><div class="label">Name</div><div class="value">${escapeHtml(state.customer.name || '—')}</div></div>
        <div><div class="label">Phone</div><div class="value">${escapeHtml(state.customer.phone || '—')}</div></div>
        <div><div class="label">Email</div><div class="value">${escapeHtml(state.customer.email || '—')}</div></div>
        <div><div class="label">GSTIN</div><div class="value">${escapeHtml(state.customer.gstNumber || '—')}</div></div>
        <div style="grid-column: span 4"><div class="label">Address</div><div class="value">${escapeHtml(
          [state.customer.address, state.customer.city, state.customer.state, state.customer.pincode]
            .filter(Boolean)
            .join(', ') || '—'
        )}</div></div>
      </div>
    </div>

    <div class="section">
      <h3>Vehicle</h3>
      <div class="grid">
        <div><div class="label">Registration</div><div class="value">${escapeHtml(state.vehicle.registrationNumber || '—')}</div></div>
        <div><div class="label">Vehicle</div><div class="value">${escapeHtml(
          [state.vehicle.brand, state.vehicle.model, state.vehicle.variant].filter(Boolean).join(' ') || '—'
        )}</div></div>
        <div><div class="label">Fuel</div><div class="value">${escapeHtml(state.vehicle.fuelType || '—')}</div></div>
        <div><div class="label">Odometer</div><div class="value">${state.vehicle.odometer ? `${Number(state.vehicle.odometer).toLocaleString('en-IN')} km` : '—'}</div></div>
        <div><div class="label">Year</div><div class="value">${escapeHtml(state.vehicle.year || '—')}</div></div>
        <div><div class="label">Colour</div><div class="value">${escapeHtml(state.vehicle.color || '—')}</div></div>
        <div><div class="label">Engine No</div><div class="value">${escapeHtml(state.vehicle.engineNumber || '—')}</div></div>
        <div><div class="label">Chassis No</div><div class="value">${escapeHtml(state.vehicle.chassisNumber || '—')}</div></div>
      </div>
    </div>

    <div class="section">
      <h3>Inspection Summary</h3>
      <div class="grid">
        <div><div class="label">${INSPECTION_STATUS_META.good.icon} Good</div><div class="value good">${counts.good}</div></div>
        <div><div class="label">${INSPECTION_STATUS_META.attention.icon} Attention</div><div class="value attention">${counts.attention}</div></div>
        <div><div class="label">${INSPECTION_STATUS_META.critical.icon} Critical</div><div class="value critical">${counts.critical}</div></div>
        <div><div class="label">${INSPECTION_STATUS_META.na.icon} N/A</div><div class="value na">${counts.na}</div></div>
      </div>
      ${
        issues.length
          ? `<div style="margin-top:8px">${issues
              .map(
                ({ category, item }) =>
                  `<div class="issue"><span class="badge ${item.status}">${INSPECTION_STATUS_META[item.status].label}</span> <strong>${escapeHtml(
                    category
                  )} — ${escapeHtml(item.name)}</strong>${
                    item.notes ? `<div class="note">${escapeHtml(item.notes)}</div>` : ''
                  }</div>`
              )
              .join('')}</div>`
          : '<div class="muted" style="font-size:10px;margin-top:6px">No defects recorded.</div>'
      }
    </div>

    <div class="section">
      <h3>Services, Parts &amp; Labour</h3>
      <table>
        <thead>
          <tr>
            <th>Item</th><th>Type</th><th class="num">Qty</th><th class="num">Rate</th>
            <th class="num">Discount</th><th class="num">Tax</th><th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows || '<tr><td colspan="7" class="muted">No items</td></tr>'}</tbody>
      </table>
    </div>

    <div class="section">
      <h3>Financial Summary</h3>
      <div class="totals">
        <div class="line"><span>Subtotal</span><span>${formatMoney(totals.subtotal, config.currency)}</span></div>
        <div class="line"><span>Discount</span><span>-${formatMoney(totals.discountTotal, config.currency)}</span></div>
        <div class="line"><span>Taxable Amount</span><span>${formatMoney(totals.taxableAmount, config.currency)}</span></div>
        ${taxRows}
        ${totals.roundOff ? `<div class="line"><span>Round Off</span><span>${formatMoney(totals.roundOff, config.currency)}</span></div>` : ''}
        <div class="line grand"><span>Grand Total</span><span>${formatMoney(totals.grandTotal, config.currency)}</span></div>
        ${
          totals.advancePaid
            ? `<div class="line"><span>Advance Paid</span><span>-${formatMoney(totals.advancePaid, config.currency)}</span></div>
               <div class="line balance"><span>Balance Due</span><span>${formatMoney(totals.balanceDue, config.currency)}</span></div>`
            : ''
        }
      </div>
    </div>

    ${payments}

    ${
      state.complaint
        ? `<div class="section"><h3>Customer Complaint</h3><div style="font-size:10px" class="muted">${escapeHtml(
            state.complaint
          )}</div></div>`
        : ''
    }

    ${
      state.notes
        ? `<div class="section"><h3>Notes</h3><div style="font-size:10px" class="muted">${escapeHtml(state.notes)}</div></div>`
        : ''
    }

    <div class="section">
      <h3>Terms &amp; Conditions</h3>
      <ol class="terms">${(config.terms || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ol>
    </div>

    <div class="signatures">
      <div class="line">Authorised Signature</div>
      <div class="line">Customer Signature</div>
    </div>

    <div class="footer">
      This is a computer generated estimate. ${taxLabel} as applicable. ${escapeHtml(config.company.name)} — ${escapeHtml(
        config.company.phone
      )}
    </div>
  </div>
</body>
</html>`;
}

/** Open a print preview window containing the estimate. */
export function openPrintWindow(
  state: EstimateState,
  config: EstimateBusinessConfig,
  options: PrintOptions = {}
): Window | null {
  const html = buildPrintableHtml(state, config, options);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!win) {
    throw new Error('Your browser blocked the print window. Allow pop-ups to preview the estimate.');
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
        /* the toolbar print button remains available */
      }
    }, 350);
  }
  return win;
}

/** Download the printable document as a standalone .html file (offline copy). */
export function downloadHtml(
  state: EstimateState,
  config: EstimateBusinessConfig,
  options: PrintOptions = {}
): string {
  const number = options.estimateNumber || state.metadata?.estimateNumber || 'draft';
  const filename = `${number.replace(/[^\w.-]+/g, '-')}-estimate.html`;
  const blob = new Blob([buildPrintableHtml(state, config, options)], { type: 'text/html;charset=utf-8' });
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

/** Server-side renderer endpoint (available once the estimate is generated). */
export function serverPdfUrl(estimateId: string): string {
  const base = (import.meta as any)?.env?.VITE_API_URL || '/api';
  return `${base}/estimates/${estimateId}/pdf`;
}

export default { buildPrintableHtml, openPrintWindow, downloadHtml, serverPdfUrl };
