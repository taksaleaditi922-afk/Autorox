import { describe, expect, it } from 'vitest';
import {
  JOB_CARD_DOCUMENTS,
  buildJobCardDocument,
  documentNumber,
  resolveJobCardDocumentConfig,
} from './documentService';

const jobCard = {
  jobCardNumber: 'JC-1001',
  createdAt: '2026-01-05T10:00:00.000Z',
  status: 'In Progress',
  paymentStatus: 'Pending',
  source: 'Walk-in',
  customer: {
    type: 'Individual',
    name: 'Asha Rao',
    phone: '9876543210',
    email: 'asha@example.com',
    address: '12 MG Road, Pune',
    idProofNumber: '1234 5678 9012',
  },
  vehicle: {
    registrationNumber: 'MH12AB1234',
    make: 'Maruti',
    model: 'Swift',
    year: 2020,
    odometerReading: 42000,
    fuelType: 'Petrol',
    chassisNumber: 'MA3XYZ123',
  },
  service: { type: 'Repair', priority: 'High' },
  intake: { complaint: 'Noise from the front suspension' },
  inspectionReport: [
    { item: 'Brakes', condition: 'Needs Attention', notes: 'Pads worn', photoUrl: 'https://example.com/p.jpg' },
    { item: 'Engine', condition: 'Good', notes: '', photoUrl: '' },
  ],
  services: [
    { name: 'Brake Pad Replacement', type: 'service', unit: 'nos', qty: 1, price: 2500, taxType: 'GST', taxRate: 18, discountType: 'none', discountValue: 0 },
  ],
  orderSummary: { discount: 100, advanceDeducted: 500, paymentTerms: 'Balance on delivery' },
  advances: [{ amount: 500, paymentMode: 'Cash', reference: 'R1', recordedAt: '2026-01-05T10:00:00.000Z' }],
};

const config = resolveJobCardDocumentConfig();

describe('job card documents', () => {
  it('builds every document as a self-contained sheet', () => {
    for (const doc of JOB_CARD_DOCUMENTS) {
      const html = buildJobCardDocument(doc.id, jobCard, config);
      expect(html).toContain('<!doctype html>');
      expect(html).toContain(doc.label);
      expect(html).toContain('MH12AB1234');
      expect(html).toContain('JC-1001');
      expect(html).toContain('window.print()');
    }
  });

  it('renders the money breakdown on the proforma invoice', () => {
    const html = buildJobCardDocument('proforma-invoice', jobCard, config);
    expect(html).toContain('Grand Total');
    expect(html).toContain('Balance Due');
    expect(html).toContain('Order Discount');
    expect(html).toContain('Balance on delivery');
    // 1 x 2500 subtotal, 100 order discount and 500 advance from the job card.
    expect(html).toContain('2,500.00');
    expect(html).toContain('100.00');
    expect(html).toContain('500.00');
  });

  it('lists inspection findings and media', () => {
    const report = buildJobCardDocument('inspection-report', jobCard, config);
    expect(report).toContain('Brakes');
    expect(report).toContain('Needs Attention');

    const media = buildJobCardDocument('inspection-media', jobCard, config);
    expect(media).toContain('https://example.com/p.jpg');
    expect(media).toContain('No media');
  });

  it('numbers each document from the job card', () => {
    expect(documentNumber('proforma-invoice', jobCard)).toBe('PI-JC-1001');
    expect(documentNumber('work-order', jobCard)).toBe('WO-JC-1001');
    expect(documentNumber('proforma-invoice', { jobCardNumber: 'JC-2', invoice: { number: 'INV-9' } })).toBe('INV-9');
  });

  it('escapes user supplied text', () => {
    const html = buildJobCardDocument(
      'customer-complaint',
      { ...jobCard, customer: { ...jobCard.customer, name: '<script>alert(1)</script>' } },
      config
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
