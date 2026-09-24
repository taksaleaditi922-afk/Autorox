import express from 'express';
import expressValidator from 'express-validator';
import {
  getPublicApproval,
  respondPublicApproval,
} from '../controllers/publicApprovalController.js';
import validate from '../middleware/validate.js';

// Customer-facing endpoints. These are deliberately NOT behind `protect`: the
// opaque token in the URL is the credential, which is what makes the approval
// link usable on a phone without a login.
const router = express.Router();
const { body, param } = expressValidator;

const tokenParam = param('token')
  .isLength({ min: 16, max: 64 })
  .matches(/^[a-f0-9]+$/i)
  .withMessage('Invalid approval token');

router.get('/approvals/:token', tokenParam, validate, getPublicApproval);

router.post(
  '/approvals/:token/respond',
  [
    tokenParam,
    body('decision').isIn(['approve', 'changes']).withMessage("decision must be 'approve' or 'changes'"),
  ],
  validate,
  respondPublicApproval
);

export default router;
