import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { signTokens, verifyRefreshToken } from '../middleware/auth.js';

// POST /api/auth/login
export const login = async (payload: any): Promise<any> => {
  const { email, password } = payload;
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Account is deactivated. Contact an administrator.');
  }
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const { accessToken, refreshToken } = signTokens(user);

  return {
    success: true,
    accessToken,
    refreshToken,
    user: user.toSafeJSON(),
  };
};

// POST /api/auth/change-password
export const changePassword = async (payload: any): Promise<any> => {
  const { email, currentPassword, newPassword } = payload;
  if (!email || !currentPassword || !newPassword) {
    throw new ApiError(400, 'Email, current password, and new password are required');
  }
  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !user.isActive || !(await user.matchPassword(currentPassword))) {
    throw new ApiError(401, 'Invalid email or current password');
  }

  user.password = newPassword;
  await user.save();
  return { success: true, message: 'Password changed successfully' };
};

// POST /api/auth/refresh-token
export const refreshToken = async (payload: any): Promise<any> => {
  const token = payload.refreshToken;
  if (!token) {
    throw new ApiError(401, 'No refresh token provided');
  }
  const decoded = await verifyRefreshToken(token);
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'User not found or deactivated');
  }
  const tokens = signTokens(user);

  return { success: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: user.toSafeJSON() };
};

// POST /api/auth/logout
export const logout = async (): Promise<any> => {

  return { success: true, message: 'Logged out successfully' };
};

// GET /api/auth/me
export const me = async (actor: any): Promise<any> => {
  return { success: true, user: actor.toSafeJSON() };
};