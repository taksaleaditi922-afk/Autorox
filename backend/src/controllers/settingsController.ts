import Settings from '../models/Settings.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/settings
export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await Settings.getSingleton();
  res.json({ success: true, data: settings });
});

// PUT /api/settings
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const b = req.body;
  if (b.company) settings.company = { ...settings.company, ...b.company };
  if (typeof b.taxRate === 'number') settings.taxRate = b.taxRate;
  if (b.currency) settings.currency = b.currency;
  await settings.save();
  res.json({ success: true, data: settings });
});

// GET /api/settings/service-types
export const getServiceTypes = asyncHandler(async (_req, res) => {
  const settings = await Settings.getSingleton();
  res.json({ success: true, data: settings.serviceTypes });
});

// POST /api/settings/service-types
export const createServiceType = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const { name, category } = req.body;
  if (!name) throw new ApiError(400, 'Service type name is required');
  const exists = settings.serviceTypes.some((s) => s.name.toLowerCase() === name.toLowerCase());
  if (exists) throw new ApiError(409, 'Service type already exists');
  settings.serviceTypes.push({ name, category, isActive: true });
  await settings.save();
  res.status(201).json({ success: true, data: settings.serviceTypes });
});

// DELETE /api/settings/service-types/:id
export const deleteServiceType = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  settings.serviceTypes = settings.serviceTypes.filter(
    (s) => s._id.toString() !== req.params.id
  );
  await settings.save();
  res.json({ success: true, data: settings.serviceTypes });
});