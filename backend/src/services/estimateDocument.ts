// ---------------------------------------------------------------------------
// Printable estimate document.
//
// Emitted as a self-contained A4 HTML document: it renders in any browser, can
// be printed to PDF, and is the exact markup a headless PDF renderer would
// consume. Swapping in pdfkit/puppeteer means feeding this HTML to the renderer
// — nothing above this module changes.
// ---------------------------------------------------------------------------

import { formatMoney, maxAllowedAdvance } from '../utils/estimateMath.js';

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtDate = (value: unknown): string => {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_LABEL: Record<string, string> = {
  good: '✓ Good',
  attention: '⚠ Attention',
  critical: '🔴 Critical',
  na: '— N/A',
};

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
  .sheet { width: 210mm; margin: 0 auto; padding: 12mm; }
  .head { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  .head h1 { margin: 0; font-size: 19px; }
  .head p { margin: 2px 0; font-size: 11px; color: #475569; }
  .head .meta { text-align: right; font-size: 11px; }
  .head .meta .no { font-size: 15px; font-weight: 700; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 16px 0 8px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; font-size: 11px; }
  .grid .k { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  .grid .v { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f8fafc; color: #475569; font-size: 10px; text-transform: uppercase; padding: 5px 7px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 5px 7px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .totals { width: 64mm; margin-left: auto; font-size: 11px; }
  .totals .line { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 5px; font-size: 14px; font-weight: 700; }
  .totals .balance { background: #f8fafc; font-weight: 700; padding: 5px 7px; margin-top: 5px; }
  ol.terms { margin: 0; padding-left: 16px; font-size: 10px; color: #475569; }
  .sigs { display: flex; justify-content: space-between; margin-top: 30px; font-size: 10px; color: #475569; }
  .sigs div { border-top: 1px solid #94a3b8; padding-top: 4px; width: 60mm; text-align: center; }
  @page { size: A4; margin: 8mm; }
  @media print { .sheet { width: auto; padding: 0; } }
`;

export function buildEstimateDocument(estimate: any, config: any): string {
  const totals = estimate.totals || {};
  const vehicle = estimate.vehicle || {};
  const customer = estimate.customer || {};
  const lineItems: any[] = estimate.lineItems || [];

  const counts = { good: 0, attention: 0, critical: 0, na: 0 } as Record<string, number>;
  const issues: { category: string; item: any }[] = [];
  for (const category of estimate.inspection || []) {
    for (const item of category.items || []) {
      counts[item.status] = (counts[item.status] || 0) + 1;
      if (item.status === 'attention' || item.status === 'critical') {
        issues.push({ category: category.name, item });
      }
    }
  }

  const rows = lineItems
    .map((item) => {
      const discount =
        item.discountAmount > 0
          ? item.discountType === 'percentage'
            ? `${item.discountValue}%`
            : formatMoney(item.discountAmount)
          : '—';
      const tax = !item.taxRate || item.taxType === 'NONE' ? 'No Tax' : `${item.taxRate}% ${item.taxType}`;
      const trace = item.inspectionItemName
        ? `<div style="color:#64748b;font-size:9px">From inspection: ${esc(item.inspectionItemName)}</div>`
        : '';
      const contents =
        item.type === 'package' && item.packageContents?.length
          ? `<div style="color:#64748b;font-size:9px">Includes: ${item.packageContents.map((c: any) => esc(c.name)).join(', ')}</div>`
          : '';
      return `<tr>
        <td><strong>${esc(item.name)}</strong>${item.description ? `<div style="color:#64748b;font-size:9px">${esc(item.description)}</div>` : ''}${trace}${contents}</td>
        <td>${esc(item.type)}</td>
        <td class="num">${esc(item.quantity)} ${esc(item.unit)}</td>
        <td class="num">${formatMoney(item.rate)}</td>
        <td class="num">${discount}</td>
        <td class="num">${tax}</td>
        <td class="num">${formatMoney(item.total)}</td>
      </tr>`;
    })
    .join('');

  const taxRows =
    totals.igst > 0
      ? `<div class="line"><span>IGST</span><span>${formatMoney(totals.igst)}</span></div>`
      : `<div class="line"><span>CGST</span><span>${formatMoney(totals.cgst)}</span></div>
         <div class="line"><span>SGST</span><span>${formatMoney(totals.sgst)}</span></div>`;

  const advanceRows = (estimate.payments || []).length
    ? `<h3>Advance Payment</h3>
       <table><thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th class="num">Amount</th></tr></thead>
       <tbody>${(estimate.payments || [])
         .map(
           (p: any) =>
             `<tr><td>${fmtDate(p.date)}</td><td>${esc(p.mode)}</td><td>${esc(p.reference || '—')}</td><td class="num">${formatMoney(p.amount)}</td></tr>`
         )
         .join('')}</tbody></table>`
    : '';

  const cap = maxAllowedAdvance(Number(totals.grandTotal) || 0, config);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(estimate.estimateNumber)} — Estimate</title>
<style>${STYLES}</style></head>
<body><div class="sheet">
  <div class="head">
    <div>
      <h1>${esc(config.company.name)}</h1>
      <p>${esc(config.company.address)}</p>
      <p>${esc(config.company.phone)} | ${esc(config.company.email)}</p>
      <p>GSTIN: ${esc(config.company.gstNumber)}</p>
    </div>
    <div class="meta">
      <div class="no">${esc(estimate.estimateNumber)}</div>
      <div style="color:#64748b">Service Estimate</div>
      <div>Date: ${fmtDate(estimate.metadata?.estimateDate || estimate.createdAt)}</div>
      <div>Valid until: ${fmtDate(estimate.metadata?.validUntil || estimate.validUntil)}</div>
      <div>Status: ${esc(estimate.status)}</div>
    </div>
  </div>

  <h3>Customer</h3>
  <div class="grid">
    <div><div class="k">Name</div><div class="v">${esc(customer.name || '—')}</div></div>
    <div><div class="k">Phone</div><div class="v">${esc(customer.phone || '—')}</div></div>
    <div><div class="k">Email</div><div class="v">${esc(customer.email || '—')}</div></div>
    <div><div class="k">GSTIN</div><div class="v">${esc(customer.gstNumber || '—')}</div></div>
    <div style="grid-column: span 4"><div class="k">Address</div><div class="v">${esc(
      [customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ') || '—'
    )}</div></div>
  </div>

  <h3>Vehicle</h3>
  <div class="grid">
    <div><div class="k">Registration</div><div class="v">${esc(vehicle.registrationNumber || '—')}</div></div>
    <div><div class="k">Vehicle</div><div class="v">${esc([vehicle.brand, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || '—')}</div></div>
    <div><div class="k">Fuel</div><div class="v">${esc(vehicle.fuelType || '—')}</div></div>
    <div><div class="k">Odometer</div><div class="v">${vehicle.odometer ? `${Number(vehicle.odometer).toLocaleString('en-IN')} km` : '—'}</div></div>
    <div><div class="k">Year</div><div class="v">${esc(vehicle.year || '—')}</div></div>
    <div><div class="k">Colour</div><div class="v">${esc(vehicle.color || '—')}</div></div>
    <div><div class="k">Engine No</div><div class="v">${esc(vehicle.engineNumber || '—')}</div></div>
    <div><div class="k">Chassis No</div><div class="v">${esc(vehicle.chassisNumber || '—')}</div></div>
  </div>

  <h3>Inspection Summary</h3>
  <div class="grid">
    <div><div class="k">✓ Good</div><div class="v">${counts.good || 0}</div></div>
    <div><div class="k">⚠ Attention</div><div class="v">${counts.attention || 0}</div></div>
    <div><div class="k">🔴 Critical</div><div class="v">${counts.critical || 0}</div></div>
    <div><div class="k">— N/A</div><div class="v">${counts.na || 0}</div></div>
  </div>
  ${
    issues.length
      ? issues
          .map(
            ({ category, item }) =>
              `<div style="font-size:10px;margin-top:4px"><strong>${STATUS_LABEL[item.status] || item.status}</strong> ${esc(
                category
              )} — ${esc(item.name)}${item.notes ? `<div style="color:#475569">${esc(item.notes)}</div>` : ''}</div>`
          )
          .join('')
      : '<div style="font-size:10px;color:#64748b;margin-top:6px">No defects recorded.</div>'
  }

  <h3>Services, Parts &amp; Labour</h3>
  <table>
    <thead><tr><th>Item</th><th>Type</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Discount</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7">No items</td></tr>'}</tbody>
  </table>

  <h3>Financial Summary</h3>
  <div class="totals">
    <div class="line"><span>Subtotal</span><span>${formatMoney(totals.subtotal)}</span></div>
    <div class="line"><span>Discount</span><span>-${formatMoney(totals.discountTotal)}</span></div>
    <div class="line"><span>Taxable Amount</span><span>${formatMoney(totals.taxableAmount)}</span></div>
    ${taxRows}
    ${totals.roundOff ? `<div class="line"><span>Round Off</span><span>${formatMoney(totals.roundOff)}</span></div>` : ''}
    <div class="line grand"><span>Grand Total</span><span>${formatMoney(totals.grandTotal)}</span></div>
    ${
      totals.advancePaid
        ? `<div class="line"><span>Advance Paid</span><span>-${formatMoney(totals.advancePaid)}</span></div>
           <div class="line balance"><span>Balance Due</span><span>${formatMoney(totals.balanceDue)}</span></div>`
        : ''
    }
    ${Number.isFinite(cap) ? `<div style="font-size:9px;color:#94a3b8;margin-top:4px">Maximum advance allowed: ${formatMoney(cap)}</div>` : ''}
  </div>

  ${advanceRows}

  ${estimate.complaint ? `<h3>Customer Complaint</h3><div style="font-size:10px;color:#475569">${esc(estimate.complaint)}</div>` : ''}
  ${estimate.notes ? `<h3>Notes</h3><div style="font-size:10px;color:#475569">${esc(estimate.notes)}</div>` : ''}

  <h3>Terms &amp; Conditions</h3>
  <ol class="terms">${(config.terms || []).map((t: string) => `<li>${esc(t)}</li>`).join('')}</ol>

  <div class="sigs"><div>Authorised Signature</div><div>Customer Signature</div></div>
</div></body></html>`;
}

export default buildEstimateDocument;
