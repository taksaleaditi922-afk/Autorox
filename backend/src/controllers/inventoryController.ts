import Product from '../models/Product.js';
import StockTransaction from '../models/StockTransaction.js';
import asyncHandler from '../utils/asyncHandler.js';
import Settings from '../models/Settings.js';
import { addStock, reduceStock, runMongoTransaction } from '../services/stockService.js';
import * as inventoryService from '../services/inventoryService.js';
import {
  inventoryCsvTemplate, inventoryRowsToCsv, parseInventoryCsv, validateInventoryCsvRow,
} from '../services/inventoryCsvService.js';

const activeProductFilter = {
  isActive: true,
  deletedAt: null,
};

const inventoryFilter = (query, defaultThreshold) => {
  const filter: any = { ...activeProductFilter };
  if (query.q) {
    const q = String(query.q).trim();
    filter.$or = [
      { productName: { $regex: q, $options: 'i' } },
      { productCode: { $regex: q, $options: 'i' } },
      { barcode: { $regex: q, $options: 'i' } },
    ];
  }
  if (query.category) filter.category = query.category;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;
  if (query.partType) filter.partType = query.partType;
  if (query.location) filter['inventory.location'] = query.location;
  if (query.stockStatus === 'out-of-stock' || query.outOfStock === 'true') filter['inventory.quantity'] = 0;
  if (query.stockStatus === 'in-stock' || query.inStock === 'true') filter['inventory.quantity'] = { $gt: 0 };
  if (query.stockStatus === 'low-stock' || query.reorderLevel === 'true') {
    filter.$expr = {
      $and: [
        { $gt: [{ $ifNull: ['$inventory.quantity', 0] }, 0] },
        { $lte: [{ $ifNull: ['$inventory.quantity', 0] }, { $ifNull: ['$inventory.minimumLevel', defaultThreshold] }] },
      ],
    };
  }
  return filter;
};

