import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import PartOrder from '../models/PartOrder.js';
import Product from '../models/Product.js';
import { protect, authorize } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { addStock } from '../services/stockService.js';
import { parseInventoryCsv } from '../services/inventoryCsvService.js';
import { createPurchaseInvoice, listOrderVendors, prepareBulkOrder } from '../services/bulkOrderService.js';
const router = (express as any).Router();
router.use(protect);
const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const paging = (q) => ({ page: Math.max(1, Number.parseInt(q.page) || 1), limit: Math.max(1, Math.min(100, Number.parseInt(q.limit) || 10)) });
const present = (order) => ({ ...order, id: String(order._id) });
router.get('/summary', asyncHandler(async (_req, res) => {
  const [data] = await PartOrder.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: null,
    total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
    completed: { $sum: { $cond: [{ $eq: ['$status', 'Received'] }, 1, 0] } },
    value: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'Cancelled'] }, { $ne: ['$isDraft', true] }] }, '$totalAmount', 0] } },
  } }]);
  res.json({ data: data || { total: 0, pending: 0, completed: 0, value: 0 } });
}));
router.get('/suggestions', asyncHandler(async (req, res) => {
  const { page, limit } = paging(req.query);
  const filter: any = { isActive: true, deletedAt: null, $expr: { $lt: ['$inventory.quantity', '$inventory.minimumLevel'] } };
  if (req.query.q) filter.$or = ['productName', 'productCode'].map(key => ({ [key]: { $regex: escape(req.query.q), $options: 'i' } }));
  const [data, total] = await Promise.all([Product.find(filter).sort({ productName: 1 }).skip((page - 1) * limit).limit(limit), Product.countDocuments(filter)]);
  res.json({ data: data.map(p => ({ ...p.toObject(), id: String(p._id), suggestedQuantity: Math.max(0, p.inventory.minimumLevel - p.inventory.quantity) })), pagination: { total, page, limit } });
}));
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = paging(req.query);
  const filter: any = { deletedAt: null };
  if (req.query.status && req.query.status !== 'All') {
    if (!['Pending', 'Received', 'Cancelled'].includes(String(req.query.status))) throw new ApiError(400, 'Invalid status');
    filter.status = req.query.status;
  }
  if (req.query.bulk === 'true') filter.bulk = true;
  if (req.query.q) filter.$or = ['orderNumber', 'vendorName', 'customerName', 'items.partName', 'items.partNumber'].map(key => ({ [key]: { $regex: escape(req.query.q), $options: 'i' } }));
  const sortFields = ['orderNumber', 'vendorName', 'items.partName', 'items.partNumber', 'customerName', 'orderDate', 'expectedDelivery', 'status'];
  const sort = sortFields.includes(String(req.query.sort)) ? String(req.query.sort) : 'orderDate';
  const [data, total] = await Promise.all([PartOrder.find(filter).sort({ [sort]: req.query.direction === 'asc' ? 1 : -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), PartOrder.countDocuments(filter)]);
  res.json({ data: data.map(present), pagination: { total, page, limit } });
}));
router.get('/vendors', asyncHandler(async (_req, res) => res.json({ data: await listOrderVendors() })));
router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid order');
  const order = await PartOrder.findOne({ _id: req.params.id, deletedAt: null }).lean();
  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ data: present(order) });
}));
router.use(authorize('Admin', 'Service Manager'));
export const saveBulkOrder = async (req, res) => {
  if (req.params.id) {
    if (!mongoose.isValidObjectId(req.params.id) || !Number.isInteger(req.body.version)) throw new ApiError(400, 'Invalid order or version. Refresh before editing.');
    const current = await PartOrder.findOne({ _id: req.params.id, bulk: true, deletedAt: null });
    if (!current || current.status !== 'Pending') throw new ApiError(409, 'Only pending orders can be edited');
    const data: any = await prepareBulkOrder(req.body, current);
    if (!current.isDraft && data.isDraft) throw new ApiError(409, 'A finalized order cannot become a draft');
    data.invoice = data.isDraft ? null : createPurchaseInvoice(data, current.invoice?.invoiceNumber);
    data.finalizedAt = data.isDraft ? null : current.finalizedAt || new Date();
    const order = await PartOrder.findOneAndUpdate({ _id: current._id, status: 'Pending', deletedAt: null, __v: req.body.version }, { $set: data, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!order) throw new ApiError(409, 'This order changed. Refresh before editing.');
    return res.json({ data: present(order.toObject()) });
  }
  const data: any = await prepareBulkOrder(req.body);
  data.invoice = data.isDraft ? null : createPurchaseInvoice(data);
  data.finalizedAt = data.isDraft ? null : new Date();
  const order = await PartOrder.create({ ...data, orderNumber: `PO-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`, createdBy: req.user._id });
  res.status(201).json({ data: present(order.toObject()) });
};
router.post('/bulk-order', asyncHandler(saveBulkOrder));
router.put('/bulk-order/:id', asyncHandler(saveBulkOrder));
export const deleteBulkOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid order');
  const order = await PartOrder.findOneAndUpdate({ _id: req.params.id, bulk: true, status: 'Pending', deletedAt: null }, { $set: { deletedAt: new Date() }, $inc: { __v: 1 } }, { new: true });
  if (!order) throw new ApiError(409, 'Only pending bulk orders can be deleted');
  res.json({ success: true });
};
router.delete('/bulk-order/:id', asyncHandler(deleteBulkOrder));
export const previewBulk = async (csv) => {
  const entries = parseInventoryCsv(csv);
  if (!entries.length || entries.length > 100) throw new ApiError(400, 'Upload between 1 and 100 CSV rows');
  const rows = [];
  for (const entry of entries) {
    try {
      if (!entry.data.partNumber || !entry.data.quantity || entry.data.unitPrice === '') throw new ApiError(400, 'partNumber, quantity and unitPrice are required');
      const product = await Product.findOne({ productCode: entry.data.partNumber, isActive: true, deletedAt: null });
      if (!product) throw new ApiError(400, 'Part number not found in Inventory');
      const data = await prepareOrder({ ...entry.data, items: [{ productId: product._id, quantity: entry.data.quantity, unitPrice: entry.data.unitPrice }] });
      rows.push({ rowNumber: entry.rowNumber, data, error: '' });
    } catch (error) { rows.push({ rowNumber: entry.rowNumber, data: entry.data, error: error.message }); }
  }
  return rows;
};
router.post('/bulk/preview', asyncHandler(async (req, res) => res.json({ data: await previewBulk(req.body.csv) })));
router.post('/bulk', asyncHandler(async (req, res) => {
  const rows = await previewBulk(req.body.csv);
  if (rows.some(row => row.error)) throw new ApiError(400, 'Fix all CSV errors before importing');
  const data = await PartOrder.insertMany(rows.map(row => ({ ...row.data, orderNumber: `PO-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`, createdBy: req.user._id, bulk: true })));
  res.status(201).json({ data: data.map(order => present(order.toObject())) });
}));
export const prepareOrder = async (body) => {
  const vendorName = String(body.vendorName || '').trim();
  if (!vendorName || vendorName.length > 200) throw new ApiError(400, 'Vendor name is required (up to 200 characters)');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new ApiError(400, 'Provide between 1 and 100 order lines');
  const items = [];
  for (const line of body.items) {
    if (!mongoose.isValidObjectId(line.productId)) throw new ApiError(400, 'Choose a valid Inventory part');
    const quantity = Number(line.quantity), unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new ApiError(400, 'Quantity must be positive and price must be non-negative');
    const product = await Product.findOne({ _id: line.productId, isActive: true, deletedAt: null });
    if (!product) throw new ApiError(400, 'An Inventory part is unavailable');
    items.push({ productId: product._id, partName: product.productName, partNumber: product.productCode, vehicleType: product.vehicleType, partType: product.partType, quantity, unitPrice });
  }
  const expectedDelivery = body.expectedDelivery ? new Date(body.expectedDelivery) : undefined;
  if (expectedDelivery && Number.isNaN(expectedDelivery.getTime())) throw new ApiError(400, 'Invalid delivery date');
  const totalAmount = items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (!Number.isFinite(totalAmount)) throw new ApiError(400, 'Order value is too large');
  return { vendorName, vendorPhone: String(body.vendorPhone || '').trim(), customerName: String(body.customerName || '').trim(), notes: String(body.notes || '').trim(), expectedDelivery, items, totalAmount };
};
router.post('/', asyncHandler(async (req, res) => {
  const data = await prepareOrder(req.body);
  const order = await PartOrder.create({ ...data, orderNumber: `PO-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`, createdBy: req.user._id, bulk: req.body.bulk === true });
  res.status(201).json({ data: present(order.toObject()) });
}));
router.put('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid order');
  const data = await prepareOrder(req.body);
  const order = await PartOrder.findOneAndUpdate({ _id: req.params.id, status: 'Pending', bulk: false, deletedAt: null }, { $set: data }, { new: true, runValidators: true });
  if (!order) throw new ApiError(409, 'Only pending orders can be edited');
  res.json({ data: present(order.toObject()) });
}));
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid order');
  const order = await PartOrder.findOneAndUpdate({ _id: req.params.id, status: 'Pending', deletedAt: null }, { $set: { status: 'Cancelled' }, $inc: { __v: 1 } }, { new: true });
  if (!order) throw new ApiError(409, 'Only pending orders can be cancelled');
  res.json({ data: present(order.toObject()) });
}));
export const receiveOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid order');
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await PartOrder.findOneAndUpdate({ _id: req.params.id, status: 'Pending', isDraft: { $ne: true }, deletedAt: null }, { $set: { status: 'Received', receivedDate: new Date(), receivedBy: req.user._id }, $inc: { __v: 1 } }, { new: true, session });
      if (!order) throw new ApiError(409, 'This order has already been received or cancelled');
      for (const item of order.items) await addStock({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, transactionType: 'Purchase', reason: 'purchase', reference: { type: order.vendorName, number: order.orderNumber }, note: order.notes, employeeId: req.user._id }, { session });
      result = present(order.toObject());
    });
  } catch (error) {
    if (/Transaction numbers are only allowed|replica set|mongos/i.test(String(error.message))) throw new ApiError(503, 'Receiving orders requires MongoDB transactions. Configure a replica set, then retry. No stock was changed.');
    throw error;
  } finally { await session.endSession(); }
  res.json({ data: result });
};
router.post('/:id/receive', asyncHandler(receiveOrder));
export default router;
