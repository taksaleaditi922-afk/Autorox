import express from 'express';
import { jobCardReport } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/jobcards', jobCardReport);

export default router;