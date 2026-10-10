import api from './api';
import { exportToCsv } from './types';
import type {
  InventoryItem,
  InventoryStats,
  InventoryInsight,
  StockAlert,
  PurchaseOrder,
  InwardRecord,
  IssuedRecord,
  PurchaseReturn,
  StockMovement,
} from './types';

// Pages and the redux slice import the shared inventory types, constants and
// helpers from this module, so re-export everything declared in ./types.
export * from './types';

export type InventoryTab = 'stock' | 'order' | 'inward' | 'issued' | 'purchase-return' | 'stock-alert';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const INVENTORY_TABS: { id: InventoryTab; label: string }[] = [
  { id: 'stock', label: 'Stock' },
  { id: 'order', label: 'Order' },
  { id: 'inward', label: 'Inward' },
  { id: 'issued', label: 'Issued' },
  { id: 'purchase-return', label: 'Purchase Return' },
  { id: 'stock-alert', label: 'Stock Alert' },
];

export const PAGE_SIZES = PAGE_SIZE_OPTIONS;

// ---------------------------------------------------------------------------
// Real API helpers (where backend exists)
// ---------------------------------------------------------------------------

/** GET /api/products — the existing products endpoint already supports search,
 *  category filter, minStock/inStock filters, sorting, and pagination. */
export async function fetchInventory(params: Record<string, any> = {}): Promise<{
  data: InventoryItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const res = await api.get('/products', { params });
  return res.data;
}

/** GET /api/products/:id — single product detail. */
export async function fetchInventoryItem(id: string): Promise<InventoryItem> {
  const res = await api.get(`/products/${id}`);
  return res.data.data as InventoryItem;
}

/** PATCH /api/products/:id/stock — update quantity / reorder level / location. */
export async function updateStockFields(
  id: string,
  payload: { quantity?: number; minimumLevel?: number; location?: string; unit?: string }
): Promise<InventoryItem> {
  const res = await api.patch(`/products/${id}/stock`, payload);
  return res.data.data as InventoryItem;
}

export async function createInventoryProduct(payload: Record<string, any>): Promise<InventoryItem> {
  const res = await api.post('/products', payload);
  return res.data.data as InventoryItem;
}

export async function updateInventoryProduct(id: string, payload: Record<string, any>): Promise<InventoryItem> {
  const res = await api.put(`/products/${id}`, payload);
  return res.data.data as InventoryItem;
}

export async function deleteInventoryProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}

export async function changeProductStock(
  id: string,
  mode: 'add' | 'reduce',
  payload: { quantity: number; purchasePrice?: number; reason?: string; note?: string }
): Promise<{ product: InventoryItem; movement: StockMovement }> {
  const res = await api.post(`/stock-transactions/${id}/${mode}`, payload);
  return { product: res.data.data, movement: res.data.movement };
}

/** POST /api/stock-transactions — record a stock movement. */
export async function createStockMovement(
  payload: {
    productId: string;
    transactionType: string;
    quantity: number;
    reference?: { type?: string; number?: string };
    notes?: string;
  }
): Promise<{ movement: StockMovement; product: InventoryItem }> {
  const res = await api.post('/stock-transactions', payload);
  return { movement: res.data.data, product: res.data.product };
}

export async function fetchStockMovements(
  productId: string,
  params: { type?: string; from?: string; to?: string } = {}
): Promise<StockMovement[]> {
  const res = await api.get('/stock-transactions', { params: { productId, ...params, limit: 200 } });
  return res.data.data as StockMovement[];
}

// ---------------------------------------------------------------------------
// Stats / insights / alerts
// The backend does not yet expose dedicated endpoints for these. We derive them
// client-side from the inventory list so the UI works today and can be swapped
// for real endpoints later without touching the UI layer.
// ---------------------------------------------------------------------------

export async function fetchInventoryStats(): Promise<InventoryStats> {
  try {
    // Optional future endpoint: GET /api/inventory/stats
    const res = await api.get('/inventory/stats');
    return res.data.data as InventoryStats;
  } catch {
    // Fall back to client-side computation in a moment.
    throw new Error('noStatsEndpoint');
  }
}

