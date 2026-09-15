import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import JobCard from '../models/JobCard.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const normalizePhone = (p) => (p ? String(p).replace(/\D/g, '') : null);

// GET /api/customers?q=&page=&limit=
export const getCustomers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.q) {
    const q = req.query.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }
  const [data, total] = await Promise.all([
    Customer.find(filter).sort('-createdAt').skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /api/customers
export const createCustomer = asyncHandler(async (req, res) => {
  const body = req.body;
  const phone = normalizePhone(body.phone);
  if (!phone) throw new ApiError(400, 'Phone number is required');

  const dup = await Customer.findOne({
    $or: [{ phone }, { email: body.email?.toLowerCase() || '$none$' }],
  });
  if (dup) {
    throw new ApiError(409, `A customer with phone ${phone} or email ${body.email} already exists`);
  }

  const customer = new Customer({ ...body, phone });
  await customer.save();
  res.status(201).json({ success: true, data: customer.toSafeJSON() });
});

// GET /api/customers/:id
export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id).populate('vehicles');
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: customer.toSafeJSON() });
});

// PUT /api/customers/:id
export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  const b = req.body;
  const allowed = [
    'name',
    'email',
    'alternatePhone',
    'address',
    'city',
    'state',
    'pincode',
    'preferredContactMethod',
    'isActive',
  ];
  allowed.forEach((k) => {
    if (b[k] !== undefined) customer[k] = b[k];
  });
  if (b.phone) customer.phone = normalizePhone(b.phone);
  await customer.save();
  res.json({ success: true, data: customer.toSafeJSON() });
});

// DELETE /api/customers/:id (soft delete)
export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  customer.isActive = false;
  await customer.save();
  res.json({ success: true, message: 'Customer deactivated (soft delete)' });
});

// GET /api/customers/:id/vehicles
export const getCustomerVehicles = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({ owner: req.params.id });
  res.json({ success: true, data: vehicles });
});

// GET /api/customers/:id/jobcards
export const getCustomerJobCards = asyncHandler(async (req, res) => {
  const jobCards = await JobCard.find({ 'customer.customerId': req.params.id }).sort('-createdAt');
  res.json({ success: true, data: jobCards });
});

// PATCH /api/customers/:id/assign-advisor
export const assignAdvisor = asyncHandler(async (req, res) => {
  const { advisorId, name } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  if (!advisorId) {
    customer.assignedAdvisor = null;
  } else {
    customer.assignedAdvisor = { advisorId, name: name || customer.assignedAdvisor?.name || '' };
  }
  await customer.save();
  res.json({ success: true, data: customer.toSafeJSON() });
});