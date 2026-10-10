import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/authService.js';

export const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  const { refreshToken, ...response } = result;
  res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json(response);
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await service.changePassword(req.body);
  res.json(result);
});

export const refreshToken = asyncHandler(async (req, res) => {
  const result = await service.refreshToken({ refreshToken: req.cookies?.refreshToken || req.body?.refreshToken });
  const { refreshToken, ...response } = result;
  res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json(response);
});

export const logout = asyncHandler(async (req, res) => {
  const result = await service.logout();
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  const result = await service.me(req.user);
  res.json(result);
});
