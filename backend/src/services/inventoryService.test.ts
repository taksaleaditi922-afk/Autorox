import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock('../models/Product.js', () => ({ default: db }));
import { getInventory, inventoryPipeline, pagination, summarizeInventory } from './inventoryService.js';

beforeEach(() => vi.clearAllMocks());

describe('inventory queries', () => {
  it('clamps invalid page sizes and calculates later-page offsets', () => {
    expect(pagination({ page: 3, limit: 20 })).toEqual({ page: 3, limit: 20, skip: 40 });
    expect(pagination({ page: -1, limit: -5 })).toEqual({ page: 1, limit: 1, skip: 0 });
    expect(pagination({ limit: 500 })).toMatchObject({ limit: 200 });
  });

  it('applies filters before pagination, escapes search text, and retains real totals', async () => {
    db.aggregate.mockResolvedValue([{ data: [{ id: 'product-21' }], count: [{ total: 45 }] }]);
    const result = await getInventory({ page: 2, limit: 20, q: 'Oil (5L)', stockStatus: 'reorder-level', minQty: '0', maxQty: '4', ageing: 'dead', sort: 'inventory.quantity', order: 'desc' });
    const pipeline = db.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match['inventory.quantity']).toEqual({ $gte: 0, $lte: 4 });
    expect(pipeline[0].$match.$or[0].productCode.$regex).toBe('Oil \\(5L\\)');
    expect(pipeline[3]).toEqual({ $match: { stockStatus: 'Re-order Level', ageing: { $gt: 240 } } });
    expect(pipeline.at(-1).$facet.data[1]).toEqual({ $skip: 20 });
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
    expect(result.data).toEqual([{ id: 'product-21' }]);
  });

  it('rejects malformed numeric filters', () => {
    expect(() => inventoryPipeline({ minPrice: 'abc' })).toThrow('minPrice must be a number');
  });
});

it('calculates stock values and ageing boundaries from real quantities, without counting empty stock as dead stock', () => {
  const item = (quantity: number, minimumLevel: number, ageing: number) => ({ inventory: { quantity, minimumLevel }, pricing: { costPrice: 10 }, ageing });
  const result = summarizeInventory([item(0, 2, 300), item(2, 2, 119), item(4, 2, 120), item(10, 2, 240), item(3, 1, 241)]);
  expect(result.stats).toEqual({ uniquePartNos: 5, totalStockItems: 19, stockValue: 190, lowStock: 1, outOfStock: 1, reorderItems: 1, deadStockCount: 1, deadStockValue: 30 });
  expect(result.insights).toEqual({ lessThan120Days: 1, between120And240Days: 2, greaterThan240Days: 2, deadStockCount: 1, deadStockValue: 30 });
});
