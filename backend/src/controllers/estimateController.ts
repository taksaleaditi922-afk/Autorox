import Estimate, { ESTIMATE_STATUSES } from '../models/Estimate.js';
import JobCard, { JOB_STATUS } from '../models/JobCard.js';
import { generateEstimateNumber } from '../utils/generators.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const computeTotals = (parts, labor, other, discount, taxRate) => {
  const partsTotal = (parts || []).reduce((s, p) => s + p.unitCost * p.quantity, 0);
  const laborTotal = (labor || []).reduce((s, l) => s + l.hours * l.hourlyRate, 0);
  const otherTotal = (other || []).reduce((s, o) => s + o.amount, 0);
  const preDiscount = partsTotal + laborTotal + otherTotal;

  let discountAmount = 0;
  if (discount && discount.value) {
    if (discount.type === 'Percentage') {
      discountAmount = (preDiscount * discount.value) / 100;
    } else {
      discountAmount = discount.value;
    }
  }
  const taxable = Math.max(preDiscount - discountAmount, 0);
  const taxAmount = (taxable * (taxRate || 0)) / 100;
  const grandTotal = taxable + taxAmount;

  return {
    partsTotal,
    laborTotal,
    otherTotal,
    subtotal: preDiscount,
    discountAmount,
    taxable,
    taxAmount,
    grandTotal,
  };
};

// POST /api/estimates
export const createEstimate = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.jobCardId) throw new ApiError(400, 'jobCardId is required');
  const jobCard = await JobCard.findById(body.jobCardId);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  const parts = body.items?.parts || [];
  const labor = body.items?.labor || [];
  const other = body.items?.other || [];
  const discount = body.discount || { type: 'Fixed', value: 0 };
  const taxRate = body.tax?.rate ?? 18;

  const totals = computeTotals(parts, labor, other, discount, taxRate);

  const estimate = new Estimate({
    jobCardId: body.jobCardId,
    estimateNumber: body.estimateNumber || generateEstimateNumber(),
    status: body.status || 'Draft',
    items: { parts, labor, other },
    subtotal: totals.subtotal,
    discount: { ...discount },
    tax: { rate: taxRate, amount: totals.taxAmount },
    grandTotal: totals.grandTotal,
    validUntil: body.validUntil || null,
    notes: body.notes,
    terms: body.terms,
    approvalHistory: [
      { status: body.status || 'Draft', by: req.user?.email || 'System', at: new Date() },
    ],
    createdBy: req.user?.email || 'System',
  });
  await estimate.save();
  res.status(201).json({ success: true, data: estimate });
});

// GET /api/estimates?jobCardId=&status=
export const getEstimates = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.jobCardId) filter.jobCardId = req.query.jobCardId;
  if (req.query.status && ESTIMATE_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const estimates = await Estimate.find(filter)
    .sort('-createdAt')
    .populate('jobCardId', 'jobCardNumber vehicle customer');
  res.json({ success: true, data: estimates });
});

// GET /api/estimates/:id
export const getEstimate = asyncHandler(async (req, res) => {
  const estimate = await Estimate.findById(req.params.id).populate(
    'jobCardId',
    'jobCardNumber vehicle customer'
  );
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  res.json({ success: true, data: estimate });
});

// PUT /api/estimates/:id
export const updateEstimate = asyncHandler(async (req, res) => {
  const estimate = await Estimate.findById(req.params.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (estimate.status === 'Converted to Invoice') {
    throw new ApiError(400, 'Cannot modify an estimate that has been converted to invoice');
  }
  const b = req.body;
  if (b.items) estimate.items = b.items;
  if (b.discount) estimate.discount = b.discount;
  if (b.tax != null) estimate.tax = b.tax;
  if (b.notes !== undefined) estimate.notes = b.notes;
  if (b.terms !== undefined) estimate.terms = b.terms;
  if (b.validUntil) estimate.validUntil = b.validUntil;

  const totals = computeTotals(
    estimate.items?.parts,
    estimate.items?.labor,
    estimate.items?.other,
    estimate.discount,
    estimate.tax?.rate ?? 18
  );
  estimate.subtotal = totals.subtotal;
  estimate.tax.amount = totals.taxAmount;
  estimate.grandTotal = totals.grandTotal;
  await estimate.save();
  res.json({ success: true, data: estimate });
});

// PATCH /api/estimates/:id/approve
export const approveEstimate = asyncHandler(async (req, res) => {
  const estimate = await Estimate.findById(req.params.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  estimate.status = 'Approved';
  estimate.approvedBy = req.user?.email || 'Customer';
  estimate.approvedAt = new Date();
  estimate.approvalHistory = estimate.approvalHistory || [];
  estimate.approvalHistory.push({ status: 'Approved', by: req.user?.email || 'Customer', at: new Date() });
  await estimate.save();
  await JobCard.findByIdAndUpdate(estimate.jobCardId, {
    'estimate.estimateId': estimate._id,
    'estimate.status': 'Approved',
    'estimate.totalAmount': estimate.grandTotal,
  });
  res.json({ success: true, data: estimate });
});

// PATCH /api/estimates/:id/reject
export const rejectEstimate = asyncHandler(async (req, res) => {
  const estimate = await Estimate.findById(req.params.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  estimate.status = 'Rejected';
  estimate.approvalHistory = estimate.approvalHistory || [];
  estimate.approvalHistory.push({ status: 'Rejected', by: req.user?.email || 'Customer', at: new Date() });
  await estimate.save();
  res.json({ success: true, data: estimate });
});

// POST /api/estimates/:id/send-email
export const sendEstimateEmail = asyncHandler(async (req, res) => {
  const estimate = await Estimate.findById(req.params.id).populate('jobCardId');
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  res.json({ success: true, message: 'Estimate forwarded to customer for approval (email integration pending)' });
});

// POST /api/estimates/:id/convert-invoice
export const convertToInvoice = asyncHandler(async (req, res) => {
  const estimate = await Estimate.findById(req.params.id);
  if (!estimate) throw new ApiError(404, 'Estimate not found');
  if (estimate.status !== 'Approved') {
    throw new ApiError(400, 'Only approved estimates can be converted to invoices');
  }
  estimate.status = 'Converted to Invoice';
  estimate.approvalHistory = estimate.approvalHistory || [];
  estimate.approvalHistory.push({
    status: 'Converted to Invoice',
    by: req.user?.email || 'System',
    at: new Date(),
  });
  await estimate.save();
  await JobCard.findByIdAndUpdate(estimate.jobCardId, {
    'estimate.estimateId': estimate._id,
    'estimate.status': 'Converted to Invoice',
    'estimate.totalAmount': estimate.grandTotal,
    status: JOB_STATUS.IN_PROGRESS,
  });
  res.json({ success: true, data: estimate, message: 'Estimate converted to invoice' });
});