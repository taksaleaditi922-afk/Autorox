import Sale, { SALE_STATUSES } from '../models/Sale.js';
import Product from '../models/Product.js';
import StockTransaction from '../models/StockTransaction.js';
import { generateBillNumber } from '../utils/generators.js';
import ApiError from '../utils/ApiError.js';

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
export const getSales = async (filters: any): Promise<any> => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};
  if (filters.status && SALE_STATUSES.includes(filters.status)) {
    filter['payment.status'] = filters.status;
  }
  if (filters.advisor) filter['advisor.advisorId'] = filters.advisor;
  if (filters.from || filters.to) {
    const from = filters.from ? new Date(filters.from) : new Date(0);
    const to = filters.to ? new Date(filters.to) : new Date();
    filter.billDate = { $gte: from, $lte: to };
  }
  if (filters.minAmount != null || filters.maxAmount != null) {
    filter['billing.grandTotal'] = {};
    if (filters.minAmount != null) filter['billing.grandTotal'].$gte = Number(filters.minAmount);
    if (filters.maxAmount != null) filter['billing.grandTotal'].$lte = Number(filters.maxAmount);
  }
  if (filters.q) {
    const q = filters.q.trim();
    filter.$or = [
      { billNumber: { $regex: q, $options: 'i' } },
      { 'customer.name': { $regex: q, $options: 'i' } },
      { 'customer.phone': { $regex: q, $options: 'i' } },
    ];
  }

  const sortField = ['billNumber', 'billDate', 'billing.grandTotal', 'payment.status', 'advisor.advisorId'].includes(filters.sort || '')
    ? filters.sort
    : '-billDate';
  const sort: Record<string, 1 | -1> = { [sortField.replace(/^-/, '')]: sortField.startsWith('-') ? -1 : 1 };

  const [data, total] = await Promise.all([
    Sale.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customer.customerId', 'name email phone')
      .populate('advisor.advisorId', 'name email phone'),
    Sale.countDocuments(filter),
  ]);

  return {
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// POST /api/sales
export const createSale = async (payload: any, actor: any): Promise<any> => {
  const body = payload;
  const user = actor || {};
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
    const product = await Product.findById(item.productId);
    const stockBefore = product.inventory.quantity;
    product.inventory.quantity = stockBefore - item.quantity;
    await product.save();

    sale.items[items.indexOf(item)].unitPrice = item.unitPrice;
    await StockTransaction.create({
      productId: item.productId,
      transactionType: 'Sale',
      quantity: -item.quantity,
      reference: { type: 'Bill', id: sale._id, number: billNumber },
      stockBefore,
      stockAfter: product.inventory.quantity,
      notes: `Sold to ${customer.name}`,
      recordedBy: user._id || null,
    });
  }

  await sale.save();
  return { success: true, data: sale };
};

// GET /api/sales/:id
export const getSale = async (routeParams: any): Promise<any> => {
  const sale = await Sale.findById(routeParams.id)
    .populate('customer.customerId', 'name email phone')
    .populate('advisor.advisorId', 'name email phone')
    .populate('items.productId', 'productCode productName');
  if (!sale) throw new ApiError(404, 'Sale not found');
  return { success: true, data: sale };
};

