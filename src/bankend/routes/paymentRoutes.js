/**
 * routes/paymentRoutes.js
 * ------------------------
 * All /payments/** endpoints.
 *
 * Mount in app.js:
 *   import paymentRoutes from './routes/paymentRoutes.js';
 *   app.use('/payments', paymentRoutes);
 */

import { Router } from 'express';
import { authenticate, requireRole, validate } from '../middleware/auth.js';
import {
  initiatePayment,
  getPaymentBySession,
  releasePayment,
  refundPayment,
  verifyPayment,
} from '../controllers/paymentController.js';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

// ── POST /payments/initiate ──────────────────────────────────────────────────
// Buyer initiates escrow payment.
// Guard: authenticated + buyer role (paymentController also re-checks ownership).
router.post(
  '/initiate',
  validate(['session_id', 'phone', 'network', 'amount']),
  initiatePayment
);

// ── GET /payments/session/:session_id ────────────────────────────────────────
// Fetch payment record for a session (buyer, seller, or admin).
router.get('/session/:session_id', getPaymentBySession);

// ── GET /payments/verify/:reference ─────────────────────────────────────────
// Manually poll Kang to verify payment (fallback if webhook missed).
router.get('/verify/:reference', verifyPayment);

// ── POST /payments/release ───────────────────────────────────────────────────
// Release escrowed funds to seller.
// ADMIN / SYSTEM only — never exposed to buyer/seller directly.
router.post(
  '/release',
  requireRole('admin', 'system'),
  validate(['session_id']),
  releasePayment
);

// ── POST /payments/refund ────────────────────────────────────────────────────
// Refund escrowed funds to buyer.
// ADMIN only.
router.post(
  '/refund',
  requireRole('admin'),
  validate(['session_id']),
  refundPayment
);

export default router;
