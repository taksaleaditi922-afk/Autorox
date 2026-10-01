
// ---------------------------------------------------------------------------
// Re-exported types used by the inventory service layer
// ---------------------------------------------------------------------------

export interface InventoryFilters {
  q: string;
  category: string;
  vehicleType: string;
  partType: string;
  brand: string;
  location: string;
  workshopId: string;
  stockStatus: string;
  ageing: string;
  minPrice: string;
  maxPrice: string;
  minQty: string;
  maxQty: string;
  inStock?: boolean;
  outOfStock?: boolean;
  reorderLevel?: boolean;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export type InventorySortField = string;
export type InventorySortOrder = 'asc' | 'desc';

export interface InventoryItem {
  id: string;
  productCode: string;
  productName: string;
  barcode?: string;
  vehicleType?: '2W' | '4W';
  category: string;
  subCategory?: string;
  partType?: 'OEM' | 'Aftermarket' | 'Other';
  remark?: string;
  employeeName?: string;
  firstStockInDate?: string;
  oldestRemainingStockDate?: string | null;
  brand?: string;
  description?: string;
  pricing: {
    costPrice: number;
    sellingPrice: number;
    tax: number;
  };
  inventory: {
    quantity: number;
    minimumLevel: number;
    unit: string;
    location: string;
    rackNumber?: string;
    workshopName?: string;
    workshopId?: string;
  };
  supplier?: {
    supplierName?: string;
    supplierPhone?: string;
  };
  lastPurchaseDate?: string;
  lastMovementDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStats {
  uniquePartNos: number;
  totalStockItems: number;
  purchaseValue: number;
  saleValue: number;
  stockValue: number;
  lowStock: number;
  outOfStock: number;
  reorderItems: number;
  deadStockValue: number;
  deadStockCount: number;
}

export interface InventoryInsight {
  lessThan120Days: number;
  between120And240Days: number;
  greaterThan240Days: number;
  deadStockCount: number;
  deadStockValue: number;
}

export interface StockAlert {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  quantity: number;
  minimumLevel: number;
  location?: string;
  workshopName?: string;
  type: 'out-of-stock' | 'low-stock' | 'reorder-level' | 'critical';
  createdAt: string;
}

export interface StockMovement {
  id: string;
  transactionType: string;
  quantity: number;
  reference?: { type?: string; number?: string };
  stockBefore: number;
  stockAfter: number;
  unitPrice?: number | null;
  reason?: string;
  notes?: string;
  recordedBy?: { username?: string; email?: string } | string | null;
  recordedAt: string;
  createdAt?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendorName: string;
  vendorPhone?: string;
  orderDate: string;
  expectedDelivery: string;
  status: 'Pending' | 'In Transit' | 'Partial' | 'Delivered' | 'Cancelled';
  itemsCount: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

export interface InwardRecord {
  id: string;
  inwardNumber: string;
  vendorName: string;
  receivedDate: string;
  invoiceNumber?: string;
  itemsCount: number;
  totalAmount: number;
  status: 'Pending' | 'Verified' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export interface IssuedRecord {
  id: string;
  issueNumber: string;
  issueDate: string;
  issuedTo: string;
  issueType: 'Job' | 'Vehicle' | 'Technician' | 'Workshop' | 'Internal';
  referenceNumber?: string;
  itemsCount: number;
  totalQuantity: number;
  notes?: string;
  createdAt: string;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  vendorName: string;
  returnDate: string;
  orderNumber?: string;
  itemsCount: number;
  totalAmount: number;
  status: 'Requested' | 'Approved' | 'Received' | 'Cancelled';
  reason?: string;
  createdAt: string;
}

export type StockStatus = 'In Stock' | 'Re-order Level' | 'Out of Stock';

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  'In Stock': 'In Stock',
  'Re-order Level': 'Re-order Level',
  'Out of Stock': 'Out of Stock',
};

export const STOCK_STATUS_COLORS: Record<StockStatus, 'success' | 'warning' | 'error'> = {
  'In Stock': 'success',
  'Re-order Level': 'warning',
  'Out of Stock': 'error',
};

export const AGEING_BUCKETS = [
  { key: 'fresh', label: '< 120 Days', min: 0, max: 120, color: 'success' },
  { key: 'ageing', label: '120–240 Days', min: 120, max: 240, color: 'warning' },
  { key: 'dead', label: '> 240 Days', min: 240, max: Infinity, color: 'error' },
] as const;

export const DEFAULT_AGEING_THRESHOLD_DAYS = 240;

export const COLUMNS = [
  { field: 'barcode', label: 'Bar Code', sortable: false },
  { field: 'productName', label: 'Part Name', sortable: true },
  { field: 'productCode', label: 'Part Number', sortable: true },
  { field: 'vehicleType', label: 'Vehicle Type', sortable: true },
  { field: 'inventory.quantity', label: 'Available Quantity', sortable: true, numeric: true },
  { field: 'category', label: 'Category', sortable: true },
  { field: 'subCategory', label: 'Sub Category', sortable: false },
  { field: 'inventory.location', label: 'Location', sortable: true },
  { field: 'pricing.costPrice', label: 'Purchase Price', sortable: true, numeric: true },
  { field: 'pricing.sellingPrice', label: 'Selling Price', sortable: true, numeric: true },
  { field: 'stockActions', label: 'Stock', sortable: false },
  { field: 'partType', label: 'Part Type', sortable: true },
  { field: 'history', label: 'Part History', sortable: false },
  { field: 'remark', label: 'Remark', sortable: false },
  { field: 'employeeName', label: 'Employee Name', sortable: false },
  { field: 'age', label: 'Age', sortable: false },
  { field: 'delete', label: 'Delete', sortable: false },
] as const;

export const QUICK_FILTERS: Record<string, Partial<InventoryFilters>> = {
  all: {},
  'in-stock': { inStock: true },
  'out-of-stock': { outOfStock: true },
  'reorder-level': { reorderLevel: true },
};

export function computeStockStatus(item: InventoryItem): StockStatus {
  const q = item.inventory?.quantity ?? 0;
  const reorder = item.inventory?.minimumLevel ?? 0;
  if (q === 0) return 'Out of Stock';
  if (q <= reorder) return 'Re-order Level';
  return 'In Stock';
}

export function computeAgeingDays(item: InventoryItem, refDate?: Date): number {
  const lastMovement = item.lastMovementDate ?? item.updatedAt ?? item.createdAt;
  if (!lastMovement) return 0;
  const d = new Date(lastMovement);
  if (Number.isNaN(d.getTime())) return 0;
  const base = refDate ?? new Date();
  const diff = base.getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function getAgeingBucket(days: number) {
  if (days < 120) return AGEING_BUCKETS[0];
  if (days <= 240) return AGEING_BUCKETS[1];
  return AGEING_BUCKETS[2];
}

export function getDefaultFilters(): InventoryFilters {
  return {
    q: '',
    category: '',
    vehicleType: '',
    partType: '',
    brand: '',
    location: '',
    workshopId: '',
    stockStatus: 'all',
    ageing: 'all',
    minPrice: '',
    maxPrice: '',
    minQty: '',
    maxQty: '',
    page: 1,
    limit: 20,
  };
}

export function buildInventoryParams(filters: InventoryFilters, sortField?: string, sortOrder?: InventorySortOrder): Record<string, any> {
  const params: Record<string, any> = {};
  if (filters.q) params.q = filters.q;
  if (filters.category) params.category = filters.category;
  if (filters.vehicleType) params.vehicleType = filters.vehicleType;
  if (filters.partType) params.partType = filters.partType;
  if (filters.brand) params.brand = filters.brand;
  if (filters.location) params.location = filters.location;
  if (filters.workshopId) params.workshopId = filters.workshopId;
  if (filters.inStock) params.inStock = 'true';
  if (filters.outOfStock) params.outOfStock = 'true';
  if (filters.reorderLevel) params.reorderLevel = 'true';
  if (filters.stockStatus && filters.stockStatus !== 'all') params.stockStatus = filters.stockStatus;
  if (filters.minPrice || filters.maxPrice) {
    params.minPrice = filters.minPrice;
    params.maxPrice = filters.maxPrice;
  }
  if (filters.minQty || filters.maxQty) {
    if (filters.minQty) params.minStock = filters.minQty;
    if (filters.maxQty) params.maxStock = filters.maxQty;
  }
  params.page = filters.page;
  params.limit = filters.limit;
  if (sortField) params.sort = sortField;
  if (sortOrder) params.order = sortOrder;
  return params;
}

export function formatBarcode(code: string | undefined): string {
  if (!code) return '—';
  if (/^[0-9]{6,}$/.test(code)) {
    return `${code.slice(0, 6)} ${code.slice(6, 12)} ${code.slice(12)}`;
  }
  return code;
}

export function exportToCsv(items: InventoryItem[], stats: InventoryStats): string {
  const headers = [
    'Part No',
    'Part Name',
    'Brand',
    'Category',
    'Barcode',
    'QoH',
    'Re-order Level',
    'Stock Status',
    'Avg Purchase Price',
    'Avg Selling Price',
    'Tax %',
    'Tax Amount',
    'Stock Value',
    'Rack Number',
    'Workshop / Location',
    'Ageing (Days)',
    'Last Purchase Date',
    'Last Movement Date',
  ];
  const rows = items.map((item) => {
    const status = computeStockStatus(item);
    const ageing = computeAgeingDays(item);
    const taxAmount = item.pricing?.sellingPrice ? +(item.pricing.sellingPrice * (item.pricing?.tax ?? 18) / 100).toFixed(2) : 0;
    const value = (item.inventory?.quantity ?? 0) * (item.pricing?.costPrice ?? 0);
    return [
      item.productCode,
      item.productName,
      item.brand || '',
      item.category || '',
      item.barcode || '',
      item.inventory?.quantity ?? 0,
      item.inventory?.minimumLevel ?? 0,
      status,
      item.pricing?.costPrice ?? 0,
      item.pricing?.sellingPrice ?? 0,
      item.pricing?.tax ?? 18,
      taxAmount,
      +value.toFixed(2),
      item.inventory?.rackNumber || '',
      item.inventory?.location || '',
      ageing,
      item.lastPurchaseDate || '',
      item.lastMovementDate || item.updatedAt || '',
    ].map((v) => (typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v));
  });
  const lines = [headers.join(','), ...rows.map((r) => r.join(','))];
  return lines.join('\n');
}