// PUT /api/sales/:id
export const updateSale = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const sale = await Sale.findById(routeParams.id).populate('items.productId');
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (sale.payment.status === 'Paid') {
    throw new ApiError(400, 'Paid bills cannot be edited');
  }
  if (sale.payment.status === 'Cancelled') {
    throw new ApiError(400, 'Cancelled bills cannot be edited');
  }

  const b = payload;
  const user = actor || {};

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
    const oldMap = new Map<string, any>(oldItems.map((i) => [i.productId.toString(), i] as [string, any]));
    const newMap = new Map<string, any>(items.map((i) => [i.productId.toString(), i] as [string, any]));

    for (const [productId, oldItem] of oldMap) {
      const newItem = newMap.get(productId);
      if (!newItem) {
        // item removed - restore stock
        const product = await Product.findById(productId);
        if (product) {
          const stockBefore = product.inventory.quantity;
          product.inventory.quantity += oldItem.quantity;
          await product.save();
          await StockTransaction.create({
            productId,
            transactionType: 'Adjustment',
            quantity: oldItem.quantity,
            reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
            stockBefore,
            stockAfter: product.inventory.quantity,
            notes: `Restored stock after bill edit`,
            recordedBy: user._id || null,
          });
        }
      } else if (newItem.quantity !== oldItem.quantity) {
        const product = await Product.findById(productId);
        const diff = oldItem.quantity - newItem.quantity;
        const stockBefore = product.inventory.quantity;
        product.inventory.quantity += diff;
        await product.save();
        await StockTransaction.create({
          productId,
          transactionType: diff > 0 ? 'Adjustment' : 'Sale',
          quantity: diff,
          reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
          stockBefore,
          stockAfter: product.inventory.quantity,
          notes: `Adjusted stock after bill edit`,
          recordedBy: user._id || null,
        });
      }
    }

    for (const [productId, newItem] of newMap) {
      const oldItem = oldMap.get(productId);
      if (!oldItem) {
        // new item added
        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, `Product not found: ${newItem.productCode}`);
        if (product.inventory.quantity < newItem.quantity) {
          throw new ApiError(
            400,
            `Insufficient stock for ${product.productName}. Available: ${product.inventory.quantity}`
          );
        }
        const stockBefore = product.inventory.quantity;
        product.inventory.quantity -= newItem.quantity;
        await product.save();
        await StockTransaction.create({
          productId,
          transactionType: 'Sale',
          quantity: -newItem.quantity,
          reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
          stockBefore,
          stockAfter: product.inventory.quantity,
          notes: `Added to bill during edit`,
          recordedBy: user._id || null,
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
  return { success: true, data: sale };
};

// DELETE /api/sales/:id
export const deleteSale = async (routeParams: any, actor: any): Promise<any> => {
  const sale = await Sale.findById(routeParams.id).populate('items.productId');
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (sale.payment.status === 'Paid') {
    throw new ApiError(400, 'Paid bills cannot be deleted');
  }
  if (sale.payment.status === 'Cancelled') {
    throw new ApiError(400, 'Cancelled bills cannot be deleted');
  }

  // Restore stock
  const user = actor || {};
  for (const item of sale.items || []) {
    const product = await Product.findById(item.productId);
    if (product) {
      const stockBefore = product.inventory.quantity;
      product.inventory.quantity += item.quantity;
      await product.save();
      await StockTransaction.create({
        productId: item.productId,
        transactionType: 'Adjustment',
        quantity: item.quantity,
        reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
        stockBefore,
        stockAfter: product.inventory.quantity,
        notes: `Restored stock after bill deletion`,
        recordedBy: user._id || null,
      });
    }
  }

  await sale.deleteOne();
  return { success: true, message: 'Bill deleted' };
};

// PATCH /api/sales/:id/status
export const updateSaleStatus = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const sale = await Sale.findById(routeParams.id);
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (!SALE_STATUSES.includes(payload.status)) {
    throw new ApiError(400, `Status must be one of: ${SALE_STATUSES.join(', ')}`);
  }
  if (payload.status === 'Cancelled') {
    if (sale.payment.status === 'Paid') {
      throw new ApiError(400, 'Cannot cancel a paid bill');
    }
    // Restore stock on cancellation
    const user = actor || {};
    for (const item of sale.items || []) {
      const product = await Product.findById(item.productId);
      if (product) {
        const stockBefore = product.inventory.quantity;
        product.inventory.quantity += item.quantity;
        await product.save();
        await StockTransaction.create({
          productId: item.productId,
          transactionType: 'Adjustment',
          quantity: item.quantity,
          reference: { type: 'Bill', id: sale._id, number: sale.billNumber },
          stockBefore,
          stockAfter: product.inventory.quantity,
          notes: 'Stock restored after cancellation',
          recordedBy: user._id || null,
        });
      }
    }
    sale.payment.status = 'Cancelled';
  } else {
    sale.payment.status = payload.status;
  }
  await sale.save();
  return { success: true, data: sale };
};

// POST /api/sales/:id/payment
export const recordPayment = async (routeParams: any, payload: any, actor: any): Promise<any> => {
  const sale = await Sale.findById(routeParams.id);
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (sale.payment.status === 'Cancelled') {
    throw new ApiError(400, 'Cannot pay a cancelled bill');
  }
  if (sale.payment.status === 'Paid') {
    throw new ApiError(400, 'Bill is already paid');
  }

  const { amount, method, transactionId, notes } = payload;
  if (amount == null || amount <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than zero');
  }
  if (amount > sale.payment.balance && sale.payment.balance > 0) {
    throw new ApiError(400, `Payment exceeds remaining balance of ₹${sale.payment.balance}`);
  }

  const newPaid = sale.payment.amountPaid + amount;
  const newBalance = Math.max(sale.billing.grandTotal - newPaid, 0);
  const newStatus = determineStatus(sale.billing.grandTotal, newPaid);
  const advisorName = (actor || {}).name || 'Advisor';

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
  return { success: true, data: sale };
};

// GET /api/sales/:id/payments
export const getPaymentHistory = async (routeParams: any): Promise<any> => {
  const sale = await Sale.findById(routeParams.id);
  if (!sale) throw new ApiError(404, 'Sale not found');
  return { success: true, data: sale.payment.paymentHistory || [] };
};

// POST /api/sales/:id/invoice - returns structured invoice data (frontend generates PDF)
export const getInvoice = async (routeParams: any): Promise<any> => {
  const sale = await Sale.findById(routeParams.id)
    .populate('customer.customerId', 'name email phone address')
    .populate('advisor.advisorId', 'name email phone')
    .populate('items.productId', 'productCode productName');
  if (!sale) throw new ApiError(404, 'Sale not found');
  return { success: true, data: sale, message: 'Invoice data ready for PDF generation' };
};
