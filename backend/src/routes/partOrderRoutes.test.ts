import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ product: vi.fn(), vendors: vi.fn(), findOrder: vi.fn(), create: vi.fn(), update: vi.fn(), addStock: vi.fn(), end: vi.fn(), session: { withTransaction: vi.fn() } }));
vi.mock('express', () => ({ default: { Router: () => ({ use: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }) } }));
vi.mock('../models/Product.js', () => ({ default: { findOne: mocks.product, aggregate: mocks.vendors } }));
vi.mock('../models/PartOrder.js', () => ({ default: { findOneAndUpdate: mocks.update, findOne: mocks.findOrder, create: mocks.create } }));
vi.mock('../services/stockService.js', () => ({ addStock: mocks.addStock }));
vi.mock('../middleware/auth.js', () => ({ protect: (_req, _res, next) => next(), authorize: () => (_req, _res, next) => next() }));
vi.mock('mongoose', () => ({ default: { isValidObjectId: value => /^[a-f\d]{24}$/i.test(String(value)), startSession: async () => ({ ...mocks.session, endSession: mocks.end }) } }));
import { prepareOrder, previewBulk, receiveOrder, saveBulkOrder, deleteBulkOrder } from './partOrderRoutes.js';
import { prepareBulkOrder } from '../services/bulkOrderService.js';
const productId = '507f1f77bcf86cd799439011';
const input = () => ({ vendorName: ' Parts vendor ', items: [{ productId, quantity: 2, unitPrice: 120 }] });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.product.mockResolvedValue({ _id: productId, productName: 'Brake Pad', productCode: 'BP-1', vehicleType: '2W', partType: 'OEM' });
  mocks.session.withTransaction.mockImplementation(async work => work());
  mocks.vendors.mockResolvedValue([]);
  mocks.create.mockImplementation(async data => ({ toObject: () => ({ _id: productId, ...data }) }));
});
describe('part order validation', () => {
  it('snapshots inventory identity and calculates value from validated lines', async () => {
    const order = await prepareOrder(input());
    expect(order.vendorName).toBe('Parts vendor');
    expect(order.totalAmount).toBe(240);
    expect(order.items[0]).toMatchObject({ partNumber: 'BP-1', partName: 'Brake Pad', quantity: 2 });
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid quantity %s', async quantity => {
    const data = input(); data.items[0].quantity = quantity;
    await expect(prepareOrder(data)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects missing inventory parts and invalid delivery dates', async () => {
    mocks.product.mockResolvedValueOnce(null);
    await expect(prepareOrder(input())).rejects.toMatchObject({ statusCode: 400 });
    await expect(prepareOrder({ ...input(), expectedDelivery: 'invalid' })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('validates CSV rows independently and retains row numbers', async () => {
    const rows = await previewBulk('vendorName,partNumber,quantity,unitPrice\n"Parts, Ltd",BP-1,2,120\nVendor,BP-1,-1,120');
    expect(rows[0]).toMatchObject({ rowNumber: 2, error: '', data: { vendorName: 'Parts, Ltd', totalAmount: 240 } });
    expect(rows[1].error).toContain('Quantity');
  });
});
describe('receiving orders', () => {
  const request = () => ({ params: { id: productId }, user: { _id: 'employee' } });
  it('claims only pending orders and writes stock history in the same session', async () => {
    mocks.update.mockResolvedValue({ items: [{ productId, quantity: 2, unitPrice: 120 }], vendorName: 'Vendor', orderNumber: 'PO-1', notes: '', toObject: () => ({ _id: productId }) });
    const response = { json: vi.fn() };
    await receiveOrder(request(), response);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ _id: productId, status: 'Pending', isDraft: { $ne: true }, deletedAt: null }), expect.anything(), expect.objectContaining({ session: expect.anything() }));
    expect(mocks.addStock).toHaveBeenCalledWith(expect.objectContaining({ productId, quantity: 2, employeeId: 'employee', transactionType: 'Purchase', reference: { type: 'Vendor', number: 'PO-1' } }), expect.objectContaining({ session: expect.anything() }));
    expect(mocks.end).toHaveBeenCalled();
  });
  it('rejects a duplicate receipt without changing stock', async () => {
    mocks.update.mockResolvedValue(null);
    await expect(receiveOrder(request(), { json: vi.fn() })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.addStock).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalled();
  });
  it('does not fall back to unsafe stock updates on standalone MongoDB', async () => {
    mocks.session.withTransaction.mockRejectedValue(new Error('Transaction numbers are only allowed on a replica set member or mongos'));
    await expect(receiveOrder(request(), { json: vi.fn() })).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.addStock).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalled();
  });
  it('propagates a stock write failure and never returns a successful receipt', async () => {
    mocks.update.mockResolvedValue({ items: [{ productId, quantity: 2, unitPrice: 120 }], vendorName: 'Vendor', orderNumber: 'PO-1', toObject: () => ({ _id: productId }) });
    mocks.addStock.mockRejectedValueOnce(new Error('Stock history write failed'));
    const response = { json: vi.fn() };
    await expect(receiveOrder(request(), response)).rejects.toThrow('Stock history write failed');
    expect(response.json).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalled();
  });
});

