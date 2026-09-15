import Advisor from '../models/Advisor.js';
import JobCard from '../models/JobCard.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/advisors?q=&active=
export const getAdvisors = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active === 'true') filter.isActive = true;
  if (req.query.active === 'false') filter.isActive = false;
  if (req.query.q) {
    const q = req.query.q.trim();
    filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
  }
  const advisors = await Advisor.find(filter).sort('name');
  res.json({ success: true, data: advisors });
});

// POST /api/advisors
export const createAdvisor = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.name) throw new ApiError(400, 'Advisor name is required');
  const advisor = new Advisor(body);
  await advisor.save();
  res.status(201).json({ success: true, data: advisor });
});

// GET /api/advisors/:id
export const getAdvisor = asyncHandler(async (req, res) => {
  const advisor = await Advisor.findById(req.params.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  res.json({ success: true, data: advisor });
});

// PUT /api/advisors/:id
export const updateAdvisor = asyncHandler(async (req, res) => {
  const advisor = await Advisor.findById(req.params.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  const b = req.body;
  const editable = ['name', 'email', 'phone', 'specializations', 'workingHours', 'availability', 'averageRating'];
  editable.forEach((k) => {
    if (b[k] !== undefined) advisor[k] = b[k];
  });
  await advisor.save();
  res.json({ success: true, data: advisor });
});

// PATCH /api/advisors/:id/status
export const toggleAdvisorStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const advisor = await Advisor.findById(req.params.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  if (typeof isActive === 'boolean') advisor.isActive = isActive;
  await advisor.save();
  res.json({ success: true, data: advisor });
});

// GET /api/advisors/:id/workload
export const getAdvisorWorkload = asyncHandler(async (req, res) => {
  const advisor = await Advisor.findById(req.params.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  const activeJobCards = await JobCard.find({
    'advisor.advisorId': advisor._id,
    status: { $not: /Delivered|Cancelled/ },
  }).sort('-createdAt');
  res.json({ success: true, data: { advisor, activeJobCards } });
});

// GET /api/advisors/:id/customers
export const getAdvisorCustomers = asyncHandler(async (req, res) => {
  const advisor = await Advisor.findById(req.params.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  const { default: Customer } = await import('../models/Customer.js');
  const customers = await Customer.find({ 'assignedAdvisor.advisorId': advisor._id }).sort('name');
  const jobCards = await JobCard.find({
    'advisor.advisorId': advisor._id,
    status: { $not: /Delivered|Cancelled/ },
  }).sort('-createdAt');
  res.json({ success: true, data: { advisor, customers, activeJobCards: jobCards } });
});