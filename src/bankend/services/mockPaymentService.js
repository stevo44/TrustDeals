/**
 * services/mockPaymentService.js
 * --------------------------------
 * In-process mock of the Fapshi payout API for local development.
 *
 * Activated when: NODE_ENV=development AND FAPSHI_MOCK=true in .env
 *
 * Switch to real payments: set FAPSHI_MOCK=false (or remove it) and
 * supply real FAPSHI_PAYOUT_API_USER / FAPSHI_PAYOUT_API_KEY.
 *
 * All functions return the same shape as the real paymentService,
 * so swapping is zero-code-change.
 */

import crypto from 'crypto';

// ── In-memory ledger (resets on server restart) ───────────────────────────────
const _transactions = new Map();
let   _mockBalance  = 500_000; // start with 500,000 XAF in the mock float

function _createTx({ externalId, amount, phone, medium, type, description }) {
  const transId = `MOCK-${type.toUpperCase()}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const entry = { transId, externalId, amount, phone, medium, type, description, status: 'PENDING', createdAt: Date.now() };
  _transactions.set(transId, entry);

  // Simulate async confirmation after 3 seconds
  setTimeout(() => {
    const tx = _transactions.get(transId);
    if (tx) _transactions.set(transId, { ...tx, status: 'SUCCESSFUL' });
  }, 3_000);

  console.info(`[MockPaymentService] ${type} tx created — ${transId} | ${amount} XAF → ${phone} (${medium})`);
  return entry;
}

// ── Rider payout table (same as real service) ─────────────────────────────────
const RIDER_PAYOUT_TABLE = {
  'Buea→Buea':        1000,
  'Buea→Douala':      1500,
  'Douala→Douala':    1000,
  'Douala→Buea':      1500,
  'Yaoundé→Yaoundé':  1000,
  'Yaoundé→Douala':   1500,
  'Douala→Yaoundé':   1500,
  'Yaoundé→Buea':     2000,
  'Buea→Yaoundé':     2000,
};

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length === 12) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ── 1. Pay rider ──────────────────────────────────────────────────────────────
export async function payRider({ dealId, phone, network, sellerCity, buyerCity }) {
  const routeKey = `${sellerCity}→${buyerCity}`;
  const amount   = RIDER_PAYOUT_TABLE[routeKey] ?? 1000;
  const tx = _createTx({
    externalId:  `${dealId}-rider`,
    amount,
    phone:       normalizePhone(phone),
    medium:      network === 'mtn' ? 'MTN' : 'ORANGE',
    type:        'rider_payout',
    description: `Rider payment — Deal ${dealId}`,
  });
  _mockBalance -= amount;
  return { transId: tx.transId, amount, status: 'PENDING', externalId: tx.externalId, isMock: true };
}

// ── 2. Pay seller ─────────────────────────────────────────────────────────────
export async function paySeller({ dealId, phone, network, productPrice, accountDebt = 0 }) {
  let payoutAmount = productPrice;
  let debtDeducted = 0;
  let remainingDebt = 0;

  if (accountDebt > 0) {
    if (productPrice >= accountDebt) {
      debtDeducted  = accountDebt;
      payoutAmount  = productPrice - accountDebt;
      remainingDebt = 0;
    } else {
      debtDeducted  = productPrice;
      payoutAmount  = 0;
      remainingDebt = accountDebt - productPrice;
    }
  }

  let transId = null;
  if (payoutAmount > 0) {
    const tx = _createTx({
      externalId:  `${dealId}-seller`,
      amount:      payoutAmount,
      phone:       normalizePhone(phone),
      medium:      network === 'mtn' ? 'MTN' : 'ORANGE',
      type:        'seller_payout',
      description: `Seller payment — Deal ${dealId}`,
    });
    transId = tx.transId;
    _mockBalance -= payoutAmount;
  }

  return { transId, payoutAmount, debtDeducted, remainingDebt, status: payoutAmount > 0 ? 'PENDING' : 'HELD', isMock: true };
}

// ── 3. Refund buyer ───────────────────────────────────────────────────────────
export async function refundBuyer({ dealId, phone, network, amount, reason }) {
  const tx = _createTx({
    externalId:  `${dealId}-refund`,
    amount,
    phone:       normalizePhone(phone),
    medium:      network === 'mtn' ? 'MTN' : 'ORANGE',
    type:        'buyer_refund',
    description: `Refund — Deal ${dealId}: ${reason}`,
  });
  _mockBalance -= amount;
  return { transId: tx.transId, amount, status: 'PENDING', externalId: tx.externalId, isMock: true };
}

// ── 4. Pay return rider ───────────────────────────────────────────────────────
export async function payReturnRider({ dealId, phone, network }) {
  const amount = 1000;
  const tx = _createTx({
    externalId:  `${dealId}-return-rider`,
    amount,
    phone:       normalizePhone(phone),
    medium:      network === 'mtn' ? 'MTN' : 'ORANGE',
    type:        'return_rider_payout',
    description: `Return rider — Deal ${dealId}`,
  });
  _mockBalance -= amount;
  return { transId: tx.transId, amount, status: 'PENDING', isMock: true };
}

// ── 5. Mock balance ───────────────────────────────────────────────────────────
export async function getPayoutBalance() {
  return { balance: _mockBalance, currency: 'XAF', isMock: true };
}

// ── 6. Get mock transaction (for debug/status checks) ─────────────────────────
export function getMockTransaction(transId) {
  return _transactions.get(transId) || null;
}

export { RIDER_PAYOUT_TABLE };
