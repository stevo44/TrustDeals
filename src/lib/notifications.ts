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
      body: `${fromName} invited you to a secure deal: "${title}" for ${price.toLocaleString()} XAF.`,
    }),

  dealCreatedBySeller: (userId: string, dealId: string, sellerName: string, title: string, price: number) =>
    createNotification({
      userId, type: 'deal_created_by_seller', dealId,
      title: 'New Deal Created For You',
      body: `${sellerName} created a deal "${title}" for ${price.toLocaleString()} XAF. Join to review and pay.`,
    }),

  dealFunded: (userId: string, dealId: string, amount: number) =>
    createNotification({
      userId, type: 'deal_funded', dealId,
      title: '💰 Escrow Funded — Prepare Your Goods',
      body: `${amount.toLocaleString()} FCFA is locked in escrow. Ship the goods. Funds are released automatically once the buyer confirms delivery.`,
    }),

  // OTP is shown in the Deal Room UI — this notif is for buyer's notification panel
  paymentLocked: (buyerId: string, sellerId: string, dealId: string) => Promise.all([
    createNotification({
      userId: buyerId, type: 'deal_payment_locked', dealId,
      title: '🔐 Payment Locked in Escrow',
      body: 'Your payment is secured. Check your Deal Room for your 6-digit delivery code.',
    }),
    createNotification({
      userId: sellerId, type: 'deal_payment_locked', dealId,
      title: '💰 Escrow Funded — Prepare Your Goods',
      body: 'The buyer has funded escrow. Prepare the goods for rider pickup.',
    }),
  ]),

  riderAssigned: (buyerId: string, sellerId: string, dealId: string, riderName: string) => Promise.all([
    createNotification({
      userId: buyerId, type: 'deal_rider_assigned', dealId,
      title: '🛵 Rider Assigned',
      body: `${riderName} has been assigned to deliver your order.`,
    }),
    createNotification({
      userId: sellerId, type: 'deal_rider_assigned', dealId,
      title: '🛵 Rider En Route to You',
      body: `${riderName} is heading to collect the goods. Have them ready and share the pickup code when they arrive.`,
    }),
  ]),

  goodsCollected: (buyerId: string, sellerId: string, dealId: string) => Promise.all([
    createNotification({
      userId: buyerId, type: 'goods_collected', dealId,
      title: '📦 Your Order Is On The Way',
      body: 'The rider has collected the goods from the seller and is heading to you.',
    }),
    createNotification({
      userId: sellerId, type: 'goods_collected', dealId,
      title: '✅ Goods Collected by Rider',
      body: 'The rider has confirmed collection of your goods.',
    }),
  ]),

  atBuyerLocation: (buyerId: string, sellerId: string, dealId: string) => Promise.all([
    createNotification({
      userId: buyerId, type: 'deal_at_buyer_location', dealId,
      title: '🛵 Rider Is At Your Location',
      body: 'The rider has arrived. Inspect your goods carefully, then share your delivery code.',
    }),
    createNotification({
      userId: sellerId, type: 'deal_at_buyer_location', dealId,
      title: '📍 Rider At Buyer Location',
      body: 'The rider has arrived at the buyer\'s location. Awaiting delivery confirmation.',
    }),
  ]),

  dealCompleted: (buyerId: string, sellerId: string, dealId: string, sellerAmount: number) => Promise.all([
    createNotification({
      userId: buyerId, type: 'deal_completed', dealId,
      title: '✅ Deal Complete!',
      body: 'Delivery confirmed. Thank you for using TrustEscrow.',
    }),
    createNotification({
      userId: sellerId, type: 'deal_completed', dealId,
      title: '🎉 Payment Released!',
      body: `${sellerAmount.toLocaleString()} XAF has been sent to your MoMo account.`,
    }),
  ]),

  disputeRaised: (userId: string, dealId: string, type: 'buyer' | 'seller' | 'rider') =>
    createNotification({
      userId, type: 'dispute_raised', dealId,
      title: '⚠️ Dispute Raised',
      body: `A ${type} dispute has been raised on deal ${dealId}. Our team will review it.`,
    }),

  riderHoldGoods: (riderId: string, dealId: string) =>
    createNotification({
      userId: riderId, type: 'deal_disputed', dealId,
      title: '⚠️ Hold Goods — Dispute Raised',
      body: 'A dispute has been raised. Do NOT leave the buyer\'s location. Await admin instruction.',
    }),

  dealCancelled: (userId: string, dealId: string, refundAmount?: number) =>
    createNotification({
      userId, type: 'deal_cancelled', dealId,
      title: '❌ Deal Cancelled',
      body: refundAmount
        ? `Deal cancelled. Refund of ${refundAmount.toLocaleString()} XAF is being processed.`
        : 'Deal has been cancelled.',
    }),

  otpGenerated: (userId: string, dealId: string, otp: string) =>
    createNotification({
      userId, type: 'otp_generated', dealId,
      title: '🔐 Your Delivery Confirmation Code',
      body: `Your 6-digit code is: ${otp}. Enter this in the Deal Room when your package arrives to release payment to the seller.`,
    }),

  pickupCodeGenerated: (sellerId: string, dealId: string, code: string) =>
    createNotification({
      userId: sellerId, type: 'pickup_code_generated', dealId,
      title: '📦 Pickup Code: ' + code,
      body: `Give this code to the rider verbally ONLY when handing over goods: ${code}`,
    }),

  returnApproved: (buyerId: string, sellerId: string, riderId: string, dealId: string) => Promise.all([
    createNotification({
      userId: buyerId, type: 'return_approved', dealId,
      title: '↩️ Return Approved',
      body: 'Admin ruled in your favour. A return rider will collect the goods from you.',
    }),
    createNotification({
      userId: sellerId, type: 'return_approved', dealId,
      title: '↩️ Return In Progress',
      body: 'Admin has approved a return. The goods will be returned to you. A debt of 3,000 XAF has been recorded on your account.',
    }),
    createNotification({
      userId: riderId, type: 'return_approved', dealId,
      title: '↩️ Return Order Available',
      body: 'A return delivery job is available. The original rider must hand over goods to the return rider using the release code.',
    }),
  ]),

  debtNotice: (sellerId: string, amount: number, dealId: string) =>
    createNotification({
      userId: sellerId, type: 'debt_notice', dealId,
      title: '⚠️ Account Debt Recorded',
      body: `A debt of ${amount.toLocaleString()} XAF has been recorded on your account from deal ${dealId}. It will be deducted from your next payout.`,
    }),

  dealInTransit: (userId: string, dealId: string) =>
    createNotification({
      userId, type: 'deal_in_transit', dealId,
      title: '📦 Item On the Way',
      body: 'The rider has collected the item and is heading to the buyer.',
    }),

  dealDelivered: (userId: string, dealId: string) =>
    createNotification({
      userId, type: 'deal_delivered', dealId,
      title: '✅ Package Arrived',
      body: 'The rider has arrived at the delivery location. Awaiting delivery confirmation.',
    }),

  dealFinalized: (userId: string, dealId: string, amount: number) =>
    createNotification({
      userId, type: 'deal_finalized', dealId,
      title: '🎉 Deal Completed!',
      body: `The deal is finalized. ${amount.toLocaleString()} XAF has been released.`,
    }),

  walletCredited: (userId: string, amount: number, description: string, dealId?: string) =>
    createNotification({
      userId, type: 'wallet_credited', dealId,
      title: '💳 Wallet Credited',
      body: `+${amount.toLocaleString()} XAF — ${description}`,
    }),

  walletDebited: (userId: string, amount: number, description: string, dealId?: string) =>
    createNotification({
      userId, type: 'wallet_debited', dealId,
      title: '💳 Wallet Debited',
      body: `-${amount.toLocaleString()} XAF — ${description}`,
    }),

  fundsRequested: (userId: string, dealId: string, sellerName: string, amount: number) =>
    createNotification({
      userId, type: 'funds_requested', dealId,
      title: '💸 Seller Requesting Funds',
      body: `${sellerName} is requesting ${amount.toLocaleString()} XAF for the completed deal.`,
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

  verificationSubmitted: (adminUid: string, userName: string, role: string) =>
    createNotification({
      userId: adminUid, type: 'verification_submitted',
      title: '📋 New Verification Submission',
      body: `${userName} (${role}) submitted documents for review.`,
    }),

  verificationApproved: (userId: string) =>
    createNotification({
      userId, type: 'verification_approved',
      title: '✅ Verification Approved',
      body: 'Your identity has been verified. You now have full platform access.',
    }),

  verificationRejected: (userId: string, reason: string) =>
    createNotification({
      userId, type: 'verification_rejected',
      title: '❌ Verification Rejected',
      body: `Your verification was rejected: ${reason}. Please resubmit.`,
    }),
};

// ── Generate a 6-digit OTP ───────────────────────────────────────────────────
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
