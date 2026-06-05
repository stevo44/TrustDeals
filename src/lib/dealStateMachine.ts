/**
 * lib/dealStateMachine.ts
 * -----------------------
 * Enforces the TrustEscrow deal state machine.
 *
 * All status transitions go through transitionDeal() — never update
 * the status field directly from UI code.
 *
 * Valid transitions are defined in VALID_TRANSITIONS below.
 * Any attempt to skip states or go backwards throws an error.
 */

import { db } from './firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { DealStatus, StatusHistoryEntry } from '../types';
import { notifyAdminEvent } from './adminNotifications';

// ── Valid state transitions ───────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  WAITING:               ['ACTIVE', 'CANCELLED'],
  ACTIVE:                ['PRODUCT_CONFIRMED', 'CANCELLED'],
  PRODUCT_CONFIRMED:     ['PAYMENT_LOCKED', 'ACTIVE', 'CANCELLED'],
  PAYMENT_LOCKED:        ['RIDER_ASSIGNED', 'DISPUTED', 'SELLER_DISPUTED', 'CANCELLED'],
  RIDER_ASSIGNED:        ['PICKUP_PENDING', 'RIDER_DISPUTED'],
  PICKUP_PENDING:        ['IN_TRANSIT'],
  IN_TRANSIT:            ['AT_BUYER_LOCATION'],
  AT_BUYER_LOCATION:     ['COMPLETED', 'DISPUTED', 'RIDER_DISPUTED', 'CANCELLED_OTP_FAILED'],
  COMPLETED:             [],
  DISPUTED:              ['RETURN_APPROVED', 'AUTO_RELEASED', 'RESOLVED'],
  SELLER_DISPUTED:       ['AUTO_RELEASED', 'RESOLVED'],
  RIDER_DISPUTED:        ['RETURN_APPROVED', 'AUTO_RELEASED', 'RESOLVED'],
  RETURN_APPROVED:       ['RETURN_IN_TRANSIT'],
  RETURN_IN_TRANSIT:     ['RETURNED'],
  RETURNED:              ['RESOLVED'],
  RESOLVED:              [],
  CANCELLED:             [],
  CANCELLED_OTP_FAILED:  [],
  AUTO_RELEASED:         [],
  PAYOUT_FAILED:         ['COMPLETED'],
  RETURN_RIDER_PAYOUT_FAILED: ['RETURNED'],
  BUYER_REFUND_FAILED:   ['CANCELLED', 'CANCELLED_OTP_FAILED'],
};

// ── States where cancellation is forbidden ────────────────────────────────────
const NON_CANCELLABLE_STATES: DealStatus[] = [
  'RIDER_ASSIGNED',
  'PICKUP_PENDING',
  'IN_TRANSIT',
  'AT_BUYER_LOCATION',
  'COMPLETED',
  'CANCELLED',
  'CANCELLED_OTP_FAILED',
  'AUTO_RELEASED',
  'PAYOUT_FAILED',
  'DISPUTED',
  'SELLER_DISPUTED',
  'RIDER_DISPUTED',
  'RETURN_APPROVED',
  'RETURN_IN_TRANSIT',
  'RETURNED',
  'RESOLVED',
];

export function canCancel(status: DealStatus, riderAssigned: boolean): boolean {
  if (NON_CANCELLABLE_STATES.includes(status)) return false;
  if (status === 'PAYMENT_LOCKED' && riderAssigned) return false;
  return true;
}

export function validateTransition(from: DealStatus, to: DealStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) throw new Error(`Unknown source state: ${from}`);
  if (!allowed.includes(to)) {
    throw new Error(`Invalid state transition: ${from} → ${to}`);
  }
}

// ── Core transition function ──────────────────────────────────────────────────
export async function transitionDeal(
  dealId: string,
  to: DealStatus,
  triggeredBy: string = 'system',
  additionalUpdates: Record<string, unknown> = {},
  note?: string,
): Promise<void> {
  const dealRef = doc(db, 'deals', dealId);
  const snap = await getDoc(dealRef);

  if (!snap.exists()) throw new Error(`Deal ${dealId} not found`);

  const currentStatus = (snap.data().status as string).toUpperCase() as DealStatus;
  validateTransition(currentStatus, to);

  const historyEntry: StatusHistoryEntry = {
    status: to,
    timestamp: new Date().toISOString(),
    triggeredBy,
    ...(note ? { note } : {}),
  };

  await updateDoc(dealRef, {
    status: to,
    statusHistory: arrayUnion(historyEntry),
    updatedAt: new Date().toISOString(),
    ...additionalUpdates,
  });
}

