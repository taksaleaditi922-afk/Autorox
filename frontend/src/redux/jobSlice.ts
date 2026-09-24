import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchJobCards = createAsyncThunk('jobCards/fetch', async (params: Record<string, any> = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/jobcards', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to load job cards');
  }
});

export const fetchJobCardStats = createAsyncThunk('jobCards/stats', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/jobcards/stats');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to load job card counts');
  }
});

export const fetchJobCard = createAsyncThunk('jobCards/fetchOne', async (id: string, { rejectWithValue }) => {
  try {
    const res = await api.get(`/jobcards/${id}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to load job card');
  }
});

export const createJobCard = createAsyncThunk('jobCards/create', async (payload: any, { rejectWithValue }) => {
  try {
    const res = await api.post('/jobcards', payload);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to create job card');
  }
});

export const updateJobCard = createAsyncThunk('jobCards/update', async ({ id, payload }: { id: string; payload: any }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/jobcards/${id}`, payload);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to update job card');
  }
});

export const updateJobStatus = createAsyncThunk(
  'jobCards/status',
  async ({ id, status, notes }: { id: string; status: string; notes?: string }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/jobcards/${id}/status`, { status, notes });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to update status');
    }
  }
);

export const deleteJobCard = createAsyncThunk(
  'jobCards/delete',
  async (input: string | { id: string; force?: boolean }, { rejectWithValue }) => {
    const id = typeof input === 'string' ? input : input.id;
    const force = typeof input === 'string' ? false : input.force === true;
    try {
      await api.delete(`/jobcards/${id}`, { params: force ? { force: 'true' } : undefined });
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to delete job card');
    }
  }
);

export interface JobCardStats {
  total: number;
  byStatus: Record<string, number>;
  groups: Record<string, number>;
}

const EMPTY_STATS: JobCardStats = { total: 0, byStatus: {}, groups: {} };

const jobCardSlice = createSlice({
  name: 'jobCards',
  initialState: {
    items: [],
    current: null,
    stats: EMPTY_STATS as JobCardStats,
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    loading: false,
    statsLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobCards.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchJobCards.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchJobCards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchJobCardStats.pending, (state) => {
        state.statsLoading = true;
      })
      .addCase(fetchJobCardStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload || EMPTY_STATS;
      })
      .addCase(fetchJobCardStats.rejected, (state) => {
        state.statsLoading = false;
      })
      .addCase(fetchJobCard.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchJobCard.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchJobCard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createJobCard.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateJobStatus.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(updateJobCard.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteJobCard.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i._id !== action.payload);
      });
  },
});

export default jobCardSlice.reducer;
