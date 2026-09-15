import express from 'express';
import expressValidator from 'express-validator';
import {
  createEstimate,
  getEstimates,
  getEstimate,
  updateEstimate,
  approveEstimate,
  rejectEstimate,
  sendEstimateEmail,
  convertToInvoice,
} from '../controllers/estimateController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { param, body } = expressValidator;

router.use(protect);

router.get('/', getEstimates);
router.post(
  '/',
  [body('jobCardId').isMongoId().withMessage('Invalid job card')],
  validate,
  createEstimate
);

router
  .route('/:id')
  .get(param('id').isMongoId(), validate, getEstimate)
  .put(param('id').isMongoId(), validate, updateEstimate);

router.patch('/:id/approve', param('id').isMongoId(), validate, approveEstimate);
router.patch('/:id/reject', param('id').isMongoId(), validate, rejectEstimate);
router.post('/:id/send-email', param('id').isMongoId(), validate, sendEstimateEmail);
router.post('/:id/convert-invoice', param('id').isMongoId(), validate, convertToInvoice);

export default router;