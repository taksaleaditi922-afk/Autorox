import Product from '../models/Product.js';
import StockTransaction from '../models/StockTransaction.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import ApiError from '../utils/ApiError.js';

type Filters = Record<string, any>;
const numeric = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const escapeSearch = (value: unknown) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function pagination(filters: Filters = {}) {
  const page = Math.max(1, Math.floor(numeric(filters.page, 1)));
  const limit = Math.max(1, Math.min(200, Math.floor(numeric(filters.limit, 20))));
  return { page, limit, skip: (page - 1) * limit };
}

export function inventoryPipeline(filters: Filters = {}): any[] {
  const match: Filters = { isActive: true };
  if (filters.q) match.$or = ['productCode', 'productName', 'brand', 'category', 'barcode', 'inventory.location'].map(field => ({ [field]: { $regex: escapeSearch(filters.q), $options: 'i' } }));
  for (const [key, field] of Object.entries({ category: 'category', brand: 'brand', location: 'inventory.location' })) {
    if (filters[key]) match[field] = filters[key];
  }
  if (filters.workshopId) match.$and = [{ $or: [{ 'inventory.workshopId': filters.workshopId }, { 'inventory.workshopName': filters.workshopId }] }];
  for (const [min, max, field] of [['minPrice', 'maxPrice', 'pricing.costPrice'], ['minQty', 'maxQty', 'inventory.quantity']]) {
    const range: Filters = {};
    if (filters[min] !== undefined && filters[min] !== '') {
      if (!Number.isFinite(Number(filters[min]))) throw new ApiError(400, `${min} must be a number`);
      range.$gte = Number(filters[min]);
    }
    if (filters[max] !== undefined && filters[max] !== '') {
      if (!Number.isFinite(Number(filters[max]))) throw new ApiError(400, `${max} must be a number`);
      range.$lte = Number(filters[max]);
    }
    if (Object.keys(range).length) match[field] = range;
  }
  const computed: Filters = {};
  const status = filters.stockStatus;
  if (status === 'out-of-stock' || filters.outOfStock === 'true') computed.stockStatus = 'Out of Stock';
  else if (status === 'reorder-level' || filters.reorderLevel === 'true') computed.stockStatus = 'Re-order Level';
  else if (status === 'in-stock' || filters.inStock === 'true') computed.stockStatus = 'In Stock';
  if (filters.ageing === 'fresh') computed.ageing = { $lt: 120 };
  if (filters.ageing === 'ageing') computed.ageing = { $gte: 120, $lte: 240 };
  if (filters.ageing === 'dead') computed.ageing = { $gt: 240 };
  return [
    { $match: match },
    { $addFields: {
      id: { $toString: '$_id' },
      inventoryValue: { $multiply: ['$inventory.quantity', '$pricing.costPrice'] },
      'pricing.taxAmount': { $divide: [{ $multiply: ['$pricing.sellingPrice', '$pricing.tax'] }, 100] },
      lastMovementDate: { $ifNull: ['$lastMovementDate', { $ifNull: ['$updatedAt', '$createdAt'] }] },
      stockStatus: { $cond: [{ $lte: ['$inventory.quantity', 0] }, 'Out of Stock', { $cond: [{ $lte: ['$inventory.quantity', '$inventory.minimumLevel'] }, 'Re-order Level', 'In Stock'] }] },
    } },
    { $addFields: { ageing: { $max: [0, { $floor: { $divide: [{ $subtract: ['$$NOW', '$lastMovementDate'] }, 86400000] } }] } } },
    ...(Object.keys(computed).length ? [{ $match: computed }] : []),
  ];
}

