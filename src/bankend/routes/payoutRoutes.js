/**
 * routes/payoutRoutes.js
 * -----------------------
 * Routing for payout-related actions.
 */

import express from 'express';
import {
  releasePayout,
  issueRefund,
  payReturnRiderPayout,
} from '../controllers/paymentController.js';

const router = express.Router();

// ── Release sequence (rider + seller)
router.post('/release', releasePayout);

// ── Refund buyer
router.post('/refund', issueRefund);

// ── Pay return rider
router.post('/return-rider', payReturnRiderPayout);

export default router;
