import express from 'express';
import {
  downloadInventoryTemplate,
  exportInventoryCsv,
  getInventoryAlerts,
  getInventoryOptions,
  getInventoryStats,
  getProcurementReceipts,
  importInventoryCsv,
  previewInventoryImport,
  receiveProcurement,
} from '../controllers/inventoryController.js';
import * as controller from '../controllers/inventoryController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.get('/', controller.getInventory);
router.get('/stats', getInventoryStats);
router.get('/insights', controller.getInsights);
router.get('/alerts', getInventoryAlerts);
router.get('/orders', controller.getOrders);
router.get('/inward', controller.getInward);
router.post('/inward', authorize('Admin', 'Service Manager'), receiveProcurement);
router.get('/receipts', getProcurementReceipts);
router.get('/issued', controller.getIssued);
router.get('/purchase-returns', controller.getReturns);
router.get('/options', getInventoryOptions);
router.get('/export', exportInventoryCsv);
router.get('/template', downloadInventoryTemplate);
router.post('/import/preview', authorize('Admin', 'Service Manager'), previewInventoryImport);
router.post('/import', authorize('Admin', 'Service Manager'), importInventoryCsv);

export default router;
