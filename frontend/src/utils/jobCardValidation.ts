// ---------------------------------------------------------------------------
// Per-step validation for the six-step job card wizard.
//
// Uses `yup` (already a project dependency) so the rules live in one place and
// are reused by the step gate, the stepper badges and the final submit guard.
//
// Errors are keyed by dot-path (e.g. vehicle.registrationNumber) so a field can
// render its own message.
// ---------------------------------------------------------------------------

import * as yup from 'yup';
import { REGISTRATION_REGEX } from '../services/estimate/config';
import type { JobCardFormState } from './jobCard';
import {
  computeLineItem,
  computeOrderSummary,
  isStockShort,
  resolveDiscountType,
  resolveTaxType,
} from './jobCard';

export interface JobCardStepResult {
  valid: boolean;
  errors: Record<string, string>;
  summary: string[];
  /** Non-blocking advisories, e.g. a part quantity above the available stock. */
  warnings?: string[];
}

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

function isBlank(value: unknown): boolean {
  return value === '' || value === null || value === undefined;
}

const requiredText = (label: string) => yup.string().trim().required(`${label} is required`);
const optionalText = () => yup.string().trim().notRequired();

function requiredNumber(label: string, min?: number, max?: number) {
  return yup
    .mixed()
    .test('required-number', `${label} is required`, (value) => !isBlank(value) && Number.isFinite(Number(value)))
    .test('range', `${label} must be a valid number`, (value) => {
      if (isBlank(value)) return true;
      const n = Number(value);
      if (!Number.isFinite(n)) return false;
      if (min !== undefined && n < min) return false;
      if (max !== undefined && n > max) return false;
      return true;
    });
}

function optionalNumber(label: string, min?: number, max?: number) {
  return yup.mixed().test('range', `${label} must be a valid number`, (value) => {
    if (isBlank(value)) return true;
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    return true;
  });
}

function isPast(date: string): boolean {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/** Collect every yup error into a dot-path keyed map. */
function collect(schema: yup.AnySchema, value: unknown, prefix = ''): Record<string, string> {
  const errors: Record<string, string> = {};
  try {
    schema.validateSync(value, { abortEarly: false });
  } catch (err) {
    const error = err as yup.ValidationError;
    const inner = error.inner?.length ? error.inner : [error];
    for (const e of inner) {
      const path = prefix ? `${prefix}.${e.path || ''}`.replace(/\.$/, '') : e.path || '';
      if (!errors[path]) errors[path] = e.message;
    }
  }
  return errors;
}

export const vehicleSchema = yup.object({
  registrationNumber: requiredText('Vehicle number')
    .min(6, 'Vehicle number looks too short')
    .max(15, 'Vehicle number looks too long')
    .test(
      'format',
      'Enter a valid registration number (e.g. GJ14AA8119)',
      (value) => !value || REGISTRATION_REGEX.test(value.toUpperCase().replace(/\s+/g, ''))
    ),
  odometer: requiredNumber('Odometer reading', 0, 2_000_000),
  fuelMeter: optionalNumber('Fuel meter', 0, 100),
  brand: optionalText(),
  model: optionalText(),
  year: optionalNumber('Manufacturing year', 1950, new Date().getFullYear() + 1),
});

export const customerSchema = yup.object({
  type: requiredText('Customer type'),
  name: requiredText('Customer name').min(2, 'Customer name looks too short'),
  phone: requiredText('Phone number').test(
    'phone',
    'Enter a valid 10-digit mobile number',
    (value) => !value || PHONE_REGEX.test(value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))
  ),
  email: requiredText('Email').email('Enter a valid email address'),
  address: requiredText('Address'),
  // Field level tests so the message attaches to the GST input, not the whole
  // customer section. `this.parent` gives access to the sibling customer type.
  gstNumber: yup
    .string()
    .trim()
    .uppercase()
    .test('gst-required', 'GST number is required for company customers', function (value) {
      const type = (this.parent as { type?: string })?.type;
      if (type !== 'Company') return true;
      return Boolean(value && value.trim());
    })
    .test('gst-format', 'Enter a valid 15-character GSTIN', function (value) {
      const type = (this.parent as { type?: string })?.type;
      if (type !== 'Company' || !value) return true;
      return GST_REGEX.test(value.trim().toUpperCase());
    }),
  idProofNumber: optionalText(),
});

