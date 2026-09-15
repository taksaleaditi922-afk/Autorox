import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import env from '../config/env.js';

export const signTokens = (user) => {
  const payload = { sub: user._id.toString(), role: user.role };
  const accessToken = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtAccessExpires,
  });
  const refreshToken = jwt.sign({ sub: user._id.toString(), type: 'refresh' }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires,
  });
  return { accessToken, refreshToken };
};

/** Verify access token; attach req.user */
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }
  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw new ApiError(401, 'Not authorized, invalid or expired token');
  }
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Not authorized, user not found or deactivated');
  }
  req.user = user;
  next();
});

/** Verify a refresh token string, returns payload */
export const verifyRefreshToken = (token) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, env.jwtRefreshSecret, (err, decoded) => {
      if (err || decoded.type !== 'refresh') {
        reject(new ApiError(401, 'Invalid refresh token'));
      } else {
        resolve(decoded);
      }
    });
  });

/** Role-based access control. Allow listed roles (or all when empty). */
export const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized'));
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Role '${req.user.role}' is not permitted to perform this action`)
      );
    }
    return next();
  };