// GET /api/inventory/stats
// These totals always cover the complete active inventory collection. They are
// intentionally independent of table search, filters and pagination.
export const getInventoryStats = asyncHandler(async (_req, res) => {
  const settings = await Settings.getSingleton();
  const defaultThreshold = settings.inventory?.lowStockThreshold ?? 5;
  const [stats = {}] = await Product.aggregate([
    { $match: activeProductFilter },
    {
      $group: {
        _id: null,
        uniquePartNos: { $sum: 1 },
        totalStockItems: { $sum: { $ifNull: ['$inventory.quantity', 0] } },
        purchaseValue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$inventory.quantity', 0] },
              { $ifNull: ['$pricing.costPrice', 0] },
            ],
          },
        },
        saleValue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$inventory.quantity', 0] },
              { $ifNull: ['$pricing.sellingPrice', 0] },
            ],
          },
        },
        outOfStock: {
          $sum: { $cond: [{ $eq: [{ $ifNull: ['$inventory.quantity', 0] }, 0] }, 1, 0] },
        },
        lowStock: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: [{ $ifNull: ['$inventory.quantity', 0] }, 0] },
                  {
                    $lte: [
                      { $ifNull: ['$inventory.quantity', 0] },
                      { $ifNull: ['$inventory.minimumLevel', defaultThreshold] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const purchaseValue = Number(stats.purchaseValue || 0);
  const lowStock = Number(stats.lowStock || 0);

  res.json({
    success: true,
    data: {
      uniquePartNos: Number(stats.uniquePartNos || 0),
      totalStockItems: Number(stats.totalStockItems || 0),
      purchaseValue,
      saleValue: Number(stats.saleValue || 0),
      // Legacy fields are retained for the current frontend contract.
      stockValue: purchaseValue,
      lowStock,
      outOfStock: Number(stats.outOfStock || 0),
      reorderItems: lowStock,
      deadStockValue: 0,
      deadStockCount: 0,
    },
  });
});

// GET /api/inventory/alerts
export const getInventoryAlerts = asyncHandler(async (_req, res) => {
  const settings = await Settings.getSingleton();
  const defaultThreshold = settings.inventory?.lowStockThreshold ?? 5;
  const products = await Product.find({
    ...activeProductFilter,
    $expr: {
      $lte: [
        { $ifNull: ['$inventory.quantity', 0] },
        { $ifNull: ['$inventory.minimumLevel', defaultThreshold] },
      ],
    },
  }).sort({ 'inventory.quantity': 1, productName: 1 });

  const data = products.map((product) => {
    const quantity = product.inventory?.quantity ?? 0;
    const minimumLevel = product.inventory?.minimumLevel ?? defaultThreshold;
    return {
      id: `alert-${product._id}`,
      productId: product._id,
      productCode: product.productCode,
      productName: product.productName,
      category: product.category || '',
      quantity,
      minimumLevel,
      location: product.inventory?.location || '',
      type: quantity === 0 ? 'out-of-stock' : 'low-stock',
      createdAt: product.updatedAt,
    };
  });

  res.json({ success: true, data, count: data.length });
});

// GET /api/inventory/options
export const getInventoryOptions = asyncHandler(async (_req, res) => {
  const match = { ...activeProductFilter };
  const [categories, locations, settings] = await Promise.all([
    Product.distinct('category', match),
    Product.distinct('inventory.location', match),
    Settings.getSingleton(),
  ]);
  res.json({
    success: true,
    data: {
      categories: categories.filter(Boolean).sort(),
      locations: locations.filter(Boolean).sort(),
      vehicleTypes: ['2W', '4W'],
      partTypes: ['OEM', 'Aftermarket', 'Other'],
      agedStockDays: settings.inventory?.agedStockDays ?? 90,
    },
  });
});

export const downloadInventoryTemplate = asyncHandler(async (_req, res) => {
  res.type('text/csv').attachment('inventory-sample-template.csv').send(inventoryCsvTemplate());
});

export const previewInventoryImport = asyncHandler(async (req, res) => {
  const parsed = parseInventoryCsv(req.body.csv);
  const partNumbers = parsed.map((entry) => String(entry.data.partNumber || '').trim()).filter(Boolean);
  const barcodes = parsed.map((entry) => String(entry.data.barcode || '').trim()).filter(Boolean);
  const existing = await Product.find({ $or: [{ productCode: { $in: partNumbers } }, { barcode: { $in: barcodes } }] }).select('productCode barcode').lean();
  const existingCodes = new Set(existing.map((product) => product.productCode));
  const barcodeOwners = new Map(existing.filter((product) => product.barcode).map((product) => [product.barcode, product.productCode]));
  const seenCodes = new Set<string>();
  const seenBarcodes = new Set<string>();

  const rows = parsed.map((entry) => {
    const errors = validateInventoryCsvRow(entry);
    const code = String(entry.data.partNumber || '').trim();
    const barcode = String(entry.data.barcode || '').trim();
    if (seenCodes.has(code)) errors.push('Duplicate part number in file');
    if (barcode && seenBarcodes.has(barcode)) errors.push('Duplicate barcode in file');
    if (barcode && barcodeOwners.has(barcode) && barcodeOwners.get(barcode) !== code) errors.push('Barcode already belongs to another part');
    seenCodes.add(code);
    if (barcode) seenBarcodes.add(barcode);
    return {
      ...entry,
      valid: errors.length === 0,
      errors,
      action: existingCodes.has(code) ? 'update' : 'create',
    };
  });
  res.json({ success: true, data: rows, summary: { total: rows.length, valid: rows.filter((row) => row.valid).length, invalid: rows.filter((row) => !row.valid).length } });
});

export const importInventoryCsv = asyncHandler(async (req, res) => {
  const parsed = parseInventoryCsv(req.body.csv);
  const summary = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const results: any[] = [];
  const seenCodes = new Set<string>();
  const seenBarcodes = new Set<string>();

  for (const entry of parsed) {
    const errors = validateInventoryCsvRow(entry);
    const code = String(entry.data.partNumber || '').trim();
    const barcode = String(entry.data.barcode || '').trim();
    if (seenCodes.has(code)) errors.push('Duplicate part number in file');
    if (barcode && seenBarcodes.has(barcode)) errors.push('Duplicate barcode in file');
    seenCodes.add(code);
    if (barcode) seenBarcodes.add(barcode);
    if (errors.length) {
      summary.failed += 1;
      results.push({ rowNumber: entry.rowNumber, status: 'failed', errors });
      continue;
    }

    const row = entry.data;
    try {
      let action = 'updated';
      await runMongoTransaction(async (session) => {
        let product = await Product.findOne({ productCode: String(row.partNumber).trim(), deletedAt: null }).session(session);
        if (!product) {
          action = 'created';
          product = new Product({
            productCode: String(row.partNumber).trim(),
            productName: String(row.partName).trim(),
            barcode: String(row.barcode || '').trim() || undefined,
            vehicleType: row.vehicleType as '2W' | '4W',
            category: row.category,
            subCategory: row.subCategory,
            partType: row.partType as 'OEM' | 'Aftermarket' | 'Other',
            remark: row.remark,
            pricing: { costPrice: Number(row.purchasePrice), sellingPrice: Number(row.sellingPrice) },
            inventory: { quantity: 0, minimumLevel: Number(row.lowStockThreshold || 5), location: row.location },
            employeeId: req.user?._id || null,
            employeeName: req.user?.username || req.user?.email || 'User',
          });
          await product.save(session ? { session } : undefined);
        } else {
          product.productName = String(row.partName).trim();
          product.barcode = String(row.barcode || '').trim() || undefined;
          product.vehicleType = row.vehicleType as '2W' | '4W';
          product.category = row.category;
          product.subCategory = row.subCategory;
          product.partType = row.partType as 'OEM' | 'Aftermarket' | 'Other';
          product.remark = row.remark;
          product.pricing.costPrice = Number(row.purchasePrice);
          product.pricing.sellingPrice = Number(row.sellingPrice);
          product.inventory.minimumLevel = Number(row.lowStockThreshold || 5);
          product.inventory.location = row.location;
          product.employeeId = req.user?._id || null;
          product.employeeName = req.user?.username || req.user?.email || 'User';
          await product.save(session ? { session } : undefined);
        }

        const desiredQuantity = Number(row.quantity);
        const difference = desiredQuantity - Number(product.inventory.quantity || 0);
        if (difference > 0) {
          await addStock({ productId: product._id, quantity: difference, unitPrice: Number(row.purchasePrice), transactionType: 'CSV Import', reason: 'import', note: `CSV row ${entry.rowNumber}`, employeeId: req.user?._id || null }, { session });
        } else if (difference < 0) {
          await reduceStock({ productId: product._id, quantity: Math.abs(difference), transactionType: 'CSV Import', reason: 'correction', note: `CSV row ${entry.rowNumber}`, employeeId: req.user?._id || null }, { session });
        }
      });
      summary[action] += 1;
      results.push({ rowNumber: entry.rowNumber, status: action });
    } catch (error: any) {
      summary.failed += 1;
      results.push({ rowNumber: entry.rowNumber, status: 'failed', errors: [error?.message || 'Import failed'] });
    }
  }

  res.json({ success: true, data: summary, rows: results });
});

export const exportInventoryCsv = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const threshold = settings.inventory?.lowStockThreshold ?? 5;
  const products = await Product.find(inventoryFilter(req.query, threshold)).sort({ productName: 1 });
  res.type('text/csv').attachment(`inventory-${new Date().toISOString().slice(0, 10)}.csv`).send(inventoryRowsToCsv(products));
});

