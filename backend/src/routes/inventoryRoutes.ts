import express from 'express';
import { protect } from '../middleware/auth.js';
import * as controller from '../controllers/inventoryController.js';

const router = express.Router();
router.use(protect);
router.get('/', controller.getInventory);
router.get('/stats', controller.getStats);
router.get('/insights', controller.getInsights);
router.get('/alerts', controller.getAlerts);
router.get('/orders', controller.getOrders);
router.get('/inward', controller.getInward);
router.get('/issued', controller.getIssued);
router.get('/purchase-returns', controller.getReturns);
export default router;
