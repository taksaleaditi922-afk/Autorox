import express from 'express';
import {
  downloadInventoryTemplate, exportInventoryCsv, getInventoryAlerts, getInventoryOptions,
  getInventoryStats, getProcurementReceipts, importInventoryCsv, previewInventoryImport,
  receiveProcurement,
} from '../controllers/inventoryController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.get('/stats', getInventoryStats);
router.get('/alerts', getInventoryAlerts);
router.get('/options', getInventoryOptions);
router.get('/export', exportInventoryCsv);
router.get('/template', downloadInventoryTemplate);
router.post('/import/preview', authorize('Admin', 'Service Manager'), previewInventoryImport);
router.post('/import', authorize('Admin', 'Service Manager'), importInventoryCsv);
router.get('/inward', getProcurementReceipts);
router.post('/inward', authorize('Admin', 'Service Manager'), receiveProcurement);

export default router;
