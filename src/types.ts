export type UserRole = 'buyer' | 'seller' | 'rider' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phoneNumber?: string;
  photoURL?: string;
  createdAt: string;
}

export type DealStatus =
  | 'waiting'    // created, other party not joined yet
  | 'active'     // both parties present, payment not initiated
  | 'funded'     // buyer paid, funds held in escrow
  | 'transit'    // item dispatched
  | 'delivered'  // item received, pending OTP
  | 'finalized'  // funds released to seller
  | 'dispute';   // disputed

export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  sellerId: string;
  sellerName: string;
  sellerEmail?: string;
  createdBy: 'buyer' | 'seller';
  riderId?: string;
  status: DealStatus;
  milestone: number;
  paymentReference?: string;
  transferReference?: string;
  releaseOtp?: string;
  productImageUrl?: string;
  platformFee?: number;
  sellerReceives?: number;
  buyerConfirmedDelivery?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageType = 'text' | 'system' | 'image';

export interface Message {
  id: string;
  dealId: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: string;
  type: MessageType;
  imageUrl?: string;
}

export interface Wallet {
  userId: string;
  balance: number;
  pendingBalance: number;
  totalReceived: number;
  totalSent: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'fund' | 'release' | 'fee' | 'refund';
  amount: number;
  description: string;
  dealId?: string;
  createdAt: string;
}

export type NotificationType =
  | 'deal_invite'
  | 'deal_update'
  | 'message'
  | 'funds_released'
  | 'payment_received'
  | 'deal_created_by_seller'
  | 'otp_generated'
  | 'deal_funded'
  | 'deal_in_transit'
  | 'deal_delivered'
  | 'deal_finalized'
  | 'deal_disputed'
  | 'wallet_credited'
  | 'wallet_debited'
  | 'funds_requested';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  dealId?: string;
  read: boolean;
  createdAt: string;
}

export interface NotchpayInitResponse {
  status: string;
  message: string;
  transaction: {
    reference: string;
    authorization_url: string;
    amount: number;
    currency: string;
  };
}

export interface NotchpayTransferResponse {
  status: string;
  message: string;
  transfer?: {
    reference: string;
    amount: number;
    currency: string;
  };
}

export interface BuyerPaymentForm {
  momoNumber: string;
  momoName: string;
  channel: 'cm.mtn' | 'cm.orange';
}

export interface SellerPayoutForm {
  momoNumber: string;
  momoName: string;
  channel: 'cm.mtn' | 'cm.orange';
}
