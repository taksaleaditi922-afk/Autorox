// ---------------------------------------------------------------------------
// Schema-based validation for the estimate workflow.
//
// Uses `yup` (already a project dependency) so the rules are declared once and
// reused by every step, the review screen and the generation guard.
//
// Errors are returned as a flat map keyed by dot-path so a field can render its
// own message, e.g. errors['vehicle.registrationNumber'].
// ---------------------------------------------------------------------------

import * as yup from 'yup';
import {
  REGISTRATION_REGEX,
  daysUntil,
} from '../services/estimate/config';
import type {
  EstimateBusinessConfig,
  EstimateState,
  LineItemType,
} from '../services/estimate/types';
import { maxAllowedAdvance, toPaise } from './estimateMath';

export interface StepValidationResult {
  valid: boolean;
  /** field path -> message */
  errors: Record<string, string>;
  /** human readable list shown on the review screen */
  summary: string[];
}

function emptyResult(): StepValidationResult {
  return { valid: true, errors: {}, summary: [] };
}

function isBlank(value: unknown): boolean {
  return value === '' || value === null || value === undefined;
}

/** Collect every yup error as a dot-path keyed map. */
function collect(schema: yup.AnySchema, value: unknown, prefix = ''): Record<string, string> {
  const errors: Record<string, string> = {};
  try {
    schema.validateSync(value, { abortEarly: false });
  } catch (err) {
    const inner = (err as yup.ValidationError).inner?.length
      ? (err as yup.ValidationError).inner
      : [err as yup.ValidationError];
    for (const e of inner) {
      const path = prefix ? `${prefix}.${e.path || ''}`.replace(/\.$/, '') : e.path || '';
      if (!errors[path]) errors[path] = e.message;
    }
  }
  return errors;
}

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

const requiredText = (label: string) =>
  yup.string().trim().required(`${label} is required`);

const optionalText = () => yup.string().trim().notRequired();

