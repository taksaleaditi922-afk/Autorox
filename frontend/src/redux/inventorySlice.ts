import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import {
  fetchInventory as fetchInventoryApi,
  fetchInventoryItem as fetchInventoryItemApi,
  fetchInventoryStats as fetchInventoryStatsApi,
  fetchInventoryInsights as fetchInventoryInsightsApi,
  fetchStockAlerts as fetchStockAlertsApi,
  fetchInventoryOptions as fetchInventoryOptionsApi,
  fetchPurchaseOrders as fetchPurchaseOrdersApi,
  fetchInwardRecords as fetchInwardRecordsApi,
  fetchIssuedRecords as fetchIssuedRecordsApi,
  fetchPurchaseReturns as fetchPurchaseReturnsApi,
  updateStockFields as updateStockFieldsApi,
  createStockMovement as createStockMovementApi,
  fetchStockMovements as fetchStockMovementsApi,
  createInventoryProduct as createInventoryProductApi,
  updateInventoryProduct as updateInventoryProductApi,
  deleteInventoryProduct as deleteInventoryProductApi,
  changeProductStock as changeProductStockApi,
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
import type { InventoryItem, InventoryStats, InventoryInsight, StockAlert, PurchaseOrder, InwardRecord, IssuedRecord, PurchaseReturn, InventoryOptions, StockMovement } from '../services/inventoryService';
import { buildInventoryParams } from '../services/types';
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
  purchaseValue: 0,
  saleValue: 0,
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
      const params = buildInventoryParams(filters, filters.sortField, filters.sortOrder);
      const res = await fetchInventoryApi(params);
      return { data: res.data, pagination: res.pagination, source: 'api' };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory');
    }
  }
);

export const fetchInventoryOptionsThunk = createAsyncThunk(
  'inventory/fetchOptions',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchInventoryOptionsApi();
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory filters');
    }
  }
);

export const fetchInventoryStatsThunk = createAsyncThunk(
  'inventory/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchInventoryStatsApi();
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory totals');
    }
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
    try {
      return await fetchStockAlertsApi();
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to load stock alerts');
    }
  }
);

export const fetchPurchaseOrdersThunk = createAsyncThunk(
  'inventory/fetchOrders',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchPurchaseOrdersApi(), { data: mockOrders(24), pagination: { page: 1, limit: 24, total: 24, totalPages: 1 } }, 'orders');
    if (result.success) return result.data;
    return { data: mockOrders(24), pagination: { page: 1, limit: 24, total: 24, totalPages: 1 } };
  }
);

export const fetchInwardRecordsThunk = createAsyncThunk(
  'inventory/fetchInward',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchInwardRecordsApi(), { data: mockInward(20), pagination: { page: 1, limit: 20, total: 20, totalPages: 1 } }, 'inward');
    if (result.success) return result.data;
    return { data: mockInward(20), pagination: { page: 1, limit: 20, total: 20, totalPages: 1 } };
  }
);

export const fetchIssuedRecordsThunk = createAsyncThunk(
  'inventory/fetchIssued',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchIssuedRecordsApi(), { data: mockIssued(22), pagination: { page: 1, limit: 22, total: 22, totalPages: 1 } }, 'issued');
    if (result.success) return result.data;
    return { data: mockIssued(22), pagination: { page: 1, limit: 22, total: 22, totalPages: 1 } };
  }
);

export const fetchPurchaseReturnsThunk = createAsyncThunk(
  'inventory/fetchReturns',
  async (_, { rejectWithValue }) => {
    const result = await withFallback(() => fetchPurchaseReturnsApi(), { data: mockPurchaseReturns(14), pagination: { page: 1, limit: 14, total: 14, totalPages: 1 } }, 'returns');
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
      return await createStockMovementApi(payload);
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to record stock movement');
    }
  }
);

export const fetchStockHistoryThunk = createAsyncThunk(
  'inventory/history',
  async ({ productId, type, from, to }: { productId: string; type?: string; from?: string; to?: string }, { rejectWithValue }) => {
    try {
      return await fetchStockMovementsApi(productId, { type, from, to });
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to load stock history');
    }
  }
);

export const saveInventoryProductThunk = createAsyncThunk(
  'inventory/saveProduct',
  async ({ id, payload }: { id?: string; payload: Record<string, any> }, { rejectWithValue }) => {
    try {
      return id ? await updateInventoryProductApi(id, payload) : await createInventoryProductApi(payload);
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to save part');
    }
  }
);

export const deleteInventoryProductThunk = createAsyncThunk(
  'inventory/deleteProduct',
  async (id: string, { rejectWithValue }) => {
    try {
      await deleteInventoryProductApi(id);
      return id;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to delete part');
    }
  }
);

export const changeProductStockThunk = createAsyncThunk(
  'inventory/changeStock',
  async ({ id, mode, payload }: { id: string; mode: 'add' | 'reduce'; payload: { quantity: number; purchasePrice?: number; reason?: string; note?: string } }, { rejectWithValue }) => {
    try {
      return await changeProductStockApi(id, mode, payload);
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.error || 'Failed to update stock');
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
  options: InventoryOptions;

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
  movementHistory: StockMovement[];
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
  options: { categories: [], locations: [], vehicleTypes: ['2W', '4W'], partTypes: ['OEM', 'Aftermarket', 'Other'], agedStockDays: 90 },

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
      .addCase(fetchInventoryOptionsThunk.fulfilled, (state, action) => {
        state.options = action.payload;
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
        state.alerts = (action.payload as { data: StockAlert[] }).data || [];
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
        const product = action.payload.product;
        const idx = state.items.findIndex((item) => item.id === product.id);
        if (idx >= 0) state.items[idx] = product;
        if (state.current?.id === product.id) state.current = product;
      })
      .addCase(fetchStockHistoryThunk.pending, (state) => {
        state.movementLoading = true;
      })
      .addCase(fetchStockHistoryThunk.fulfilled, (state, action) => {
        state.movementLoading = false;
        state.movementHistory = action.payload;
      })
      .addCase(fetchStockHistoryThunk.rejected, (state) => {
        state.movementLoading = false;
        state.movementHistory = [];
      })
      .addCase(saveInventoryProductThunk.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
        else state.items.unshift(action.payload);
      })
      .addCase(deleteInventoryProductThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      })
      .addCase(changeProductStockThunk.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.product.id);
        if (index >= 0) state.items[index] = action.payload.product;
        if (state.current?.id === action.payload.product.id) state.current = action.payload.product;
      });
  },
});

export const { clearInventoryError, resetCurrentItem } = inventorySlice.actions;
export default inventorySlice.reducer;
