// ---------------------------------------------------------------------------
// Estimate workflow configuration + default catalog.
//
// Everything configurable lives here so pages never hard-code business data:
// inspection templates, fallback catalog items, units, tax rates, statuses and
// the local business configuration used before the server responds.
//
// The server owns the real data (GET /api/estimates/config + /catalog/*); these
// constants are the offline/fallback adapter payload.
// ---------------------------------------------------------------------------

import type {
  CatalogLabour,
  CatalogPackage,
  CatalogPart,
  CatalogService,
  EstimateBusinessConfig,
  FuelType,
  IdProofType,
  InspectionStatus,
  PaymentMode,
  VehicleType,
} from './types';

// ---------------------------------------------------------------------------
// Generic option lists
// ---------------------------------------------------------------------------

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: '4W', label: '4 Wheeler' },
  { value: '2W', label: '2 Wheeler' },
];

export const FUEL_TYPES: FuelType[] = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Other'];

export const VEHICLE_BRANDS = [
  'Maruti Suzuki',
  'Hyundai',
  'Tata',
  'Mahindra',
  'Honda',
  'Toyota',
  'Kia',
  'MG',
  'Renault',
  'Skoda',
  'Volkswagen',
  'Nissan',
  'Ford',
  'Chevrolet',
  'Bajaj',
  'TVS',
  'Hero',
  'Royal Enfield',
  'Yamaha',
  'Other',
];

export const ID_PROOF_TYPES: IdProofType[] = [
  'Aadhaar',
  'PAN',
  'Driving License',
  'Passport',
  'Voter ID',
  'Other',
];

export const UNITS = ['Pcs', 'Ltrs', 'Kg', 'Set', 'Box', 'Pair', 'Hour', 'Job', 'Other'];

export const TAX_RATES = [0, 5, 12, 18, 28];

export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export const BOOKING_SOURCES = [
  'Walk-in',
  'Phone',
  'Website',
  'WhatsApp',
  'Existing Customer',
  'Referral',
  'Social Media',
  'Campaign',
  'Other',
];

export const ESTIMATE_STATUSES = [
  'Draft',
  'Pending Approval',
  'Generated',
  'Sent',
  'Accepted',
  'Rejected',
  'Cancelled',
  'Expired',
] as const;

export const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Draft: 'default',
  'Pending Approval': 'warning',
  Generated: 'info',
  Sent: 'info',
  Accepted: 'success',
  Approved: 'success',
  Rejected: 'error',
  Cancelled: 'error',
  Expired: 'warning',
  'Converted to Invoice': 'success',
};

// ---------------------------------------------------------------------------
// Inspection status presentation.
//
// Icons + labels are provided alongside colours so status is never communicated
// by colour alone (WCAG 1.4.1).
// ---------------------------------------------------------------------------

export const INSPECTION_STATUS_META: Record<
  InspectionStatus,
  { label: string; shortLabel: string; icon: string; color: string; hex: string }
> = {
  good: { label: 'Good', shortLabel: 'OK', icon: '✓', color: 'success', hex: '#10b981' },
  attention: { label: 'Attention', shortLabel: 'ATT', icon: '⚠', color: 'warning', hex: '#f59e0b' },
  critical: { label: 'Critical', shortLabel: 'CRIT', icon: '🔴', color: 'error', hex: '#ef4444' },
  na: { label: 'N/A', shortLabel: 'N/A', icon: '—', color: 'default', hex: '#94a3b8' },
};

export const INSPECTION_STATUSES: InspectionStatus[] = ['good', 'attention', 'critical', 'na'];

// ---------------------------------------------------------------------------
// Default inspection template (configurable — custom categories are appended)
// ---------------------------------------------------------------------------

export interface InspectionTemplateCategory {
  id: string;
  name: string;
  description: string;
  items: string[];
}

