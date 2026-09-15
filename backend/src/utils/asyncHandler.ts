import ApiError from './ApiError.js';

/**
 * Wraps async route handlers so rejected promises are forwarded
 * to the central error handler instead of crashing the process.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export default asyncHandler;