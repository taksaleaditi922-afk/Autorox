import { describe, it, expect } from 'vitest';
import {
  buildJobCardPayload,
  computeOrderSummary,
  createEmptyJobCardForm,
  derivePaymentStatus,
  mapJobCardToForm,
  type JobCardFormState,
} from './jobCard';
import {
  serviceListWarnings,
  validateApprovalStep,
  validateJobCardForm,
  validateOrderSummaryStep,
  validateReminderStep,
  validateServicesStep,
  validateVehicleClientStep,
} from './jobCardValidation';

function validStepOneForm(): JobCardFormState {
  const form = createEmptyJobCardForm();
  form.vehicle.registrationNumber = 'GJ14AA8119';
  form.vehicle.odometer = '45000';
  form.customer.name = 'Ravi Kumar';
  form.customer.phone = '9876543210';
  form.customer.email = 'ravi@example.com';
  form.customer.address = '12 MG Road, Ahmedabad';
  return form;
}

describe('computeOrderSummary', () => {
  it('adds line items plus tax and subtracts the advance', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [
      { name: 'Oil change', type: 'service', qty: 2, price: 100, taxRate: 18 },
    ];
    const totals = computeOrderSummary(form);
    expect(totals.subtotal).toBe(200);
    expect(totals.tax).toBe(36);
    expect(totals.total).toBe(236);
    expect(totals.balanceDue).toBe(236);
  });

  it('applies the discount before the total and the advance to the balance', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [{ name: 'Wash', type: 'service', qty: 1, price: 500, taxRate: 0 }];
    form.orderSummary.discount = '100';
    form.intake.advanceAmount = '150';
    const totals = computeOrderSummary(form);
    expect(totals.total).toBe(400);
    expect(totals.balanceDue).toBe(250);
  });
});

describe('derivePaymentStatus', () => {
  it('marks the order paid when the advance covers the total', () => {
    expect(derivePaymentStatus({ subtotal: 100, discount: 0, tax: 0, advanceDeducted: 100, total: 100, balanceDue: 0 })).toBe(
      'Paid'
    );
  });

  it('keeps it pending while a balance remains', () => {
    expect(derivePaymentStatus({ subtotal: 100, discount: 0, tax: 0, advanceDeducted: 0, total: 100, balanceDue: 100 })).toBe(
      'Pending'
    );
  });
});

describe('vehicle & client validation', () => {
  it('rejects a blank form', () => {
    const result = validateVehicleClientStep(createEmptyJobCardForm());
    expect(result.valid).toBe(false);
    expect(result.errors['vehicle.registrationNumber']).toBeTruthy();
    expect(result.errors['customer.phone']).toBeTruthy();
  });

  it('accepts a complete individual customer', () => {
    const result = validateVehicleClientStep(validStepOneForm());
    expect(result.valid).toBe(true);
  });

  it('requires a GST number for a company customer', () => {
    const form = validStepOneForm();
    form.customer.type = 'Company';
    const result = validateVehicleClientStep(form);
    expect(result.valid).toBe(false);
    expect(result.errors['customer.gstNumber']).toBeTruthy();
  });

  it('validates an Indian registration number', () => {
    const form = validStepOneForm();
    form.vehicle.registrationNumber = 'BOGUS123';
    const result = validateVehicleClientStep(form);
    expect(result.errors['vehicle.registrationNumber']).toBeTruthy();
  });
});

describe('services validation', () => {
  it('requires at least one item', () => {
    const result = validateServicesStep(createEmptyJobCardForm());
    expect(result.valid).toBe(false);
    expect(result.summary.join(' ')).toContain('at least one');
  });

  it('rejects a zero quantity', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [{ name: 'Brake pads', type: 'part', qty: 0, price: 800, taxRate: 18 }];
    const result = validateServicesStep(form);
    expect(result.valid).toBe(false);
    expect(result.errors['lineItems.0.qty']).toBeTruthy();
  });

  it('accepts a well formed item', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [{ name: 'Brake pads', type: 'part', qty: 1, price: 800, taxRate: 18 }];
    expect(validateServicesStep(form).valid).toBe(true);
  });

  it('rejects a flat discount larger than the line subtotal', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [
      { name: 'Wash', type: 'service', qty: 1, price: 300, taxRate: 18, discountType: 'flat', discountValue: 500 },
    ];
    const result = validateServicesStep(form);
    expect(result.valid).toBe(false);
    expect(result.errors['lineItems.0.discountValue']).toContain('subtotal');
  });

  it('warns about a part quantity above stock without blocking', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [
      { name: 'Air filter', type: 'part', qty: 3, price: 400, taxType: 'GST', taxRate: 18, stockAvailable: 2 },
    ];
    const result = validateServicesStep(form);
    expect(result.valid).toBe(true);
    expect(result.warnings?.join(' ')).toContain('only 2 in stock');
    expect(serviceListWarnings(form)).toHaveLength(1);
  });

  it('warns when a package loses its header row', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [
      { name: 'Wheel alignment', type: 'service', qty: 1, price: 0, taxType: 'None', packageId: 'pkg-1', packageName: 'Full Service', coreItem: true },
    ];
    expect(serviceListWarnings(form).join(' ')).toContain('lost its header row');
  });
});

