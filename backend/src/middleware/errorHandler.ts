import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

/**
 * Central error handler. Always responds with structured JSON:
 *   { success: false, error: message, errors?: unknown }
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.details || null;
  if (err.name === 'VersionError') {
    statusCode = 409;
    message = 'This job card changed while you were editing. Refresh and try again.';
  }

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
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Upload error: file is larger than the allowed limit'
        : `Upload error: ${err.message}`;
  }

  // Rejected by the upload fileFilter (plain Error, not a MulterError).
  if (!err.statusCode && !err.name && /File type not allowed/i.test(String(err.message))) {
    statusCode = 400;
  }

  const response = {
    success: false,
    error: message,
  } as Record<string, unknown>;
  if (errors) response.errors = errors;
  if (env.nodeEnv === 'development' && typeof err.stack === 'string') {
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