// ── State label for UI display ────────────────────────────────────────────────
export function getStatusLabel(status: DealStatus): string {
  const labels: Record<DealStatus, string> = {
    WAITING:               'Waiting for other party',
    ACTIVE:                'Active',
    PRODUCT_CONFIRMED:     'Product Confirmed',
    PAYMENT_LOCKED:        'Payment Locked in Escrow',
    RIDER_ASSIGNED:        'Rider Assigned',
    PICKUP_PENDING:        'Rider Heading to Seller',
    IN_TRANSIT:            'In Transit',
    AT_BUYER_LOCATION:     'At Your Location',
    COMPLETED:             'Completed',
    DISPUTED:              'Under Dispute',
    SELLER_DISPUTED:       'Seller Raised Concern',
    RIDER_DISPUTED:        'Rider Reported Issue',
    RETURN_APPROVED:       'Return Approved',
    RETURN_IN_TRANSIT:     'Return In Progress',
    RETURNED:              'Goods Returned',
    RESOLVED:              'Resolved',
    CANCELLED:             'Cancelled',
    CANCELLED_OTP_FAILED:  'Cancelled (OTP Failed)',
    AUTO_RELEASED:         'Auto-Released',
    PAYOUT_FAILED:         'Payout Failed — Admin Review',
    RETURN_RIDER_PAYOUT_FAILED: 'Return Rider Payout Failed',
    BUYER_REFUND_FAILED:   'Refund Failed — Admin Review',
  };
  return labels[status] ?? status;
}

export function getStatusColor(status: DealStatus): string {
  const colors: Partial<Record<DealStatus, string>> = {
    WAITING:           'text-amber-500',
    ACTIVE:            'text-blue-500',
    PRODUCT_CONFIRMED: 'text-blue-600',
    PAYMENT_LOCKED:    'text-indigo-600',
    RIDER_ASSIGNED:    'text-purple-600',
    PICKUP_PENDING:    'text-purple-500',
    IN_TRANSIT:        'text-orange-500',
    AT_BUYER_LOCATION: 'text-teal-500',
    COMPLETED:         'text-green-600',
    DISPUTED:          'text-red-500',
    SELLER_DISPUTED:   'text-red-500',
    RIDER_DISPUTED:    'text-red-500',
    CANCELLED:         'text-slate-400',
    CANCELLED_OTP_FAILED: 'text-red-400',
    PAYOUT_FAILED:     'text-red-600',
    BUYER_REFUND_FAILED: 'text-red-600',
    RESOLVED:          'text-green-500',
    RETURNED:          'text-slate-500',
  };
  return colors[status] ?? 'text-slate-500';
}

// ── Admin notification for critical events ────────────────────────────────────
export async function notifyAdminOnTransition(
  dealId: string,
  status: DealStatus,
): Promise<void> {
  switch (status) {
    case 'DISPUTED':
    case 'SELLER_DISPUTED':
    case 'RIDER_DISPUTED':
      await notifyAdminEvent('NEW_DISPUTE', dealId, `Dispute raised on deal ${dealId} (${status})`);
      break;
    case 'CANCELLED_OTP_FAILED':
      await notifyAdminEvent('OTP_CANCELLED', dealId, `3 failed OTP attempts on deal ${dealId}`);
      break;
    case 'PAYOUT_FAILED':
    case 'RETURN_RIDER_PAYOUT_FAILED':
      await notifyAdminEvent('PAYOUT_FAILED', dealId, `Payout failed on deal ${dealId}`);
      break;
    case 'BUYER_REFUND_FAILED':
      await notifyAdminEvent('BUYER_REFUND_FAILED', dealId, `Buyer refund failed on deal ${dealId}`);
      break;
    case 'AUTO_RELEASED':
      await notifyAdminEvent('AUTO_RELEASE', dealId, `Auto-release triggered on deal ${dealId}`);
      break;
  }
}