function requiredNumber(label: string, min?: number, max?: number) {
  return yup.mixed().test('required-number', `${label} is required`, (value) => {
    if (isBlank(value)) return false;
    return Number.isFinite(Number(value));
  }).test('range', `${label} must be a valid number`, (value) => {
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

function optionalDate(label: string) {
  return yup.string().test('is-date', `${label} must be a valid date`, (value) => {
    if (!value) return true;
    return !Number.isNaN(new Date(value).getTime());
  });
}

// ---------------------------------------------------------------------------
// Step 1 schemas
// ---------------------------------------------------------------------------

const currentYear = () => new Date().getFullYear() + 1;

export const vehicleSchema = yup.object({
  registrationNumber: requiredText('Vehicle registration number')
    .min(6, 'Registration number looks too short')
    .max(15, 'Registration number looks too long')
    .test(
      'format',
      'Enter a valid registration number (e.g. MH12AB1234)',
      (value) => !value || REGISTRATION_REGEX.test(value.toUpperCase().replace(/\s+/g, ''))
    ),
  brand: requiredText('Vehicle brand'),
  model: requiredText('Vehicle model'),
  year: requiredNumber('Manufacturing year', 1950, currentYear()),
  fuelType: requiredText('Fuel type'),
  odometer: optionalNumber('Odometer reading', 0, 2_000_000),
  fuelMeter: optionalNumber('Fuel meter reading', 0, 100),
  engineNumber: optionalText(),
  chassisNumber: optionalText(),
});

export const customerSchema = yup.object({
  name: requiredText('Customer name').min(2, 'Customer name looks too short'),
  phone: requiredText('Customer phone number').test(
    'phone',
    'Enter a valid 10-digit mobile number',
    (value) => !value || PHONE_REGEX.test(value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))
  ),
  email: yup
    .string()
    .trim()
    .email('Enter a valid email address')
    .notRequired(),
  gstNumber: yup
    .string()
    .trim()
    .uppercase()
    .test('gst', 'Enter a valid 15-character GSTIN', (value) => !value || GST_REGEX.test(value))
    .notRequired(),
  pincode: yup
    .string()
    .trim()
    .test('pincode', 'Pincode must be 6 digits', (value) => !value || /^\d{6}$/.test(value))
    .notRequired(),
});

export const insuranceSchema = yup.object({
  policyNumber: optionalText(),
  startDate: optionalDate('Policy start date'),
  expiryDate: optionalDate('Policy expiry date'),
}).test('policy-window', 'Policy expiry date cannot be before the start date', (value) => {
  const start = (value as { startDate?: string })?.startDate;
  const expiry = (value as { expiryDate?: string })?.expiryDate;
  if (!start || !expiry) return true;
  const s = new Date(start).getTime();
  const e = new Date(expiry).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return true;
  return e >= s;
}).test('company-with-policy', 'Insurance company is required when a policy number is entered', (value) => {
  const v = value as { company?: string; policyNumber?: string };
  if (!v?.policyNumber) return true;
  return Boolean(v.company && v.company.trim());
});

function complianceDocSchema(label: string) {
  return yup.object({
    expiryDate: optionalDate(`${label} expiry date`),
    setReminder: yup.boolean().notRequired(),
  }).test('reminder-needs-date', `Set a ${label} expiry date to enable reminders`, (value) => {
    const v = value as { expiryDate?: string; setReminder?: boolean };
    if (!v?.setReminder) return true;
    return Boolean(v.expiryDate);
  });
}

export const documentsSchema = yup.object({
  rc: complianceDocSchema('RC'),
  puc: complianceDocSchema('PUC'),
  license: complianceDocSchema('Driving License'),
});

export const identityProofSchema = yup
  .object({
    idType: optionalText(),
    idNumber: optionalText(),
  })
  .test('type-when-number', 'Select an ID type', (value) => {
    const v = value as { idType?: string; idNumber?: string };
    if (!v?.idNumber) return true;
    return Boolean(v.idType);
  })
  .test('number-when-type', 'Enter the ID number', (value) => {
    const v = value as { idType?: string; idNumber?: string };
    if (!v?.idType) return true;
    return Boolean(v.idNumber);
  })
  .test('format', 'Enter a valid ID number', (value) => {
    const v = value as { idType?: string; idNumber?: string };
    if (!v?.idType || !v.idNumber) return true;
    const num = v.idNumber.replace(/\s+/g, '');
    if (v.idType === 'Aadhaar') return /^\d{12}$/.test(num);
    if (v.idType === 'PAN') return /^[A-Z]{5}\d{4}[A-Z]$/.test(num.toUpperCase());
    return num.length >= 5;
  });

export const pickupSchema = yup
  .object({
    enabled: yup.boolean(),
    address: optionalText(),
    contactPerson: optionalText(),
    phone: optionalText(),
    preferredDate: optionalDate('Preferred pickup date'),
  })
  .test('pickup-required', 'Pickup address is required', (value) => {
    const v = value as { enabled?: boolean; address?: string };
    if (!v?.enabled) return true;
    return Boolean(v.address && v.address.trim());
  })
  .test('pickup-contact', 'Pickup contact person is required', (value) => {
    const v = value as { enabled?: boolean; contactPerson?: string };
    if (!v?.enabled) return true;
    return Boolean(v.contactPerson && v.contactPerson.trim());
  })
  .test('pickup-phone', 'Enter a valid pickup phone number', (value) => {
    const v = value as { enabled?: boolean; phone?: string };
    if (!v?.enabled) return true;
    if (!v.phone) return false;
    return PHONE_REGEX.test(String(v.phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''));
  })
  .test('pickup-date-not-past', 'Pickup date cannot be in the past', (value) => {
    const v = value as { enabled?: boolean; preferredDate?: string };
    if (!v?.enabled || !v.preferredDate) return true;
    const days = daysUntil(v.preferredDate);
    return days === null ? true : days >= 0;
  });

// ---------------------------------------------------------------------------
// Line item + financial validation
// ---------------------------------------------------------------------------

export const lineItemSchema = yup.object({
  name: requiredText('Item name'),
  quantity: requiredNumber('Quantity', 0.01).test(
    'positive',
    'Quantity must be greater than zero',
    (value) => !isBlank(value) && Number(value) > 0
  ),
  rate: requiredNumber('Rate', 0).test('non-negative', 'Rate cannot be negative', (value) => {
    if (isBlank(value)) return true;
    return Number(value) >= 0;
  }),
  discountValue: optionalNumber('Discount', 0),
  taxRate: optionalNumber('Tax rate', 0),
});

export function validateLineItem(item: any): Record<string, string> {
  const errors = collect(lineItemSchema, item);
  const subtotal = toPaise(Number(item?.quantity) * Number(item?.rate));

  // Prefer the specific rule over the generic range message from the schema.
  if (!isBlank(item?.quantity) && Number(item?.quantity) <= 0) {
    errors.quantity = 'Quantity must be greater than zero';
  }
  if (!isBlank(item?.rate) && Number(item?.rate) < 0) {
    errors.rate = 'Rate cannot be negative';
  }
  if (item?.discountType === 'percentage' && Number(item?.discountValue) > 100) {
    errors.discountValue = 'Percentage discount cannot exceed 100%';
  }
  if (item?.discountType === 'fixed' && toPaise(Number(item?.discountValue)) > subtotal) {
    errors.discountValue = 'Discount cannot exceed the line amount';
  }
  if (item?.taxType === 'NONE' && Number(item?.taxRate) > 0) {
    // Not an error — the engine ignores the rate. Keep silent.
  }
  if (Number(item?.taxRate) < 0) {
    errors.taxRate = 'Tax rate cannot be negative';
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Step-level validation
// ---------------------------------------------------------------------------

export const ESTIMATE_STEPS = [
  { key: 'vehicle-client', label: 'Vehicle & Client', short: 'Vehicle' },
  { key: 'inspection', label: 'Inspection', short: 'Inspection' },
  { key: 'services', label: 'Services & Parts', short: 'Services' },
  { key: 'review', label: 'Estimate', short: 'Estimate' },
] as const;

export type EstimateStepKey = (typeof ESTIMATE_STEPS)[number]['key'];

function merge(results: StepValidationResult[]): StepValidationResult {
  const errors: Record<string, string> = {};
  const summary: string[] = [];
  for (const r of results) {
    Object.assign(errors, r.errors);
    summary.push(...r.summary);
  }
  return { valid: summary.length === 0 && Object.keys(errors).length === 0, errors, summary };
}

/* Human labels for a few non-obvious field paths, used by the summary list. */
const FIELD_LABELS: Record<string, string> = {
  'vehicle.registrationNumber': 'Vehicle registration number',
  'vehicle.brand': 'Vehicle brand',
  'vehicle.model': 'Vehicle model',
  'vehicle.year': 'Manufacturing year',
  'vehicle.fuelType': 'Fuel type',
  'vehicle.odometer': 'Odometer reading',
  'customer.name': 'Customer name',
  'customer.phone': 'Customer phone number',
  'customer.email': 'Customer email',
  'customer.gstNumber': 'GST number',
  'customer.pincode': 'Pincode',
};

function toSummary(errors: Record<string, string>, prefix = ''): string[] {
  return Object.entries(errors).map(([path, message]) => {
    const label = FIELD_LABELS[path];
    if (label) return `${label} is required`.startsWith(message) ? message : `${path}: ${message}`;
    return `${prefix}${message}`;
  });
}

export function validateVehicleClientStep(state: EstimateState): StepValidationResult {
  const errors: Record<string, string> = {
    ...collect(vehicleSchema, state.vehicle, 'vehicle'),
    ...collect(customerSchema, state.customer, 'customer'),
    ...collect(insuranceSchema, state.insurance, 'insurance'),
    ...collect(documentsSchema, state.documents, 'documents'),
    ...collect(identityProofSchema, state.identityProof, 'identityProof'),
    ...collect(pickupSchema, state.pickup, 'pickup'),
  };
  const summary = toSummary(errors);
  return { valid: Object.keys(errors).length === 0, errors, summary };
}

export function validateInspectionStep(_state: EstimateState): StepValidationResult {
  // Inspection itself is optional — a service advisor may skip straight to
  // building the estimate. Nothing here should block "Save & Continue".
  return emptyResult();
}

export function validateServicesStep(
  state: EstimateState,
  config: EstimateBusinessConfig
): StepValidationResult {
  const errors: Record<string, string> = {};
  const summary: string[] = [];

  if (!state.lineItems.length) {
    summary.push('At least one service, package, part, labour or custom item must be added.');
  }

  state.lineItems.forEach((item, index) => {
    const itemErrors = validateLineItem(item);
    const label = item.name?.trim() || `Item ${index + 1}`;
    for (const [field, message] of Object.entries(itemErrors)) {
      errors[`lineItems.${index}.${field}`] = message;
      summary.push(`${label}: ${message}`);
    }
  });

  if (config?.advanceMaxPercent !== undefined || config?.allowAdvanceExceedingTotal !== undefined) {
    const cap = maxAllowedAdvance(state.totals.grandTotal, config);
    if (state.totals.advancePaid > cap) {
      const message = `Advance paid cannot exceed ${config.advanceMaxPercent}% of the estimate total`;
      errors.advance = message;
      summary.push(message);
    }
  }
  if (state.totals.grandTotal < 0) {
    errors.grandTotal = 'Estimate total cannot be negative';
    summary.push(errors.grandTotal);
  }

  // `summary` also carries the "no items yet" message, which has no field to
  // attach to — an empty estimate must still fail the step gate.
  return { valid: Object.keys(errors).length === 0 && summary.length === 0, errors, summary };
}

/** Full validation used by the review step and the "Generate" guard. */
export function validateEstimateForGeneration(
  state: EstimateState,
  config: EstimateBusinessConfig
): StepValidationResult {
  const results: StepValidationResult[] = [
    validateVehicleClientStep(state),
    validateServicesStep(state, config),
  ];

  const merged = merge(results);

  if (!state.vehicle.registrationNumber) {
    merged.errors['vehicle.registrationNumber'] = 'Vehicle registration number is required';
  }
  if (!state.customer.phone) {
    merged.errors['customer.phone'] = 'Customer phone number is required';
  }
  if (!state.lineItems.length) {
    if (!merged.summary.some((s) => s.includes('At least one'))) {
      merged.summary.push('At least one service must be added.');
    }
  }

  // Financial sanity — never let a broken total reach the server.
  if (state.totals.grandTotal <= 0 && state.lineItems.length > 0) {
    merged.summary.push('Estimate total must be greater than zero before generating.');
  }
  if (state.totals.discountTotal > state.totals.subtotal) {
    merged.summary.push('Total discount cannot exceed the subtotal.');
  }

  merged.valid = merged.summary.length === 0 && Object.keys(merged.errors).length === 0;
  return merged;
}

export function stepValidator(
  step: number
): (state: EstimateState, config: EstimateBusinessConfig) => StepValidationResult {
  switch (step) {
    case 0:
      return validateVehicleClientStep;
    case 1:
      return validateInspectionStep;
    case 2:
      return validateServicesStep;
    default:
      return validateEstimateForGeneration;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask an identity number for display: 1234 5678 9012 -> XXXXXXXX9012. */
export function maskIdentityNumber(value: string | undefined | null): string {
  if (!value) return '—';
  const compact = String(value).replace(/\s+/g, '');
  if (compact.length <= 4) return compact.replace(/./g, 'X');
  return `${'X'.repeat(compact.length - 4)}${compact.slice(-4)}`;
}

export function maskPhone(value: string | undefined | null): string {
  if (!value) return '—';
  const compact = String(value).replace(/\D/g, '');
  if (compact.length < 6) return compact;
  return `${compact.slice(0, 2)}XXXXX${compact.slice(-3)}`;
}

export function lineItemTypeLabel(type: LineItemType): string {
  switch (type) {
    case 'service':
      return 'Service';
    case 'package':
      return 'Package';
    case 'part':
      return 'Part';
    case 'labour':
      return 'Labour';
    default:
      return 'Custom';
  }
}
