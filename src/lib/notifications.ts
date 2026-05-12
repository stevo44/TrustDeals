/**
 * Notification Module
 * Central place to create all notifications in the system.
 * Firestore path: notifications/{userId}/items/{notifId}
 */
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { NotificationType } from '../types';

interface CreateNotifParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  dealId?: string;
}

export async function createNotification(params: CreateNotifParams): Promise<void> {
  const { userId, type, title, body, dealId } = params;
  try {
    await addDoc(collection(db, 'notifications', userId, 'items'), {
      userId,
      type,
      title,
      body,
      dealId: dealId ?? null,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err);
  }
}

// ── Convenience helpers ──────────────────────────────────────────────────────

export const notify = {
  dealInvite: (userId: string, dealId: string, fromName: string, title: string, price: number) =>
    createNotification({
      userId, type: 'deal_invite', dealId,
      title: 'New Deal Invitation',
      body: `${fromName} invited you to a secure deal: "${title}" for ${price.toLocaleString()} FCFA.`,
    }),

  dealCreatedBySeller: (userId: string, dealId: string, sellerName: string, title: string, price: number) =>
    createNotification({
      userId, type: 'deal_created_by_seller', dealId,
      title: 'New Deal Created For You',
      body: `${sellerName} created a deal "${title}" for ${price.toLocaleString()} FCFA. Join to review and pay.`,
    }),

  dealFunded: (userId: string, dealId: string, amount: number) =>
    createNotification({
      userId, type: 'deal_funded', dealId,
      title: '💰 Escrow Funded',
      body: `${amount.toLocaleString()} FCFA has been locked in escrow for this deal.`,
    }),

  otpGenerated: (userId: string, dealId: string, otp: string) =>
    createNotification({
      userId, type: 'otp_generated', dealId,
      title: '🔐 Your Release OTP',
      body: `Your fund-release OTP is: ${otp}. Share it with the buyer only after you receive the package.`,
    }),

  dealInTransit: (userId: string, dealId: string) =>
    createNotification({
      userId, type: 'deal_in_transit', dealId,
      title: '📦 Item Shipped',
      body: 'The seller has marked your item as shipped. Confirm receipt once it arrives.',
    }),

  dealDelivered: (userId: string, dealId: string) =>
    createNotification({
      userId, type: 'deal_delivered', dealId,
      title: '✅ Package Delivered',
      body: 'The buyer has marked the package as delivered. Awaiting OTP to release funds.',
    }),

  dealFinalized: (userId: string, dealId: string, amount: number) =>
    createNotification({
      userId, type: 'deal_finalized', dealId,
      title: '🎉 Deal Completed!',
      body: `The deal is finalized. ${amount.toLocaleString()} FCFA has been released.`,
    }),

  walletCredited: (userId: string, amount: number, description: string, dealId?: string) =>
    createNotification({
      userId, type: 'wallet_credited', dealId,
      title: '💳 Wallet Credited',
      body: `+${amount.toLocaleString()} FCFA — ${description}`,
    }),

  walletDebited: (userId: string, amount: number, description: string, dealId?: string) =>
    createNotification({
      userId, type: 'wallet_debited', dealId,
      title: '💳 Wallet Debited',
      body: `-${amount.toLocaleString()} FCFA — ${description}`,
    }),

  fundsRequested: (userId: string, dealId: string, sellerName: string, amount: number) =>
    createNotification({
      userId, type: 'funds_requested', dealId,
      title: '💸 Seller Requesting Funds',
      body: `${sellerName} is requesting ${amount.toLocaleString()} FCFA for the completed deal.`,
    }),

  dealDisputed: (userId: string, dealId: string) =>
    createNotification({
      userId, type: 'deal_disputed', dealId,
      title: '⚠️ Deal Disputed',
      body: 'A dispute has been raised on this deal. Our team will review it shortly.',
    }),

  newChatMessage: (userId: string, dealId: string, senderName: string) =>
    createNotification({
      userId, type: 'message', dealId,
      title: '💬 New Message',
      body: `${senderName} sent you a message in the deal room.`,
    }),
};

// ── Generate a 6-digit OTP ───────────────────────────────────────────────────
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