describe('approval and reminder validation', () => {
  it('lets an unsent or skipped list proceed without a signature', () => {
    const form = createEmptyJobCardForm();
    expect(validateApprovalStep(form).valid).toBe(true);

    form.approval.status = 'skipped';
    expect(validateApprovalStep(form).valid).toBe(true);

    form.approval.status = 'awaiting';
    expect(validateApprovalStep(form).valid).toBe(true);
  });

  it('requires the approver and date once the list is marked approved', () => {
    const form = createEmptyJobCardForm();
    form.approval.status = 'approved';
    const result = validateApprovalStep(form);
    expect(result.valid).toBe(false);
    expect(result.errors['approval.approvedBy']).toBeTruthy();
    expect(result.errors['approval.approvedAt']).toBeTruthy();
  });

  it('accepts a recorded sign-off', () => {
    const form = createEmptyJobCardForm();
    form.approval.status = 'approved';
    form.approval.approvedBy = 'Ravi Kumar';
    form.approval.method = 'OTP';
    form.approval.approvedAt = '2026-09-20';
    expect(validateApprovalStep(form).valid).toBe(true);
  });

  it('rejects a reminder in the past', () => {
    const form = createEmptyJobCardForm();
    form.reminders = [{ type: 'Next Service', dueDate: '2000-01-01', channel: 'SMS' }];
    const result = validateReminderStep(form);
    expect(result.valid).toBe(false);
    expect(result.errors['reminders.0.dueDate']).toContain('past');
  });

  it('accepts an empty reminder list', () => {
    expect(validateReminderStep(createEmptyJobCardForm()).valid).toBe(true);
  });
});

describe('order summary validation', () => {
  it('requires a positive total', () => {
    expect(validateOrderSummaryStep(createEmptyJobCardForm()).valid).toBe(false);
  });
});

describe('buildJobCardPayload', () => {
  it('maps the form onto the API shape', () => {
    const form = validStepOneForm();
    form.vehicle.registrationNumber = 'gj14aa8119';
    form.lineItems = [{ name: 'Oil change', type: 'service', qty: 1, price: 2000, taxRate: 18 }];
    form.intake.advanceAmount = '2360';
    form.intake.complaint = 'Engine noise';

    const payload: any = buildJobCardPayload(form);
    expect(payload.vehicle.registrationNumber).toBe('GJ14AA8119');
    expect(payload.vehicle.odometerReading).toBe(45000);
    expect(payload.services).toHaveLength(1);
    expect(payload.service.description).toBe('Engine noise');
    expect(payload.paymentStatus).toBe('Paid');
    expect(payload.orderSummary.total).toBe(2360);
  });

  it('sends the compliance fields and the advance the wizard captured', () => {
    const form = validStepOneForm();
    form.lineItems = [
      {
        name: 'TYRE',
        type: 'part',
        hsnSacCode: '4011',
        unit: 'nos',
        qty: 2,
        price: 5000,
        taxType: 'GST',
        taxRate: 18,
        discountType: 'percent',
        discountValue: 10,
      },
    ];
    form.advance = { amount: '1180', paymentMode: 'UPI', reference: 'UPI-1' };
    form.approval.status = 'approved';
    form.approval.approvedBy = 'Ravi Kumar';

    const payload: any = buildJobCardPayload(form);
    const line = payload.services[0];
    expect(line.hsnSacCode).toBe('4011');
    expect(line.unit).toBe('nos');
    expect(line.taxType).toBe('GST');
    expect(line.discountType).toBe('percent');
    expect(line.discountValue).toBe(10);
    expect(payload.advance).toEqual({ amount: 1180, paymentMode: 'UPI', reference: 'UPI-1' });
    expect(payload.approval.status).toBe('approved');
    // 2 x 5000 = 10000, minus 10% = 9000, plus 18% GST = 10620, minus the 1180 advance.
    expect(payload.orderSummary.total).toBe(10620);
    expect(payload.orderSummary.balanceDue).toBe(9440);
    expect(payload.grandTotal).toBe(10620);
  });

  it('keeps an inferred tax type consistent with the running total', () => {
    const form = validStepOneForm();
    // Legacy row: a rate but no explicit tax type.
    form.lineItems = [{ name: 'Chain service', type: 'service', qty: 1, price: 300, taxRate: 18 }];
    const payload: any = buildJobCardPayload(form);
    expect(payload.services[0].taxType).toBe('GST');
    expect(payload.orderSummary.total).toBe(354);
  });

  it('always provides a service description for the backend', () => {
    const form = validStepOneForm();
    const payload: any = buildJobCardPayload(form);
    expect(payload.service.description).toBe('General service');
  });
});

