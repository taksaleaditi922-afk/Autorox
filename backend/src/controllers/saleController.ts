import Sale, { SALE_STATUSES } from '../models/Sale.js';
import Product from '../models/Product.js';
import { addStock, reduceStock } from '../services/stockService.js';
import { generateBillNumber } from '../utils/generators.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const computeBilling = (items, discount, taxRate) => {
  const subtotal = (items || []).reduce((s, item) => s + item.quantity * item.unitPrice, 0);

  let discountAmount = 0;
  if (discount?.value != null && discount?.value > 0) {
    discountAmount = discount.type === 'Percentage'
      ? (subtotal * discount.value) / 100
      : discount.value;
  }
  const afterDiscount = Math.max(subtotal - discountAmount, 0);
  const taxAmount = (afterDiscount * (taxRate || 0)) / 100;
  const grandTotal = afterDiscount + taxAmount;

  return {
    subtotal,
    discountAmount,
    afterDiscount,
    taxAmount,
    grandTotal,
  };
};

const determineStatus = (grandTotal, amountPaid) => {
  if (amountPaid >= grandTotal) return 'Paid';
  if (amountPaid > 0) return 'Pending';
  return 'Invoice';
};

const normalizeCustomer = (c) => ({
  customerId: c?.customerId || null,
  name: c?.name?.trim() || '',
  email: (c?.email || '').trim().toLowerCase(),
  phone: (c?.phone || '').replace(/\\D/g, ''),
  address: c?.address?.trim() || '',
});

const normalizeAdvisor = (u, advisor) => {
  const name = advisor?.name || u?.name || u?.email?.split('@')[0] || 'Advisor';
  return {
    advisorId: advisor?.advisorId || u?._id || null,
    name,
  };
};

