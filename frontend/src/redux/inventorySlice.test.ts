import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
vi.mock('../services/api', () => ({ default: api }));
import inventory, { fetchInventoryList, fetchMovementHistoryThunk, fetchPurchaseOrdersThunk, updateStockThunk } from './inventorySlice';
import { getDefaultFilters } from '../services/types';
const createStore = () => configureStore({ reducer: { inventory } });
beforeEach(() => vi.clearAllMocks());

it('passes every inventory filter and preserves server page totals and product IDs', async () => {
  api.get.mockResolvedValue({ data: { data: [{ id: 'part' }], pagination: { page: 2, limit: 20, total: 43, totalPages: 3 } } });
  const store = createStore();
  await store.dispatch(fetchInventoryList({ ...getDefaultFilters(), page: 2, ageing: 'dead', brand: 'Brand A', sortField: 'inventory.quantity', sortOrder: 'desc' }));
  expect(api.get).toHaveBeenCalledWith('/inventory', { params: expect.objectContaining({ page: 2, ageing: 'dead', brand: 'Brand A', sort: 'inventory.quantity', order: 'desc' }) });
  expect(store.getState().inventory.pagination.total).toBe(43);
  expect(store.getState().inventory.items).toEqual([{ id: 'part' }]);
});

it('rejects failed reads instead of inventing inventory or purchase orders', async () => {
  api.get.mockRejectedValue({ response: { data: { error: 'Database unavailable' } } });
  const store = createStore();
  await store.dispatch(fetchInventoryList(getDefaultFilters()));
  await store.dispatch(fetchPurchaseOrdersThunk());
  expect(store.getState().inventory.items).toEqual([]);
  expect(store.getState().inventory.orders).toEqual([]);
  expect(store.getState().inventory.error).toBe('Database unavailable');
});

it('does not report a successful stock edit when the backend rejects it', async () => {
  api.patch.mockRejectedValue({ response: { data: { error: 'Insufficient stock' } } });
  const store = createStore();
  await expect(store.dispatch(updateStockThunk({ id: 'part', payload: { quantity: 5 } })).unwrap()).rejects.toBe('Insufficient stock');
  expect(store.getState().inventory.error).toBe('Insufficient stock');
});

it('loads persisted movement history for the selected product', async () => {
  api.get.mockResolvedValue({ data: { data: [{ id: 'movement', stockBefore: 10, stockAfter: 7 }] } });
  const store = createStore();
  await store.dispatch(fetchMovementHistoryThunk('part'));
  expect(api.get).toHaveBeenCalledWith('/stock-transactions/part');
  expect(store.getState().inventory.movementHistory[0].id).toBe('movement');
});
