import JobCard, { JOB_STATUS, STATUS_VALUES, PRIORITIES } from '../models/JobCard.js';
import { generateJobCardNumber } from '../utils/generators.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const SORTABLE = [
  'jobCardNumber',
  'status',
  'createdAt',
  'service.priority',
  'service.estimatedDelivery',
  'vehicle.registrationNumber',
];

// GET /api/jobcards?status=&priority=&advisor=&type=&insurance=&q=&from=&to=&page=&limit=&sort=
export const getJobCards = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && STATUS_VALUES.includes(req.query.status)) {
    filter.status = req.query.status;
  }
  if (req.query.priority && PRIORITIES.includes(req.query.priority)) {
    filter['service.priority'] = req.query.priority;
  }
  if (req.query.advisor) {
    filter['advisor.advisorId'] = req.query.advisor;
  }
  if (req.query.type) {
    filter['service.type'] = req.query.type;
  }
  if (req.query.insurance === 'true' || req.query.insurance === 'false') {
    filter['insurance.isClaim'] = req.query.insurance === 'true';
  }
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(req.query.from) : new Date(0);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    filter.createdAt = { $gte: from, $lte: to };
  }
  if (req.query.q) {
    const q = req.query.q.trim();
    filter.$or = [
      { jobCardNumber: { $regex: q, $options: 'i' } },
      { 'vehicle.registrationNumber': { $regex: q.toUpperCase(), $options: 'i' } },
      { 'customer.name': { $regex: q, $options: 'i' } },
      { 'customer.phone': { $regex: q, $options: 'i' } },
    ];
  }

  const sortField = SORTABLE.includes(req.query.sort) ? req.query.sort : '-createdAt';
  const sort = { [sortField.replace(/^-/, '')]: sortField.startsWith('-') ? -1 : 1 };

  const [items, total] = await Promise.all([
    JobCard.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('advisor.advisorId', 'name email phone'),
    JobCard.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/jobcards
export const createJobCard = asyncHandler(async (req, res) => {
  const body = req.body;
  const who = req.user?.email || req.user?.username || 'System';

  const jobCardNumber = body.jobCardNumber || generateJobCardNumber();
  const isDraft = body.isDraft === true || body.submitMode === 'draft';

  const existing = await JobCard.findOne({
    'vehicle.registrationNumber': body?.vehicle?.registrationNumber?.toUpperCase(),
    isDraft: false,
  });
  if (existing && !isDraft) {
    throw new ApiError(
      409,
      `A job card already exists for registration ${body.vehicle.registrationNumber}. Please create a new one.`
    );
  }

  const statusHistory = [
    {
      status: JOB_STATUS.NEW,
      changedBy: who,
      changedAt: new Date(),
      notes: isDraft ? 'Job card saved as draft' : 'Job card created',
    },
  ];

  const jobCard = new JobCard({
    ...body,
    jobCardNumber,
    isDraft,
    status: JOB_STATUS.NEW,
    statusHistory,
    audit: [{ action: isDraft ? 'Created (draft)' : 'Created', by: who, at: new Date() }],
    createdBy: who,
    updatedBy: who,
    ...(body.advisor?.advisorId ? { advisor: body.advisor } : {}),
  });

  await jobCard.save();

  syncExternalCounts(jobCard).catch(() => {});

  res.status(201).json({ success: true, data: jobCard });
});

// GET /api/jobcards/:id
export const getJobCard = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id).populate('advisor.advisorId');
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  res.json({ success: true, data: jobCard });
});

