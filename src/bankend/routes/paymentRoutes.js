/**
 * routes/payoutRoutes.js
 * -----------------------
 * Payout endpoints — all require system/admin authentication.
 *
 * POST /payouts/release         → full OTP-confirmed payout sequence
 * POST /payouts/refund          → buyer refund with fee policy enforcement
 * POST /payouts/return-rider    → pay the return rider after RETURNED state
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  releasePayout,
  issueRefund,
  payReturnRiderPayout,
} from '../controllers/payoutController.js';

const router = express.Router();

// All payout routes require authentication and admin/system role
router.use(authenticate);
router.use(requireRole(['admin', 'system']));

router.post('/release',       releasePayout);
router.post('/refund',        issueRefund);
router.post('/return-rider',  payReturnRiderPayout);

export default router;
