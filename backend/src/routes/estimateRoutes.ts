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
import {
  getEstimateConfig,
  getNextEstimateNumber,
  getCatalogServices,
  getCatalogPackages,
  getCatalogParts,
  getCatalogLabour,
  getInspectionTemplate,
  createInspectionCategory,
  createDraft,
  updateDraft,
  deleteEstimate,
  generateEstimate,
  getPayments,
  addPayment,
  deletePayment,
  uploadEstimateMedia,
  downloadEstimateMedia,
  deleteEstimateMedia,
  renderEstimatePdf,
  shareEstimate,
} from '../controllers/estimateDraftController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { param, body } = expressValidator;

router.use(protect);

const idParam = param('id').isMongoId().withMessage('Invalid estimate id');

// ---------------------------------------------------------------------------
// Static routes first — they must not be swallowed by /:id.
// ---------------------------------------------------------------------------

router.get('/', getEstimates);

router.get('/config', getEstimateConfig);
router.get('/next-number', getNextEstimateNumber);

router.get('/catalog/services', getCatalogServices);
router.get('/catalog/packages', getCatalogPackages);
router.get('/catalog/parts', getCatalogParts);
router.get('/catalog/labour', getCatalogLabour);

router.get('/inspection/template', getInspectionTemplate);
router.post(
  '/inspection/categories',
  [body('name').notEmpty().withMessage('Category name is required')],
  validate,
  createInspectionCategory
);

router.post('/drafts', createDraft);

router.post(
  '/',
  [body('jobCardId').isMongoId().withMessage('Invalid job card')],
  validate,
  createEstimate
);

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

router.put('/:id/draft', [idParam], validate, updateDraft);
router.post('/:id/generate', [idParam], validate, generateEstimate);
router.delete('/:id', [idParam], validate, deleteEstimate);

// ---------------------------------------------------------------------------
// Advance payments
// ---------------------------------------------------------------------------

router.get('/:id/payments', [idParam], validate, getPayments);
router.post(
  '/:id/payments',
  [
    idParam,
    body('amount').isNumeric().withMessage('Advance amount must be a number'),
    body('date').optional({ checkFalsy: true }).isISO8601().withMessage('Payment date is invalid'),
  ],
  validate,
  addPayment
);
router.delete('/:id/payments/:paymentId', [idParam], validate, deletePayment);

// ---------------------------------------------------------------------------
// Media (stored privately, streamed through an authenticated route)
// ---------------------------------------------------------------------------

router.post('/:id/media', [idParam], validate, upload.single('file'), uploadEstimateMedia);
router.get('/:id/media/:mediaId', [idParam], validate, downloadEstimateMedia);
router.delete('/:id/media/:mediaId', [idParam], validate, deleteEstimateMedia);

// ---------------------------------------------------------------------------
// Document / sharing
// ---------------------------------------------------------------------------

router.get('/:id/pdf', [idParam], validate, renderEstimatePdf);
router.post('/:id/share', [idParam], validate, shareEstimate);

// ---------------------------------------------------------------------------
// Detail + legacy actions
// ---------------------------------------------------------------------------

router
  .route('/:id')
  .get(idParam, validate, getEstimate)
  .put(idParam, validate, updateEstimate);

router.patch('/:id/approve', [idParam], validate, approveEstimate);
router.patch('/:id/reject', [idParam], validate, rejectEstimate);
router.post('/:id/send-email', [idParam], validate, sendEstimateEmail);
router.post('/:id/convert-invoice', [idParam], validate, convertToInvoice);

export default router;