export async function fetchInventoryInsights(): Promise<InventoryInsight> {
  try {
    const res = await api.get('/inventory/insights');
    return res.data.data as InventoryInsight;
  } catch {
    throw new Error('noInsightsEndpoint');
  }
}

export async function fetchStockAlerts(): Promise<{ data: StockAlert[]; pagination?: Record<string, any> }> {
  const res = await api.get('/inventory/alerts');
  return res.data;
}

export interface InventoryOptions {
  categories: string[];
  locations: string[];
  vehicleTypes: string[];
  partTypes: string[];
  agedStockDays: number;
}

export async function fetchInventoryOptions(): Promise<InventoryOptions> {
  const res = await api.get('/inventory/options');
  return res.data.data as InventoryOptions;
}

export interface InventoryImportRow {
  rowNumber: number;
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
  action: 'create' | 'update';
}

export async function previewInventoryCsv(csv: string): Promise<{ rows: InventoryImportRow[]; summary: { total: number; valid: number; invalid: number } }> {
  const res = await api.post('/inventory/import/preview', { csv });
  return { rows: res.data.data, summary: res.data.summary };
}

export async function importInventoryCsv(csv: string): Promise<{ created: number; updated: number; skipped: number; failed: number }> {
  const res = await api.post('/inventory/import', { csv });
  return res.data.data;
}

export async function downloadInventoryFile(path: '/inventory/template' | '/inventory/export', params?: Record<string, any>): Promise<Blob> {
  const res = await api.get(path, { params, responseType: 'blob' });
  return res.data as Blob;
}

export async function fetchPurchaseOrders(params?: Record<string, any>): Promise<{ data: PurchaseOrder[]; pagination?: Record<string, any> }> {
  try {
    const res = await api.get('/inventory/orders', { params });
    return res.data;
  } catch {
    throw new Error('noOrdersEndpoint');
  }
}

export async function fetchInwardRecords(params?: Record<string, any>): Promise<{ data: InwardRecord[]; pagination?: Record<string, any> }> {
  try {
    const res = await api.get('/inventory/inward', { params });
    return res.data;
  } catch {
    throw new Error('noInwardEndpoint');
  }
}

export async function fetchIssuedRecords(params?: Record<string, any>): Promise<{ data: IssuedRecord[]; pagination?: Record<string, any> }> {
  try {
    const res = await api.get('/inventory/issued', { params });
    return res.data;
  } catch {
    throw new Error('noIssuedEndpoint');
  }
}

export async function fetchPurchaseReturns(params?: Record<string, any>): Promise<{ data: PurchaseReturn[]; pagination?: Record<string, any> }> {
  try {
    const res = await api.get('/inventory/purchase-returns', { params });
    return res.data;
  } catch {
    throw new Error('noReturnsEndpoint');
  }
}

// ---------------------------------------------------------------------------
// Export: stream a CSV of the currently filtered dataset.
// Today this is client-side (respects active filters). Once the backend exposes
// an export endpoint, replace the body of this function with a single API call.
// ---------------------------------------------------------------------------

export function exportInventoryCsv(items: InventoryItem[], stats: InventoryStats): string {
  return exportToCsv(items, stats);
}

// ---------------------------------------------------------------------------
// Mock data layer — only used when real endpoints are unavailable.
// Structured so it can be removed wholesale once the backend provides these routes.
// ---------------------------------------------------------------------------

const MOCK_BRANDS = ['Bosch', 'TRW', 'AkzoNobel', 'Castrol', 'Hankook', 'CEAT', 'Filtron', 'Mahle', 'Nexen', 'Valeo'];
const MOCK_CATEGORIES = ['Brakes', 'Filters', 'Oils & Fluids', 'Tyres', 'Batteries', 'Electrical', 'Suspension', 'Lighting', 'Belts & Hoses', 'Wipers'];

function mockDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockItems(count: number, seed?: number): InventoryItem[] {
  const items: InventoryItem[] = [];
  let id = 1;
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const quantity = Math.floor(Math.random() * 120);
    const minLevel = Math.floor(Math.random() * 15) + 3;
    const cost = +(Math.random() * 4500 + 80).toFixed(2);
    const sell = Math.round((cost * (1.18 + Math.random() * 0.4)) * 100) / 100;
    const daysSinceMovement = Math.floor(Math.random() * 320);
    const daysSincePurchase = Math.floor(Math.random() * 200) + 2;
    const productCode = `PN-${String(1000 + i).padStart(5, '0')}`;
    items.push({
      id: `item-${i + 1}`,
      productCode,
      productName: `${pick(['Brake Pad', 'Oil Filter', 'Air Filter', 'Cabin Filter', 'Radiator Coolant', 'Motor Oil 5W30', 'Tyre', 'Battery', 'Headlamp Bulb', 'Drive Belt', 'Shock Absorber', 'Windscreen Wiper', 'Spark Plug', 'Fuel Filter', 'Brake Disc'])} ${pick(['Premium', 'Standard', 'Heavy Duty', ' OEM', 'Plus', 'XL'])}`,
      category: pick(MOCK_CATEGORIES),
      brand: pick(MOCK_BRANDS),
      description: '',
      barcode: `890123456${String(10000 + i).slice(0, 5)}`,
      pricing: { costPrice: cost, sellingPrice: sell, tax: 18 },
      inventory: {
        quantity,
        minimumLevel: minLevel,
        unit: 'Units',
        location: pick(['Workshop A — Shelf 1', 'Workshop A — Shelf 2', 'Workshop B — Rack 3', 'Workshop B — Rack 4', 'Central Warehouse — Bay 1']),
        rackNumber: pick(['A1-01', 'A1-02', 'A2-01', 'B3-02', 'B4-01', 'C1-05']),
        workshopId: pick(['ws-a', 'ws-b']),
        workshopName: pick(['Main Workshop', 'North Branch', 'South Branch']),
      },
      supplier: {
        supplierName: pick(['Suraj Auto Parts', 'Tata Auto components', 'Godrej Auto', 'CCI Motors', 'Takshak Suppliers']),
        supplierPhone: pick(['98765 43210', '98231 44556', '99321 77889']),
      },
      createdAt: mockDate(Math.floor(Math.random() * 400) + 5),
      updatedAt: mockDate(daysSinceMovement),
    });
  }
  // Stagger lastPurchaseDate / lastMovementDate deterministically from updatedAt.
  return items.map((it) => ({
    ...it,
    lastPurchaseDate: mockDate(Math.min(200, Math.floor(Math.random() * 200) + 2) + (id++ % 50)),
    lastMovementDate: mockDate(Math.min(320, Math.floor(Math.random() * 320) + 1) + (id % 60)),
  }));
}

const MOCK_ITEMS_COUNT = 320;
const MOCK_ITEMS = generateMockItems(MOCK_ITEMS_COUNT);

export const MOCK_STATS: InventoryStats = (() => {
  const items = MOCK_ITEMS;
  const unique = new Set(items.map((i) => i.productCode)).size;
  const totalQty = items.reduce((s, i) => s + (i.inventory?.quantity ?? 0), 0);
  const stockValue = items.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.costPrice ?? 0), 0);
  let low = 0, out = 0, reorder = 0;
  for (const i of items) {
    const q = i.inventory?.quantity ?? 0;
    const m = i.inventory?.minimumLevel ?? 0;
    if (q === 0) out++;
    else if (q <= m) reorder++;
    else if (q <= m * 2) low++;
  }
  const deadItems = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days > 240;
  });
  const deadValue = deadItems.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.costPrice ?? 0), 0);
  return {
    uniquePartNos: unique,
    totalStockItems: totalQty,
    purchaseValue: stockValue,
    saleValue: items.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.sellingPrice ?? 0), 0),
    stockValue,
    lowStock: low,
    outOfStock: out,
    reorderItems: reorder,
    deadStockValue: deadValue,
    deadStockCount: deadItems.length,
  };
})();

