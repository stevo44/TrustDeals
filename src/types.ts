export type UserRole = 'buyer' | 'seller' | 'rider' | 'admin';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Verification {
  userId: string;
  role: UserRole;
  status: VerificationStatus;
  phoneVerified: boolean;
  phoneNumber: string;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  businessRegUrl?: string;
  vehiclePhotoUrl?: string;
  licenseUrl?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phoneNumber?: string;
  photoURL?: string;
  createdAt: string;
  accountDebt?: number;
  debtDealId?: string;
  debtAcknowledged?: boolean;
  debtAcknowledgedAt?: string;
  debtStatus?: 'acknowledged' | 'partially_recovered' | 'cleared';
  accountStatus?: 'normal' | 'debt_hold' | 'suspended' | 'banned';
  debtHistory?: DebtRecord[];
  verificationStatus?: VerificationStatus;
}

export interface DebtRecord {
  amount: number;
  dealId: string;
  reason: string;
  createdAt: string;
  clearedAt?: string;
}

export type DealStatus =
  | 'WAITING'
  | 'ACTIVE'
  | 'PRODUCT_CONFIRMED'
  | 'PAYMENT_LOCKED'
  | 'RIDER_ASSIGNED'
  | 'PICKUP_PENDING'
  | 'IN_TRANSIT'
  | 'AT_BUYER_LOCATION'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'SELLER_DISPUTED'
  | 'RIDER_DISPUTED'
  | 'RETURN_APPROVED'
  | 'RETURN_IN_TRANSIT'
  | 'RETURNED'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'CANCELLED_OTP_FAILED'
  | 'AUTO_RELEASED'
  | 'PAYOUT_FAILED'
  | 'RETURN_RIDER_PAYOUT_FAILED'
  | 'BUYER_REFUND_FAILED';

export interface StatusHistoryEntry {
  status: DealStatus;
  timestamp: string;
  triggeredBy?: string;
  note?: string;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  buyerCity: string;
  sellerId: string;
  sellerName: string;
  sellerEmail?: string;
  sellerCity?: string;
  createdBy: 'buyer' | 'seller';
  riderId?: string;
  riderName?: string;
  status: DealStatus;
  statusHistory?: StatusHistoryEntry[];
  productPrice?: number;
  platformFee?: number;
  deliveryFee?: number;
  totalCharged?: number;
  sellerReceives?: number;
  paymentReference?: string;
  transferReference?: string;
  fapshiTransId?: string;
  buyerOtp?: string;
  otpAttempts?: number;
  pickupCode?: string;
  pickupCodeAttempts?: number;
  createdAt: string;
  updatedAt: string;
  fundedAt?: string;
  completedAt?: string;
  productImageUrl?: string;
  buyerConfirmedDelivery?: boolean;
  disputeType?: 'buyer' | 'seller' | 'rider';
  disputeRaisedAt?: string;
  disputeRaisedBy?: string;
  disputeReason?: string;
  disputeDescription?: string;
  disputeEvidenceUrls?: string[];
  disputeCounterEvidenceUrls?: string[];
  disputeResolution?: 'buyer' | 'seller' | 'escalated';
  disputeResolvedAt?: string;
  returnRiderId?: string;
  returnRiderName?: string;
  sellerPhone?: string;
  sellerNetwork?: 'mtn' | 'orange';
  buyerPhone?: string;
  buyerNetwork?: 'mtn' | 'orange';
}

export interface DeliveryFeeConfig {
  routes: Record<string, number>;
}

export interface FeeBreakdown {
  productPrice: number;
  platformFee: number;
  deliveryFee: number;
  totalCharged: number;
  sellerReceives: number;
  sellerCity: string;
  buyerCity: string;
  routeLabel: string;
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
  type: 'fund' | 'release' | 'fee' | 'payout_fee' | 'refund' | 'withdraw';
  amount: number;
  description: string;
  dealId?: string;
  createdAt: string;
}

export type BuyerDisputeReason =
  | 'wrong_item'
  | 'item_damaged'
  | 'not_matching_description'
  | 'quantity_incorrect'
  | 'other';

export type SellerDisputeReason =
  | 'buyer_unreachable'
  | 'wrong_delivery_address'
  | 'buyer_refusing_inspection'
  | 'false_dispute'
  | 'other';

export type RiderDisputeReason =
  | 'buyer_not_present'
  | 'buyer_unreachable'
  | 'buyer_refusing_goods'
  | 'other';

export interface DisputeSubmission {
  dealId: string;
  type: 'buyer' | 'seller' | 'rider';
  reason: BuyerDisputeReason | SellerDisputeReason | RiderDisputeReason;
  description: string;
  evidenceUrls?: string[];
  callAttempts?: number;
}

export type AdminNotifType =
  | 'NEW_DISPUTE'
  | 'OTP_CANCELLED'
  | 'PAYOUT_FAILED'
  | 'BUYER_REFUND_FAILED'
  | 'PICKUP_CODE_FAILED'
  | 'LOW_BALANCE'
  | 'RIDER_DISPUTE'
  | 'AUTO_RELEASE';

export interface AdminNotification {
  id: string;
  type: AdminNotifType;
  dealId?: string;
  message: string;
  timestamp: string;
  read: boolean;
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
  | 'funds_requested'
  | 'deal_payment_locked'
  | 'deal_rider_assigned'
  | 'deal_at_buyer_location'
  | 'deal_completed'
  | 'deal_cancelled'
  | 'dispute_raised'
  | 'pickup_code_generated'
  | 'goods_collected'
  | 'return_approved'
  | 'debt_notice'
  | 'verification_submitted'
  | 'verification_approved'
  | 'verification_rejected';

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

export type FapshiNetwork = 'mtn' | 'orange';

export interface BuyerPaymentForm {
  momoNumber: string;
  momoName: string;
  network: FapshiNetwork;
}

export interface SellerPayoutForm {
  momoNumber: string;
  momoName: string;
  network: FapshiNetwork;
}
