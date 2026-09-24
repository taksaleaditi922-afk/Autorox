// ---------------------------------------------------------------------------
// Test-only stand-in for the Estimate mongoose model.
//
// The installed `mongoose` package ships TypeScript sources that Vitest cannot
// load (the app runs it through tsx instead), so unit tests that only need the
// enum constants mock the model out. The values below mirror
// src/models/Estimate.ts — the sanitisers are assertions against these lists.
// ---------------------------------------------------------------------------

export const ESTIMATE_STATUSES = [
  'Draft',
  'Review',
  'Pending Approval',
  'Generated',
  'Sent',
  'Accepted',
  'Rejected',
  'Cancelled',
  'Expired',
];

export const VEHICLE_TYPES = ['4W', '2W'];
export const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Other'];
export const INSPECTION_STATUSES = ['good', 'attention', 'critical', 'na'];
export const LINE_ITEM_TYPES = ['service', 'package', 'part', 'labour', 'custom'];
export const DISCOUNT_TYPES = ['percentage', 'fixed', 'none'];
export const TAX_TYPES = ['GST', 'CGST_SGST', 'IGST', 'NONE'];
export const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
export const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Driving License', 'Passport', 'Voter ID', 'Other'];
export const MEDIA_SCOPES = ['inspection', 'insurance', 'identity', 'other'];

/** Module shape expected by `vi.mock('../models/Estimate.js', ...)`. */
export function estimateModelStub() {
  return {
    __esModule: true,
    default: {
      countDocuments: async () => 0,
      findOne: async () => null,
    },
    ESTIMATE_STATUSES,
    VEHICLE_TYPES,
    FUEL_TYPES,
    INSPECTION_STATUSES,
    LINE_ITEM_TYPES,
    DISCOUNT_TYPES,
    TAX_TYPES,
    PAYMENT_MODES,
    ID_PROOF_TYPES,
    MEDIA_SCOPES,
  };
}