// GET /api/sales?q=&status=&advisor=&from=&to=&minAmount=&maxAmount=&page=&limit=&sort=
export const getSales = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && SALE_STATUSES.includes(req.query.status)) {
    filter['payment.status'] = req.query.status;
  }
  if (req.query.advisor) filter['advisor.advisorId'] = req.query.advisor;
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(req.query.from) : new Date(0);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    filter.billDate = { $gte: from, $lte: to };
  }
  if (req.query.minAmount != null || req.query.maxAmount != null) {
    filter['billing.grandTotal'] = {};
    if (req.query.minAmount != null) filter['billing.grandTotal'].$gte = Number(req.query.minAmount);
    if (req.query.maxAmount != null) filter['billing.grandTotal'].$lte = Number(req.query.maxAmount);
  }
  if (req.query.q) {
    const q = req.query.q.trim();
    filter.$or = [
      { billNumber: { $regex: q, $options: 'i' } },
      { 'customer.name': { $regex: q, $options: 'i' } },
      { 'customer.phone': { $regex: q, $options: 'i' } },
    ];
  }

  const sortField = ['billNumber', 'billDate', 'billing.grandTotal', 'payment.status', 'advisor.advisorId'].includes(req.query.sort || '')
    ? req.query.sort
    : '-billDate';
  const sort = { [sortField.replace(/^-/, '')]: sortField.startsWith('-') ? -1 : 1 };

  const [data, total] = await Promise.all([
    Sale.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customer.customerId', 'name email phone')
      .populate('advisor.advisorId', 'name email phone'),
    Sale.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /api/sales
export const createSale = asyncHandler(async (req, res) => {
  const body = req.body;
  const user = req.user || {};
  if (!body.items || body.items.length === 0) {
    throw new ApiError(400, 'At least one product must be selected');
  }

  // Validate and calculate item totals
  const items = body.items.map((item) => {
    if (!item.productId) throw new ApiError(400, 'Product is required for each item');
    if (!item.productName) throw new ApiError(400, 'Product name is required for each item');
    if (!item.productCode) throw new ApiError(400, 'Product code is required for each item');
    if (item.quantity <= 0) throw new ApiError(400, 'Quantity must be positive');
    if (item.unitPrice < 0) throw new ApiError(400, 'Unit price cannot be negative');
    const taxRate = item.tax != null ? item.tax : 18;
    const totalPrice = item.quantity * item.unitPrice;
    const taxAmount = (totalPrice * taxRate) / 100;
    return {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice,
      tax: taxRate,
      taxAmount,
    };
  });

  const customer = normalizeCustomer(body.customer);
  if (!customer.name) throw new ApiError(400, 'Customer name is required');
  if (!customer.phone || customer.phone.length < 10) {
    throw new ApiError(400, 'Customer phone number is required');
  }

  const advisor = normalizeAdvisor(user, body.advisor);
  const taxRate = body.tax?.rate != null ? body.tax.rate : 18;
  const discount = body.discount || { type: 'Fixed', value: 0 };
  const billingInput = computeBilling(items, discount, taxRate);

  // Check stock availability
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) throw new ApiError(404, `Product not found: ${item.productCode}`);
    if (product.inventory.quantity < item.quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for ${product.productName}. Available: ${product.inventory.quantity}, requested: ${item.quantity}`
      );
    }
  }

  // Generate bill number
  const billNumber = body.billNumber || generateBillNumber();

  // Build payment info
  const amountPaid = Math.max(Number(body.payment?.amountPaid ?? body.amountPaid) || 0, 0);
  const balance = Math.max(billingInput.grandTotal - amountPaid, 0);
  const paymentStatus = determineStatus(billingInput.grandTotal, amountPaid);

  const sale = new Sale({
    billNumber,
    billDate: body.billDate ? new Date(body.billDate) : new Date(),
    customer,
    advisor,
    items,
    billing: {
      ...billingInput,
      discountType: discount.type || 'Fixed',
      discountValue: discount.value || 0,
      taxRate,
    },
    payment: {
      status: paymentStatus,
      amountPaid,
      balance,
      method: body.payment?.method || 'Cash',
      transactionId: body.payment?.transactionId || null,
      paidDate: amountPaid >= billingInput.grandTotal ? new Date() : null,
      paymentHistory: amountPaid > 0
        ? [{
            amount: amountPaid,
            method: body.payment?.method || 'Cash',
            paidBy: advisor.name,
            paidAt: new Date(),
          }]
        : [],
    },
    jobCardLinked: body.jobCardLinked || null,
    notes: body.notes || '',
    createdBy: user._id || null,
  });

  // Deduct stock and create transactions
  for (const item of items) {
    sale.items[items.indexOf(item)]._doc.unitPrice = item.unitPrice;
    await reduceStock({
      productId: item.productId,
      transactionType: 'Sale',
      quantity: item.quantity,
      reference: { type: 'Bill', id: sale._id, number: billNumber },
      reason: 'sale',
      note: `Sold to ${customer.name}`,
      unitPrice: item.unitPrice,
      employeeId: user._id || null,
    });
  }

  await sale.save();
  res.status(201).json({ success: true, data: sale });
});

// GET /api/sales/:id
export const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('customer.customerId', 'name email phone')
    .populate('advisor.advisorId', 'name email phone')
    .populate('items.productId', 'productCode productName');
  if (!sale) throw new ApiError(404, 'Sale not found');
  res.json({ success: true, data: sale });
});

// PUT /api/sales/:id
export const updateSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate('items.productId');
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (sale.payment.status === 'Paid') {
    throw new ApiError(400, 'Paid bills cannot be edited');
  }
  if (sale.payment.status === 'Cancelled') {
    throw new ApiError(400, 'Cancelled bills cannot be edited');
  }

  const b = req.body;
  const user = req.user || {};

  // Validate and recalculate items
  if (b.items && b.items.length > 0) {
    const items = b.items.map((item) => {
      if (item.quantity <= 0) throw new ApiError(400, 'Quantity must be positive');
      if (item.unitPrice < 0) throw new ApiError(400, 'Unit price cannot be negative');
      const taxRate = item.tax != null ? item.tax : 18;
      const totalPrice = item.quantity * item.unitPrice;
      const taxAmount = (totalPrice * taxRate) / 100;
      return {
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        tax: taxRate,
        taxAmount,
      };
    });

    // Restore stock for removed items & deduct for new quantities
    const oldItems = sale.items || [];
    const oldMap = new Map(oldItems.map((i) => [i.productId.toString(), i]));
    const newMap = new Map(items.map((i) => [i.productId.toString(), i]));

    for (const [productId, oldItem] of oldMap) {
      const newItem = newMap.get(productId);
      if (!newItem) {
        // item removed - restore stock
        await addStock({
          productId,
          transactionType: 'Adjustment',
          quantity: oldItem.quantity,
          reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
          reason: 'correction',
          note: 'Restored stock after bill edit',
          employeeId: user._id || null,
        });
      } else if (newItem.quantity !== oldItem.quantity) {
        const diff = oldItem.quantity - newItem.quantity;
        const change = {
          productId,
          transactionType: diff > 0 ? 'Adjustment' : 'Sale',
          quantity: Math.abs(diff),
          reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
          reason: diff > 0 ? 'return' : 'sale',
          note: 'Adjusted stock after bill edit',
          employeeId: user._id || null,
        };
        if (diff > 0) await addStock(change);
        else await reduceStock(change);
      }
    }

    for (const [productId, newItem] of newMap) {
      const oldItem = oldMap.get(productId);
      if (!oldItem) {
        // new item added
        await reduceStock({
          productId,
          transactionType: 'Sale',
          quantity: newItem.quantity,
          reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
          reason: 'sale',
          note: 'Added to bill during edit',
          unitPrice: newItem.unitPrice,
          employeeId: user._id || null,
        });
      }
    }

    sale.items = items;
    sale.billing = { ...sale.billing, ...computeBilling(items, sale.billing, sale.billing.taxRate) };
  }

  if (b.discount) {
    sale.billing.discountType = b.discount.type || 'Fixed';
    sale.billing.discountValue = b.discount.value || 0;
    sale.billing.discountAmount = b.discount.amount || 0;
    sale.billing = { ...sale.billing, ...computeBilling(sale.items, b.discount, sale.billing.taxRate) };
  }

  if (b.notes != null) sale.notes = b.notes;

  // Recalculate payment if amountPaid changed
  const newAmountPaid = b.payment?.amountPaid != null ? Math.max(Number(b.payment.amountPaid), 0) : sale.payment.amountPaid;
  const balance = Math.max(sale.billing.grandTotal - newAmountPaid, 0);
  const newStatus = determineStatus(sale.billing.grandTotal, newAmountPaid);

  if (b.payment?.method) sale.payment.method = b.payment.method;
  sale.payment.amountPaid = newAmountPaid;
  sale.payment.balance = balance;
  sale.payment.status = newStatus;
  if (newAmountPaid >= sale.billing.grandTotal && !sale.payment.paidDate) {
    sale.payment.paidDate = new Date();
  }

  await sale.save();
  res.json({ success: true, data: sale });
});

// DELETE /api/sales/:id
export const deleteSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate('items.productId');
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (sale.payment.status === 'Paid') {
    throw new ApiError(400, 'Paid bills cannot be deleted');
  }
  if (sale.payment.status === 'Cancelled') {
    throw new ApiError(400, 'Cancelled bills cannot be deleted');
  }

  // Restore stock
  const user = req.user || {};
  for (const item of sale.items || []) {
    await addStock({
      productId: item.productId,
      transactionType: 'Adjustment',
      quantity: item.quantity,
      reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
      reason: 'return',
      note: 'Restored stock after bill deletion',
      employeeId: user._id || null,
    });
  }

  await sale.deleteOne();
  res.json({ success: true, message: 'Bill deleted' });
});

// PATCH /api/sales/:id/status
export const updateSaleStatus = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (!SALE_STATUSES.includes(req.body.status)) {
    throw new ApiError(400, `Status must be one of: ${SALE_STATUSES.join(', ')}`);
  }
  if (req.body.status === 'Cancelled') {
    if (sale.payment.status === 'Paid') {
      throw new ApiError(400, 'Cannot cancel a paid bill');
    }
    // Restore stock on cancellation
    const user = req.user || {};
    for (const item of sale.items || []) {
      await addStock({
        productId: item.productId,
        transactionType: 'Adjustment',
        quantity: item.quantity,
        reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
        reason: 'return',
        note: 'Stock restored after cancellation',
        employeeId: user._id || null,
      });
    }
    sale.payment.status = 'Cancelled';
  } else {
    sale.payment.status = req.body.status;
  }
  await sale.save();
  res.json({ success: true, data: sale });
});

// POST /api/sales/:id/payment
export const recordPayment = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (sale.payment.status === 'Cancelled') {
    throw new ApiError(400, 'Cannot pay a cancelled bill');
  }
  if (sale.payment.status === 'Paid') {
    throw new ApiError(400, 'Bill is already paid');
  }

  const { amount, method, transactionId, notes } = req.body;
  if (amount == null || amount <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than zero');
  }
  if (amount > sale.payment.balance && sale.payment.balance > 0) {
    throw new ApiError(400, `Payment exceeds remaining balance of ₹${sale.payment.balance}`);
  }

  const newPaid = sale.payment.amountPaid + amount;
  const newBalance = Math.max(sale.billing.grandTotal - newPaid, 0);
  const newStatus = determineStatus(sale.billing.grandTotal, newPaid);
  const advisorName = (req.user || {}).name || 'Advisor';

  sale.payment.amountPaid = newPaid;
  sale.payment.balance = newBalance;
  sale.payment.status = newStatus;
  if (method) sale.payment.method = method;
  if (transactionId) sale.payment.transactionId = transactionId;
  if (newStatus === 'Paid' && !sale.payment.paidDate) {
    sale.payment.paidDate = new Date();
  }
  sale.payment.paymentHistory.push({
    amount,
    method: method || sale.payment.method || 'Cash',
    paidBy: advisorName,
    paidAt: new Date(),
    notes: notes || '',
  });

  await sale.save();
  res.json({ success: true, data: sale });
});

// GET /api/sales/:id/payments
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) throw new ApiError(404, 'Sale not found');
  res.json({ success: true, data: sale.payment.paymentHistory || [] });
});

// POST /api/sales/:id/invoice - returns structured invoice data (frontend generates PDF)
export const getInvoice = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('customer.customerId', 'name email phone address')
    .populate('advisor.advisorId', 'name email phone')
    .populate('items.productId', 'productCode productName');
  if (!sale) throw new ApiError(404, 'Sale not found');
  res.json({ success: true, data: sale, message: 'Invoice data ready for PDF generation' });
});
