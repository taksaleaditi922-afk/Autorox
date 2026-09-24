/**
 * Operational HTTP error.
 *
 * `details` carries structured, client-safe information such as the list of
 * validation problems returned by the error handler as `{ errors: [...] }`.
 */
class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: unknown;

  constructor(statusCode: number, message: string, isOperational = true, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (details !== undefined && details !== null) {
      this.details = details;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
