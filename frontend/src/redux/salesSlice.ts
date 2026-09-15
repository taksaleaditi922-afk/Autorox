import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchSales = createAsyncThunk('sales/fetch', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to load sales');
  }
});

export const fetchSale = createAsyncThunk('sales/fetchOne', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/sales/${id}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to load sale');
  }
});

export const createSale = createAsyncThunk('sales/create', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.post('/sales', payload);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to create sale');
  }
});

export const updateSale = createAsyncThunk('sales/update', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/sales/${id}`, payload);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to update sale');
  }
});

export const deleteSale = createAsyncThunk('sales/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/sales/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to delete sale');
  }
});

export const updateSaleStatus = createAsyncThunk(
  'sales/status',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/sales/${id}/status`, { status });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to update status');
    }
  }
);

export const recordPayment = createAsyncThunk(
  'sales/recordPayment',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/sales/${id}/payment`, payload);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to record payment');
    }
  }
);

export const fetchPaymentHistory = createAsyncThunk(
  'sales/paymentHistory',
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/sales/${id}/payments`);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load payment history');
    }
  }
);

const salesSlice = createSlice({
  name: 'sales',
  initialState: {
    items: [],
    current: null,
    paymentHistory: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSales.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchSale.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSale.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchSale.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createSale.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateSale.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteSale.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i._id !== action.payload);
      })
      .addCase(updateSaleStatus.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(recordPayment.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(fetchPaymentHistory.fulfilled, (state, action) => {
        state.paymentHistory = action.payload;
      });
  },
});

export default salesSlice.reducer;