describe('advance handling inside the wizard', () => {
  it('falls back to the intake advance when no advance was recorded on the service list', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [{ name: 'Wash', type: 'service', qty: 1, price: 500, taxType: 'None' }];
    form.intake.advanceAmount = '200';
    const totals = computeOrderSummary(form);
    expect(totals.advanceDeducted).toBe(200);
    expect(totals.balanceDue).toBe(300);
  });

  it('prefers the Step 4 advance over the intake figure', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [{ name: 'Wash', type: 'service', qty: 1, price: 500, taxType: 'None' }];
    form.intake.advanceAmount = '200';
    form.advance = { amount: '450', paymentMode: 'UPI', reference: '' };
    expect(computeOrderSummary(form).advanceDeducted).toBe(450);
  });
});

describe('mapJobCardToForm', () => {
  it('round-trips the service list, advance and approval state', () => {
    const doc = {
      vehicle: { type: '4W', registrationNumber: 'GJ14AA8119', odometerReading: 12000 },
      customer: { name: 'Ravi', phone: '9876543210' },
      services: [
        {
          name: 'TYRE',
          type: 'part',
          hsnSacCode: '4011',
          unit: 'nos',
          qty: 2,
          price: 5000,
          taxType: 'GST',
          taxRate: 18,
          discountType: 'percent',
          discountValue: 10,
          stockAvailable: 4,
          updatedBy: 'advisor@example.com',
        },
      ],
      advance: { amount: 1000, paymentMode: 'UPI' },
      approval: {
        status: 'awaiting',
        sharedAt: '2026-09-20T10:00:00.000Z',
        channels: ['WhatsApp'],
        token: 'abc123',
        history: [{ action: 'Shared to customer', by: 'advisor@example.com', at: '2026-09-20T10:00:00.000Z' }],
      },
    };

    const form = mapJobCardToForm(doc);
    expect(form.lineItems[0].hsnSacCode).toBe('4011');
    expect(form.lineItems[0].discountType).toBe('percent');
    expect(form.lineItems[0].stockAvailable).toBe(4);
    expect(form.lineItems[0].updatedBy).toBe('advisor@example.com');
    expect(form.advance).toEqual({ amount: '1000', paymentMode: 'UPI', reference: '' });
    expect(form.approval.status).toBe('awaiting');
    expect(form.approval.channels).toEqual(['WhatsApp']);
    expect(form.approval.history).toHaveLength(1);

    const totals = computeOrderSummary(form);
    expect(totals.grandTotal).toBe(10620);
    expect(totals.balanceDue).toBe(9620);
  });

  it('round-trips a stored document into the form', () => {
    const doc = {
      vehicle: {
        type: '2W',
        registrationNumber: 'GJ14AA8119',
        make: 'Hero',
        model: 'Splendor',
        year: 2020,
        odometerReading: 12000,
        chassisNumber: 'MA3ABC123',
      },
      customer: { type: 'Individual', name: 'Ravi', phone: '9876543210', email: 'r@x.com', address: 'A' },
      intake: { complaint: 'Chain noise', advanceAmount: 500 },
      service: { type: 'Repair', priority: 'High' },
      services: [{ name: 'Chain service', type: 'service', qty: 1, price: 300, taxRate: 18 }],
      orderSummary: { discount: 50 },
      reminders: [{ type: 'Next Service', dueDate: '2027-01-01T00:00:00.000Z', channel: 'WhatsApp' }],
      source: 'Referral',
    };

    const form = mapJobCardToForm(doc);
    expect(form.vehicleType).toBe('2W');
    expect(form.vehicle.brand).toBe('Hero');
    expect(form.vehicle.odometer).toBe('12000');
    expect(form.customer.name).toBe('Ravi');
    expect(form.intake.complaint).toBe('Chain noise');
    expect(form.serviceType).toBe('Repair');
    expect(form.lineItems).toHaveLength(1);
    expect(form.orderSummary.discount).toBe('50');
    expect(form.reminders).toHaveLength(1);
    expect(form.source).toBe('Referral');
  });
});

