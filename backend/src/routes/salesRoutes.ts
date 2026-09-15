import express from 'express';
import expressValidator from 'express-validator';
import {
  getSales,
  createSale,
  getSale,
  updateSale,
  deleteSale,
  updateSaleStatus,
  recordPayment,
  getPaymentHistory,
  getInvoice,
} from '../controllers/saleController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getSales);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one product is required'),
    body('customer.name').notEmpty().withMessage('Customer name is required'),
    body('customer.phone').notEmpty().withMessage('Customer phone is required'),
  ],
  validate,
  createSale
);

router.route('/:id')
  .get(param('id').isMongoId(), validate, getSale)
  .put(param('id').isMongoId(), validate, updateSale)
  .delete(param('id').isMongoId(), validate, deleteSale);

router.patch(
  '/:id/status',
  [
    param('id').isMongoId(),
    body('status').custom((v) => ['Invoice', 'Pending', 'Paid', 'Cancelled'].includes(v)).withMessage('Invalid status'),
  ],
  validate,
  updateSaleStatus
);

router.post(
  '/:id/payment',
  [
    param('id').isMongoId(),
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  ],
  validate,
  recordPayment
);

router.get('/:id/payments', param('id').isMongoId(), validate, getPaymentHistory);
router.post('/:id/invoice', param('id').isMongoId(), validate, getInvoice);

export default router;
