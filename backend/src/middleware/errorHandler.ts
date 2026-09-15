import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

/**
 * Central error handler. Always responds with structured JSON:
 *   { success, message, errors?, stack? }
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = 'Validation failed';
  }

  // Duplicate key (unique index) error
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate value for: ${fields || 'unique field'}`;
  }

  // CastError from invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Multer file size / type errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = `Upload error: ${err.message}`;
  }

  const response = {
    success: false,
    error: message,
  };
  if (errors) response.errors = errors;
  if (env.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack;
  }

  if (statusCode >= 500) {
    console.error('[Error]', err);
  } else {
    console.error(`[${statusCode}]`, message);
  }

  res.status(statusCode).json(response);
};

/** Helper to throw ApiError from a controller. */
export { ApiError };