import express from 'express';
import expressValidator from 'express-validator';
import {
  getSettings,
  updateSettings,
  getServiceTypes,
  createServiceType,
  deleteServiceType,
} from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getSettings);
router.put(
  '/',
  authorize('Admin'),
  updateSettings
);

router.get('/service-types', getServiceTypes);
router.post(
  '/service-types',
  authorize('Admin', 'Service Manager'),
  [body('name').notEmpty().withMessage('Service type name is required')],
  validate,
  createServiceType
);
router.delete('/service-types/:id', authorize('Admin'), param('id').isMongoId(), validate, deleteServiceType);

export default router;