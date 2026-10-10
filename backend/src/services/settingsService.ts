import Settings from '../models/Settings.js';
import ApiError from '../utils/ApiError.js';

// GET /api/settings
export const getSettings = async (): Promise<any> => {
  const settings = await Settings.getSingleton();
  return { success: true, data: settings };
};

// PUT /api/settings
export const updateSettings = async (payload: any): Promise<any> => {
  const settings = await Settings.getSingleton();
  const b = payload;
  if (b.company) settings.company = { ...settings.company, ...b.company };
  if (typeof b.taxRate === 'number') settings.taxRate = b.taxRate;
  if (b.currency) settings.currency = b.currency;
  await settings.save();
  return { success: true, data: settings };
};

// GET /api/settings/service-types
export const getServiceTypes = async (): Promise<any> => {
  const settings = await Settings.getSingleton();
  return { success: true, data: settings.serviceTypes };
};

// POST /api/settings/service-types
export const createServiceType = async (payload: any): Promise<any> => {
  const settings = await Settings.getSingleton();
  const { name, category } = payload;
  if (!name) throw new ApiError(400, 'Service type name is required');
  const exists = settings.serviceTypes.some((s) => s.name.toLowerCase() === name.toLowerCase());
  if (exists) throw new ApiError(409, 'Service type already exists');
  settings.serviceTypes.push({ name, category, isActive: true });
  await settings.save();
  return { success: true, data: settings.serviceTypes };
};

// DELETE /api/settings/service-types/:id
export const deleteServiceType = async (routeParams: any): Promise<any> => {
  const settings = await Settings.getSingleton();
  settings.serviceTypes = settings.serviceTypes.filter(
    (s) => s._id.toString() !== routeParams.id
  );
  await settings.save();
  return { success: true, data: settings.serviceTypes };
};