import Vehicle, { FUEL_TYPES } from '../models/Vehicle.js';
import Customer from '../models/Customer.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/vehicles?q=&page=&limit=&owner=
export const getVehicles = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.q) {
    const q = req.query.q.trim();
    filter.$or = [
      { registrationNumber: { $regex: q.toUpperCase(), $options: 'i' } },
      { make: { $regex: q, $options: 'i' } },
      { model: { $regex: q, $options: 'i' } },
      { vin: { $regex: q.toUpperCase(), $options: 'i' } },
    ];
  }
  const [data, total] = await Promise.all([
    Vehicle.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('owner', 'name phone'),
    Vehicle.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// POST /api/vehicles
export const createVehicle = asyncHandler(async (req, res) => {
  const body = req.body;
  const reg = body.registrationNumber?.toUpperCase();
  if (!reg) throw new ApiError(400, 'registrationNumber is required');
  const up = await Vehicle.findOne({ registrationNumber: reg });
  if (up) throw new ApiError(409, `Vehicle with registration ${reg} already exists`);
  const vehicle = new Vehicle({ ...body, registrationNumber: reg });
  await vehicle.save();
  if (body.owner) {
    await Customer.findByIdAndUpdate(body.owner, { $addToSet: { vehicles: vehicle._id } });
  }
  res.status(201).json({ success: true, data: vehicle });
});

// GET /api/vehicles/byReg/:regNo
export const getVehicleByReg = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findOne({
    registrationNumber: req.params.regNo?.toUpperCase(),
  }).populate('owner');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json({ success: true, data: vehicle });
});

// GET /api/vehicles/:id
export const getVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id).populate('owner');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json({ success: true, data: vehicle });
});

// PUT /api/vehicles/:id
export const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  const b = req.body;
  const editable = [
    'make',
    'model',
    'year',
    'color',
    'fuelType',
    'engineCapacity',
    'vin',
    'odometerReading',
    'owner',
    'isActive',
  ];
  editable.forEach((k) => {
    if (b[k] !== undefined) vehicle[k] = b[k];
  });
  if (b.registrationNumber) {
    const reg = b.registrationNumber.toUpperCase();
    const dup = await Vehicle.findOne({ registrationNumber: reg, _id: { $ne: vehicle._id } });
    if (dup) throw new ApiError(409, `Registration ${reg} already exists`);
    vehicle.registrationNumber = reg;
  }
  await vehicle.save();
  res.json({ success: true, data: vehicle });
});