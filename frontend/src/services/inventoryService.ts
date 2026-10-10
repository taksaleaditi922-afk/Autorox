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

/** Load a filtered, sorted inventory page from the backend. */
export async function fetchInventory(params: Record<string, any> = {}): Promise<{
  data: InventoryItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const res = await api.get('/inventory', { params });
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

/** POST /api/stock-transactions — record a stock movement. */
export async function createStockMovement(
  payload: {
    productId: string;
    transactionType: string;
    quantity: number;
    reference?: { type?: string; number?: string };
    notes?: string;
  }
): Promise<void> {
  await api.post('/stock-transactions', payload);
}

// ---------------------------------------------------------------------------
// Backend statistics, alerts and stock records.
// ---------------------------------------------------------------------------

export async function fetchInventoryStats(): Promise<InventoryStats> {
  const res = await api.get('/inventory/stats');
  return res.data.data as InventoryStats;
}

export async function fetchInventoryInsights(): Promise<InventoryInsight> {
  const res = await api.get('/inventory/insights');
  return res.data.data as InventoryInsight;
}

export async function fetchStockAlerts(): Promise<{ data: StockAlert[]; pagination?: Record<string, any> }> {
  const res = await api.get('/inventory/alerts');
  return res.data;
}

export async function fetchPurchaseOrders(params?: Record<string, any>): Promise<{ data: PurchaseOrder[]; pagination?: Record<string, any> }> {
  const res = await api.get('/inventory/orders', { params });
  return res.data;
}

export async function fetchInwardRecords(params?: Record<string, any>): Promise<{ data: InwardRecord[]; pagination?: Record<string, any> }> {
  const res = await api.get('/inventory/inward', { params });
  return res.data;
}

export async function fetchIssuedRecords(params?: Record<string, any>): Promise<{ data: IssuedRecord[]; pagination?: Record<string, any> }> {
  const res = await api.get('/inventory/issued', { params });
  return res.data;
}

export async function fetchPurchaseReturns(params?: Record<string, any>): Promise<{ data: PurchaseReturn[]; pagination?: Record<string, any> }> {
  const res = await api.get('/inventory/purchase-returns', { params });
  return res.data;
}

// ---------------------------------------------------------------------------
// Export: stream a CSV of the currently filtered dataset.
// Today this is client-side (respects active filters). Once the backend exposes
// an export endpoint, replace the body of this function with a single API call.
// ---------------------------------------------------------------------------

export function exportInventoryCsv(items: InventoryItem[], stats: InventoryStats): string {
  return exportToCsv(items, stats);
}


export async function fetchMovementHistory(id: string) {
  const res = await api.get(`/stock-transactions/${id}`);
  return res.data.data;
}
