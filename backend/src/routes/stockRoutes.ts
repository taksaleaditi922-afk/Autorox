import express from 'express';
import expressValidator from 'express-validator';
import {
  getStockTransactions,
  getProductTransactions,
  createStockTransaction,
  addProductStock,
  reduceProductStock,
} from '../controllers/stockTransactionController.js';
import { protect, authorize } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getStockTransactions);
router.post('/:productId/add', authorize('Admin', 'Service Manager', 'Service Advisor'), param('productId').isMongoId(), body('quantity').isFloat({ gt: 0 }), validate, addProductStock);
router.post('/:productId/reduce', authorize('Admin', 'Service Manager', 'Service Advisor'), param('productId').isMongoId(), body('quantity').isFloat({ gt: 0 }), body('reason').isIn(['sale', 'damage', 'return', 'correction']), validate, reduceProductStock);
router.get('/:productId', param('productId').isMongoId(), validate, getProductTransactions);
router.post(
  '/',
  [
    body('productId').isMongoId().withMessage('Invalid product id'),
    body('transactionType').notEmpty().withMessage('Transaction type is required'),
    body('quantity').isNumeric().withMessage('Quantity must be a number'),
  ],
  validate,
  createStockTransaction
);

export default router;
