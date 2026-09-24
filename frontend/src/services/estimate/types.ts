// ---------------------------------------------------------------------------
// Estimate workflow data model
//
// These types are the single source of truth for the 4-step estimate workflow
// (Vehicle & Client -> Inspection -> Services -> Estimate). The backend mirrors
// them in backend/src/models/Estimate.ts.
// ---------------------------------------------------------------------------

export type VehicleType = '4W' | '2W';

export type FuelType = 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid' | 'Other';

export type InspectionStatus = 'good' | 'attention' | 'critical' | 'na';

export type LineItemType = 'service' | 'package' | 'part' | 'labour' | 'custom';

export type DiscountType = 'percentage' | 'fixed' | 'none';

export type TaxType = 'GST' | 'CGST_SGST' | 'IGST' | 'NONE';

export type SupplyType = 'intra' | 'inter';

export type EstimateStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Review'
  | 'Generated'
  | 'Sent'
  | 'Accepted'
  | 'Rejected'
  | 'Cancelled'
  | 'Expired'
  | 'Approved'
  | 'Converted to Invoice';

export type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';

export type DocumentStatus = 'valid' | 'expiring-soon' | 'expired' | 'unknown';

// ---------------------------------------------------------------------------
// Vehicle / customer
// ---------------------------------------------------------------------------

export interface Vehicle {
  id?: string;
  type: VehicleType;
  registrationNumber: string;
  brand: string;
  model: string;
  variant?: string;
  year?: number | '';
  fuelType?: FuelType | '';
  engineNumber?: string;
  chassisNumber?: string;
  color?: string;
  odometer?: number | '';
  fuelMeter?: number | '';
  /** EV specific fields, only rendered when fuelType === 'Electric'. */
  evBatteryCapacity?: string;
  evChargerType?: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
}

export interface AddressSuggestion {
  id: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  /** Provider payload kept opaque so the map provider can be swapped. */
  provider?: string;
  raw?: Record<string, unknown>;
}

export interface MediaAttachment {
  id: string;
  /** Identifier assigned by the server once the upload completes. */
  serverId?: string;
  name: string;
  kind: 'photo' | 'video';
  mimeType: string;
  size: number;
  /** Server URL once uploaded, or a local object URL while uploading. */
  url?: string;
  /** Blob/File kept in memory so a retry is possible without re-picking. */
  file?: File;
  uploadState: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  uploadedAt: string;
  error?: string;
  /** True when the attachment only exists in the browser session. */
  localOnly?: boolean;
}

export interface UploadedDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  uploadState: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  uploadedAt: string;
  error?: string;
  /** Documents are never exposed as public URLs; keep the storage key only. */
  storageKey?: string;
}

export interface Insurance {
  company: string;
  policyNumber: string;
  startDate: string;
  expiryDate: string;
  document: UploadedDocument | null;
}

export interface ComplianceDocument {
  expiryDate: string;
  setReminder: boolean;
}

export interface Documents {
  rc: ComplianceDocument;
  puc: ComplianceDocument;
  license: ComplianceDocument;
}

export type IdProofType = 'Aadhaar' | 'PAN' | 'Driving License' | 'Passport' | 'Voter ID' | 'Other';

export interface IdentityProof {
  idType: IdProofType | '';
  idNumber: string;
  document: UploadedDocument | null;
}

export interface PickupRequest {
  enabled: boolean;
  address: string;
  contactPerson: string;
  phone: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

export interface InspectionItem {
  id: string;
  categoryId: string;
  name: string;
  status: InspectionStatus;
  notes: string;
  media: MediaAttachment[];
  /** Line item ids created straight from this defect. */
  linkedServiceIds: string[];
}

export interface InspectionCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  isCustom?: boolean;
  items: InspectionItem[];
}

// ---------------------------------------------------------------------------
// Line items / money
// ---------------------------------------------------------------------------

export interface PackageContent {
  name: string;
  type: LineItemType;
  quantity: number;
  rate: number;
  taxRate: number;
}

