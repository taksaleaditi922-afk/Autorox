// ---------------------------------------------------------------------------
// Tests for payload sanitisation.
//
// The client is untrusted: a malformed or hostile draft must never be able to
// inject a money value, a bad enum, a negative quantity or an oversized array
// into the database.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

// The installed mongoose package only ships TypeScript sources, which Vitest
// cannot load, so the model is replaced with an enum-only stub.
vi.mock('../models/Estimate.js', async () => (await import('./estimateModel.test-support.js')).estimateModelStub());

import {
  parseDate,
  sanitizeCustomer,
  sanitizeDocuments,
  sanitizeIdentityProof,
  sanitizeInspection,
  sanitizeLineItem,
  sanitizeLineItems,
  sanitizeMetadata,
  sanitizePayments,
  sanitizePickup,
  sanitizeVehicle,
} from './estimatePayload.js';

describe('vehicle', () => {
  it('normalises the registration number', () => {
    const vehicle = sanitizeVehicle({ registrationNumber: 'mh-12 ab 1234' });
    expect(vehicle.registrationNumber).toBe('MH12AB1234');
  });

  it('defaults the vehicle type and fuel type to allowed values', () => {
    expect(sanitizeVehicle({ type: 'truck', fuelType: 'Steam' })).toMatchObject({ type: '4W', fuelType: '' });
    expect(sanitizeVehicle({ type: '2W', fuelType: 'CNG' })).toMatchObject({ type: '2W', fuelType: 'CNG' });
  });

  it('keeps blank numerics as null rather than zero', () => {
    expect(sanitizeVehicle({ year: '', odometer: undefined })).toMatchObject({ year: null, odometer: null });
    expect(sanitizeVehicle({ year: '2019', odometer: '48250' })).toMatchObject({ year: 2019, odometer: 48250 });
  });
});

describe('customer', () => {
  it('reduces the phone to its last 10 digits', () => {
    expect(sanitizeCustomer({ phone: '+91 98765 43210' }).phone).toBe('9876543210');
    expect(sanitizeCustomer({ phone: '98765-43210' }).phone).toBe('9876543210');
  });

  it('upper-cases the GSTIN and trims the pincode', () => {
    const customer = sanitizeCustomer({ gstNumber: '27abcde1234f1z5', pincode: '400 001' });
    expect(customer.gstNumber).toBe('27ABCDE1234F1Z5');
    expect(customer.pincode).toBe('400001');
  });

  it('lower-cases the email address', () => {
    expect(sanitizeCustomer({ email: 'Rahul@Example.COM' }).email).toBe('rahul@example.com');
  });
});

describe('line items', () => {
  it('discards every derived money column the client sent', () => {
    const result = sanitizeLineItem({
      id: 'a',
      name: 'Brake Pad Replacement',
      quantity: 1,
      rate: 2500,
      subtotal: 999999,
      discountAmount: -500,
      taxableAmount: 1,
      taxAmount: 0,
      total: 12,
    }) as Record<string, unknown>;

    expect(result).not.toHaveProperty('subtotal');
    expect(result).not.toHaveProperty('discountAmount');
    expect(result).not.toHaveProperty('taxableAmount');
    expect(result).not.toHaveProperty('taxAmount');
    expect(result).not.toHaveProperty('total');
    expect(result.rate).toBe(2500);
  });

  it('coerces a non-positive quantity to 1 so a line can never be free or negative', () => {
    expect(sanitizeLineItem({ quantity: 0 }).quantity).toBe(1);
    expect(sanitizeLineItem({ quantity: -5 }).quantity).toBe(1);
    expect(sanitizeLineItem({ quantity: 'abc' }).quantity).toBe(1);
    expect(sanitizeLineItem({ quantity: 2.5 }).quantity).toBe(2.5);
  });

  it('clamps a negative rate, discount and tax rate to zero', () => {
    const result = sanitizeLineItem({
      rate: -100,
      discountType: 'fixed',
      discountValue: -50,
      taxType: 'GST',
      taxRate: -18,
    });

    expect(result.rate).toBe(0);
    expect(result.discountValue).toBe(0);
    expect(result.taxRate).toBe(0);
  });

  it('caps a percentage discount at 100 and keeps a fixed discount untouched', () => {
    expect(sanitizeLineItem({ discountType: 'percentage', discountValue: 150 }).discountValue).toBe(100);
    expect(sanitizeLineItem({ discountType: 'fixed', discountValue: 4000 }).discountValue).toBe(4000);
    expect(sanitizeLineItem({ discountType: undefined }).discountType).toBe('none');
  });

  it('falls back to safe enum values', () => {
    expect(sanitizeLineItem({ type: 'spaceship' }).type).toBe('custom');
    expect(sanitizeLineItem({ taxType: 'VAT' }).taxType).toBe('GST');
    expect(sanitizeLineItem({ discountType: 'half' }).discountType).toBe('none');
  });

  it('gives unnamed rows a placeholder name, id and unit', () => {
    const result = sanitizeLineItem({}, 3);
    expect(result.id).toBe('item-3');
    expect(result.name).toBe('Item 4');
    expect(result.unit).toBe('Pcs');
  });

  it('keeps the package contents and the inspection provenance', () => {
    const result = sanitizeLineItem({
      type: 'package',
      packageContents: [{ name: 'Engine Oil Change', quantity: 0, rate: 1200, taxRate: 18 }],
      inspectionItemId: 'insp-1',
      inspectionItemName: 'Brake Fluid',
      inspectionCategoryName: 'Mechanical',
    });

    expect(result.packageContents).toHaveLength(1);
    expect(result.packageContents[0]).toMatchObject({ name: 'Engine Oil Change', quantity: 1, rate: 1200 });
    expect(result.inspectionItemId).toBe('insp-1');
    expect(result.inspectionCategoryName).toBe('Mechanical');
  });

  it('rejects a non-array payload and caps an absurd one at 500 rows', () => {
    expect(sanitizeLineItems('nope')).toBeUndefined();
    expect(sanitizeLineItems(Array.from({ length: 900 }, () => ({ name: 'x' })))).toHaveLength(500);
  });
});

