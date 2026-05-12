/**
 * controllers/paymentController.js
 * ----------------------------------
 * Handles payment initiation, status queries, and manual
 * payout/refund triggers (admin-only).
 *
 * All escrow-sensitive mutations use atomic MongoDB operations
 * to prevent race conditions.
 */

import crypto from 'crypto';
import Payment from '../models/Payment.js';
import DealSession from '../models/DealSession.js';
import {
  initiateKangPayment,
  checkKangPaymentStatus,
  payoutToSeller,
  refundToBuyer,
  generateTransactionRef,
} from '../services/paymentService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('237')) return digits;
  if (digits.startsWith('0'))   return `237${digits.slice(1)}`;
  return `237${digits}`;
}

function sendError(res, status, message, details = {}) {
  return res.status(status).json({ success: false, message, ...details });
}

// ─── POST /payments/initiate ──────────────────────────────────────────────────
/**
 * Buyer initiates an escrow payment.
 *
 * Guards:
 *  - Authenticated buyer only
 *  - Session must be in PRODUCT_CONFIRMED state
 *  - No existing pending/paid payment for this session (idempotency)
 *
 * Body: { session_id, phone, network, amount }
 */
export async function initiatePayment(req, res) {
  try {
    const { session_id, phone, network, amount } = req.body;
    const userId = req.user.id;

    // ── 1. Input validation ──
    if (!session_id || !phone || !network || !amount) {
      return sendError(res, 400, 'Missing required fields: session_id, phone, network, amount');
    }
    if (!['mtn', 'orange'].includes(network)) {
      return sendError(res, 400, 'Invalid network. Must be "mtn" or "orange"');
    }
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount < 100) {
      return sendError(res, 400, 'Amount must be an integer ≥ 100 XAF');
    }

    // ── 2. Load session ──
    const session = await DealSession.findById(session_id).lean();
    if (!session) {
      return sendError(res, 404, 'Deal session not found');
    }

    // ── 3. Authorize: only the buyer of this session ──
    if (String(session.buyer_id) !== String(userId)) {
      return sendError(res, 403, 'Only the buyer of this session can initiate payment');
    }

    // ── 4. Enforce state machine ──
    if (session.status !== 'PRODUCT_CONFIRMED') {
      return sendError(res, 409, `Payment not allowed in status "${session.status}". Session must be PRODUCT_CONFIRMED.`);
    }

    // ── 5. Idempotency: check for existing active payment ──
    const existingPayment = await Payment.findOne({
      session_id,
      status: { $in: ['pending', 'paid'] },
    }).lean();

    if (existingPayment) {
      // Return existing payment info so frontend can show appropriate state
      return res.status(200).json({
        success: true,
        idempotent: true,
        message: 'Payment already in progress',
        payment: {
          id: existingPayment._id,
          status: existingPayment.status,
          transaction_reference: existingPayment.transaction_reference,
          amount: existingPayment.amount,
        },
      });
    }

    // ── 6. Generate transaction reference ──
    const transactionRef = generateTransactionRef(session_id);
    const formattedPhone = formatPhone(phone);

    // ── 7. Persist payment record as "pending" BEFORE calling Kang ──
    //    This ensures we have a record even if the Kang call partially
    //    succeeds before a network failure.
    const payment = await Payment.create({
      session_id,
      buyer_id:  session.buyer_id,
      seller_id: session.seller_id,
      amount:    parsedAmount,
      currency:  session.currency || 'XAF',
      phone:     formattedPhone,
      network,
      transaction_reference: transactionRef,
      status: 'pending',
    });

    // ── 8. Transition session → PAYMENT_PENDING ──
    await DealSession.findByIdAndUpdate(session_id, {
      status:     'PAYMENT_PENDING',
      payment_id: payment._id,
    });

    // ── 9. Call Kang API ──
    let kangResult;
    try {
      kangResult = await initiateKangPayment({
        amount:     parsedAmount,
        phone:      formattedPhone,
        network,
        reference:  transactionRef,
        session_id: String(session_id),
        description: `Escrow: ${session.title || 'TrustDeals purchase'}`,
      });
    } catch (kangErr) {
      // Kang call failed — revert status so buyer can retry
      await Payment.findByIdAndUpdate(payment._id, { status: 'failed', failed_at: new Date() });
      await DealSession.findByIdAndUpdate(session_id, { status: 'PRODUCT_CONFIRMED', payment_id: null });

      console.error('[PaymentController] Kang initiation failed:', kangErr.message);
      return sendError(res, 502, 'Payment gateway error. Please try again.', {
        detail: process.env.NODE_ENV === 'development' ? kangErr.message : undefined,
      });
    }

    // ── 10. Store Kang's payment ID ──
    await Payment.findByIdAndUpdate(payment._id, {
      kang_payment_id: kangResult.kang_payment_id,
    });

    // ── 11. Respond ──
    return res.status(201).json({
      success: true,
      message: 'Payment initiated. Buyer will receive a MoMo prompt.',
      payment: {
        id:                    payment._id,
        status:                'pending',
        transaction_reference: transactionRef,
        amount:                parsedAmount,
        network,
        kang_payment_id:       kangResult.kang_payment_id,
      },
      session: {
        id:     session_id,
        status: 'PAYMENT_PENDING',
      },
    });
  } catch (err) {
    console.error('[PaymentController] initiatePayment error:', err);
    return sendError(res, 500, 'Internal server error');
  }
}

