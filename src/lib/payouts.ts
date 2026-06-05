/**
 * lib/payouts.ts
 * --------------
 * Payout orchestration for TrustEscrow.
 *
 * On OTP confirmation:
 *   Step 1 → Pay rider
 *   Step 2 → Pay seller (minus any debt)
 *   Step 3 → Mark deal COMPLETED
 *
 * Uses the backend payout service — the frontend triggers
 * this via a Cloud Function / backend API call so that
 * payout credentials are NEVER exposed to the browser.
 *
 * The frontend fapshi.ts handles collection (incoming payments).
 * All payouts go through /api/payouts/* endpoints.
 */

import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { transitionDeal, notifyAdminOnTransition } from './dealStateMachine';
import { notify } from './notifications';
import { notifyAdminEvent } from './adminNotifications';
import { getRiderPayoutConfig, routeKey } from './fees';
import { Deal } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// ── Trigger payout sequence via backend ──────────────────────────────────────
// Called after OTP confirmed. Backend handles the actual Fapshi payout calls.
export async function triggerPayoutSequence(dealId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/payouts/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message ?? 'Payout failed' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Handle payout failure ─────────────────────────────────────────────────────
export async function handlePayoutFailure(dealId: string, step: 'rider' | 'seller'): Promise<void> {
  await transitionDeal(dealId, 'PAYOUT_FAILED', 'system', {}, `${step} payout failed`);
  await notifyAdminEvent('PAYOUT_FAILED', dealId, `${step} payout failed on deal ${dealId}. Admin retry required.`);
}

// ── Seller debt check (frontend read-only — actual deduction on backend) ─────
export async function getSellerDebt(sellerId: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, 'users', sellerId));
    return snap.exists() ? (snap.data().accountDebt ?? 0) : 0;
  } catch {
    return 0;
  }
}

// ── Rider payout amount for a deal ───────────────────────────────────────────
export async function getRiderPayoutAmount(deal: Deal): Promise<number> {
  const payouts = await getRiderPayoutConfig();
  const key = routeKey(deal.sellerCity ?? '', deal.buyerCity ?? '');
  return payouts[key] ?? 1000;
}

// ── Initiate buyer refund via backend ────────────────────────────────────────
export async function triggerBuyerRefund(
  dealId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/payouts/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, reason }),
    });

    const data = await res.json();
    if (!res.ok) {
      await notifyAdminEvent('BUYER_REFUND_FAILED', dealId, `Buyer refund failed: ${data.message}`);
      return { success: false, error: data.message };
    }

    return { success: true };
  } catch (err: any) {
    await notifyAdminEvent('BUYER_REFUND_FAILED', dealId, `Buyer refund network error: ${err.message}`);
    return { success: false, error: err.message };
  }
}
