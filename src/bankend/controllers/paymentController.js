/**
 * controllers/payoutController.js
 * ---------------------------------
 * Handles the full payout sequence after OTP confirmation:
 *   Step 1 → Pay rider
 *   Step 2 → Pay seller (with debt check)
 *   Step 3 → Mark deal COMPLETED
 *
 * Also handles:
 *   - Buyer refunds (cancellation, OTP failure, dispute ruling)
 *   - Return rider payouts
 *   - Admin retry on failed payouts
 *
 * All Fapshi payout credentials are loaded from FAPSHI_PAYOUT_* env vars.
 * NEVER called from frontend directly.
 */

import admin from 'firebase-admin';
import {
  payRider,
  paySeller,
  refundBuyer,
  payReturnRider,
  getPayoutBalance,
} from '../services/payoutService.js';

const db = admin.firestore();

const LOW_BALANCE_THRESHOLD = 10000; // XAF

function sendError(res, status, message, details = {}) {
  return res.status(status).json({ success: false, message, ...details });
}

// ── Helper: append to statusHistory ──────────────────────────────────────────
async function appendStatusHistory(dealRef, status, triggeredBy = 'system', note = '') {
  await dealRef.update({
    status,
    statusHistory: admin.firestore.FieldValue.arrayUnion({
      status,
      timestamp: new Date().toISOString(),
      triggeredBy,
      ...(note ? { note } : {}),
    }),
    updatedAt: new Date().toISOString(),
  });
}

// ── Helper: write admin notification ─────────────────────────────────────────
async function notifyAdmin(type, dealId, message) {
  await db.collection('adminNotifications').add({
    type,
    dealId: dealId ?? null,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  });
}

