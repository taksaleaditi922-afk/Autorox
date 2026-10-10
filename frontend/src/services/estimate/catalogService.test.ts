import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api', () => ({ default: api }));
import { clearBusinessConfigCache, DEFAULT_CATALOG_FILTERS, getBusinessConfig, searchParts } from './catalogService';
beforeEach(() => { vi.clearAllMocks(); clearBusinessConfigCache(); });

it('does not substitute sample prices when catalog loading fails', async () => {
  const error = new Error('API unavailable');
  api.get.mockRejectedValue(error);
  await expect(searchParts(DEFAULT_CATALOG_FILTERS)).rejects.toBe(error);
});

it('preserves an empty server catalog', async () => {
  api.get.mockResolvedValue({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
  expect((await searchParts(DEFAULT_CATALOG_FILTERS)).data).toEqual([]);
});

it('retries failed business configuration requests instead of caching defaults', async () => {
  api.get.mockRejectedValueOnce(new Error('API unavailable'));
  await expect(getBusinessConfig()).rejects.toThrow('API unavailable');
  api.get.mockResolvedValueOnce({ data: { data: { currency: 'INR', company: { name: 'Workshop A' } } } });
  expect((await getBusinessConfig()).company.name).toBe('Workshop A');
  expect(api.get).toHaveBeenCalledTimes(2);
});
