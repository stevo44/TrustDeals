/**
 * models/Payment.js
 * -----------------
 * Mongoose model for escrow payments.
 * Each payment is linked 1-to-1 with a DealSession.
 */

import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

// ─── Payment Status Machine ────────────────────────────────────────────────
//
//   pending  →  paid  →  released   (normal flow)
//                 └────→  refunded  (failed delivery / buyer rejects)
//   pending  →  failed              (Kang API rejected / timeout)
//
const PAYMENT_STATUSES = ['pending', 'paid', 'released', 'refunded', 'failed'];

// ─── Schema ───────────────────────────────────────────────────────────────
const paymentSchema = new Schema(
  {
    // ── Core linkage ──
    session_id: {
      type: Schema.Types.ObjectId,
      ref: 'DealSession',
      required: true,
      unique: true,          // one payment per session (idempotency)
      index: true,
    },

    // ── Parties ──
    buyer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    seller_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Payment details (buyer side) ──
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: 'XAF',
    },
    phone: {
      type: String,
      required: true,
    },
    network: {
      type: String,
      enum: ['mtn', 'orange'],
      required: true,
    },

    // ── Kang transaction refs ──
    transaction_reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    kang_payment_id: {
      type: String,         // Kang's own internal ID returned on initiation
      default: null,
    },

    // ── Payout details (seller side) ──
    payout_reference: {
      type: String,         // ref returned by Kang transfers endpoint
      default: null,
    },
    seller_phone: {
      type: String,
      default: null,
    },
    seller_network: {
      type: String,
      enum: ['mtn', 'orange', null],
      default: null,
    },

    // ── State ──
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },

    // ── Webhook idempotency ──
    webhook_events: {
      type: [String],       // store processed webhook event IDs
      default: [],
    },

    // ── Timestamps ──
    paid_at: { type: Date, default: null },
    released_at: { type: Date, default: null },
    refunded_at: { type: Date, default: null },
    failed_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'payments',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────
paymentSchema.index({ session_id: 1, status: 1 });
paymentSchema.index({ transaction_reference: 1 }, { unique: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────
paymentSchema.virtual('is_escrowed').get(function () {
  return this.status === 'paid';
});

paymentSchema.virtual('is_settled').get(function () {
  return ['released', 'refunded'].includes(this.status);
});

// ─── Export ───────────────────────────────────────────────────────────────
const Payment = models.Payment || model('Payment', paymentSchema);
export default Payment;
