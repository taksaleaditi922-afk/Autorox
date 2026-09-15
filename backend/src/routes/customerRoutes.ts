import express from 'express';
import mongoose from 'mongoose';
import expressValidator from 'express-validator';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerVehicles,
  getCustomerJobCards,
  assignAdvisor,
} from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getCustomers);
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Customer name is required'),
    body('phone').notEmpty().matches(/^\d{10}$/).withMessage('Phone must be 10 digits'),
    body('email').optional().isEmail().withMessage('Email is invalid'),
  ],
  validate,
  createCustomer
);

router
  .route('/:id')
  .get(param('id').isMongoId(), validate, getCustomer)
  .put(param('id').isMongoId(), validate, updateCustomer)
  .delete(param('id').isMongoId(), validate, deleteCustomer);

router.get('/:id/vehicles', param('id').isMongoId(), validate, getCustomerVehicles);
router.get('/:id/jobcards', param('id').isMongoId(), validate, getCustomerJobCards);
router.patch(
  '/:id/assign-advisor',
  [
    param('id').isMongoId(),
    body('advisorId')
      .optional({ checkFalsy: true, nullable: true })
      .custom((v) => v === null || mongoose.isValidObjectId(v))
      .withMessage('advisorId must be null or a valid id'),
  ],
  validate,
  assignAdvisor
);

export default router;