export const INSPECTION_TEMPLATE: InspectionTemplateCategory[] = [
  {
    id: 'road-test',
    name: 'Road Test',
    description: 'Behaviour of the vehicle while driving',
    items: [
      'Engine Performance',
      'Steering',
      'Brakes',
      'Gearbox / Transmission',
      'Clutch',
      'Vehicle Noise',
      'Acceleration',
      'Ride Quality',
    ],
  },
  {
    id: 'exterior-interior',
    name: 'Exterior / Interior',
    description: 'Body, lights, cabin and comfort features',
    items: [
      'Body Panels',
      'Paint',
      'Front Lights',
      'Rear Lights',
      'Indicators',
      'Wipers',
      'Horn',
      'AC',
      'Dashboard',
      'Warning Lights',
      'Seats',
      'Mirrors',
      'Glass / Windshield',
      'Central Locking',
    ],
  },
  {
    id: 'mechanical',
    name: 'Mechanical',
    description: 'Fluids, filters, suspension and running gear',
    items: [
      'Engine Oil',
      'Coolant',
      'Brake Fluid',
      'Battery',
      'Air Filter',
      'Oil Filter',
      'Fuel Filter',
      'Suspension',
      'Tyres',
      'Exhaust',
      'Belts',
      'Hoses',
    ],
  },
];

// ---------------------------------------------------------------------------
// Fallback business configuration
// ---------------------------------------------------------------------------