export interface EstimateLineItem {
  id: string;
  type: LineItemType;
  name: string;
  description?: string;
  hsnSacCode?: string;
  partNumber?: string;
  brand?: string;
  unit: string;
  quantity: number;
  rate: number;

  discountType: DiscountType;
  discountValue: number;

  taxType: TaxType;
  taxRate: number;

  /** Derived, always recalculated by the tax engine (never trusted as input). */
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;

  /** Package contents — rendered expandable under the package row. */
  packageContents?: PackageContent[];

  /** Traceability back to the inspection defect that recommended this item. */
  inspectionItemId?: string;
  inspectionItemName?: string;
  inspectionCategoryName?: string;

  /** Catalog reference, when the item came from the catalog. */
  catalogId?: string;
}

export interface AdvancePayment {
  id: string;
  amount: number;
  mode: PaymentMode;
  date: string;
  reference?: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

export interface EstimateTotals {
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  advancePaid: number;
  balanceDue: number;
}

export interface EstimateMetadata {
  estimateNumber: string;
  estimateDate: string;
  validUntil: string;
  createdBy?: string;
  lastSavedAt?: string;
  generatedAt?: string;
  revision: number;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface CatalogService {
  id: string;
  name: string;
  category: string;
  description?: string;
  rate: number;
  unit: string;
  taxRate: number;
  hsnSacCode?: string;
  vehicleTypes?: VehicleType[];
}

export interface CatalogPackage {
  id: string;
  name: string;
  description?: string;
  price: number;
  taxRate: number;
  contents: PackageContent[];
  vehicleTypes?: VehicleType[];
}

export interface CatalogPart {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
  category?: string;
  hsnCode: string;
  unit: string;
  rate: number;
  taxRate: number;
  stock?: number;
}

export interface CatalogLabour {
  id: string;
  description: string;
  sacCode: string;
  unit: string;
  rate: number;
  taxRate: number;
}

export interface CatalogFilters {
  q: string;
  category: string;
  brand: string;
  minPrice: string;
  maxPrice: string;
  vehicleType?: VehicleType;
  page: number;
  limit: number;
}

export interface CatalogPage<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CustomerVehicleSummary {
  id: string;
  registrationNumber: string;
  brand: string;
  model: string;
  year?: number;
  fuelType?: string;
  color?: string;
  odometer?: number;
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  vehicles: CustomerVehicleSummary[];
}

// ---------------------------------------------------------------------------
// Business configuration (server driven, with a safe local default)
// ---------------------------------------------------------------------------

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
  supplyType: SupplyType;
  /** Maximum advance allowed, as a % of the grand total. */
  advanceMaxPercent: number;
  /** When false an advance can never exceed the grand total. */
  allowAdvanceExceedingTotal: boolean;
  /** Documents expiring within N days are flagged "expiring soon". */
  reminderThresholdDays: number;
  validUntilDays: number;
  roundOffEnabled: boolean;
  estimatePrefix: string;
  terms: string[];
}

// ---------------------------------------------------------------------------
// Whole-page state
// ---------------------------------------------------------------------------

export interface EstimateState {
  /** Draft id once the backend has persisted the estimate. */
  draftId: string | null;
  currentStep: number;
  /** Furthest step the user has unlocked (guarded by validation). */
  maxStepReached: number;
  /** Steps that passed validation at least once. */
  completedSteps: number[];

  status: EstimateStatus;

  vehicle: Vehicle;
  customer: Customer;
  insurance: Insurance;
  documents: Documents;
  identityProof: IdentityProof;
  pickup: PickupRequest;
  bookingSource: string;
  complaint: string;

  inspection: InspectionCategory[];

  lineItems: EstimateLineItem[];

  payments: AdvancePayment[];

  totals: EstimateTotals;

  metadata: EstimateMetadata;

  notes: string;
  terms: string;

  /* --- UI / persistence bookkeeping --- */
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
  dirty: boolean;
  errors: Record<string, string>;
  loadingDraft: boolean;
  generating: boolean;
  generated: boolean;
}
