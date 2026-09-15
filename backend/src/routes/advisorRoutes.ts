import express from 'express';
import expressValidator from 'express-validator';
import {
  getAdvisors,
  getAdvisor,
  createAdvisor,
  updateAdvisor,
  toggleAdvisorStatus,
  getAdvisorWorkload,
  getAdvisorCustomers,
} from '../controllers/advisorController.js';
import { protect, authorize } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getAdvisors);
router.post(
  '/',
  authorize('Admin', 'Service Manager'),
  [body('name').notEmpty().withMessage('Advisor name is required')],
  validate,
  createAdvisor
);

router.get('/load', (req, res) => res.status(404).json({ success: false, error: 'Use /:id/workload' }));

router
  .route('/:id')
  .get(param('id').isMongoId(), validate, getAdvisor)
  .put(authorize('Admin', 'Service Manager'), param('id').isMongoId(), validate, updateAdvisor);

router.patch(
  '/:id/status',
  authorize('Admin', 'Service Manager'),
  param('id').isMongoId(),
  validate,
  toggleAdvisorStatus
);

router.get('/:id/workload', param('id').isMongoId(), validate, getAdvisorWorkload);
router.get('/:id/customers', param('id').isMongoId(), validate, getAdvisorCustomers);

export default router;