export const DEFAULT_BUSINESS_CONFIG: EstimateBusinessConfig = {
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

// ---------------------------------------------------------------------------
// Fallback catalog
// ---------------------------------------------------------------------------

export const SERVICE_CATALOG: CatalogService[] = [
  { id: 'svc-brake-pad', name: 'Brake Pad Replacement', category: 'Brakes', rate: 2500, unit: 'Job', taxRate: 18, hsnSacCode: '998714', description: 'Replace front/rear brake pads and clean calipers' },
  { id: 'svc-brake-clean', name: 'Brake Cleaning', category: 'Brakes', rate: 850, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-brake-inspect', name: 'Brake Inspection', category: 'Brakes', rate: 400, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-engine-oil', name: 'Engine Oil Change', category: 'Maintenance', rate: 1200, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-general-service', name: 'General Service', category: 'Maintenance', rate: 4500, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-ac-service', name: 'AC Service & Gas Top-up', category: 'Comfort', rate: 3200, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-wheel-align', name: 'Wheel Alignment', category: 'Suspension', rate: 900, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-wheel-balance', name: 'Wheel Balancing', category: 'Suspension', rate: 700, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-suspension', name: 'Suspension Overhaul', category: 'Suspension', rate: 6800, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-clutch', name: 'Clutch Overhaul', category: 'Transmission', rate: 7500, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-diagnostic', name: 'Computerised Diagnostics', category: 'Electrical', rate: 1500, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-battery', name: 'Battery Replacement', category: 'Electrical', rate: 650, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-denting', name: 'Denting & Painting — Panel', category: 'Bodywork', rate: 5500, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-wash', name: 'Full Body Wash & Detailing', category: 'Detailing', rate: 1200, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-ceramic', name: 'Ceramic Coating', category: 'Detailing', rate: 18000, unit: 'Job', taxRate: 18, hsnSacCode: '998714' },
  { id: 'svc-chain', name: 'Chain Lubrication & Adjustment', category: 'Two Wheeler', rate: 350, unit: 'Job', taxRate: 18, hsnSacCode: '998714', vehicleTypes: ['2W'] },
];

export const PACKAGE_CATALOG: CatalogPackage[] = [
  {
    id: 'pkg-general',
    name: 'General Service Package',
    description: 'Periodic maintenance for petrol vehicles up to 10 years old',
    price: 4999,
    taxRate: 18,
    contents: [
      { name: 'Engine Oil Change', type: 'service', quantity: 1, rate: 1200, taxRate: 18 },
      { name: 'Oil Filter', type: 'part', quantity: 1, rate: 550, taxRate: 18 },
      { name: 'Air Filter Inspection', type: 'service', quantity: 1, rate: 250, taxRate: 18 },
      { name: 'Brake Inspection', type: 'service', quantity: 1, rate: 400, taxRate: 18 },
      { name: 'Car Wash', type: 'service', quantity: 1, rate: 600, taxRate: 18 },
    ],
  },
  {
    id: 'pkg-monsoon',
    name: 'Monsoon Care Package',
    description: 'Wiper, brake and underbody protection check',
    price: 3499,
    taxRate: 18,
    contents: [
      { name: 'Wiper Blade Replacement', type: 'part', quantity: 2, rate: 450, taxRate: 18 },
      { name: 'Brake Fluid Top-up', type: 'service', quantity: 1, rate: 650, taxRate: 18 },
      { name: 'Anti-rust Coating', type: 'service', quantity: 1, rate: 1800, taxRate: 18 },
    ],
  },
  {
    id: 'pkg-ac',
    name: 'Summer AC Package',
    description: 'Complete AC service with cabin filter replacement',
    price: 4299,
    taxRate: 18,
    contents: [
      { name: 'AC Gas Top-up', type: 'service', quantity: 1, rate: 2400, taxRate: 18 },
      { name: 'Cabin Filter', type: 'part', quantity: 1, rate: 900, taxRate: 18 },
      { name: 'AC Vent Cleaning', type: 'service', quantity: 1, rate: 800, taxRate: 18 },
    ],
  },
];

export const PART_CATALOG: CatalogPart[] = [
  { id: 'part-bp-front', name: 'Brake Pad Set — Front', partNumber: 'BP-2210-F', brand: 'Bosch', category: 'Brakes', hsnCode: '8708', unit: 'Set', rate: 1850, taxRate: 18, stock: 24 },
  { id: 'part-bp-rear', name: 'Brake Pad Set — Rear', partNumber: 'BP-3315-R', brand: 'Bosch', category: 'Brakes', hsnCode: '8708', unit: 'Set', rate: 1650, taxRate: 18, stock: 18 },
  { id: 'part-brake-disc', name: 'Brake Disc Rotor', partNumber: 'BD-9910', brand: 'TRW', category: 'Brakes', hsnCode: '8708', unit: 'Pcs', rate: 3200, taxRate: 18, stock: 8 },
  { id: 'part-oil-filter', name: 'Oil Filter', partNumber: 'OF-4412', brand: 'Mahle', category: 'Filters', hsnCode: '8421', unit: 'Pcs', rate: 550, taxRate: 18, stock: 46 },
  { id: 'part-air-filter', name: 'Air Filter', partNumber: 'AF-7702', brand: 'Mahle', category: 'Filters', hsnCode: '8421', unit: 'Pcs', rate: 780, taxRate: 18, stock: 32 },
  { id: 'part-fuel-filter', name: 'Fuel Filter', partNumber: 'FF-1188', brand: 'Filtron', category: 'Filters', hsnCode: '8421', unit: 'Pcs', rate: 980, taxRate: 18, stock: 12 },
  { id: 'part-cabin-filter', name: 'Cabin Air Filter', partNumber: 'CF-5567', brand: 'Valeo', category: 'Filters', hsnCode: '8421', unit: 'Pcs', rate: 900, taxRate: 18, stock: 20 },
  { id: 'part-engine-oil-4', name: 'Engine Oil 5W-30 (4L)', partNumber: 'EO-5W30-4', brand: 'Castrol', category: 'Oils & Fluids', hsnCode: '2710', unit: 'Ltrs', rate: 2400, taxRate: 18, stock: 40 },
  { id: 'part-coolant', name: 'Radiator Coolant (1L)', partNumber: 'RC-1000', brand: 'Castrol', category: 'Oils & Fluids', hsnCode: '3820', unit: 'Ltrs', rate: 420, taxRate: 18, stock: 55 },
  { id: 'part-brake-fluid', name: 'Brake Fluid DOT-4 (500ml)', partNumber: 'BF-DOT4', brand: 'Bosch', category: 'Oils & Fluids', hsnCode: '3819', unit: 'Ltrs', rate: 380, taxRate: 18, stock: 34 },
  { id: 'part-battery', name: 'Battery 45Ah', partNumber: 'BAT-45', brand: 'Exide', category: 'Electrical', hsnCode: '8507', unit: 'Pcs', rate: 6400, taxRate: 18, stock: 9 },
  { id: 'part-spark-plug', name: 'Spark Plug — Iridium', partNumber: 'SP-IR9', brand: 'NGK', category: 'Electrical', hsnCode: '8511', unit: 'Pcs', rate: 780, taxRate: 18, stock: 60 },
  { id: 'part-headlamp', name: 'Headlamp Bulb H4', partNumber: 'HL-H4', brand: 'Philips', category: 'Lighting', hsnCode: '8539', unit: 'Pcs', rate: 640, taxRate: 18, stock: 28 },
  { id: 'part-wiper', name: 'Wiper Blade 22"', partNumber: 'WB-22', brand: 'Valeo', category: 'Wipers', hsnCode: '8512', unit: 'Pair', rate: 890, taxRate: 18, stock: 22 },
  { id: 'part-shock-front', name: 'Shock Absorber — Front', partNumber: 'SA-4401', brand: 'Monroe', category: 'Suspension', hsnCode: '8708', unit: 'Pair', rate: 5600, taxRate: 18, stock: 6 },
  { id: 'part-belt', name: 'Drive Belt', partNumber: 'DB-2200', brand: 'Gates', category: 'Belts & Hoses', hsnCode: '4010', unit: 'Pcs', rate: 1450, taxRate: 18, stock: 14 },
];

export const LABOUR_CATALOG: CatalogLabour[] = [
  { id: 'lab-general', description: 'General Labour — per hour', sacCode: '998714', unit: 'Hour', rate: 650, taxRate: 18 },
  { id: 'lab-technician', description: 'Senior Technician — per hour', sacCode: '998714', unit: 'Hour', rate: 950, taxRate: 18 },
  { id: 'lab-denting', description: 'Denting & Painting Labour', sacCode: '998714', unit: 'Job', rate: 3200, taxRate: 18 },
  { id: 'lab-electrical', description: 'Auto Electrical Labour', sacCode: '998714', unit: 'Job', rate: 1500, taxRate: 18 },
  { id: 'lab-washing', description: 'Washing & Detailing Labour', sacCode: '998714', unit: 'Job', rate: 500, taxRate: 18 },
  { id: 'lab-outdoor', description: 'Outdoor / Roadside Assistance', sacCode: '998714', unit: 'Job', rate: 1200, taxRate: 18 },
];

// ---------------------------------------------------------------------------
// Document expiry helpers
// ---------------------------------------------------------------------------

export type DocumentExpiryStatus = 'valid' | 'expiring-soon' | 'expired' | 'unknown';

export const DOCUMENT_STATUS_META: Record<
  DocumentExpiryStatus,
  { label: string; color: 'success' | 'warning' | 'error' | 'default' }
> = {
  valid: { label: 'Valid', color: 'success' },
  'expiring-soon': { label: 'Expiring Soon', color: 'warning' },
  expired: { label: 'Expired', color: 'error' },
  unknown: { label: 'Not Set', color: 'default' },
};

/** Days from today until an ISO date. Negative values mean already expired. */
export function daysUntil(isoDate: string | undefined | null, from: Date = new Date()): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

/**
 * @param thresholdDays number of days before expiry that counts as "expiring soon"
 */
export function getDocumentStatus(
  isoDate: string | undefined | null,
  thresholdDays = DEFAULT_BUSINESS_CONFIG.reminderThresholdDays,
  from: Date = new Date()
): DocumentExpiryStatus {
  const days = daysUntil(isoDate, from);
  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= thresholdDays) return 'expiring-soon';
  return 'valid';
}

export function getInsuranceStatus(
  expiryDate: string | undefined | null,
  thresholdDays = DEFAULT_BUSINESS_CONFIG.reminderThresholdDays,
  from: Date = new Date()
): DocumentExpiryStatus {
  return getDocumentStatus(expiryDate, thresholdDays, from);
}

/** Available years for the vehicle year dropdown (newest first). */
export function vehicleYears(count = 30): number[] {
  const current = new Date().getFullYear() + 1;
  return Array.from({ length: count }, (_, i) => current - i);
}

/** Loose Indian registration number check, e.g. MH12AB1234 or MH-12-AB-1234. */
export const REGISTRATION_REGEX = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/;

/** File rules shared by every uploader in the workflow. */
export const UPLOAD_RULES = {
  documents: {
    accept: '.pdf,.jpg,.jpeg,.png',
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMb: 10,
  },
  photos: {
    accept: 'image/*',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    maxSizeMb: 12,
  },
  videos: {
    accept: 'video/*',
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxSizeMb: 60,
  },
};