export const intakeSchema = yup
  .object({
    complaint: optionalText(),
    pickupRequested: yup.boolean(),
    pickupAddress: optionalText(),
    pickupDate: optionalText(),
    advanceAmount: optionalNumber('Advance amount', 0),
  })
  .test('pickup-address', 'Pickup address is required', (value) => {
    const v = value as { pickupRequested?: boolean; pickupAddress?: string };
    if (!v?.pickupRequested) return true;
    return Boolean(v.pickupAddress && v.pickupAddress.trim());
  });

export const insuranceSchema = yup.object({
  company: optionalText(),
  policyNumber: optionalText(),
  expiryDate: optionalText(),
  reminderDate: optionalText(),
});



/** STEP 1 — Vehicle & Client Details. */
export function validateVehicleClientStep(form: JobCardFormState): JobCardStepResult {
  const errors: Record<string, string> = {
    ...collect(vehicleSchema, form.vehicle, 'vehicle'),
    ...collect(customerSchema, form.customer, 'customer'),
    ...collect(insuranceSchema, form.insurance, 'insurance'),
    ...collect(intakeSchema, form.intake, 'intake'),
  };
  const summary = Object.values(errors);
  return { valid: summary.length === 0, errors, summary };
}

/** STEP 2 — Inspection report. Optional; a technician may capture it later. */
export function validateInspectionStep(_form: JobCardFormState): JobCardStepResult {
  return { valid: true, errors: {}, summary: [] };
}

/**
 * STEP 3 — Services, packages & parts.
 * Quantity must be above zero, rates cannot be negative and a line discount can
 * never exceed the line subtotal. Stock shortfalls and broken package expansion
 * are surfaced as warnings, not blockers — the advisor may knowingly over-sell.
 */
export function validateServicesStep(form: JobCardFormState): JobCardStepResult {
  const errors: Record<string, string> = {};
  const summary: string[] = [];
  const warnings = serviceListWarnings(form);

  if (!form.lineItems.length) {
    summary.push('Add at least one service, package or part.');
  }

  form.lineItems.forEach((item, index) => {
    const label = item.name?.trim() || `Item ${index + 1}`;
    const itemErrors: Record<string, string> = {};

    if (!item.name || !item.name.trim()) itemErrors.name = 'Item name is required';

    const qty = Number(item.qty);
    if (isBlank(item.qty) || !Number.isFinite(qty) || qty <= 0) {
      itemErrors.qty = 'Quantity must be greater than zero';
    }

    const rate = Number(item.price);
    if (!isBlank(item.price) && (!Number.isFinite(rate) || rate < 0)) {
      itemErrors.price = 'Rate cannot be negative';
    }

    const taxType = resolveTaxType(item);
    const taxRate = Number(item.taxRate) || 0;
    if (taxType !== 'None' && (taxRate < 0 || taxRate > 100 || !Number.isFinite(Number(item.taxRate ?? 0)))) {
      itemErrors.taxRate = 'Tax % must be between 0 and 100';
    }

    const discountType = resolveDiscountType(item);
    const discountValue = Number(item.discountValue) || 0;
    if (discountValue < 0 || !Number.isFinite(Number(item.discountValue ?? 0))) itemErrors.discountValue = 'Discount must be a non-negative number';
    if (discountType === 'percent' && discountValue > 100) {
      itemErrors.discountValue = 'Discount cannot exceed 100%';
    }
    if (discountType === 'flat' && discountValue > computeLineItem(item).subtotal) {
      itemErrors.discountValue = 'Discount cannot exceed the line subtotal';
    }

    for (const [field, message] of Object.entries(itemErrors)) {
      errors[`lineItems.${index}.${field}`] = message;
      summary.push(`${label}: ${message}`);
    }
  });

  return {
    valid: Object.keys(errors).length === 0 && summary.length === 0,
    errors,
    summary,
    warnings,
  };
}

/**
 * Non-blocking advisories for the service list: part quantities above available
 * stock and packages whose expansion was broken up. Shared with Step 3 so the
 * table shows exactly what the step gate knows.
 */
export function serviceListWarnings(form: JobCardFormState): string[] {
  const warnings: string[] = [];

  form.lineItems.forEach((item) => {
    if (isStockShort(item)) {
      const label = item.name?.trim() || 'Part';
      warnings.push(`${label}: ${item.qty} requested, only ${item.stockAvailable} in stock.`);
    }
  });

  // Package integrity: the expanded rows should keep their header and core items.
  const packageIds = Array.from(new Set(form.lineItems.map((line) => line.packageId).filter(Boolean))) as string[];
  for (const id of packageIds) {
    const rows = form.lineItems.filter((line) => line.packageId === id);
    const packageName = rows.find((row) => row.packageName)?.packageName || id;
    const hasHeader = rows.some((row) => row.isPackageHeader);
    const coreRows = rows.filter((row) => row.coreItem);
    if (!hasHeader) {
      warnings.push(`Package "${packageName}" lost its header row.`);
    } else if (!coreRows.length) {
      warnings.push(`Package "${packageName}" no longer includes any of its core items.`);
    }
  }

  return warnings;
}

