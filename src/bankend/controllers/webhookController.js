/**
 * controllers/webhookController.js
 * ----------------------------------
 * Handles inbound webhook events from Fapshi.
 *
 * SECURITY RULES:
 *  1. Signature is verified using HMAC-SHA512 before any DB write.
 *  2. Payment status is NEVER trusted from frontend — only from here.
 *  3. All mutations are idempotent: duplicate webhooks are silently ignored.
 *  4. Raw body MUST be preserved (do not use express.json() on this route).
 *     Use express.raw({ type: 'application/json' }) instead.
 *
 * Fapshi webhook payload shape:
 *  {
 *    transId:    "FP-XXXXXXXX",
 *    externalId: "td-...",          ← your transaction_reference
 *    status:     "SUCCESSFUL",
 *    amount:     15000,
 *    medium:     "MTN",
 *    userId:     "<session_id>"
 *  }
 */

import Payment from '../models/Payment.js';
import DealSession from '../models/DealSession.js';
import {
  verifyKangWebhookSignature,
  normalizeKangStatus,
} from '../services/paymentService.js';

// ─── POST /webhooks/fapshi ────────────────────────────────────────────────────
export async function handleKangWebhook(req, res) {
  // ── 1. Verify signature ──────────────────────────────────────────────────
  //    req.body is a Buffer because we use express.raw() on this route.
  const rawBody   = req.body; // Buffer
  const signature = req.headers['x-fapshi-signature'];

  const signatureValid = verifyKangWebhookSignature(rawBody, signature);
  if (!signatureValid) {
    console.warn('[Webhook] Invalid signature – request rejected');
    return res.status(401).json({ received: false, error: 'Invalid signature' });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    console.error('[Webhook] Failed to parse JSON body');
    return res.status(400).json({ received: false, error: 'Invalid JSON' });
  }

  // Acknowledge immediately — Fapshi expects a fast 200 response.
  // Heavy processing happens below but we've already responded.
  res.status(200).json({ received: true });

  // ── 3. Process asynchronously (fire-and-forget with error capture) ──────
  processWebhookEvent(event).catch((err) => {
    console.error('[Webhook] Unhandled processing error:', err);
  });
}

// ─── Internal: process the event after 200 is sent ───────────────────────────
async function processWebhookEvent(event) {
  // Fapshi webhook fields:
  //   transId    – Fapshi's own transaction ID
  //   externalId – your transaction_reference (td-xxxxxxxx-...)
  //   status     – SUCCESSFUL | FAILED | EXPIRED | PENDING
  //   amount, medium, userId (your session_id)
  const eventId      = event?.transId;           // Fapshi's transId is the unique event key
  const reference    = event?.externalId;        // your transaction_reference
  const fapshiStatus = event?.status;

  console.log(`[Webhook] Fapshi event: transId=${eventId} ref=${reference} status=${fapshiStatus}`);

  if (!reference) {
    console.warn('[Webhook] No externalId (reference) in event — skipping');
    return;
  }

  // ── 4. Load payment record ───────────────────────────────────────────────
  const payment = await Payment.findOne({ transaction_reference: reference });
  if (!payment) {
    console.warn(`[Webhook] No payment found for reference="${reference}" — skipping`);
    return;
  }

  // ── 5. Idempotency check — skip if this event was already processed ──────
  if (eventId && payment.webhook_events.includes(eventId)) {
    console.log(`[Webhook] Duplicate event ${eventId} — already processed, skipping`);
    return;
  }

  // ── 6. Normalize Fapshi status ───────────────────────────────────────────
  const normalized = normalizeKangStatus(fapshiStatus);

  // ── 7. Apply state transitions ───────────────────────────────────────────
  if (normalized === 'success') {
    await handlePaymentSuccess(payment, event, eventId);
  } else if (normalized === 'failed') {
    await handlePaymentFailure(payment, event, eventId);
  } else if (normalized === 'pending') {
    console.log(`[Webhook] Payment ${reference} still pending — no state change`);
    if (eventId) await markEventProcessed(payment._id, eventId);
  } else {
    console.warn(`[Webhook] Unknown status "${fapshiStatus}" for reference="${reference}"`);
  }
}

// ─── Handle SUCCESS ───────────────────────────────────────────────────────────
async function handlePaymentSuccess(payment, paymentData, eventId) {
  const { _id: paymentId, session_id, status: currentStatus } = payment;

  // Guard: only transition from 'pending'
  if (currentStatus !== 'pending') {
    console.log(`[Webhook] Payment ${payment.transaction_reference} already in status "${currentStatus}" — skipping success handler`);
    if (eventId) await markEventProcessed(paymentId, eventId);
    return;
  }

  // Atomic update: only succeeds if status is still 'pending'
  const updated = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'pending' },  // guard condition
    {
      status:  'paid',
      paid_at: new Date(),
      ...(eventId ? { $push: { webhook_events: eventId } } : {}),
    },
    { new: true }
  );

  if (!updated) {
    // Another process already updated this (race condition guard)
    console.log(`[Webhook] Race condition guard triggered for ${payment.transaction_reference} — skipping`);
    return;
  }

  // Update session: PAYMENT_PENDING → PAYMENT_LOCKED
  const sessionUpdate = await DealSession.findOneAndUpdate(
    { _id: session_id, status: 'PAYMENT_PENDING' },  // guard
    {
      status:            'PAYMENT_LOCKED',
      payment_locked_at: new Date(),
    },
    { new: true }
  );

  if (!sessionUpdate) {
    console.warn(`[Webhook] Session ${session_id} was not in PAYMENT_PENDING — could not lock`);
  }

  console.log(`[Webhook] ✅ Payment ${payment.transaction_reference} LOCKED in escrow. Session ${session_id} → PAYMENT_LOCKED`);

  // TODO: emit socket event / push notification to buyer & seller
  // io.to(`deal:${session_id}`).emit('payment_locked', { session_id });
}

// ─── Handle FAILURE ───────────────────────────────────────────────────────────
async function handlePaymentFailure(payment, paymentData, eventId) {
  const { _id: paymentId, session_id, status: currentStatus } = payment;

  if (!['pending'].includes(currentStatus)) {
    console.log(`[Webhook] Payment ${payment.transaction_reference} in status "${currentStatus}" — skipping failure handler`);
    if (eventId) await markEventProcessed(paymentId, eventId);
    return;
  }

  await Payment.findByIdAndUpdate(paymentId, {
    status:    'failed',
    failed_at: new Date(),
    ...(eventId ? { $push: { webhook_events: eventId } } : {}),
  });

  // Revert session to PRODUCT_CONFIRMED so buyer can retry
  await DealSession.findOneAndUpdate(
    { _id: session_id, status: 'PAYMENT_PENDING' },
    {
      status:     'PRODUCT_CONFIRMED',
      payment_id: null,
    }
  );

  console.log(`[Webhook] ❌ Payment ${payment.transaction_reference} FAILED. Session ${session_id} reverted to PRODUCT_CONFIRMED`);

  // TODO: notify buyer of failure
}

// ─── Mark event as processed ──────────────────────────────────────────────────
async function markEventProcessed(paymentId, eventId) {
  if (!eventId) return;
  await Payment.findByIdAndUpdate(paymentId, {
    $addToSet: { webhook_events: eventId },
  });
}