describe('inspection payload', () => {
  it('rejects a non-array payload so existing inspection data is left alone', () => {
    expect(sanitizeInspection(undefined)).toBeUndefined();
    expect(sanitizeInspection({})).toBeUndefined();
  });

  it('fills in ids, names and a neutral status', () => {
    const [category] = sanitizeInspection([{ items: [{}] }])!;

    expect(category.id).toBe('cat-0');
    expect(category.name).toBe('Category 1');
    expect(category.isActive).toBe(true);
    expect(category.items[0]).toMatchObject({ status: 'na', notes: '', media: [], linkedServiceIds: [] });
  });

  it('keeps a valid status and drops an invalid one', () => {
    const [category] = sanitizeInspection([
      { id: 'c', name: 'Brakes', items: [{ status: 'critical' }, { status: 'maybe' }] },
    ])!;

    expect(category.items[0].status).toBe('critical');
    expect(category.items[1].status).toBe('na');
  });

  it('truncates runaway notes and strips blank service links', () => {
    const [category] = sanitizeInspection([
      { items: [{ notes: 'x'.repeat(5000), linkedServiceIds: ['svc-1', '', null] }] },
    ])!;

    expect(category.items[0].notes).toHaveLength(2000);
    expect(category.items[0].linkedServiceIds).toEqual(['svc-1']);
  });

  it('sanitises attached media', () => {
    const [category] = sanitizeInspection([
      { items: [{ media: [{ id: 'm1', name: 'pad.jpg', kind: 'video', size: '2048' }] }] },
    ])!;

    expect(category.items[0].media[0]).toMatchObject({ id: 'm1', kind: 'video', size: 2048 });
  });
});

describe('identity proof', () => {
  it('keeps the stored number when the client sends a masked value back', () => {
    const stored = { idNumber: '123456789012', document: { id: 'doc-1' } };
    const result = sanitizeIdentityProof({ idType: 'Aadhaar', idNumber: 'XXXXXXXX9012' }, stored);

    expect(result.idNumber).toBe('123456789012');
    expect(result.idLast4).toBe('9012');
    expect(result.document).toEqual(stored.document);
  });

  it('accepts a fresh number and records only the last four for display', () => {
    const result = sanitizeIdentityProof({ idType: 'PAN', idNumber: 'ABCDE1234F' }, undefined);

    expect(result.idNumber).toBe('ABCDE1234F');
    expect(result.idLast4).toBe('234F');
  });

  it('falls back to an empty id type and no document', () => {
    const result = sanitizeIdentityProof({}, undefined);
    expect(result.idType).toBe('');
    expect(result.idNumber).toBe('');
    expect(result.idLast4).toBe('');
    expect(result.document).toBeNull();
  });
});

describe('compliance documents and pickup', () => {
  it('coerces the reminder toggle and parses the expiry date', () => {
    const documents = sanitizeDocuments({ rc: { expiryDate: '2027-04-01', setReminder: 'yes' }, puc: null });

    expect(documents.rc.setReminder).toBe(true);
    expect(documents.rc.expiryDate).toBeInstanceOf(Date);
    expect(documents.puc).toEqual({ expiryDate: null, setReminder: false });
  });

  it('ignores an unparseable date', () => {
    expect(parseDate('not-a-date')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('2026-05-01')).toBeInstanceOf(Date);
  });

  it('normalises the pickup phone to the same 10-digit form as the customer', () => {
    const pickup = sanitizePickup({ address: 'Andheri', phone: '+91 98765 43210' });
    expect(pickup.enabled).toBe(false);
    expect(pickup.phone).toBe('9876543210');
    expect(sanitizePickup({ phone: '098765-43210' }).phone).toBe('9876543210');
  });
});

describe('payments', () => {
  it('rounds the amount to paise and defaults the mode', () => {
    const [payment] = sanitizePayments([{ amount: '1000.005', mode: 'Crypto', date: '2026-01-01' }])!;

    expect(payment.amount).toBe(1000.01);
    expect(payment.mode).toBe('Cash');
    expect(payment.date).toBeInstanceOf(Date);
  });

  it('clamps a negative advance to zero and caps the list at 200', () => {
    const [payment] = sanitizePayments([{ amount: -5000 }])!;
    expect(payment.amount).toBe(0);
    expect(sanitizePayments(Array.from({ length: 500 }, () => ({ amount: 1 })))).toHaveLength(200);
  });

  it('rejects a non-array payload', () => {
    expect(sanitizePayments('nope')).toBeUndefined();
  });
});

describe('metadata', () => {
  it('never lets a client overwrite an already issued estimate number', () => {
    const result = sanitizeMetadata({ estimateNumber: 'HACK-0001' }, { estimateNumber: 'EST-2026-000124' });
    expect(result.estimateNumber).toBe('EST-2026-000124');
  });

  it('stamps lastSavedAt and keeps the revision', () => {
    const result = sanitizeMetadata({}, { revision: 3 });
    expect(result.lastSavedAt).toBeInstanceOf(Date);
    expect(result.revision).toBe(3);
  });

  it('keeps the original estimate date when the client omits one', () => {
    const existing = { estimateDate: new Date('2026-02-02') };
    expect(sanitizeMetadata({}, existing).estimateDate).toEqual(existing.estimateDate);
  });
});