export const MOCK_INSIGHTS: InventoryInsight = (() => {
  const items = MOCK_ITEMS;
  const less = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days < 120;
  }).length;
  const mid = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days >= 120 && days <= 240;
  }).length;
  const more = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days > 240;
  }).length;
  const deadItems = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days > 240;
  });
  const deadValue = deadItems.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.costPrice ?? 0), 0);
  return { lessThan120Days: less, between120And240Days: mid, greaterThan240Days: more, deadStockCount: deadItems.length, deadStockValue: deadValue };
})();

export function computeMockStats(items: InventoryItem[]): InventoryStats {
  const unique = new Set(items.map((i) => i.productCode)).size;
  const totalQty = items.reduce((s, i) => s + (i.inventory?.quantity ?? 0), 0);
  const stockValue = items.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.costPrice ?? 0), 0);
  let low = 0, out = 0, reorder = 0;
  for (const i of items) {
    const q = i.inventory?.quantity ?? 0;
    const m = i.inventory?.minimumLevel ?? 0;
    if (q === 0) out++;
    else if (q <= m) reorder++;
    else if (q <= m * 2) low++;
  }
  const deadItems = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days > 240;
  });
  const deadValue = deadItems.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.costPrice ?? 0), 0);
  return {
    uniquePartNos: unique,
    totalStockItems: totalQty,
    purchaseValue: stockValue,
    saleValue: items.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.sellingPrice ?? 0), 0),
    stockValue,
    lowStock: low,
    outOfStock: out,
    reorderItems: reorder,
    deadStockValue: deadValue,
    deadStockCount: deadItems.length,
  };
}

export function computeMockInsights(items: InventoryItem[]): InventoryInsight {
  const less = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days < 120;
  }).length;
  const mid = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days >= 120 && days <= 240;
  }).length;
  const more = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days > 240;
  }).length;
  const deadItems = items.filter((i) => {
    const days = Math.floor((Date.now() - new Date(i.lastMovementDate || i.updatedAt).getTime()) / 86400000);
    return days > 240;
  });
  const deadValue = deadItems.reduce((s, i) => s + (i.inventory?.quantity ?? 0) * (i.pricing?.costPrice ?? 0), 0);
  return { lessThan120Days: less, between120And240Days: mid, greaterThan240Days: more, deadStockCount: deadItems.length, deadStockValue: deadValue };
}

export function computeMockAlerts(items: InventoryItem[]): StockAlert[] {
  const alerts: StockAlert[] = [];
  for (const item of items) {
    const q = item.inventory?.quantity ?? 0;
    const m = item.inventory?.minimumLevel ?? 0;
    if (q === 0) {
      alerts.push({
        id: `alert-${item.id}`,
        productId: item.id,
        productCode: item.productCode,
        productName: item.productName,
        category: item.category || '',
        quantity: q,
        minimumLevel: m,
        location: item.inventory?.location,
        workshopName: item.inventory?.workshopName,
        type: 'out-of-stock',
        createdAt: item.updatedAt,
      });
    } else if (q <= m) {
      alerts.push({
        id: `alert-${item.id}`,
        productId: item.id,
        productCode: item.productCode,
        productName: item.productName,
        category: item.category || '',
        quantity: q,
        minimumLevel: m,
        location: item.inventory?.location,
        workshopName: item.inventory?.workshopName,
        type: 'reorder-level',
        createdAt: item.updatedAt,
      });
    } else if (q <= m * 2) {
      alerts.push({
        id: `alert-${item.id}`,
        productId: item.id,
        productCode: item.productCode,
        productName: item.productName,
        category: item.category || '',
        quantity: q,
        minimumLevel: m,
        location: item.inventory?.location,
        workshopName: item.inventory?.workshopName,
        type: 'low-stock',
        createdAt: item.updatedAt,
      });
    }
  }
  const maxCritical = Math.min(8, alerts.length);
  for (let i = 0; i < maxCritical; i++) {
    const a = alerts[i];
    if (a) a.type = 'critical';
  }
  return alerts.sort((a, b) => {
    const rank = { 'out-of-stock': 0, 'critical': 1, 'reorder-level': 2, 'low-stock': 3 };
    return (rank[a.type] ?? 9) - (rank[b.type] ?? 9);
  });
}

