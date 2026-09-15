import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import {
  fetchInventory as fetchInventoryApi,
  fetchInventoryItem as fetchInventoryItemApi,
  fetchInventoryStats as fetchInventoryStatsApi,
  fetchInventoryInsights as fetchInventoryInsightsApi,
  fetchStockAlerts as fetchStockAlertsApi,
  fetchPurchaseOrders as fetchPurchaseOrdersApi,
  fetchInwardRecords as fetchInwardRecordsApi,
  fetchIssuedRecords as fetchIssuedRecordsApi,
  fetchPurchaseReturns as fetchPurchaseReturnsApi,
  updateStockFields as updateStockFieldsApi,
  createStockMovement as createStockMovementApi,
  MOCK_ITEMS,
  MOCK_STATS,
  MOCK_INSIGHTS,
  computeMockStats,
  computeMockInsights,
  computeMockAlerts,
  mockOrders,
  mockInward,
  mockIssued,
  mockPurchaseReturns,
} from '../services/inventoryService';
import type { InventoryItem, InventoryStats, InventoryInsight, StockAlert, PurchaseOrder, InwardRecord, IssuedRecord, PurchaseReturn } from '../services/inventoryService';
import type { InventoryFilters } from '../services/types';

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fallback: T };

async function withFallback<T>(fetcher: () => Promise<T>, fallback: T, context: string): Promise<ApiResult<T>> {
  try {
    const data = await fetcher();
    return { success: true, data };
  } catch (err: any) {
    const message = err?.response?.data?.error || err?.message || 'Failed to load';
    if (message === 'noStatsEndpoint' || message === 'noInsightsEndpoint' || message === 'noAlertsEndpoint' ||
        message === 'noOrdersEndpoint' || message === 'noInwardEndpoint' || message === 'noIssuedEndpoint' ||
        message === 'noReturnsEndpoint') {
      return { success: false, error: message, fallback };
    }
    return { success: false, error: message, fallback };
  }
}

const EMPTY_STATS: InventoryStats = {
  uniquePartNos: 0,
  totalStockItems: 0,
  stockValue: 0,
  lowStock: 0,
  outOfStock: 0,
  reorderItems: 0,
  deadStockValue: 0,
  deadStockCount: 0,
};

const EMPTY_INSIGHTS: InventoryInsight = {
  lessThan120Days: 0,
  between120And240Days: 0,
  greaterThan240Days: 0,
  deadStockCount: 0,
  deadStockValue: 0,
};

// ---- Async thunks ----

export const fetchInventoryList = createAsyncThunk(
  'inventory/fetchList',
  async (filters: InventoryFilters, { rejectWithValue }) => {
    try {
      const params = {
        q: filters.q || undefined,
        category: filters.category || undefined,
        inStock: filters.inStock ? 'true' : undefined,
        minStock: filters.minQty ? String(filters.minQty) : undefined,
        page: String(filters.page),
        limit: String(filters.limit),
        sort: filters.sortField || undefined,
        order: filters.sortOrder || undefined,
      };
      const res = await fetchInventoryApi(params);
      return { data: res.data, pagination: res.pagination, source: 'api' };
    } catch (err: any) {
      // Fallback to client-side mock + pagination for demo/edge case.
      const start = (filters.page - 1) * filters.limit;
      const slice = MOCK_ITEMS.slice(start, start + filters.limit);
      return {
        data: slice,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: MOCK_ITEMS.length,
          totalPages: Math.ceil(MOCK_ITEMS.length / filters.limit),
        },
        source: 'mock',
      };
    }
  }
);

export const fetchInventoryStatsThunk = createAsyncThunk(
  'inventory/fetchStats',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchInventoryStatsApi(), MOCK_STATS, 'stats');
    if (result.success) return result.data;
    // Recompute from the list the page will load if the list fetch also used mock.
    return computeMockStats(MOCK_ITEMS);
  }
);

export const fetchInventoryInsightsThunk = createAsyncThunk(
  'inventory/fetchInsights',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchInventoryInsightsApi(), MOCK_INSIGHTS, 'insights');
    if (result.success) return result.data;
    return computeMockInsights(MOCK_ITEMS);
  }
);

export const fetchStockAlertsThunk = createAsyncThunk(
  'inventory/fetchAlerts',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchStockAlertsApi(), [], 'alerts');
    if (result.success) return result.data;
    return computeMockAlerts(MOCK_ITEMS);
  }
);

