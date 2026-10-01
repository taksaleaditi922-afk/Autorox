import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ quantity: 0, movements: [] as any[] }));
const productId = '507f1f77bcf86cd799439011';

vi.mock('mongoose', () => ({
  default: {
    isValidObjectId: (value: string) => /^[a-f\d]{24}$/i.test(value),
  },
}));

const productDocument = (quantity: number) => ({
  _id: productId,
  productCode: 'BP-100',
  productName: 'Brake Pad',
  inventory: { quantity, minimumLevel: 5 },
  pricing: { costPrice: 100, sellingPrice: 150 },
});

vi.mock('../models/Product.js', () => ({
  default: {
    findOneAndUpdate: vi.fn(async (query, update) => {
      const required = query['inventory.quantity']?.$gte;
      if (required != null && state.quantity < required) return null;
      const before = productDocument(state.quantity);
      state.quantity += update.$inc['inventory.quantity'];
      return before;
    }),
    findOne: vi.fn(() => ({ session: async () => productDocument(state.quantity) })),
    findById: vi.fn(() => ({ session: async () => productDocument(state.quantity) })),
  },
}));

vi.mock('../models/StockTransaction.js', () => ({
  default: {
    find: vi.fn(() => ({ sort: () => ({ session: async () => [] }) })),
    create: vi.fn(async (docs) => {
      const movement = { ...docs[0], toSafeJSON: () => docs[0] };
      state.movements.push(movement);
      return [movement];
    }),
  },
}));

import { applyStockChangeInSession, STOCK_CHANGE_TYPES } from './stockService.js';

describe('stockService', () => {
  beforeEach(() => {
    state.quantity = 10;
    state.movements.length = 0;
  });

  it('adds stock and writes a positive movement', async () => {
    const result = await applyStockChangeInSession({
      productId,
      changeType: STOCK_CHANGE_TYPES.ADD,
      quantity: 5,
      unitPrice: 120,
    }, {});

    expect(state.quantity).toBe(15);
    expect(result.movement.quantity).toBe(5);
    expect(result.movement.stockAfter).toBe(15);
  });

  it('reduces stock and writes a negative movement', async () => {
    const result = await applyStockChangeInSession({
      productId,
      changeType: STOCK_CHANGE_TYPES.REDUCE,
      quantity: 4,
      reason: 'damage',
    }, {});

    expect(state.quantity).toBe(6);
    expect(result.movement.quantity).toBe(-4);
    expect(result.movement.stockAfter).toBe(6);
  });

  it('rejects a reduction below zero', async () => {
    state.quantity = 3;

    await expect(applyStockChangeInSession({
      productId,
      changeType: STOCK_CHANGE_TYPES.REDUCE,
      quantity: 4,
    }, {})).rejects.toThrow('Reduction exceeds available stock of 3');

    expect(state.quantity).toBe(3);
    expect(state.movements).toHaveLength(0);
  });

  it('allows only one conflicting concurrent reduction', async () => {
    state.quantity = 5;
    const request = () => applyStockChangeInSession({
      productId,
      changeType: STOCK_CHANGE_TYPES.REDUCE,
      quantity: 4,
      reason: 'sale',
    }, {});

    const results = await Promise.allSettled([request(), request()]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(state.quantity).toBe(1);
    expect(state.movements).toHaveLength(1);
  });
});