// GET /api/inventory/inward - procurement receipts backed by stock movements.
export const getProcurementReceipts = asyncHandler(async (_req, res) => {
  const movements = await StockTransaction.find({
    transactionType: { $in: ['Purchase', 'Inward'] },
    quantity: { $gt: 0 },
  }).sort({ createdAt: -1 }).limit(200).populate('productId', 'productCode productName');

  const data = movements.map((movement) => ({
    id: movement._id,
    inwardNumber: movement.reference?.number || String(movement._id),
    vendorName: movement.reference?.type || 'Procurement',
    receivedDate: movement.createdAt,
    invoiceNumber: movement.reference?.number || '',
    itemsCount: 1,
    totalAmount: Math.abs(movement.quantity) * Number(movement.unitPrice || 0),
    status: 'Completed',
    createdAt: movement.createdAt,
  }));
  res.json({ success: true, data, pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 } });
});

// POST /api/inventory/inward - integration point for a procurement receipt.
// Every received line goes through the same stock service as manual additions.
export const receiveProcurement = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ success: false, error: 'At least one procurement item is required' });

  const movements: any[] = [];
  await runMongoTransaction(async (session) => {
    for (const item of items) {
      const result = await addStock({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.purchasePrice,
        transactionType: 'Purchase',
        reason: 'purchase',
        note: item.note || req.body.note || '',
        reference: { type: req.body.vendorName || 'Procurement', number: req.body.invoiceNumber || '' },
        employeeId: req.user?._id || null,
      }, { session });
      movements.push(result.movement.toSafeJSON());
    }
  });
  res.status(201).json({ success: true, data: movements });
});

export const getInventory = asyncHandler(async (req, res) => {
  res.json(await inventoryService.getInventory(req.query));
});

export const getInsights = asyncHandler(async (_req, res) => {
  res.json(await inventoryService.getInsights());
});

export const getOrders = asyncHandler(async (req, res) => {
  res.json(await inventoryService.getOrders(req.query));
});

export const getInward = asyncHandler(async (req, res) => {
  res.json(await inventoryService.getMovementRecords('Inward', req.query));
});

export const getIssued = asyncHandler(async (req, res) => {
  res.json(await inventoryService.getMovementRecords('Issued', req.query));
});

export const getReturns = asyncHandler(async (req, res) => {
  res.json(await inventoryService.getMovementRecords('Purchase Return', req.query));
});