// PUT /api/jobcards/:id
export const updateJobCard = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  const who = req.user?.email || 'System';
  const patch = req.body;

  if (patch.jobCardNumber && patch.jobCardNumber !== jobCard.jobCardNumber) {
    throw new ApiError(400, 'Job card number cannot be changed');
  }

  if (patch.service) {
    Object.assign(jobCard.service, {
      type: patch.service.type ?? jobCard.service.type,
      description: patch.service.description ?? jobCard.service.description,
      estimatedDelivery: patch.service.estimatedDelivery ?? jobCard.service.estimatedDelivery,
      priority: patch.service.priority ?? jobCard.service.priority,
      specialInstructions: patch.service.specialInstructions ?? jobCard.service.specialInstructions,
    });
  }
  if (patch.vehicle) {
    Object.assign(jobCard.vehicle, {
      registrationNumber: patch.vehicle.registrationNumber ?? jobCard.vehicle.registrationNumber,
      make: patch.vehicle.make ?? jobCard.vehicle.make,
      model: patch.vehicle.model ?? jobCard.vehicle.model,
      year: patch.vehicle.year ?? jobCard.vehicle.year,
      color: patch.vehicle.color ?? jobCard.vehicle.color,
      fuelType: patch.vehicle.fuelType ?? jobCard.vehicle.fuelType,
      odometerReading: patch.vehicle.odometerReading ?? jobCard.vehicle.odometerReading,
      vin: patch.vehicle.vin ?? jobCard.vehicle.vin,
    });
  }
  if (patch.customer) {
    Object.assign(jobCard.customer, {
      name: patch.customer.name ?? jobCard.customer.name,
      email: patch.customer.email ?? jobCard.customer.email,
      phone: patch.customer.phone ?? jobCard.customer.phone,
      alternatePhone: patch.customer.alternatePhone ?? jobCard.customer.alternatePhone,
      address: patch.customer.address ?? jobCard.customer.address,
    });
  }
  if (patch.insurance) jobCard.insurance = { ...jobCard.insurance, ...patch.insurance };
  if (patch.corporate) jobCard.corporate = { ...jobCard.corporate, ...patch.corporate };
  if (patch.advisor) jobCard.advisor = { ...jobCard.advisor, ...patch.advisor };
  if (patch.notes !== undefined) jobCard.notes = patch.notes;

  jobCard.updatedBy = who;
  jobCard.audit = jobCard.audit || [];
  jobCard.audit.push({ action: 'Updated', by: who, at: new Date() });
  await jobCard.save();
  res.json({ success: true, data: jobCard });
});

// DELETE /api/jobcards/:id
export const deleteJobCard = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  if (!jobCard.isDraft && jobCard.status !== JOB_STATUS.NEW) {
    throw new ApiError(
      400,
      'Only draft or New job cards can be deleted. This job card is already in progress.'
    );
  }
  await jobCard.deleteOne();
  res.json({ success: true, message: 'Job card deleted' });
});

// PATCH /api/jobcards/:id/status
export const updateJobCardStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  if (!status || !STATUS_VALUES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${STATUS_VALUES.join(', ')}`);
  }
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');

  jobCard.status = status;
  jobCard.statusHistory = jobCard.statusHistory || [];
  jobCard.statusHistory.push({
    status,
    changedBy: req.user?.email || 'System',
    changedAt: new Date(),
    notes: notes || `Status changed to ${status}`,
  });
  if (status === JOB_STATUS.DELIVERED && !jobCard.service.actualDelivery) {
    jobCard.service.actualDelivery = new Date();
  }
  jobCard.updatedBy = req.user?.email || 'System';
  await jobCard.save();
  res.json({ success: true, data: jobCard, message: `Status updated to ${status}` });
});

// PATCH /api/jobcards/:id/assign-advisor
export const assignAdvisor = asyncHandler(async (req, res) => {
  const { advisorId, name, phone } = req.body;
  if (!advisorId) throw new ApiError(400, 'advisorId is required');
  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) throw new ApiError(404, 'Job card not found');
  jobCard.advisor = {
    advisorId,
    name: name || jobCard.advisor?.name,
    phone: phone || jobCard.advisor?.phone,
  };
  jobCard.updatedBy = req.user?.email || 'System';
  jobCard.audit = jobCard.audit || [];
  jobCard.audit.push({
    action: 'Advisor assigned',
    by: req.user?.email || 'System',
    at: new Date(),
  });
  await jobCard.save();
  res.json({ success: true, data: jobCard });
});

// Keep customer/vehicle counters in sync (best effort, non-critical)
async function syncExternalCounts(jobCard) {
  try {
    const { default: Customer } = await import('../models/Customer.js');
    const { default: Vehicle } = await import('../models/Vehicle.js');
    if (jobCard.customer?.customerId) {
      await Customer.findByIdAndUpdate(jobCard.customer.customerId, {
        $inc: { totalJobCards: 1 },
      });
    }
    if (jobCard.vehicleRef) {
      const vehicle = await Vehicle.findById(jobCard.vehicleRef);
      if (vehicle) {
        vehicle.serviceHistory = vehicle.serviceHistory || [];
        vehicle.serviceHistory.push(jobCard._id);
        vehicle.totalServiceCount = (vehicle.totalServiceCount || 0) + 1;
        vehicle.lastServiceDate = new Date();
        await vehicle.save();
      }
    }
  } catch (err) {
    console.error('syncExternalCounts failed', err.message);
  }
}