const VENDORS = ['Suraj Auto Parts', 'Tata Auto Components', 'Godrej Auto', 'CCI Motors', 'Takshak Suppliers', 'Amphenol Interconnect', 'Valeo India'];

function mockOrders(count: number) {
  const items: PurchaseOrder[] = [];
  for (let i = 0; i < count; i++) {
    const status = pick(['Pending', 'In Transit', 'Partial', 'Delivered', 'Cancelled'] as const);
    items.push({
      id: `po-${i + 1}`,
      orderNumber: `PO-${String(1000 + i).padStart(5, '0')}`,
      vendorName: pick(VENDORS),
      vendorPhone: '98765 43210',
      orderDate: mockDate(Math.floor(Math.random() * 60) + 1),
      expectedDelivery: mockDate(Math.floor(Math.random() * 40) + 2),
      status,
      itemsCount: Math.floor(Math.random() * 20) + 1,
      totalAmount: +(Math.random() * 250000 + 5000).toFixed(2),
      notes: '',
      createdAt: mockDate(Math.floor(Math.random() * 60) + 1),
    });
  }
  return items;
}

function mockInward(count: number) {
  const items: InwardRecord[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `in-${i + 1}`,
      inwardNumber: `INV-${String(2000 + i).padStart(5, '0')}`,
      vendorName: pick(VENDORS),
      receivedDate: mockDate(Math.floor(Math.random() * 50) + 1),
      invoiceNumber: `INV-${String(5000 + i).padStart(6, '0')}`,
      itemsCount: Math.floor(Math.random() * 15) + 1,
      totalAmount: +(Math.random() * 180000 + 2000).toFixed(2),
      status: pick(['Pending', 'Verified', 'Completed', 'Cancelled'] as const),
      createdAt: mockDate(Math.floor(Math.random() * 50) + 1),
    });
  }
  return items;
}

function mockIssued(count: number) {
  const types: IssuedRecord['issueType'][] = ['Job', 'Vehicle', 'Technician', 'Workshop', 'Internal'];
  const items: IssuedRecord[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `is-${i + 1}`,
      issueNumber: `USN-${String(3000 + i).padStart(5, '0')}`,
      issueDate: mockDate(Math.floor(Math.random() * 40) + 1),
      issuedTo: pick(['Job Card #JC-0421', 'Vehicle KA-04 AB 1234', 'Ramesh (Technician)', 'Workshop A', 'Internal Store']),
      issueType: pick(types),
      referenceNumber: `JC-${String(400 + i).padStart(4, '0')}`,
      itemsCount: Math.floor(Math.random() * 8) + 1,
      totalQuantity: Math.floor(Math.random() * 30) + 1,
      notes: '',
      createdAt: mockDate(Math.floor(Math.random() * 40) + 1),
    });
  }
  return items;
}

function mockPurchaseReturns(count: number) {
  const items: PurchaseReturn[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `pr-${i + 1}`,
      returnNumber: `PR-${String(4000 + i).padStart(5, '0')}`,
      vendorName: pick(VENDORS),
      returnDate: mockDate(Math.floor(Math.random() * 30) + 1),
      orderNumber: `PO-${String(1000 + i).padStart(5, '0')}`,
      itemsCount: Math.floor(Math.random() * 6) + 1,
      totalAmount: +(Math.random() * 45000 + 500).toFixed(2),
      status: pick(['Requested', 'Approved', 'Received', 'Cancelled'] as const),
      reason: pick(['Defective', 'Wrong item', 'Overstock', 'Quality issue', 'Expired'] as const),
      createdAt: mockDate(Math.floor(Math.random() * 30) + 1),
    });
  }
  return items;
}

export {
  MOCK_ITEMS,
  generateMockItems,
  VENDORS,
  mockOrders,
  mockInward,
  mockIssued,
  mockPurchaseReturns,
};
