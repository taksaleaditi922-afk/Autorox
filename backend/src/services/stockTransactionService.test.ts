import { beforeEach, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ findById: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock('../models/Product.js', () => ({ default: { findById: db.findById } }));
vi.mock('../models/StockTransaction.js', () => ({ default: { create: db.create } }));
vi.mock('mongoose', () => ({ default: { connection: { transaction: db.transaction } } }));
import { createStockTransaction } from './stockTransactionService.js';
import { updateStock } from './productService.js';

let product: any;
const session = { id: 'transaction-session' };
beforeEach(() => {
  vi.clearAllMocks();
  product = { _id: 'part', isActive: true, inventory: { quantity: 10, minimumLevel: 1 }, pricing: { costPrice: 25 }, save: vi.fn(), toSafeJSON() { return { id: this._id, inventory: this.inventory }; } };
  db.findById.mockReturnValue({ session: vi.fn().mockResolvedValue(product) });
  db.create.mockResolvedValue([{ toSafeJSON: () => ({ id: 'movement', stockBefore: 10, stockAfter: 7 }) }]);
  db.transaction.mockImplementation(async fn => {
    const previous = product.inventory.quantity;
    try { return await fn(session); }
    catch (error) { product.inventory.quantity = previous; throw error; }
  });
});

it('updates stock and records before/after quantities in the same transaction', async () => {
  const result = await createStockTransaction({ productId: 'part', transactionType: 'Issued', quantity: -3 }, { _id: 'user' });
  expect(product.inventory.quantity).toBe(7);
  expect(product.save).toHaveBeenCalledWith({ session });
  expect(db.create).toHaveBeenCalledWith([expect.objectContaining({ productId: 'part', quantity: -3, stockBefore: 10, stockAfter: 7, recordedBy: 'user', unitCost: 25 })], { session });
  expect(result.data.id).toBe('movement');
});

it('rejects insufficient stock before changing or logging anything', async () => {
  await expect(createStockTransaction({ productId: 'part', transactionType: 'Issued', quantity: -11 }, {})).rejects.toMatchObject({ statusCode: 400 });
  expect(product.save).not.toHaveBeenCalled();
  expect(db.create).not.toHaveBeenCalled();
});

it.each([['Inward', -2], ['Issued', 2], ['Purchase Return', 2], ['Adjustment', 0], ['Adjustment', 'abc'], ['Unknown', 1]])('rejects invalid %s movement %s', async (transactionType, quantity) => {
  await expect(createStockTransaction({ productId: 'part', transactionType, quantity }, {})).rejects.toMatchObject({ statusCode: 400 });
  expect(db.transaction).not.toHaveBeenCalled();
});

it('propagates history-save failure so the database transaction rolls back', async () => {
  db.create.mockRejectedValue(new Error('History write failed'));
  await expect(createStockTransaction({ productId: 'part', transactionType: 'Inward', quantity: 5 }, {})).rejects.toThrow('History write failed');
  expect(product.inventory.quantity).toBe(10);
});

it('records an auditable adjustment for an absolute stock edit', async () => {
  await updateStock({ id: 'part' }, { quantity: 4 }, { _id: 'user' });
  expect(db.create).toHaveBeenCalledWith([expect.objectContaining({ transactionType: 'Adjustment', quantity: -6, stockBefore: 10, stockAfter: 4 })], { session });
  expect(product.save).toHaveBeenCalledWith({ session });
});