// ─── GET /payments/session/:session_id ───────────────────────────────────────
/**
 * Fetch payment record for a session.
 * Accessible by buyer, seller, or admin.
 */
export async function getPaymentBySession(req, res) {
  try {
    const { session_id } = req.params;
    const userId = req.user.id;

    const session = await DealSession.findById(session_id).lean();
    if (!session) return sendError(res, 404, 'Session not found');

    // Authorization: must be a party to the session or admin
    const isParty = [String(session.buyer_id), String(session.seller_id)].includes(String(userId));
    if (!isParty && req.user.role !== 'admin') {
      return sendError(res, 403, 'Access denied');
    }

    const payment = await Payment.findOne({ session_id }).lean();
    if (!payment) return sendError(res, 404, 'No payment found for this session');

    return res.json({ success: true, payment });
  } catch (err) {
    console.error('[PaymentController] getPaymentBySession:', err);
    return sendError(res, 500, 'Internal server error');
  }
}

// ─── POST /payments/release ─────────────────────────────────────────────────
/**
 * Release escrowed funds to the seller.
 * CRITICAL: Can ONLY be called after:
 *   1. Session status is DELIVERED
 *   2. OTP is verified (otp_verified = true on session)
 *
 * Access: admin or system only (protected by role middleware)
 *
 * Body: { session_id }
 */
export async function releasePayment(req, res) {
  try {
    const { session_id } = req.body;
    if (!session_id) return sendError(res, 400, 'session_id is required');

    // ── 1. Load session ──
    const session = await DealSession.findById(session_id);
    if (!session) return sendError(res, 404, 'Session not found');

    // ── 2. Enforce prerequisites ──
    if (session.status !== 'DELIVERED') {
      return sendError(res, 409, `Cannot release payment: session status is "${session.status}" (must be DELIVERED)`);
    }
    if (!session.otp_verified) {
      return sendError(res, 409, 'Cannot release payment: delivery OTP not yet verified');
    }
    if (!session.seller_phone || !session.seller_network) {
      return sendError(res, 422, 'Seller payout details (phone, network) not set on session');
    }

    // ── 3. Load payment ──
    const payment = await Payment.findOne({ session_id, status: 'paid' });
    if (!payment) {
      return sendError(res, 409, 'No escrowed payment found (must be in "paid" status)');
    }

    // ── 4. Call Kang payout ──
    let payoutResult;
    try {
      payoutResult = await payoutToSeller({
        amount:     payment.amount,
        phone:      session.seller_phone,
        network:    session.seller_network,
        session_id: String(session_id),
        description: `Seller payout: ${session.title}`,
      });
    } catch (kangErr) {
      console.error('[PaymentController] Payout failed:', kangErr.message);
      return sendError(res, 502, 'Payout failed. Please retry or contact support.', {
        detail: process.env.NODE_ENV === 'development' ? kangErr.message : undefined,
      });
    }

    // ── 5. Update payment & session atomically (best-effort) ──
    await Promise.all([
      Payment.findByIdAndUpdate(payment._id, {
        status:           'released',
        payout_reference: payoutResult.payout_reference,
        seller_phone:     session.seller_phone,
        seller_network:   session.seller_network,
        released_at:      new Date(),
      }),
      DealSession.findByIdAndUpdate(session_id, {
        status:       'COMPLETED',
        completed_at: new Date(),
      }),
    ]);

    return res.json({
      success: true,
      message: 'Funds released to seller. Session marked COMPLETED.',
      payout: {
        reference: payoutResult.payout_reference,
        status:    payoutResult.status,
        amount:    payment.amount,
      },
    });
  } catch (err) {
    console.error('[PaymentController] releasePayment error:', err);
    return sendError(res, 500, 'Internal server error');
  }
}

