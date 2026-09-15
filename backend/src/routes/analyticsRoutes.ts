import express from 'express';
import {
  dashboard,
  statusDistribution,
  serviceTypeDistribution,
  advisorPerformance,
} from '../controllers/analyticsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/dashboard', dashboard);
router.get('/status-distribution', statusDistribution);
router.get('/service-type-distribution', serviceTypeDistribution);
router.get('/advisor-performance', advisorPerformance);

export default router;