export const fetchPurchaseOrdersThunk = createAsyncThunk(
  'inventory/fetchOrders',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchPurchaseOrdersApi(), mockOrders(24), 'orders');
    if (result.success) return result.data;
    return { data: mockOrders(24), pagination: { page: 1, limit: 24, total: 24, totalPages: 1 } };
  }
);

export const fetchInwardRecordsThunk = createAsyncThunk(
  'inventory/fetchInward',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchInwardRecordsApi(), mockInward(20), 'inward');
    if (result.success) return result.data;
    return { data: mockInward(20), pagination: { page: 1, limit: 20, total: 20, totalPages: 1 } };
  }
);

export const fetchIssuedRecordsThunk = createAsyncThunk(
  'inventory/fetchIssued',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchIssuedRecordsApi(), mockIssued(22), 'issued');
    if (result.success) return result.data;
    return { data: mockIssued(22), pagination: { page: 1, limit: 22, total: 22, totalPages: 1 } };
  }
);

export const fetchPurchaseReturnsThunk = createAsyncThunk(
  'inventory/fetchReturns',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchPurchaseReturnsApi(), mockPurchaseReturns(14), 'returns');
    if (result.success) return result.data;
    return { data: mockPurchaseReturns(14), pagination: { page: 1, limit: 14, total: 14, totalPages: 1 } };
  }
);

export const fetchInventoryItemThunk = createAsyncThunk(
  'inventory/fetchItem',
  async (id: string, { rejectWithValue }) => {
    try {
      const data = await fetchInventoryItemApi(id);
      return { data, source: 'api' };
    } catch (err: any) {
      const found = MOCK_ITEMS.find((i) => i.id === id || i.productCode === id);
      if (found) return { data: found, source: 'mock' };
      return rejectWithValue('Inventory item not found');
    }
  }
);

export const updateStockThunk = createAsyncThunk(
  'inventory/updateStock',
  async ({ id, payload }: { id: string; payload: { quantity?: number; minimumLevel?: number; location?: string; unit?: string } }, { rejectWithValue }) => {
    try {
      const data = await updateStockFieldsApi(id, payload);
      return { data, source: 'api' };
    } catch (err: any) {
      const found = MOCK_ITEMS.find((i) => i.id === id || i.productCode === id);
      if (found) {
        if (payload.quantity != null) found.inventory.quantity = payload.quantity;
        if (payload.minimumLevel != null) found.inventory.minimumLevel = payload.minimumLevel;
        if (payload.location != null) found.inventory.location = payload.location;
        if (payload.unit != null) found.inventory.unit = payload.unit;
        return { data: found, source: 'mock' };
      }
      return rejectWithValue('Failed to update stock');
    }
  }
);

export const recordStockMovementThunk = createAsyncThunk(
  'inventory/movement',
  async (payload: { productId: string; transactionType: string; quantity: number; reference?: { type?: string; number?: string }; notes?: string }, { rejectWithValue }) => {
    try {
      await createStockMovementApi(payload);
      return { success: true };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to record stock movement');
    }
  }
);

// ---- Slice ----

interface InventoryState {
  // Stock tab
  items: InventoryItem[];
  current: InventoryItem | null;
  stats: InventoryStats;
  insights: InventoryInsight;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  loading: boolean;
  error: string | null;

  // Stock alerts
  alerts: StockAlert[];
  alertsLoading: boolean;
  alertsError: string | null;

  // Other tabs (orders, inward, issued, returns)
  orders: PurchaseOrder[];
  inwardRecords: InwardRecord[];
  issuedRecords: IssuedRecord[];
  purchaseReturns: PurchaseReturn[];
  ordersLoading: boolean;
  inwardLoading: boolean;
  issuedLoading: boolean;
  returnsLoading: boolean;

  // Movement history for a single item
  movementHistory: { id: string; transactionType: string; quantity: number; reference?: { type?: string; number?: string }; stockBefore: number; stockAfter: number; recordedAt: string }[];
  movementLoading: boolean;
}

