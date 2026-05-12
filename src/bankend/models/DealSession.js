/**
 * models/DealSession.js
 * ----------------------
 * Mongoose model for the Deal Session lifecycle.
 *
 * State machine:
 *   CREATED → JOINED → BUYER_REQUESTED_PRODUCT → PRODUCT_SUBMITTED
 *   → PRODUCT_CONFIRMED → PAYMENT_PENDING → PAYMENT_LOCKED
 *   → RIDER_ASSIGNED → IN_TRANSIT → DELIVERED → COMPLETED | RETURNED
 */

import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

export const SESSION_STATUSES = [
  'CREATED',
  'JOINED',
  'BUYER_REQUESTED_PRODUCT',
  'PRODUCT_SUBMITTED',
  'PRODUCT_CONFIRMED',
  'PAYMENT_PENDING',      // buyer initiated payment, waiting Kang confirmation
  'PAYMENT_LOCKED',       // funds received & held in escrow
  'RIDER_ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',            // funds released to seller
  'RETURNED',             // refund issued to buyer
];

// Valid forward (and allowed backward) transitions
export const ALLOWED_TRANSITIONS = {
  CREATED:                  ['JOINED'],
  JOINED:                   ['BUYER_REQUESTED_PRODUCT'],
  BUYER_REQUESTED_PRODUCT:  ['PRODUCT_SUBMITTED'],
  PRODUCT_SUBMITTED:        ['PRODUCT_CONFIRMED', 'BUYER_REQUESTED_PRODUCT'], // re-submit allowed
  PRODUCT_CONFIRMED:        ['PAYMENT_PENDING'],
  PAYMENT_PENDING:          ['PAYMENT_LOCKED', 'PRODUCT_CONFIRMED'],          // revert on failure
  PAYMENT_LOCKED:           ['RIDER_ASSIGNED'],
  RIDER_ASSIGNED:           ['IN_TRANSIT'],
  IN_TRANSIT:               ['DELIVERED'],
  DELIVERED:                ['COMPLETED', 'RETURNED'],
  COMPLETED:                [],   // terminal
  RETURNED:                 [],   // terminal
};

const dealSessionSchema = new Schema(
  {
    // ── Parties ──
    buyer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    seller_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    rider_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Deal metadata ──
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XAF' },

    // ── Seller payout info (set when seller joins) ──
    seller_phone: { type: String, default: null },
    seller_network: {
      type: String,
      enum: ['mtn', 'orange', null],
      default: null,
    },

    // ── State ──
    status: {
      type: String,
      enum: SESSION_STATUSES,
      default: 'CREATED',
      index: true,
    },

    // ── Payment linkage ──
    payment_id: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },

    // ── OTP for delivery confirmation (hashed) ──
    delivery_otp_hash: { type: String, default: null },
    delivery_otp_expires_at: { type: Date, default: null },
    otp_verified: { type: Boolean, default: false },

    // ── Product submission ──
    product_images: { type: [String], default: [] },
    product_description: { type: String, default: null },

    // ── Timestamps for key events ──
    joined_at: { type: Date, default: null },
    product_confirmed_at: { type: Date, default: null },
    payment_locked_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    returned_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'deal_sessions',
  }
);

// ─── Instance method: safe status transition ─────────────────────────────
dealSessionSchema.methods.transitionTo = function (nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[this.status] || [];
  if (!allowed.includes(nextStatus)) {
    const err = new Error(
      `Invalid transition: ${this.status} → ${nextStatus}. ` +
      `Allowed: [${allowed.join(', ')}]`
    );
    err.code = 'INVALID_TRANSITION';
    throw err;
  }
  this.status = nextStatus;

  // Stamp event timestamps
  const now = new Date();
  if (nextStatus === 'JOINED')          this.joined_at = now;
  if (nextStatus === 'PRODUCT_CONFIRMED') this.product_confirmed_at = now;
  if (nextStatus === 'PAYMENT_LOCKED')  this.payment_locked_at = now;
  if (nextStatus === 'DELIVERED')       this.delivered_at = now;
  if (nextStatus === 'COMPLETED')       this.completed_at = now;
  if (nextStatus === 'RETURNED')        this.returned_at = now;

  return this;
};

const DealSession = models.DealSession || model('DealSession', dealSessionSchema);
export default DealSession;
