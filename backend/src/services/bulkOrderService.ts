import { randomUUID } from 'node:crypto';
import { calculateOrderLine, calculateOrderTotals } from '../../../shared/partOrderPricing.mjs';
import ApiError from '../utils/ApiError.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';
export const VENDOR_REQUIRED = false; // Switch when the full Vendor module is available.
const isoDate = (value, label) => {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(value)) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== String(value).slice(0, 10)) throw new ApiError(400, `Invalid ${label}`);
  return date;
};
// Supplier snapshots are the current source; replace this adapter with the Vendor module later.
export const listOrderVendors = async () => {
  const data = await Product.aggregate([
    { $match: { isActive: true, deletedAt: null, 'supplier.supplierName': { $exists: true, $nin: ['', null] } } },
    { $group: { _id: { name: '$supplier.supplierName', phone: '$supplier.supplierPhone' }, supplierId: { $first: '$supplier.supplierId' } } },
    { $sort: { '_id.name': 1 } },
  ]);
  return data.map(v => ({ id: v.supplierId ? String(v.supplierId) : `supplier:${encodeURIComponent(v._id.name)}:${encodeURIComponent(v._id.phone || '')}`, name: v._id.name, phone: v._id.phone || '', state: '', gstNumber: '' }));
};
export const prepareBulkOrder = async (body, previousVendor?: { vendorId?: string; vendorName?: string; vendorPhone?: string }) => {
  if (!['draft', 'finalize'].includes(body.intent)) throw new ApiError(400, 'Choose Save or Create Order');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new ApiError(400, 'Choose between 1 and 100 parts');
  const orderDate = isoDate(body.orderDate, 'order date');
  const expectedDelivery = body.expectedDelivery ? isoDate(body.expectedDelivery, 'estimated delivery') : null;
  if (expectedDelivery && expectedDelivery < orderDate) throw new ApiError(400, 'Estimated delivery must be on or after order date');
  let vendor: any = null;
  if (previousVendor && (body.vendorId || null) === (previousVendor.vendorId || null) && body.vendorName === previousVendor.vendorName) {
    vendor = { id: previousVendor.vendorId, name: previousVendor.vendorName, phone: previousVendor.vendorPhone };
  }
  if (body.vendorId && !vendor) {
    vendor = (await listOrderVendors()).find(v => v.id === body.vendorId);
    // Existing snapshots remain usable after their supplier is removed.
    if (!vendor) throw new ApiError(400, 'The selected vendor is unavailable. Choose another vendor or clear the selection.');
  }
  if (VENDOR_REQUIRED && !vendor) throw new ApiError(400, 'Vendor is required');
  const seen = new Set();
  const items = [];
  for (const line of body.items) {
    if (!mongoose.isValidObjectId(line.productId)) throw new ApiError(400, 'Choose a valid Inventory part');
    if (line.unitPrice === '' || line.unitPrice == null || line.quantity === '' || line.quantity == null) throw new ApiError(400, 'Rate and quantity are required');
    if (seen.has(String(line.productId))) throw new ApiError(400, 'A part may only appear once');
    seen.add(String(line.productId));
    const product = await Product.findOne({ _id: line.productId, isActive: true, deletedAt: null });
    if (!product) throw new ApiError(400, 'A selected Inventory part is unavailable');
    const item: any = { productId: product._id, partName: product.productName, partNumber: product.productCode, vehicleType: product.vehicleType, partType: product.partType, unit: product.inventory?.unit || 'Units', hsn: String(line.hsn || '').slice(0, 30), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxPercent: Number(line.taxPercent || 0), discountType: line.discountType || 'Percentage', discountValue: Number(line.discountValue || 0) };
    try { Object.assign(item, calculateOrderLine(item)); } catch (error) { throw new ApiError(400, error.message); }
    items.push(item);
  }
  const billDate = body.managePurchase && body.billDate ? isoDate(body.billDate, 'bill date') : null;
  return { vendorId: vendor?.id || null, vendorName: vendor?.name || '', vendorPhone: vendor?.phone || '', orderDate, expectedDelivery, items, ...calculateOrderTotals(items), managePurchase: body.managePurchase === true, billNumber: body.managePurchase ? String(body.billNumber || '').slice(0, 100) : '', billDate, bulk: true, isDraft: body.intent === 'draft' };
};
export const createPurchaseInvoice = (data, existingNumber?: string) => ({
  invoiceNumber: existingNumber || `PI-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
  documentTitle: 'PURCHASE INVOICE', generatedAt: new Date(), date: data.orderDate,
  vendor: { id: data.vendorId, name: data.vendorName, phone: data.vendorPhone },
  billNumber: data.billNumber, billDate: data.billDate,
  items: data.items.map(item => ({ ...item })),
  subtotal: data.subtotal, discountTotal: data.discountTotal, taxAmount: data.taxAmount, totalAmount: data.totalAmount,
});
