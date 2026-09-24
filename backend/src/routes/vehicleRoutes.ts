import express from 'express';
import expressValidator from 'express-validator';
import {
  getVehicles,
  getVehicle,
  getVehicleByReg,
  lookupVehicleByReg,
  createVehicle,
  updateVehicle,
} from '../controllers/vehicleController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = express.Router();
const { body, param } = expressValidator;

router.use(protect);

router.get('/', getVehicles);
// Static segments before /:id — `/lookup/:regNo` must not be read as an id.
router.get('/lookup/:regNo', lookupVehicleByReg);
router.get('/byReg/:regNo', getVehicleByReg);
router.post(
  '/',
  [
    body('registrationNumber').notEmpty().withMessage('Registration number is required'),
    body('make').notEmpty().withMessage('Make is required'),
    body('model').notEmpty().withMessage('Model is required'),
  ],
  validate,
  createVehicle
);

router
  .route('/:id')
  .get(param('id').isMongoId(), validate, getVehicle)
  .put(param('id').isMongoId(), validate, updateVehicle);

export default router;