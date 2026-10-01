import express from 'express';
import expressValidator from 'express-validator';
import {
  getJobCards,
  getJobCardStats,
  createJobCard,
  getJobCard,
  updateJobCard,
  deleteJobCard,
  updateJobCardStatus,
  assignAdvisor,
  recordAdvance,
  shareApproval,
  updateApproval,
} from '../controllers/jobCardController.js';
import { uploadDocument, getDocuments, getDocumentFile, deleteDocument, printJobCard } from '../controllers/documentController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { STATUS_VALUES } from '../models/JobCard.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getJobCards);

// Declared before `/:id` so "stats" is never treated as a job card id.
router.get('/stats', getJobCardStats);

// Only the fields the wizard cannot skip are required. Make/model/year are
// auto-filled from the vehicle lookup, so they stay optional here.
router.post(
  '/',
  [
    body('vehicle.registrationNumber').notEmpty().withMessage('Vehicle registration is required'),
    body('vehicle.odometerReading')
      .notEmpty()
      .withMessage('Odometer reading is required')
      .bail()
      .isNumeric()
      .withMessage('Odometer reading must be a number'),
    body('customer.name').notEmpty().withMessage('Customer name is required'),
    body('customer.phone')
      .customSanitizer((v) => String(v ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))
      .matches(/^\d{10}$/)
      .withMessage('Customer phone must be a 10-digit number'),
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
router.get(
  '/:id/documents/:docId/file',
  [param('id').isMongoId(), param('docId').isMongoId()],
  validate,
  getDocumentFile
);
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

// --- Service list: advance payment + customer approval ---------------------

// Record a partial payment. Amount 0 clears the advance.
router.patch(
  '/:id/advance',
  [
    param('id').isMongoId().withMessage('Invalid job card id'),
    body('amount').isNumeric().withMessage('Advance amount must be a number'),
  ],
  validate,
  recordAdvance
);

// Send the itemised service list to the customer and return the approval link.
router.post('/:id/approval/share', param('id').isMongoId().withMessage('Invalid job card id'), validate, shareApproval);

// Record the outcome at the desk (approved / changes requested / skipped).
router.patch(
  '/:id/approval',
  [
    param('id').isMongoId().withMessage('Invalid job card id'),
    body('status').notEmpty().withMessage('Approval status is required'),
  ],
  validate,
  updateApproval
);

export default router;
