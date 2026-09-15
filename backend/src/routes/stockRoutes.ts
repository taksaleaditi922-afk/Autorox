import express from 'express';
import expressValidator from 'express-validator';
import {
  getStockTransactions,
  getProductTransactions,
  createStockTransaction,
} from '../controllers/stockTransactionController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getStockTransactions);
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
