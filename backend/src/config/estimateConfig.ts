// ---------------------------------------------------------------------------
// Business rules for the estimate workflow.
//
// Values that already exist in the Settings singleton (company profile, tax
// rate, currency) are read from there; the rest are deployment defaults that an
// operator can move into Settings later without changing the API contract.
// ---------------------------------------------------------------------------

import Settings from '../models/Settings.js';

export interface EstimateBusinessConfig {
  company: {
    name: string;
    logo?: string;
    address: string;
    phone: string;
    email: string;
    gstNumber: string;
  };
  currency: string;
  defaultTaxRate: number;
  supplyType: 'intra' | 'inter';
  advanceMaxPercent: number;
  allowAdvanceExceedingTotal: boolean;
  reminderThresholdDays: number;
  validUntilDays: number;
  roundOffEnabled: boolean;
  estimatePrefix: string;
  terms: string[];
}

export const DEFAULT_ESTIMATE_CONFIG: EstimateBusinessConfig = {
  company: {
    name: 'AutoGarage Workshop',
    logo: '',
    address: 'Plot 12, MIDC Industrial Area, Pune, Maharashtra 411019',
    phone: '+91 20 4000 1234',
    email: 'service@autogarage.example',
    gstNumber: '27ABCDE1234F1Z5',
  },
  currency: 'INR',
  defaultTaxRate: 18,
  supplyType: 'intra',
  advanceMaxPercent: 100,
  allowAdvanceExceedingTotal: false,
  reminderThresholdDays: 30,
  validUntilDays: 15,
  roundOffEnabled: true,
  estimatePrefix: 'EST',
  terms: [
    'This estimate is valid until the date mentioned above.',
    'Prices are subject to change without prior notice.',
    'Additional defects found during repair will be re-estimated and approved before work begins.',
    'Vehicles not collected within 7 days of completion may attract parking charges.',
    'Warranty on parts is as per the respective manufacturer policy.',
  ],
};

/** Merge the Settings singleton over the deployment defaults. */
export async function getEstimateBusinessConfig(): Promise<EstimateBusinessConfig> {
  let settings: any = null;
  try {
    // `getSingleton` is a schema static, so the model type needs an escape hatch.
    settings = await (Settings as any).getSingleton();
  } catch {
    settings = null;
  }

  const env = process.env;
  const overrides = (name: string, fallback: any) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    return raw;
  };

  return {
    ...DEFAULT_ESTIMATE_CONFIG,
    company: {
      name: settings?.company?.name || DEFAULT_ESTIMATE_CONFIG.company.name,
      logo: settings?.company?.logo || DEFAULT_ESTIMATE_CONFIG.company.logo,
      address: settings?.company?.address || DEFAULT_ESTIMATE_CONFIG.company.address,
      phone: settings?.company?.phone || DEFAULT_ESTIMATE_CONFIG.company.phone,
      email: settings?.company?.email || DEFAULT_ESTIMATE_CONFIG.company.email,
      gstNumber: overrides('COMPANY_GST_NUMBER', DEFAULT_ESTIMATE_CONFIG.company.gstNumber),
    },
    currency: settings?.currency || DEFAULT_ESTIMATE_CONFIG.currency,
    defaultTaxRate:
      typeof settings?.taxRate === 'number' ? settings.taxRate : DEFAULT_ESTIMATE_CONFIG.defaultTaxRate,
    supplyType: overrides('ESTIMATE_SUPPLY_TYPE', DEFAULT_ESTIMATE_CONFIG.supplyType) as 'intra' | 'inter',
    advanceMaxPercent: Number(overrides('ESTIMATE_ADVANCE_MAX_PERCENT', DEFAULT_ESTIMATE_CONFIG.advanceMaxPercent)),
    allowAdvanceExceedingTotal:
      String(overrides('ESTIMATE_ALLOW_ADVANCE_OVER_TOTAL', '')).toLowerCase() === 'true',
    reminderThresholdDays: Number(
      overrides('ESTIMATE_REMINDER_THRESHOLD_DAYS', DEFAULT_ESTIMATE_CONFIG.reminderThresholdDays)
    ),
    validUntilDays: Number(overrides('ESTIMATE_VALID_UNTIL_DAYS', DEFAULT_ESTIMATE_CONFIG.validUntilDays)),
    roundOffEnabled: String(overrides('ESTIMATE_ROUND_OFF', 'true')).toLowerCase() !== 'false',
    estimatePrefix: overrides('ESTIMATE_NUMBER_PREFIX', DEFAULT_ESTIMATE_CONFIG.estimatePrefix),
  };
}

export default getEstimateBusinessConfig;
