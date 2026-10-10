import Vehicle, { FUEL_TYPES } from '../models/Vehicle.js';
import Customer from '../models/Customer.js';
import ApiError from '../utils/ApiError.js';
import {
  RegistryNotConfiguredError,
  RegistryNotFoundError,
  RegistryUnavailableError,
  lookupVehicleInRegistry,
  normalizeRegistration,
} from './vehicleRegistry.js';

// GET /api/vehicles?q=&page=&limit=&owner=
export const getVehicles = async (filters: any): Promise<any> => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 10, 100);
  const skip = (page - 1) * limit;
  const filter: Record<string, any> = {};
  if (filters.owner) filter.owner = filters.owner;
  if (filters.q) {
    const q = filters.q.trim();
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
  return { success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// POST /api/vehicles
export const createVehicle = async (payload: any): Promise<any> => {
  const body = payload;
  const reg = body.registrationNumber?.toUpperCase();
  if (!reg) throw new ApiError(400, 'registrationNumber is required');
  const up = await Vehicle.findOne({ registrationNumber: reg });
  if (up) throw new ApiError(409, `Vehicle with registration ${reg} already exists`);
  const vehicle = new Vehicle({ ...body, registrationNumber: reg });
  await vehicle.save();
  if (body.owner) {
    await Customer.findByIdAndUpdate(body.owner, { $addToSet: { vehicles: vehicle._id } });
  }
  return { success: true, data: vehicle };
};

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

export const lookupVehicleByReg = async (routeParams: any): Promise<any> => {
  const reg = normalizeRegistration(routeParams.regNo || '');
  if (!REGISTRATION_PATTERN.test(reg)) {
    throw Object.assign(new ApiError(400, 'Enter a valid registration number, e.g. MH12AB1234'), { code: 'INVALID_REGISTRATION' });
  }

  // 1. Workshop master — free, instant and authoritative for our own records.
  const local = await Vehicle.findOne({ registrationNumber: reg }).lean();
  if (local) {
    return { success: true, data: { source: 'workshop', vehicle: local } };
  }

  // 2. Registry provider.
  try {
    const { vehicle, source } = await lookupVehicleInRegistry(reg);
    return { success: true, data: { source, vehicle: { ...vehicle, registrationNumber: reg } } };
  } catch (err) {
    if (err instanceof RegistryNotConfiguredError) {
      throw Object.assign(new ApiError(501, 'No vehicle registry provider is configured on the server.'), { code: 'NOT_CONFIGURED' });
    }
    if (err instanceof RegistryNotFoundError) {
      throw Object.assign(new ApiError(404, err.message), { code: 'NOT_FOUND' });
    }
    if (err instanceof RegistryUnavailableError) {
      throw Object.assign(new ApiError(502, err.message), { code: 'UNAVAILABLE' });
    }
    throw err;
  }
};

// GET /api/vehicles/byReg/:regNo
export const getVehicleByReg = async (routeParams: any): Promise<any> => {
  const vehicle = await Vehicle.findOne({
    registrationNumber: routeParams.regNo?.toUpperCase(),
  }).populate('owner');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  return { success: true, data: vehicle };
};

// GET /api/vehicles/:id
export const getVehicle = async (routeParams: any): Promise<any> => {
  const vehicle = await Vehicle.findById(routeParams.id).populate('owner');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  return { success: true, data: vehicle };
};

// PUT /api/vehicles/:id
export const updateVehicle = async (routeParams: any, payload: any): Promise<any> => {
  const vehicle = await Vehicle.findById(routeParams.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  const b = payload;
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
  return { success: true, data: vehicle };
};