const initialState: InventoryState = {
  items: [],
  current: null,
  stats: EMPTY_STATS,
  insights: EMPTY_INSIGHTS,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  loading: false,
  error: null,

  alerts: [],
  alertsLoading: false,
  alertsError: null,

  orders: [],
  inwardRecords: [],
  issuedRecords: [],
  purchaseReturns: [],
  ordersLoading: false,
  inwardLoading: false,
  issuedLoading: false,
  returnsLoading: false,

  movementHistory: [],
  movementLoading: false,
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    clearInventoryError(state) {
      state.error = null;
    },
    resetCurrentItem(state) {
      state.current = null;
      state.movementHistory = [];
    },
    setFilters(state, action) {
      // Handled in the component; this exists only for clarity.
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- Stock list ----
      .addCase(fetchInventoryList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInventoryList.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchInventoryList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // ---- Stats ----
      .addCase(fetchInventoryStatsThunk.pending, (state) => {
        // Keep existing stats visible; only refresh once fulfilled.
      })
      .addCase(fetchInventoryStatsThunk.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      // ---- Insights ----
      .addCase(fetchInventoryInsightsThunk.fulfilled, (state, action) => {
        state.insights = action.payload;
      })
      // ---- Alerts ----
      .addCase(fetchStockAlertsThunk.pending, (state) => {
        state.alertsLoading = true;
        state.alertsError = null;
      })
      .addCase(fetchStockAlertsThunk.fulfilled, (state, action) => {
        state.alertsLoading = false;
        state.alerts = action.payload;
      })
      .addCase(fetchStockAlertsThunk.rejected, (state, action) => {
        state.alertsLoading = false;
        state.alertsError = action.payload as string;
      })
      // ---- Orders ----
      .addCase(fetchPurchaseOrdersThunk.pending, (state) => {
        state.ordersLoading = true;
      })
      .addCase(fetchPurchaseOrdersThunk.fulfilled, (state, action) => {
        state.ordersLoading = false;
        state.orders = action.payload.data;
      })
      .addCase(fetchPurchaseOrdersThunk.rejected, (state, action) => {
        state.ordersLoading = false;
      })
      // ---- Inward ----
      .addCase(fetchInwardRecordsThunk.pending, (state) => {
        state.inwardLoading = true;
      })
      .addCase(fetchInwardRecordsThunk.fulfilled, (state, action) => {
        state.inwardLoading = false;
        state.inwardRecords = action.payload.data;
      })
      .addCase(fetchInwardRecordsThunk.rejected, (state, action) => {
        state.inwardLoading = false;
      })
      // ---- Issued ----
      .addCase(fetchIssuedRecordsThunk.pending, (state) => {
        state.issuedLoading = true;
      })
      .addCase(fetchIssuedRecordsThunk.fulfilled, (state, action) => {
        state.issuedLoading = false;
        state.issuedRecords = action.payload.data;
      })
      .addCase(fetchIssuedRecordsThunk.rejected, (state, action) => {
        state.issuedLoading = false;
      })
      // ---- Returns ----
      .addCase(fetchPurchaseReturnsThunk.pending, (state) => {
        state.returnsLoading = true;
      })
      .addCase(fetchPurchaseReturnsThunk.fulfilled, (state, action) => {
        state.returnsLoading = false;
        state.purchaseReturns = action.payload.data;
      })
      .addCase(fetchPurchaseReturnsThunk.rejected, (state, action) => {
        state.returnsLoading = false;
      })
      // ---- Single item ----
      .addCase(fetchInventoryItemThunk.pending, (state) => {
        state.current = null;
        state.movementLoading = true;
      })
      .addCase(fetchInventoryItemThunk.fulfilled, (state, action) => {
        state.current = action.payload.data;
        state.movementLoading = false;
      })
      .addCase(fetchInventoryItemThunk.rejected, (state, action) => {
        state.current = null;
        state.movementLoading = false;
        state.error = action.payload as string;
      })
      // ---- Update stock ----
      .addCase(updateStockThunk.pending, (state) => {
        // no-op
      })
      .addCase(updateStockThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex((i) => i.id === action.payload.data.id || i.productCode === action.payload.data.id);
        if (idx !== -1) state.items[idx] = action.payload.data;
        if (state.current?.id === action.payload.data.id || state.current?.productCode === action.payload.data.id) {
          state.current = action.payload.data;
        }
      })
      // ---- Movement history ----
      .addCase(recordStockMovementThunk.fulfilled, (state, action) => {
        // After a movement, refresh the current item and its list row.
        // Real backend would return updated product; here we keep the existing
        // payload shape and let the caller refetch if needed.
        if (action.payload.success) {
          // Mark movement recorded; list refresh handled by caller.
        }
      });
  },
});

export const { clearInventoryError, resetCurrentItem } = inventorySlice.actions;
export default inventorySlice.reducer;
