import Vehicle, { FUEL_TYPES } from '../models/Vehicle.js';
import Customer from '../models/Customer.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  RegistryNotConfiguredError,
  RegistryNotFoundError,
  RegistryUnavailableError,
  lookupVehicleInRegistry,
  normalizeRegistration,
} from '../services/vehicleRegistry.js';

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

// GET /api/vehicles/lookup/:regNo
//
// Resolves a registration number in this order:
//   1. the workshop's own vehicle master
//   2. the registry provider configured on the server (cached)
//
// Every failure answers with an explicit `code` so the client can tell "we do
// not have this vehicle" apart from "no provider is configured here", which
// are very different messages for the advisor to read.
const REGISTRATION_PATTERN = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;

export const lookupVehicleByReg = asyncHandler(async (req, res) => {
  const reg = normalizeRegistration(req.params.regNo || '');
  if (!REGISTRATION_PATTERN.test(reg)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REGISTRATION',
      error: 'Enter a valid registration number, e.g. MH12AB1234',
    });
  }

  // 1. Workshop master — free, instant and authoritative for our own records.
  const local = await Vehicle.findOne({ registrationNumber: reg }).lean();
  if (local) {
    return res.json({ success: true, data: { source: 'workshop', vehicle: local } });
  }

  // 2. Registry provider.
  try {
    const { vehicle, source } = await lookupVehicleInRegistry(reg);
    return res.json({ success: true, data: { source, vehicle: { ...vehicle, registrationNumber: reg } } });
  } catch (err) {
    if (err instanceof RegistryNotConfiguredError) {
      return res.status(501).json({
        success: false,
        code: 'NOT_CONFIGURED',
        error: 'No vehicle registry provider is configured on the server.',
      });
    }
    if (err instanceof RegistryNotFoundError) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', error: err.message });
    }
    if (err instanceof RegistryUnavailableError) {
      return res.status(502).json({ success: false, code: 'UNAVAILABLE', error: err.message });
    }
    throw err;
  }
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