describe('validateJobCardForm', () => {
  it('aggregates the problems across steps', () => {
    const result = validateJobCardForm(createEmptyJobCardForm());
    expect(result.valid).toBe(false);
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

describe('Order Summary management', () => {
  it('includes multiple advances and the earlier deposit exactly once', () => {
    const form = createEmptyJobCardForm();
    form.lineItems = [{ name: 'Labour', type: 'labour', qty: 1, price: 1000, taxRate: 0 }];
    form.advance.amount = '100';
    form.intake.advanceAmount = '100';
    form.advances = [200, 150].map(amount => ({ amount, paymentMode: 'Cash', reference: '', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'Advisor' }));
    expect(computeOrderSummary(form).advanceDeducted).toBe(450);
    expect(computeOrderSummary(form).balanceDue).toBe(550);
    form.lineItems[0].price = 400;
    expect(validateOrderSummaryStep(form).errors.advances).toBeTruthy();
  });

  it('preserves assignments, delivery and advance history through payload mapping', () => {
    const form = createEmptyJobCardForm();
    const staff = { staffId: 'staff-1', name: 'Mechanic', assignedAt: '2026-01-01T00:00:00Z' };
    form.supervisor = staff;
    form.lineItems = [{ name: 'Labour', type: 'labour', qty: 1, price: 1000, taxRate: 0, assignedMechanic: staff }];
    form.estimatedDelivery = { date: '2099-01-01', time: '14:30', lastUpdatedBy: 'Advisor', notifiedCustomer: false, notifyCustomerRequested: true };
    form.advances = [{ amount: 250, paymentMode: 'Cash', reference: '', recordedAt: '2026-01-01T00:00:00Z', recordedBy: 'Advisor' }];
    const restored = mapJobCardToForm(buildJobCardPayload(form));
    expect(restored.supervisor).toEqual(staff);
    expect(restored.lineItems[0].assignedMechanic).toEqual(staff);
    expect(restored.estimatedDelivery).toEqual(form.estimatedDelivery);
    expect(restored.advances).toEqual(form.advances);
    expect(computeOrderSummary(restored).balanceDue).toBe(750);
  });

  it('warns about a past delivery without blocking, and still blocks empty or invalid rows', () => {
    const form = createEmptyJobCardForm();
    expect(validateOrderSummaryStep(form).valid).toBe(false);
    form.lineItems = [{ name: 'Labour', type: 'labour', qty: 1, price: 1000, taxRate: 0 }];
    expect(validateOrderSummaryStep(form).valid).toBe(true);

    // A stored card carries its creation time as the estimated delivery, so a
    // past date must never block the Order Summary step.
    form.estimatedDelivery = { date: '2000-01-01', time: '12:00' };
    const past = validateOrderSummaryStep(form);
    expect(past.valid).toBe(true);
    expect(past.errors.estimatedDelivery).toBeUndefined();
    expect(past.warnings?.join(' ')).toContain('in the past');

    form.lineItems[0].qty = 0;
    expect(validateOrderSummaryStep(form).errors['lineItems.0.qty']).toBeTruthy();
  });
});

describe('customer link approval validation', () => {
  it('accepts a timestamped customer decision without internal sign-off fields', () => {
    const form = createEmptyJobCardForm();
    form.approval = { ...form.approval, status: 'approved', method: 'Link', respondedAt: '2026-09-24T10:00:00Z' };
    expect(validateApprovalStep(form).valid).toBe(true);
  });
  it('requires internal evidence when a link has no recorded response', () => {
    const form = createEmptyJobCardForm();
    form.approval = { ...form.approval, status: 'approved', method: 'Link' };
    expect(validateApprovalStep(form).valid).toBe(false);
  });
});