/**
 * STEP 4 — Service list approval.
 *
 * Sending the list, recording a sign-off and skipping the step are all valid
 * outcomes, so the step only blocks when it is *marked approved* without the
 * evidence an approval requires.
 */
export function validateApprovalStep(form: JobCardFormState): JobCardStepResult {
  const errors: Record<string, string> = {};
  const { status, approvedBy, method, approvedAt } = form.approval;

  if (status === 'approved' && !(method === 'Link' && form.approval.respondedAt)) {
    if (!approvedBy || !approvedBy.trim()) errors['approval.approvedBy'] = 'Approved by is required';
    if (!method) errors['approval.method'] = 'Approval method is required';
    if (!approvedAt) errors['approval.approvedAt'] = 'Approval date is required';
  }

  const summary = Object.values(errors);
  return { valid: summary.length === 0, errors, summary };
}

/**
 * Advisories for the estimated delivery field.
 *
 * A past estimated delivery is never a blocker: stored job cards carry
 * `service.estimatedDelivery` (which the backend defaults to the creation time),
 * so editing an older card legitimately shows a delivery date in the past. The
 * advisor gets a warning and can still save — otherwise no existing job card
 * could ever be edited or advanced past Order Summary.
 */
export function estimatedDeliveryWarning(form: JobCardFormState): string | null {
  if (!form.estimatedDelivery.date) return null;
  const delivery = new Date(`${form.estimatedDelivery.date}T${form.estimatedDelivery.time || '23:59'}`);
  if (!Number.isFinite(delivery.getTime())) return 'Estimated delivery date is not valid — pick a date again.';
  // Day granularity: a delivery scheduled earlier today is still "today".
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (delivery.getTime() < startOfToday.getTime()) {
    return 'Estimated delivery is in the past — update it if the schedule has changed.';
  }
  return null;
}

/** STEP 5 — Order summary. */
export function validateOrderSummaryStep(form: JobCardFormState): JobCardStepResult {
  const errors: Record<string, string> = { ...validateServicesStep(form).errors };
  if (!form.lineItems.length) errors.lineItems = 'Add at least one service item';
  const totals = computeOrderSummary(form);
  if (totals.advanceDeducted > totals.total) errors.advances = 'Advances cannot exceed the grand total';
  if (form.advances.some(entry => !Number.isFinite(entry.amount) || entry.amount <= 0)) errors.advances = 'Advance amounts must be greater than zero';
  if (totals.total <= 0) {
    errors['orderSummary.total'] = 'The order total must be greater than zero';
  }
  if (totals.discount > totals.subtotal) {
    errors['orderSummary.discount'] = 'Discount cannot exceed the subtotal';
  }
  const warning = estimatedDeliveryWarning(form);
  const summary = Object.values(errors);
  return { valid: summary.length === 0, errors, summary, warnings: warning ? [warning] : [] };
}

/** STEP 6 — Reminders. Reminders are optional; any that are set must be dated. */
export function validateReminderStep(form: JobCardFormState): JobCardStepResult {
  const errors: Record<string, string> = {};
  form.reminders.forEach((reminder, index) => {
    if (!reminder.dueDate) {
      errors[`reminders.${index}.dueDate`] = 'Reminder date is required';
      return;
    }
    if (isPast(reminder.dueDate)) {
      errors[`reminders.${index}.dueDate`] = 'Reminder date cannot be in the past';
    }
  });
  const summary = Object.values(errors);
  return { valid: summary.length === 0, errors, summary };
}

const STEP_VALIDATORS = [
  validateVehicleClientStep,
  validateInspectionStep,
  validateServicesStep,
  validateApprovalStep,
  validateOrderSummaryStep,
  validateReminderStep,
];

export function stepValidator(step: number) {
  return STEP_VALIDATORS[step] || validateVehicleClientStep;
}

export function validateJobCardForm(form: JobCardFormState): JobCardStepResult {
  const errors: Record<string, string> = {};
  const summary: string[] = [];
  for (const validator of STEP_VALIDATORS) {
    const result = validator(form);
    Object.assign(errors, result.errors);
    summary.push(...result.summary);
  }
  return { valid: summary.length === 0 && Object.keys(errors).length === 0, errors, summary };
}