export async function getInventory(filters: Filters = {}) {
  const { page, limit, skip } = pagination(filters);
  const sortable = ['productCode', 'productName', 'category', 'inventory.quantity', 'inventory.minimumLevel', 'pricing.costPrice', 'pricing.sellingPrice', 'pricing.tax', 'pricing.taxAmount', 'inventoryValue', 'inventory.location', 'ageing', 'lastPurchaseDate', 'lastMovementDate'];
  const sort = sortable.includes(filters.sort) ? filters.sort : 'productName';
  const [result] = await Product.aggregate([...inventoryPipeline(filters), { $facet: {
    data: [{ $sort: { [sort]: filters.order === 'desc' ? -1 : 1, _id: 1 } }, { $skip: skip }, { $limit: limit }],
    count: [{ $count: 'total' }],
  } }]);
  const total = result.count[0]?.total || 0;
  return { success: true, data: result.data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export function summarizeInventory(items: any[]) {
  const stats = { uniquePartNos: items.length, totalStockItems: 0, stockValue: 0, lowStock: 0, outOfStock: 0, reorderItems: 0, deadStockValue: 0, deadStockCount: 0 };
  const insights = { lessThan120Days: 0, between120And240Days: 0, greaterThan240Days: 0, deadStockCount: 0, deadStockValue: 0 };
  for (const item of items) {
    const qty = numeric(item.inventory?.quantity), min = numeric(item.inventory?.minimumLevel);
    const value = qty * numeric(item.pricing?.costPrice);
    stats.totalStockItems += qty;
    stats.stockValue += value;
    if (qty <= 0) stats.outOfStock++;
    else if (qty <= min) stats.reorderItems++;
    else if (qty <= min * 2) stats.lowStock++;
    if (item.ageing < 120) insights.lessThan120Days++;
    else if (item.ageing <= 240) insights.between120And240Days++;
    else {
      insights.greaterThan240Days++;
      if (qty > 0) { stats.deadStockCount++; stats.deadStockValue += value; }
    }
  }
  stats.stockValue = Math.round(stats.stockValue * 100) / 100;
  stats.deadStockValue = Math.round(stats.deadStockValue * 100) / 100;
  insights.deadStockCount = stats.deadStockCount;
  insights.deadStockValue = stats.deadStockValue;
  return { stats, insights };
}

export async function getStats() {
  return { success: true, data: summarizeInventory(await Product.aggregate(inventoryPipeline())).stats };
}

export async function getInsights() {
  return { success: true, data: summarizeInventory(await Product.aggregate(inventoryPipeline())).insights };
}

export async function getAlerts() {
  const items = await Product.find({ isActive: true, $expr: { $lte: ['$inventory.quantity', { $multiply: ['$inventory.minimumLevel', 2] }] } }).sort('inventory.quantity').lean();
  return { success: true, data: items.map(item => ({
    id: String(item._id), productCode: item.productCode, productName: item.productName,
    category: item.category || '', quantity: item.inventory.quantity, minimumLevel: item.inventory.minimumLevel,
    location: item.inventory.location, createdAt: item.updatedAt,
    type: item.inventory.quantity <= 0 ? 'out-of-stock' : item.inventory.quantity <= item.inventory.minimumLevel ? 'reorder-level' : 'low-stock',
  })) };
}

export async function getOrders(filters: Filters = {}) {
  const { page, limit, skip } = pagination(filters);
  const [data, total] = await Promise.all([PurchaseOrder.find().sort('-orderDate').skip(skip).limit(limit).lean(), PurchaseOrder.countDocuments()]);
  return { success: true, data: data.map(row => ({ ...row, id: String(row._id) })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getMovementRecords(type: 'Inward' | 'Issued' | 'Purchase Return', filters: Filters = {}) {
  const { page, limit, skip } = pagination(filters);
  const match = { transactionType: type === 'Issued' ? { $in: ['Issued', 'Sale'] } : type };
  const [rows, total] = await Promise.all([
    StockTransaction.find(match).populate('productId').populate('recordedBy', 'username email').sort('-createdAt').skip(skip).limit(limit).lean(),
    StockTransaction.countDocuments(match),
  ]);
  const data = rows.map((row: any) => {
    const id = String(row._id), date = row.recordedAt || row.createdAt;
    const common = { id, itemsCount: 1, createdAt: row.createdAt, notes: row.notes };
    const vendorName = row.productId?.supplier?.supplierName || '';
    const totalAmount = Math.abs(row.quantity) * (row.unitCost ?? row.productId?.pricing?.costPrice ?? 0);
    if (type === 'Inward') return { ...common, inwardNumber: `IN-${id.slice(-8)}`, vendorName, receivedDate: date, invoiceNumber: row.reference?.number, totalAmount, status: 'Completed' };
    if (type === 'Purchase Return') return { ...common, returnNumber: `PR-${id.slice(-8)}`, vendorName, returnDate: date, orderNumber: row.reference?.number, totalAmount, status: 'Received', reason: row.notes };
    return { ...common, issueNumber: `OUT-${id.slice(-8)}`, issueDate: date, issuedTo: row.reference?.number || row.recordedBy?.username || row.recordedBy?.email || '', issueType: row.reference?.type === 'Job Card' ? 'Job' : 'Internal', referenceNumber: row.reference?.number, totalQuantity: Math.abs(row.quantity) };
  });
  return { success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