describe('bulk drafts and purchase invoices', () => {
  const body = (intent = 'finalize') => ({ intent, orderDate: '2026-10-05', items: [{ productId, quantity: 5, unitPrice: 100, discountType: 'Percentage', discountValue: 10, taxPercent: 18 }] });
  const request = (intent = 'finalize') => ({ params: {}, body: body(intent), user: { _id: 'employee' } });
  const response = () => { const res: any = { json: vi.fn() }; res.status = vi.fn(() => res); return res; };
  it('saves a draft with optional vendor, calculated totals and no invoice', async () => {
    await saveBulkOrder(request('draft'), response());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ isDraft: true, vendorId: null, invoice: null, subtotal: 500, discountTotal: 50, taxAmount: 81, totalAmount: 531, createdBy: 'employee' }));
    expect(mocks.addStock).not.toHaveBeenCalled();
  });
  it('finalizes and persists the invoice together with the order without changing stock', async () => {
    await saveBulkOrder(request(), response());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ isDraft: false, invoice: expect.objectContaining({ documentTitle: 'PURCHASE INVOICE', totalAmount: 531, items: [expect.objectContaining({ partNumber: 'BP-1', totalAmount: 531 })] }) }));
    expect(mocks.addStock).not.toHaveBeenCalled();
  });
  it('rejects delivery before order date, duplicate parts and missing rate', async () => {
    await expect(prepareBulkOrder({ ...body(), expectedDelivery: '2026-10-04' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(prepareBulkOrder({ ...body(), items: [body().items[0], body().items[0]] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(prepareBulkOrder({ ...body(), items: [{ ...body().items[0], unitPrice: '' }] })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('uses a supplier snapshot from the vendor adapter', async () => {
    mocks.vendors.mockResolvedValue([{ _id: { name: 'Supplier', phone: '123' }, supplierId: productId }]);
    const data = await prepareBulkOrder({ ...body(), vendorId: productId });
    expect(data).toMatchObject({ vendorId: productId, vendorName: 'Supplier', vendorPhone: '123' });
  });
  it('preserves an existing snapshot when its source vendor has been removed', async () => {
    const data = await prepareBulkOrder({ ...body(), vendorId: productId, vendorName: 'Archived supplier' }, { vendorId: productId, vendorName: 'Archived supplier', vendorPhone: '123' });
    expect(data.vendorName).toBe('Archived supplier');
  });
  it('rejects stale edits and never recreates a finalized order as draft', async () => {
    mocks.findOrder.mockResolvedValue({ _id: productId, status: 'Pending', isDraft: false, invoice: { invoiceNumber: 'PI-1' } });
    const req: any = request('draft'); req.params.id = productId; req.body.version = 0;
    await expect(saveBulkOrder(req, response())).rejects.toMatchObject({ statusCode: 409 });
    req.body.intent = 'finalize'; mocks.update.mockResolvedValue(null);
    await expect(saveBulkOrder(req, response())).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ __v: 0, status: 'Pending' }), expect.objectContaining({ $inc: { __v: 1 }, $set: expect.objectContaining({ invoice: expect.objectContaining({ invoiceNumber: 'PI-1' }) }) }), expect.anything());
  });
  it('deletes only pending bulk orders and retains their data', async () => {
    mocks.update.mockResolvedValue({});
    await deleteBulkOrder({ params: { id: productId } }, response());
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ bulk: true, status: 'Pending', deletedAt: null }), expect.objectContaining({ $set: { deletedAt: expect.any(Date) } }), expect.anything());
    mocks.update.mockResolvedValue(null);
    await expect(deleteBulkOrder({ params: { id: productId } }, response())).rejects.toMatchObject({ statusCode: 409 });
  });
});
