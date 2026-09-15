import express from 'express';
import expressValidator from 'express-validator';
import {
  getJobCards,
  createJobCard,
  getJobCard,
  updateJobCard,
  deleteJobCard,
  updateJobCardStatus,
  assignAdvisor,
} from '../controllers/jobCardController.js';
import { uploadDocument, getDocuments, deleteDocument, printJobCard } from '../controllers/documentController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { STATUS_VALUES } from '../models/JobCard.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getJobCards);

router.post(
  '/',
  [
    body('vehicle.registrationNumber').notEmpty().withMessage('Vehicle registration is required'),
    body('vehicle.make').notEmpty().withMessage('Vehicle make is required'),
    body('vehicle.model').notEmpty().withMessage('Vehicle model is required'),
    body('vehicle.year').isInt({ min: 1900, max: 2100 }).withMessage('Valid vehicle year is required'),
    body('vehicle.odometerReading').isNumeric().withMessage('Odometer reading is required'),
    body('customer.name').notEmpty().withMessage('Customer name is required'),
    body('customer.phone')
      .matches(/^\d{10}$/)
      .withMessage('Customer phone must be a 10-digit number'),
    body('service.description')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Service description is required (5-500 chars)'),
    body('service.estimatedDelivery').notEmpty().withMessage('Estimated delivery date is required'),
  ],
  validate,
  createJobCard
);

router.get('/analytics', (req, res) => res.status(404).json({ success: false, error: 'Use /api/analytics' }));

router.get('/byStatusCount', (req, res) => res.status(404).json({ success: false, error: 'Use /api/analytics' }));

router
  .route('/:id')
  .get(
    param('id').isMongoId().withMessage('Invalid job card id'),
    validate,
    getJobCard
  )
  .put(
    param('id').isMongoId().withMessage('Invalid job card id'),
    validate,
    updateJobCard
  )
  .delete(
    param('id').isMongoId().withMessage('Invalid job card id'),
    validate,
    deleteJobCard
  );

router.post('/:id/documents', upload.single('file'), uploadDocument);
router.get('/:id/documents', param('id').isMongoId(), validate, getDocuments);
router.delete('/:id/documents/:docId', param('id').isMongoId(), validate, deleteDocument);
router.post('/:id/print', param('id').isMongoId(), validate, printJobCard);

router.patch(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid job card id'),
    body('status').custom((v) => STATUS_VALUES.includes(v)).withMessage('Invalid status'),
  ],
  validate,
  updateJobCardStatus
);

router.patch(
  '/:id/assign-advisor',
  [param('id').isMongoId().withMessage('Invalid job card id'), body('advisorId').notEmpty()],
  validate,
  assignAdvisor
);

export default router;