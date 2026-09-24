// ---------------------------------------------------------------------------
// Tests for the estimate validation schemas and the step gates.
//
// Covers the acceptance rules: a step cannot be left while it is invalid, the
// inspection step never blocks, and generation is refused with an explanation
// when the customer, vehicle or billable items are missing.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  ESTIMATE_STEPS,
  lineItemTypeLabel,
  maskIdentityNumber,
  maskPhone,
  stepValidator,
  validateEstimateForGeneration,
  validateLineItem,
  validateServicesStep,
  validateVehicleClientStep,
} from './estimateValidation';
import { computeEstimateTotals } from './estimateMath';
import {
  EMPTY_TOTALS,
} from './estimateMath';
import { DEFAULT_BUSINESS_CONFIG, getDocumentStatus, daysUntil } from '../services/estimate/config';
import { createEmptyEstimate } from '../redux/estimateSlice';
import type { EstimateLineItem, EstimateState } from '../services/estimate/types';

function lineItem(overrides: Partial<EstimateLineItem> = {}): EstimateLineItem {
  return {
    id: 'item-1',
    type: 'service',
    name: 'Brake Pad Replacement',
    unit: 'Job',
    quantity: 1,
    rate: 2500,
    discountType: 'none',
    discountValue: 0,
    taxType: 'GST',
    taxRate: 18,
    subtotal: 2500,
    discountAmount: 0,
    taxableAmount: 2500,
    taxAmount: 450,
    total: 2950,
    ...overrides,
  };
}

