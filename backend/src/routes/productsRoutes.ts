import express from 'express';
import expressValidator from 'express-validator';
import {
  getProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  checkStock,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getProducts);
router.post(
  '/',
  authorize('Admin', 'Service Manager', 'Service Advisor'),
  [
    body('productCode').notEmpty().withMessage('Product code is required'),
    body('productName').notEmpty().withMessage('Product name is required'),
    body('pricing.sellingPrice').optional().isNumeric().withMessage('Selling price must be a number'),
  ],
  validate,
  createProduct
);

router.route('/:id')
  .get(param('id').isMongoId(), validate, getProduct)
  .put(authorize('Admin', 'Service Manager'), param('id').isMongoId(), validate, updateProduct)
  .delete(authorize('Admin'), param('id').isMongoId(), validate, deleteProduct);

router.patch(
  '/:id/stock',
  [
    param('id').isMongoId(),
    body('quantity').optional().isNumeric().withMessage('Quantity must be a number'),
  ],
  validate,
  updateStock
);

router.get('/check-stock/:id', param('id').isMongoId(), validate, checkStock);

export default router;
