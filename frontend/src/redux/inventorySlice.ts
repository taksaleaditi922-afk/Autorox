import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
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
  fetchMovementHistory,
} from '../services/inventoryService';
import type { InventoryItem, InventoryStats, InventoryInsight, StockAlert, PurchaseOrder, InwardRecord, IssuedRecord, PurchaseReturn } from '../services/inventoryService';
import type { InventoryFilters } from '../services/types';

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

export const fetchInventoryList = createAsyncThunk('inventory/fetchList', async (filters: InventoryFilters, { rejectWithValue }) => {
  try {
    return await fetchInventoryApi({ ...filters, sort: filters.sortField, order: filters.sortOrder });
  } catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory'); }
});

export const fetchInventoryStatsThunk = createAsyncThunk('inventory/fetchStats', async (_, { rejectWithValue }) => {
  try { return await fetchInventoryStatsApi(); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory data'); }
});

export const fetchInventoryInsightsThunk = createAsyncThunk('inventory/fetchInsights', async (_, { rejectWithValue }) => {
  try { return await fetchInventoryInsightsApi(); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory data'); }
});

export const fetchStockAlertsThunk = createAsyncThunk('inventory/fetchAlerts', async (_, { rejectWithValue }) => {
  try { return await fetchStockAlertsApi(); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory data'); }
});

export const fetchPurchaseOrdersThunk = createAsyncThunk('inventory/fetchOrders', async (params: { page?: number; limit?: number } | undefined, { rejectWithValue }) => {
  try { return await fetchPurchaseOrdersApi(params); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory data'); }
});

export const fetchInwardRecordsThunk = createAsyncThunk('inventory/fetchInward', async (params: { page?: number; limit?: number } | undefined, { rejectWithValue }) => {
  try { return await fetchInwardRecordsApi(params); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory data'); }
});

export const fetchIssuedRecordsThunk = createAsyncThunk('inventory/fetchIssued', async (params: { page?: number; limit?: number } | undefined, { rejectWithValue }) => {
  try { return await fetchIssuedRecordsApi(params); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory data'); }
});

export const fetchPurchaseReturnsThunk = createAsyncThunk('inventory/fetchReturns', async (params: { page?: number; limit?: number } | undefined, { rejectWithValue }) => {
  try { return await fetchPurchaseReturnsApi(params); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load inventory data'); }
});

export const fetchInventoryItemThunk = createAsyncThunk('inventory/fetchItem', async (id: string, { rejectWithValue }) => {
  try { return { data: await fetchInventoryItemApi(id) }; }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load item'); }
});

export const fetchMovementHistoryThunk = createAsyncThunk('inventory/history', async (id: string, { rejectWithValue }) => {
  try { return await fetchMovementHistory(id); }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to load movement history'); }
});

export const updateStockThunk = createAsyncThunk('inventory/updateStock', async ({ id, payload }: { id: string; payload: { quantity?: number; minimumLevel?: number; location?: string; unit?: string } }, { rejectWithValue }) => {
  try { return { data: await updateStockFieldsApi(id, payload) }; }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to update stock'); }
});

export const recordStockMovementThunk = createAsyncThunk('inventory/movement', async (payload: { productId: string; transactionType: string; quantity: number; reference?: { type?: string; number?: string }; notes?: string }, { rejectWithValue }) => {
  try { await createStockMovementApi(payload); return { success: true }; }
  catch (err: any) { return rejectWithValue(err?.response?.data?.error || 'Failed to record stock movement'); }
});

// ---- Slice ----

interface InventoryState {
  recordPagination: Record<'orders' | 'inwardRecords' | 'issuedRecords' | 'purchaseReturns', { page: number; limit: number; total: number; totalPages: number }>;
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
  recordPagination: { orders: { page: 1, limit: 20, total: 0, totalPages: 0 }, inwardRecords: { page: 1, limit: 20, total: 0, totalPages: 0 }, issuedRecords: { page: 1, limit: 20, total: 0, totalPages: 0 }, purchaseReturns: { page: 1, limit: 20, total: 0, totalPages: 0 } },
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
      .addCase(fetchMovementHistoryThunk.pending, (state) => { state.movementLoading = true; })
      .addCase(fetchMovementHistoryThunk.fulfilled, (state, action) => { state.movementLoading = false; state.movementHistory = action.payload; })
      .addCase(fetchMovementHistoryThunk.rejected, (state, action) => { state.movementLoading = false; state.error = action.payload as string; })
      .addCase(fetchInventoryStatsThunk.rejected, (state, action) => { state.error = action.payload as string; })
      .addCase(fetchInventoryInsightsThunk.rejected, (state, action) => { state.error = action.payload as string; })
      .addCase(updateStockThunk.rejected, (state, action) => { state.error = action.payload as string; })
      .addCase(recordStockMovementThunk.rejected, (state, action) => { state.error = action.payload as string; })
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
        state.alerts = action.payload.data;
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
        state.recordPagination.orders = action.payload.pagination as InventoryState['pagination'];
      })
      .addCase(fetchPurchaseOrdersThunk.rejected, (state, action) => {
        state.ordersLoading = false;
        state.error = action.payload as string;
      })
      // ---- Inward ----
      .addCase(fetchInwardRecordsThunk.pending, (state) => {
        state.inwardLoading = true;
      })
      .addCase(fetchInwardRecordsThunk.fulfilled, (state, action) => {
        state.inwardLoading = false;
        state.inwardRecords = action.payload.data;
        state.recordPagination.inwardRecords = action.payload.pagination as InventoryState['pagination'];
      })
      .addCase(fetchInwardRecordsThunk.rejected, (state, action) => {
        state.inwardLoading = false;
        state.error = action.payload as string;
      })
      // ---- Issued ----
      .addCase(fetchIssuedRecordsThunk.pending, (state) => {
        state.issuedLoading = true;
      })
      .addCase(fetchIssuedRecordsThunk.fulfilled, (state, action) => {
        state.issuedLoading = false;
        state.issuedRecords = action.payload.data;
        state.recordPagination.issuedRecords = action.payload.pagination as InventoryState['pagination'];
      })
      .addCase(fetchIssuedRecordsThunk.rejected, (state, action) => {
        state.issuedLoading = false;
        state.error = action.payload as string;
      })
      // ---- Returns ----
      .addCase(fetchPurchaseReturnsThunk.pending, (state) => {
        state.returnsLoading = true;
      })
      .addCase(fetchPurchaseReturnsThunk.fulfilled, (state, action) => {
        state.returnsLoading = false;
        state.purchaseReturns = action.payload.data;
        state.recordPagination.purchaseReturns = action.payload.pagination as InventoryState['pagination'];
      })
      .addCase(fetchPurchaseReturnsThunk.rejected, (state, action) => {
        state.returnsLoading = false;
        state.error = action.payload as string;
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