/** A complete, valid draft that is ready to be generated. */
function validState(overrides: Partial<EstimateState> = {}): EstimateState {
  const base = createEmptyEstimate();
  const items = overrides.lineItems ?? [lineItem()];
  const payments = overrides.payments ?? [];

  return {
    ...base,
    vehicle: {
      ...base.vehicle,
      registrationNumber: 'MH12AB1234',
      brand: 'Maruti Suzuki',
      model: 'Swift',
      year: 2022,
      fuelType: 'Petrol',
      odometer: 48250,
    },
    customer: {
      ...base.customer,
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul@example.com',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    ...overrides,
    lineItems: items,
    payments,
    totals: overrides.totals ?? computeEstimateTotals(items, payments, DEFAULT_BUSINESS_CONFIG),
  };
}

describe('vehicle + customer step', () => {
  it('accepts a complete vehicle and customer', () => {
    const result = validateVehicleClientStep(validState());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('requires the registration number, brand, model, year and fuel type', () => {
    const state = validState({ vehicle: createEmptyEstimate().vehicle });
    const result = validateVehicleClientStep(state);

    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(
      expect.arrayContaining([
        'vehicle.registrationNumber',
        'vehicle.brand',
        'vehicle.model',
        'vehicle.year',
        'vehicle.fuelType',
      ])
    );
  });

  it('rejects a malformed registration number', () => {
    const state = validState();
    state.vehicle.registrationNumber = '!!';
    expect(validateVehicleClientStep(state).errors['vehicle.registrationNumber']).toBeDefined();
  });

  it('accepts common Indian registration formats', () => {
    for (const registrationNumber of ['MH12AB1234', 'MH-12-AB-1234', 'DL8CAF5030', 'KA01HJ1234']) {
      const state = validState();
      state.vehicle.registrationNumber = registrationNumber;
      expect(validateVehicleClientStep(state).errors['vehicle.registrationNumber']).toBeUndefined();
    }
  });

  it('requires the customer name and a valid mobile number', () => {
    const missing = validateVehicleClientStep(validState({ customer: createEmptyEstimate().customer }));
    expect(missing.errors['customer.name']).toBeDefined();
    expect(missing.errors['customer.phone']).toBeDefined();

    const badPhone = validState();
    badPhone.customer.phone = '12345';
    expect(validateVehicleClientStep(badPhone).errors['customer.phone']).toBe('Enter a valid 10-digit mobile number');
  });

  it('accepts a phone number with the +91 country code', () => {
    const state = validState();
    state.customer.phone = '+919876543210';
    expect(validateVehicleClientStep(state).errors['customer.phone']).toBeUndefined();
  });

  it('validates the email and GSTIN only when they are provided', () => {
    const state = validState();
    state.customer.email = 'not-an-email';
    state.customer.gstNumber = 'ABC';
    const errors = validateVehicleClientStep(state).errors;

    expect(errors['customer.email']).toBeDefined();
    expect(errors['customer.gstNumber']).toBeDefined();

    state.customer.email = 'rahul@example.com';
    state.customer.gstNumber = '27ABCDE1234F1Z5';
    expect(validateVehicleClientStep(state).errors['customer.email']).toBeUndefined();
    expect(validateVehicleClientStep(state).errors['customer.gstNumber']).toBeUndefined();
  });

  it('rejects a 5-digit pincode and a future registration year', () => {
    const state = validState();
    state.customer.pincode = '40001';
    state.vehicle.year = new Date().getFullYear() + 5;
    expect(validateVehicleClientStep(state).errors['customer.pincode']).toBeDefined();
    expect(validateVehicleClientStep(state).errors['vehicle.year']).toBeDefined();
  });

  it('rejects an odometer or fuel meter outside the sensible range', () => {
    const state = validState();
    state.vehicle.odometer = -1;
    state.vehicle.fuelMeter = 150;
    const errors = validateVehicleClientStep(state).errors;
    expect(errors['vehicle.odometer']).toBeDefined();
    expect(errors['vehicle.fuelMeter']).toBeDefined();
  });

  it('requires the insurance company once a policy number exists', () => {
    const state = validState();
    state.insurance.policyNumber = 'POL-123';
    expect(validateVehicleClientStep(state).errors['insurance']).toBeDefined();
  });

  it('rejects an insurance expiry date before the start date', () => {
    const state = validState();
    state.insurance = {
      ...state.insurance,
      company: 'ICICI Lombard',
      policyNumber: 'POL-123',
      startDate: '2026-06-01',
      expiryDate: '2026-01-01',
    };
    expect(validateVehicleClientStep(state).errors['insurance']).toBeDefined();
  });

  it('does not flag a fresh draft for compliance reminders', () => {
    // An enabled reminder without a date is an error, so the defaults must be
    // off — otherwise step 1 is blocked before the advisor sees the section.
    const errors = validateVehicleClientStep(createEmptyEstimate()).errors;
    expect(errors['documents.rc']).toBeUndefined();
    expect(errors['documents.puc']).toBeUndefined();
    expect(errors['documents.license']).toBeUndefined();
  });

  it('requires an expiry date when a compliance reminder is enabled', () => {
    const state = validState();
    state.documents.rc = { expiryDate: '', setReminder: true };
    expect(validateVehicleClientStep(state).errors['documents.rc']).toBeDefined();

    state.documents.rc = { expiryDate: '2027-01-01', setReminder: true };
    expect(validateVehicleClientStep(state).errors['documents.rc']).toBeUndefined();
  });

  it('validates the identity proof type/number pair', () => {
    const state = validState();
    state.identityProof = { idType: 'PAN', idNumber: '', document: null };
    expect(validateVehicleClientStep(state).errors['identityProof']).toBeDefined();

    state.identityProof = { idType: 'PAN', idNumber: 'ABCDE1234F', document: null };
    expect(validateVehicleClientStep(state).errors['identityProof']).toBeUndefined();

    state.identityProof = { idType: 'PAN', idNumber: '12345', document: null };
    expect(validateVehicleClientStep(state).errors['identityProof']).toBeDefined();

    state.identityProof = { idType: 'Aadhaar', idNumber: '123456789012', document: null };
    expect(validateVehicleClientStep(state).errors['identityProof']).toBeUndefined();
  });

  it('requires the pickup details when a pickup is requested', () => {
    const state = validState();
    state.pickup = { ...state.pickup, enabled: true };
    const errors = validateVehicleClientStep(state).errors;

    expect(errors['pickup']).toBeDefined();
    expect(validateVehicleClientStep(state).summary.length).toBeGreaterThan(0);
  });

  it('rejects a pickup date in the past', () => {
    const state = validState();
    state.pickup = {
      ...state.pickup,
      enabled: true,
      address: 'Andheri West, Mumbai',
      contactPerson: 'Rahul Sharma',
      phone: '9876543210',
      preferredDate: '2020-01-01',
    };
    expect(validateVehicleClientStep(state).errors['pickup']).toBeDefined();
  });

  it('accepts a complete pickup request scheduled tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const state = validState();
    state.pickup = {
      ...state.pickup,
      enabled: true,
      address: 'Andheri West, Mumbai 400053',
      contactPerson: 'Rahul Sharma',
      phone: '9876543210',
      preferredDate: tomorrow.toISOString().slice(0, 10),
      preferredTime: '10:30',
    };
    expect(validateVehicleClientStep(state).errors).toEqual({});
  });
});

describe('line item validation', () => {
  it('accepts a normal line item', () => {
    expect(validateLineItem(lineItem())).toEqual({});
  });

  it('rejects a zero quantity with the specific message', () => {
    expect(validateLineItem(lineItem({ quantity: 0 })).quantity).toBe('Quantity must be greater than zero');
  });

  it('accepts a decimal quantity', () => {
    expect(validateLineItem(lineItem({ quantity: 2.5 })).quantity).toBeUndefined();
  });

  it('rejects a negative rate', () => {
    expect(validateLineItem(lineItem({ rate: -100 })).rate).toBe('Rate cannot be negative');
  });

  it('accepts a zero-rate (complimentary) item', () => {
    expect(validateLineItem(lineItem({ rate: 0 })).rate).toBeUndefined();
  });

  it('requires a name', () => {
    expect(validateLineItem(lineItem({ name: '   ' })).name).toBeDefined();
  });

  it('rejects a percentage discount above 100', () => {
    expect(validateLineItem(lineItem({ discountType: 'percentage', discountValue: 150 })).discountValue).toBe(
      'Percentage discount cannot exceed 100%'
    );
  });

  it('rejects a fixed discount larger than the line amount', () => {
    const errors = validateLineItem(lineItem({ quantity: 1, rate: 500, discountType: 'fixed', discountValue: 900 }));
    expect(errors.discountValue).toBe('Discount cannot exceed the line amount');
  });

  it('accepts a 100% discount', () => {
    const errors = validateLineItem(
      lineItem({ rate: 500, discountType: 'percentage', discountValue: 100, taxRate: 0, taxType: 'NONE' })
    );
    expect(errors.discountValue).toBeUndefined();
  });

  it('rejects a negative tax rate', () => {
    expect(validateLineItem(lineItem({ taxRate: -5 })).taxRate).toBe('Tax rate cannot be negative');
  });
});

describe('services step', () => {
  it('blocks an empty estimate and says why', () => {
    const result = validateServicesStep(validState({ lineItems: [] }), DEFAULT_BUSINESS_CONFIG);
    expect(result.valid).toBe(false);
    expect(result.summary.join(' ')).toContain('At least one service, package, part, labour or custom item');
  });

  it('passes with at least one valid item', () => {
    expect(validateServicesStep(validState(), DEFAULT_BUSINESS_CONFIG).valid).toBe(true);
  });

  it('names the offending item in the summary', () => {
    const bad = lineItem({ id: 'bad', name: 'Wheel Alignment', quantity: 0 });
    const result = validateServicesStep(validState({ lineItems: [bad] }), DEFAULT_BUSINESS_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.summary.join(' ')).toContain('Wheel Alignment');
    expect(result.errors['lineItems.0.quantity']).toBeDefined();
  });

  it('rejects an advance above the configured cap', () => {
    const state = validState();
    const config = { ...DEFAULT_BUSINESS_CONFIG, advanceMaxPercent: 50 };
    const cap = state.totals.grandTotal / 2;

    // Exactly at the cap is allowed.
    state.totals = { ...state.totals, advancePaid: cap };
    expect(validateServicesStep(state, config).errors['advance']).toBeUndefined();

    state.totals = { ...state.totals, advancePaid: cap + 1 };
    expect(validateServicesStep(state, config).errors['advance']).toBeDefined();
  });

  it('flags a negative grand total', () => {
    const state = validState();
    state.totals = { ...EMPTY_TOTALS, grandTotal: -100 };
    expect(validateServicesStep(state, DEFAULT_BUSINESS_CONFIG).errors['grandTotal']).toBeDefined();
  });
});

describe('inspection step', () => {
  it('never blocks — inspection is optional', () => {
    const result = stepValidator(1)(createEmptyEstimate(), DEFAULT_BUSINESS_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.summary).toEqual([]);
  });
});

describe('generation guard', () => {
  it('allows a complete estimate', () => {
    expect(validateEstimateForGeneration(validState(), DEFAULT_BUSINESS_CONFIG).valid).toBe(true);
  });

  it('is invalid and explains itself for an entirely empty estimate', () => {
    const result = validateEstimateForGeneration(createEmptyEstimate(), DEFAULT_BUSINESS_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.errors['vehicle.registrationNumber']).toBeDefined();
    expect(result.errors['customer.phone']).toBeDefined();
  });

  it('requires at least one billable item', () => {
    const state = validState({ lineItems: [] });
    const result = validateEstimateForGeneration(state, DEFAULT_BUSINESS_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.summary.join(' ')).toContain('At least one');
  });

  it('requires the customer phone and the registration number', () => {
    const noPhone = validState();
    noPhone.customer.phone = '';
    const noReg = validState();
    noReg.vehicle.registrationNumber = '';

    expect(validateEstimateForGeneration(noPhone, DEFAULT_BUSINESS_CONFIG).errors['customer.phone']).toBeDefined();
    expect(validateEstimateForGeneration(noReg, DEFAULT_BUSINESS_CONFIG).errors['vehicle.registrationNumber']).toBeDefined();
  });

  it('refuses a zero total', () => {
    const state = validState({
      lineItems: [lineItem({ rate: 0, taxRate: 0, taxType: 'NONE', name: 'Free check' })],
    });
    const result = validateEstimateForGeneration(state, DEFAULT_BUSINESS_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.summary.join(' ')).toContain('greater than zero');
  });

  it('refuses a discount larger than the subtotal', () => {
    const state = validState();
    state.totals = { ...state.totals, subtotal: 1000, discountTotal: 2000, grandTotal: 500 };
    const result = validateEstimateForGeneration(state, DEFAULT_BUSINESS_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.summary.join(' ')).toContain('Total discount cannot exceed the subtotal');
  });

  it('surfaces a broken line item so a zero-quantity row cannot be generated', () => {
    const state = validState({ lineItems: [lineItem({ quantity: 0 })] });
    const result = validateEstimateForGeneration(state, DEFAULT_BUSINESS_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.errors['lineItems.0.quantity']).toBeDefined();
  });
});

describe('step metadata', () => {
  it('exposes four steps in workflow order', () => {
    expect(ESTIMATE_STEPS.map((s) => s.key)).toEqual(['vehicle-client', 'inspection', 'services', 'review']);
  });

  it('routes each step index to a validator', () => {
    for (const index of [0, 1, 2, 3]) {
      expect(typeof stepValidator(index)).toBe('function');
    }
    expect(stepValidator(9)).toBe(validateEstimateForGeneration);
  });

  it('labels every line item type', () => {
    expect(lineItemTypeLabel('service')).toBe('Service');
    expect(lineItemTypeLabel('package')).toBe('Package');
    expect(lineItemTypeLabel('part')).toBe('Part');
    expect(lineItemTypeLabel('labour')).toBe('Labour');
    expect(lineItemTypeLabel('custom')).toBe('Custom');
  });
});

describe('sensitive value masking', () => {
  it('masks all but the last four characters of an identity number', () => {
    expect(maskIdentityNumber('123456789012')).toBe('XXXXXXXX9012');
    expect(maskIdentityNumber('ABCDE1234F')).toBe('XXXXXX234F');
    expect(maskIdentityNumber('')).toBe('—');
    expect(maskIdentityNumber(null)).toBe('—');
  });

  it('masks the middle of a phone number', () => {
    expect(maskPhone('9876543210')).toBe('98XXXXX210');
    expect(maskPhone('')).toBe('—');
  });
});

describe('document expiry status', () => {
  const from = new Date('2026-06-15T12:00:00.000Z');

  it('reports valid, expiring soon and expired', () => {
    expect(getDocumentStatus('2027-01-01', 30, from)).toBe('valid');
    expect(getDocumentStatus('2026-07-01', 30, from)).toBe('expiring-soon');
    expect(getDocumentStatus('2026-01-01', 30, from)).toBe('expired');
    expect(getDocumentStatus('', 30, from)).toBe('unknown');
  });

  it('honours a configurable reminder threshold', () => {
    expect(getDocumentStatus('2026-08-01', 30, from)).toBe('valid');
    expect(getDocumentStatus('2026-08-01', 60, from)).toBe('expiring-soon');
  });

  it('counts whole days between dates', () => {
    // Asserted as relative offsets so the test does not depend on the machine's
    // timezone (date-only strings are parsed as UTC).
    const first = daysUntil('2026-06-20', from) as number;
    const next = daysUntil('2026-06-21', from) as number;
    expect(next - first).toBe(1);
    expect(daysUntil('2026-06-10', from)).toBeLessThan(0);
    expect(daysUntil('2026-06-10', from)).toBeLessThan(first);
    expect(daysUntil('')).toBeNull();
    expect(daysUntil('not-a-date', from)).toBeNull();
  });
});
