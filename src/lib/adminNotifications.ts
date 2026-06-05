/**
 * lib/adminNotifications.ts
 * -------------------------
 * Real-time admin notifications for critical deal events.
 *
 * Writes to Firestore: adminNotifications/{notifId}
 * Admin dashboard listens with onSnapshot for real-time updates.
 */

import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { AdminNotifType, AdminNotification } from '../types';

const ADMIN_NOTIFS_COLLECTION = 'adminNotifications';

export async function notifyAdminEvent(
  type: AdminNotifType,
  dealId: string | undefined,
  message: string,
): Promise<void> {
  try {
    await addDoc(collection(db, ADMIN_NOTIFS_COLLECTION), {
      type,
      dealId: dealId ?? null,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    });
  } catch (err) {
    console.error('[AdminNotifications] Failed to write admin notification:', err);
  }
}

export function subscribeToAdminNotifications(
  onUpdate: (notifications: AdminNotification[]) => void,
): () => void {
  const q = query(
    collection(db, ADMIN_NOTIFS_COLLECTION),
    orderBy('timestamp', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminNotification));
    onUpdate(notifs);
  });
}

export async function markAdminNotifRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, ADMIN_NOTIFS_COLLECTION, notifId), { read: true });
}

// ── Badge color per notification type ────────────────────────────────────────
export function getAdminNotifColor(type: AdminNotifType): string {
  const colors: Record<AdminNotifType, string> = {
    NEW_DISPUTE:         'bg-red-100 text-red-800 border-red-200',
    OTP_CANCELLED:       'bg-orange-100 text-orange-800 border-orange-200',
    PAYOUT_FAILED:       'bg-red-100 text-red-800 border-red-200',
    BUYER_REFUND_FAILED: 'bg-red-100 text-red-800 border-red-200',
    PICKUP_CODE_FAILED:  'bg-yellow-100 text-yellow-800 border-yellow-200',
    LOW_BALANCE:         'bg-amber-100 text-amber-800 border-amber-200',
    RIDER_DISPUTE:       'bg-orange-100 text-orange-800 border-orange-200',
    AUTO_RELEASE:        'bg-purple-100 text-purple-800 border-purple-200',
  };
  return colors[type] ?? 'bg-slate-100 text-slate-800 border-slate-200';
}

export function getAdminNotifIcon(type: AdminNotifType): string {
  const icons: Record<AdminNotifType, string> = {
    NEW_DISPUTE:         '⚠️',
    OTP_CANCELLED:       '🔒',
    PAYOUT_FAILED:       '💸',
    BUYER_REFUND_FAILED: '↩️',
    PICKUP_CODE_FAILED:  '📦',
    LOW_BALANCE:         '🏦',
    RIDER_DISPUTE:       '🛵',
    AUTO_RELEASE:        '⚡',
  };
  return icons[type] ?? '🔔';
}
