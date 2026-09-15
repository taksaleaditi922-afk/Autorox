import expressValidator from 'express-validator';
import ApiError from '../utils/ApiError.js';

const { validationResult } = expressValidator;

/**
 * Validates request against express-validator chain attached to the route.
 * Throws a 422 with the field errors when validation fails.
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const details = errors.array().map((e) => ({
    field: e.param || e.path,
    message: e.msg,
    location: e.location,
  }));
  const first = details[0] ? details[0].message : 'Validation failed';
  return next(new ApiError(422, first, true, details));
};

export default validate;