// ─── POST /payments/refund ───────────────────────────────────────────────────
/**
 * Refund escrowed funds to the buyer.
 * Triggered when delivery fails or buyer rejects product.
 *
 * Access: admin only
 *
 * Body: { session_id, reason }
 */
export async function refundPayment(req, res) {
  try {
    const { session_id, reason } = req.body;
    if (!session_id) return sendError(res, 400, 'session_id is required');

    // ── 1. Load session ──
    const session = await DealSession.findById(session_id).lean();
    if (!session) return sendError(res, 404, 'Session not found');

    // ── 2. Enforce preconditions ──
    const refundableStatuses = ['PAYMENT_LOCKED', 'RIDER_ASSIGNED', 'IN_TRANSIT', 'DELIVERED'];
    if (!refundableStatuses.includes(session.status)) {
      return sendError(res, 409, `Refund not applicable in status "${session.status}"`);
    }

    // ── 3. Load payment ──
    const payment = await Payment.findOne({ session_id, status: 'paid' });
    if (!payment) {
      return sendError(res, 409, 'No escrowed (paid) payment found to refund');
    }

    // ── 4. Call Kang refund (disbursement back to buyer) ──
    let refundResult;
    try {
      refundResult = await refundToBuyer({
        amount:     payment.amount,
        phone:      payment.phone,
        network:    payment.network,
        session_id: String(session_id),
      });
    } catch (kangErr) {
      console.error('[PaymentController] Refund failed:', kangErr.message);
      return sendError(res, 502, 'Refund failed. Please retry or contact support.', {
        detail: process.env.NODE_ENV === 'development' ? kangErr.message : undefined,
      });
    }

    // ── 5. Update records ──
    await Promise.all([
      Payment.findByIdAndUpdate(payment._id, {
        status:            'refunded',
        payout_reference:  refundResult.refund_reference,
        refunded_at:       new Date(),
      }),
      DealSession.findByIdAndUpdate(session_id, {
        status:      'RETURNED',
        returned_at: new Date(),
      }),
    ]);

    return res.json({
      success: true,
      message: 'Refund issued to buyer. Session marked RETURNED.',
      refund: {
        reference: refundResult.refund_reference,
        status:    refundResult.status,
        amount:    payment.amount,
        reason,
      },
    });
  } catch (err) {
    console.error('[PaymentController] refundPayment error:', err);
    return sendError(res, 500, 'Internal server error');
  }
}

// ─── POST /payments/verify/:reference ────────────────────────────────────────
/**
 * Manually poll Kang to verify a payment status.
 * Useful as a fallback if webhook was not received.
 *
 * Access: buyer, seller, or admin
 */
export async function verifyPayment(req, res) {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({ transaction_reference: reference });
    if (!payment) return sendError(res, 404, 'Payment not found');

    // Skip polling if already settled
    if (['released', 'refunded', 'failed'].includes(payment.status)) {
      return res.json({ success: true, payment });
    }

    const kangStatus = await checkKangPaymentStatus(reference);
    const normalized = kangStatus.status;

    // Only update if Kang says it's paid and we're still pending
    if (normalized === 'success' && payment.status === 'pending') {
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'paid',
        paid_at: new Date(),
      });
      await DealSession.findByIdAndUpdate(payment.session_id, {
        status: 'PAYMENT_LOCKED',
        payment_locked_at: new Date(),
      });
      payment.status = 'paid';
    }

    return res.json({ success: true, payment, kang: kangStatus });
  } catch (err) {
    console.error('[PaymentController] verifyPayment error:', err);
    return sendError(res, 500, 'Internal server error');
  }
}