// ── Helper: send user notification ───────────────────────────────────────────
async function notifyUser(userId, type, title, body, dealId) {
  await db.collection('notifications').doc(userId).collection('items').add({
    userId,
    type,
    title,
    body,
    dealId: dealId ?? null,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

// ── POST /payouts/release ─────────────────────────────────────────────────────
/**
 * Full payout sequence triggered after buyer OTP confirmation.
 * Body: { dealId }
 * Auth: system or admin only
 */
export async function releasePayout(req, res) {
  const { dealId } = req.body;
  if (!dealId) return sendError(res, 400, 'dealId is required');

  const dealRef  = db.collection('deals').doc(dealId);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) return sendError(res, 404, 'Deal not found');

  const deal = dealSnap.data();

  // Guard: must be AT_BUYER_LOCATION or PAYMENT_LOCKED (for manual retry)
  if (!['AT_BUYER_LOCATION', 'PAYOUT_FAILED'].includes(deal.status)) {
    return sendError(res, 409, `Cannot release payout in status "${deal.status}"`);
  }

  // ── Step 1: Pay rider ──
  try {
    if (!deal.riderId || !deal.riderPhone || !deal.riderNetwork) {
      throw new Error('Rider payout details missing (riderId, riderPhone, riderNetwork)');
    }

    const riderResult = await payRider({
      dealId,
      riderId:    deal.riderId,
      phone:      deal.riderPhone,
      network:    deal.riderNetwork,
      sellerCity: deal.sellerCity,
      buyerCity:  deal.buyerCity,
    });

    await dealRef.update({
      riderPayoutTransId: riderResult.transId,
      riderPayoutAmount:  riderResult.amount,
      riderPaidAt:        new Date().toISOString(),
    });
  } catch (err) {
    console.error('[PayoutController] Rider payout failed:', err.message);
    await appendStatusHistory(dealRef, 'PAYOUT_FAILED', 'system', `Rider payout failed: ${err.message}`);
    await notifyAdmin('PAYOUT_FAILED', dealId, `Rider payout failed on Deal ${dealId}: ${err.message}`);
    return sendError(res, 502, 'Rider payout failed. Admin notified.');
  }

  // ── Step 2: Pay seller (with debt check) ──
  try {
    if (!deal.sellerPhone || !deal.sellerNetwork) {
      throw new Error('Seller payout details missing (sellerPhone, sellerNetwork)');
    }

    // Fetch seller's current debt
    const sellerSnap  = await db.collection('users').doc(deal.sellerId).get();
    const sellerData  = sellerSnap.data() || {};
    const accountDebt = sellerData.accountDebt ?? 0;
    // Seller receives the full agreed product price.
    // Platform fee was collected from buyer's totalCharged — not deducted from seller.
    const productPrice = deal.price ?? deal.productPrice ?? 0;
    if (productPrice === 0) {
      return sendError(res, 422, 'deal.price missing — cannot calculate seller payout');
    }

    const sellerResult = await paySeller({
      dealId,
      sellerId:     deal.sellerId,
      phone:        deal.sellerPhone,
      network:      deal.sellerNetwork,
      productPrice,
      accountDebt,
    });

    // Update seller debt record
    const sellerUpdates = {
      accountDebt: sellerResult.remainingDebt,
    };
    if (sellerResult.remainingDebt <= 0) {
      sellerUpdates.accountStatus = 'normal';
      sellerUpdates.debtStatus    = 'cleared';
    } else if (sellerResult.debtDeducted > 0) {
      sellerUpdates.debtStatus = 'partially_recovered';
    }

    await db.collection('users').doc(deal.sellerId).update(sellerUpdates);

    await dealRef.update({
      sellerPayoutTransId: sellerResult.transId,
      sellerPayoutAmount:  sellerResult.payoutAmount,
      sellerDebtDeducted:  sellerResult.debtDeducted,
      sellerPaidAt:        new Date().toISOString(),
    });

    // Notify seller if payout was held due to debt
    if (sellerResult.payoutAmount === 0) {
      await notifyUser(
        deal.sellerId,
        'deal_completed',
        '⚠️ Payout Applied to Debt Balance',
        `Your payment of ${productPrice.toLocaleString()} XAF has been applied to your outstanding account balance. Remaining debt: ${sellerResult.remainingDebt.toLocaleString()} XAF.`,
        dealId,
      );
    }
  } catch (err) {
    console.error('[PayoutController] Seller payout failed:', err.message);
    await appendStatusHistory(dealRef, 'PAYOUT_FAILED', 'system', `Seller payout failed: ${err.message}`);
    await notifyAdmin('PAYOUT_FAILED', dealId, `Seller payout failed on Deal ${dealId}: ${err.message}`);
    return sendError(res, 502, 'Seller payout failed. Rider was paid. Admin notified.');
  }

  // ── Step 3: Mark COMPLETED ──
  const sellerReceives = deal.sellerReceives ?? deal.productPrice ?? 0;
  await appendStatusHistory(dealRef, 'COMPLETED', 'system');
  await dealRef.update({
    completedAt: new Date().toISOString(),
    buyerOtp:    admin.firestore.FieldValue.delete(), // clear OTP from document
  });

  // Notify buyer and seller
  await Promise.all([
    notifyUser(deal.buyerId,  'deal_completed', '✅ Deal Complete!', 'Delivery confirmed. Thank you for using TrustEscrow.', dealId),
    notifyUser(deal.sellerId, 'deal_completed', '🎉 Payment Released!', `${sellerReceives.toLocaleString()} XAF has been sent to your MoMo account.`, dealId),
  ]);

  // ── Balance check ──
  try {
    const { balance } = await getPayoutBalance();
    if (balance < LOW_BALANCE_THRESHOLD) {
      await notifyAdmin('LOW_BALANCE', null, `Payout service balance low: ${balance.toLocaleString()} XAF (threshold: ${LOW_BALANCE_THRESHOLD.toLocaleString()} XAF)`);
    }
  } catch {
    // Non-critical — don't fail the response for balance check errors
  }

  return res.json({
    success: true,
    message: 'Payout sequence complete. Deal marked COMPLETED.',
    dealId,
  });
}

// ── POST /payouts/refund ──────────────────────────────────────────────────────
/**
 * Refund buyer.
 * Enforces non-refundable fee policy:
 *   - Platform fee: NEVER refunded
 *   - Delivery fee: refunded ONLY if riderAssigned = false
 * Body: { dealId, reason }
 */
export async function issueRefund(req, res) {
  const { dealId, reason } = req.body;
  if (!dealId) return sendError(res, 400, 'dealId is required');

  const dealRef  = db.collection('deals').doc(dealId);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) return sendError(res, 404, 'Deal not found');

  const deal = dealSnap.data();

  // Determine refund amount
  const productPrice = deal.productPrice ?? deal.price ?? 0;
  const deliveryFee  = deal.deliveryFee ?? 0;
  const riderAssigned = !!deal.riderId;

  const refundAmount = riderAssigned
    ? productPrice                       // delivery fee non-refundable once rider assigned
    : productPrice + deliveryFee;        // delivery fee refunded if no rider yet

  if (!deal.buyerPhone || !deal.buyerNetwork) {
    return sendError(res, 422, 'Buyer phone/network not set on deal');
  }

  try {
    const refundResult = await refundBuyer({
      dealId,
      phone:   deal.buyerPhone,
      network: deal.buyerNetwork,
      amount:  refundAmount,
      reason:  reason ?? 'Cancellation refund',
    });

    await dealRef.update({
      refundTransId: refundResult.transId,
      refundAmount,
      refundedAt:    new Date().toISOString(),
    });

    await notifyUser(
      deal.buyerId,
      'deal_cancelled',
      '↩️ Refund Processing',
      `Your refund of ${refundAmount.toLocaleString()} XAF is being processed. Platform fee is non-refundable.`,
      dealId,
    );

    return res.json({
      success: true,
      refundAmount,
      transId: refundResult.transId,
      breakdown: riderAssigned
        ? 'Product price only (delivery fee non-refundable — rider was assigned)'
        : 'Product price + delivery fee (rider not yet assigned)',
    });
  } catch (err) {
    console.error('[PayoutController] Refund failed:', err.message);
    await appendStatusHistory(dealRef, 'BUYER_REFUND_FAILED', 'system', err.message);
    await notifyAdmin('BUYER_REFUND_FAILED', dealId, `Buyer refund failed on Deal ${dealId}: ${err.message}`);
    return sendError(res, 502, 'Refund failed. Admin notified. Please retry.');
  }
}

// ── POST /payouts/return-rider ────────────────────────────────────────────────
/**
 * Pay the return rider after RETURNED state.
 * Body: { dealId, riderPhone, riderNetwork }
 */
export async function payReturnRiderPayout(req, res) {
  const { dealId, riderPhone, riderNetwork } = req.body;
  if (!dealId || !riderPhone || !riderNetwork) {
    return sendError(res, 400, 'dealId, riderPhone, and riderNetwork are required');
  }

  const dealRef  = db.collection('deals').doc(dealId);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) return sendError(res, 404, 'Deal not found');

  const deal = dealSnap.data();
  if (!['RETURN_APPROVED', 'RETURN_IN_TRANSIT', 'RETURNED'].includes(deal.status)) {
    return sendError(res, 409, `Return rider payout not applicable in status "${deal.status}"`);
  }

  try {
    const result = await payReturnRider({
      dealId,
      riderId: deal.returnRiderId,
      phone:   riderPhone,
      network: riderNetwork,
    });

    await dealRef.update({
      returnRiderPayoutTransId: result.transId,
      returnRiderPaidAt:        new Date().toISOString(),
    });

    return res.json({ success: true, amount: result.amount, transId: result.transId });
  } catch (err) {
    console.error('[PayoutController] Return rider payout failed:', err.message);
    await appendStatusHistory(dealRef, 'RETURN_RIDER_PAYOUT_FAILED', 'system', err.message);
    await notifyAdmin('PAYOUT_FAILED', dealId, `Return rider payout failed on Deal ${dealId}: ${err.message}`);
    return sendError(res, 502, 'Return rider payout failed. Admin notified.');
  }
}
