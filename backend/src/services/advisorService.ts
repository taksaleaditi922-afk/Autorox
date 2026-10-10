import Advisor from '../models/Advisor.js';
import JobCard from '../models/JobCard.js';
import ApiError from '../utils/ApiError.js';

// GET /api/advisors?q=&active=
export const getAdvisors = async (filters: any): Promise<any> => {
  const filter: Record<string, any> = {};
  if (filters.active === 'true') filter.isActive = true;
  if (filters.active === 'false') filter.isActive = false;
  if (filters.q) {
    const q = filters.q.trim();
    filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
  }
  const advisors = await Advisor.find(filter).sort('name');
  return { success: true, data: advisors };
};

// POST /api/advisors
export const createAdvisor = async (payload: any): Promise<any> => {
  const body = payload;
  if (!body.name) throw new ApiError(400, 'Advisor name is required');
  const advisor = new Advisor(body);
  await advisor.save();
  return { success: true, data: advisor };
};

// GET /api/advisors/:id
export const getAdvisor = async (routeParams: any): Promise<any> => {
  const advisor = await Advisor.findById(routeParams.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  return { success: true, data: advisor };
};

// PUT /api/advisors/:id
export const updateAdvisor = async (routeParams: any, payload: any): Promise<any> => {
  const advisor = await Advisor.findById(routeParams.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  const b = payload;
  const editable = ['name', 'email', 'phone', 'specializations', 'workingHours', 'availability', 'averageRating'];
  editable.forEach((k) => {
    if (b[k] !== undefined) advisor[k] = b[k];
  });
  await advisor.save();
  return { success: true, data: advisor };
};

// PATCH /api/advisors/:id/status
export const toggleAdvisorStatus = async (routeParams: any, payload: any): Promise<any> => {
  const { isActive } = payload;
  const advisor = await Advisor.findById(routeParams.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  if (typeof isActive === 'boolean') advisor.isActive = isActive;
  await advisor.save();
  return { success: true, data: advisor };
};

// GET /api/advisors/:id/workload
export const getAdvisorWorkload = async (routeParams: any): Promise<any> => {
  const advisor = await Advisor.findById(routeParams.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  const activeJobCards = await JobCard.find({
    'advisor.advisorId': advisor._id,
    status: { $not: /Delivered|Cancelled/ },
  }).sort('-createdAt');
  return { success: true, data: { advisor, activeJobCards } };
};

// GET /api/advisors/:id/customers
export const getAdvisorCustomers = async (routeParams: any): Promise<any> => {
  const advisor = await Advisor.findById(routeParams.id);
  if (!advisor) throw new ApiError(404, 'Advisor not found');
  const { default: Customer } = await import('../models/Customer.js');
  const customers = await Customer.find({ 'assignedAdvisor.advisorId': advisor._id }).sort('name');
  const jobCards = await JobCard.find({
    'advisor.advisorId': advisor._id,
    status: { $not: /Delivered|Cancelled/ },
  }).sort('-createdAt');
  return { success: true, data: { advisor, customers, activeJobCards: jobCards } };
};