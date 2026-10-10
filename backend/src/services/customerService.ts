import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import JobCard from '../models/JobCard.js';
import ApiError from '../utils/ApiError.js';

const normalizePhone = (p) => (p ? String(p).replace(/\D/g, '') : null);

// GET /api/customers?q=&page=&limit=
export const getCustomers = async (filters: any): Promise<any> => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;
  const filter: Record<string, any> = {};
  if (filters.q) {
    const q = filters.q.trim();
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
  return {
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// POST /api/customers
export const createCustomer = async (payload: any): Promise<any> => {
  const body = payload;
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
  return { success: true, data: customer.toSafeJSON() };
};

// GET /api/customers/:id
export const getCustomer = async (routeParams: any): Promise<any> => {
  const customer = await Customer.findById(routeParams.id).populate('vehicles');
  if (!customer) throw new ApiError(404, 'Customer not found');
  return { success: true, data: customer.toSafeJSON() };
};

// PUT /api/customers/:id
export const updateCustomer = async (routeParams: any, payload: any): Promise<any> => {
  const customer = await Customer.findById(routeParams.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  const b = payload;
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
  return { success: true, data: customer.toSafeJSON() };
};

// DELETE /api/customers/:id (soft delete)
export const deleteCustomer = async (routeParams: any): Promise<any> => {
  const customer = await Customer.findById(routeParams.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  customer.isActive = false;
  await customer.save();
  return { success: true, message: 'Customer deactivated (soft delete)' };
};

// GET /api/customers/:id/vehicles
export const getCustomerVehicles = async (routeParams: any): Promise<any> => {
  const vehicles = await Vehicle.find({ owner: routeParams.id });
  return { success: true, data: vehicles };
};

// GET /api/customers/:id/jobcards
export const getCustomerJobCards = async (routeParams: any): Promise<any> => {
  const jobCards = await JobCard.find({ 'customer.customerId': routeParams.id }).sort('-createdAt');
  return { success: true, data: jobCards };
};

// PATCH /api/customers/:id/assign-advisor
export const assignAdvisor = async (routeParams: any, payload: any): Promise<any> => {
  const { advisorId, name } = payload;
  const customer = await Customer.findById(routeParams.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  if (!advisorId) {
    customer.assignedAdvisor = null;
  } else {
    customer.assignedAdvisor = { advisorId, name: name || customer.assignedAdvisor?.name || '' };
  }
  await customer.save();
  return { success: true, data: customer.toSafeJSON() };
};