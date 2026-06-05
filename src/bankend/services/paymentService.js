/**
 * services/payoutService.js
 * --------------------------
 * Payout-side Fapshi service.
 *
 * Uses SEPARATE credentials from the collection service:
 *   FAPSHI_PAYOUT_API_USER  → outgoing payments to sellers, riders, refunds
 *   FAPSHI_PAYOUT_API_KEY
 *
 * NEVER import this file from frontend code.
 * All payout calls are server-side only.
 *
 * Collection service (incoming buyer payments):
 *   FAPSHI_COLLECTION_API_USER / FAPSHI_COLLECTION_API_KEY
 *   → handled in paymentService.js
 */

const FAPSHI_BASE          = process.env.FAPSHI_BASE_URL           || 'https://live.fapshi.com';
const PAYOUT_API_USER      = process.env.FAPSHI_PAYOUT_API_USER;
const PAYOUT_API_KEY       = process.env.FAPSHI_PAYOUT_API_KEY;

if (!PAYOUT_API_USER || !PAYOUT_API_KEY) {
  console.warn('[PayoutService] FAPSHI_PAYOUT_API_USER or FAPSHI_PAYOUT_API_KEY not set. Payouts will fail.');
}

// ── Delivery fee & rider payout table ────────────────────────────────────────
// Rider payout amounts — not the delivery fees charged to buyer.
// Rule: 1,000 FCFA for jobs within Buea | 1,500 FCFA for all other routes
// Route format: "SellerCity→BuyerCity"
const RIDER_PAYOUT_TABLE = {
  'Buea→Buea':           1000,  // within Buea
  'Buea→Douala':         1500,  // out of Buea
  'Douala→Douala':       1500,
  'Douala→Buea':         1500,
  'Yaoundé→Yaoundé':    1500,
  'Yaoundé→Douala':     1500,
  'Douala→Yaoundé':     1500,
  'Yaoundé→Buea':       1500,
  'Buea→Yaoundé':       1500,
};

// ── Retry helper ─────────────────────────────────────────────────────────────
async function withRetry(fn, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fn();
      if (res.status >= 500 && attempt < maxRetries) {
        const backoff = 300 * 2 ** (attempt - 1);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const backoff = 300 * 2 ** (attempt - 1);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

// ── Base payout request ───────────────────────────────────────────────────────
async function payoutRequest(method, path, body = null) {
  const url = `${FAPSHI_BASE}${path}`;
  const options = {
    method,
    headers: {
      'apiuser':      PAYOUT_API_USER,
      'apikey':       PAYOUT_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await withRetry(() => fetch(url, options));
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data?.message || `Fapshi payout error: HTTP ${response.status}`);
    err.status     = response.status;
    err.fapshiData = data;
    throw err;
  }
  return data;
}

// ── Phone normalisation ───────────────────────────────────────────────────────
function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length === 12) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ── 1. Pay rider ──────────────────────────────────────────────────────────────
export async function payRider({ dealId, riderId, phone, network, sellerCity, buyerCity }) {
  const routeKey = `${sellerCity}→${buyerCity}`;
  const amount   = RIDER_PAYOUT_TABLE[routeKey] ?? 1000;
  const externalId = `${dealId}-rider`;

  const data = await payoutRequest('POST', '/payout', {
    amount,
    phone:      normalizePhone(phone),
    medium:     network === 'mtn' ? 'MTN' : 'ORANGE',
    name:       'Rider payout — TrustEscrow',
    externalId,
    message:    `Rider delivery payment — Deal ${dealId}`,
  });

  return {
    transId:    data?.transId || externalId,
    amount,
    status:     data?.status || 'PENDING',
    externalId,
  };
}

// ── 2. Pay seller ─────────────────────────────────────────────────────────────
// Debt deduction happens here: if seller has outstanding debt, deduct first.
export async function paySeller({ dealId, sellerId, phone, network, productPrice, accountDebt = 0 }) {
  const externalId = `${dealId}-seller`;

  let payoutAmount;
  let debtDeducted = 0;
  let remainingDebt = accountDebt;

  if (accountDebt > 0) {
    if (productPrice >= accountDebt) {
      // Payout covers full debt — pay remainder to seller
      debtDeducted    = accountDebt;
      payoutAmount    = productPrice - accountDebt;
      remainingDebt   = 0;
    } else {
      // Payout less than debt — hold entire payout, reduce debt
      debtDeducted    = productPrice;
      payoutAmount    = 0;
      remainingDebt   = accountDebt - productPrice;
    }
  } else {
    payoutAmount = productPrice;
  }

  let transId = null;
  if (payoutAmount > 0) {
    const data = await payoutRequest('POST', '/payout', {
      amount:     payoutAmount,
      phone:      normalizePhone(phone),
      medium:     network === 'mtn' ? 'MTN' : 'ORANGE',
      name:       'Seller payout — TrustEscrow',
      externalId,
      message:    `Seller payment — Deal ${dealId}`,
    });
    transId = data?.transId || externalId;
  }

  return {
    transId,
    payoutAmount,
    debtDeducted,
    remainingDebt,
    status: payoutAmount > 0 ? 'PENDING' : 'HELD',
  };
}

// ── 3. Refund buyer ───────────────────────────────────────────────────────────
export async function refundBuyer({ dealId, phone, network, amount, reason }) {
  const externalId = `${dealId}-refund`;

  const data = await payoutRequest('POST', '/payout', {
    amount,
    phone:      normalizePhone(phone),
    medium:     network === 'mtn' ? 'MTN' : 'ORANGE',
    name:       'Buyer refund — TrustEscrow',
    externalId,
    message:    `Refund for Deal ${dealId}: ${reason}`,
  });

  return {
    transId:    data?.transId || externalId,
    amount,
    status:     data?.status || 'PENDING',
    externalId,
  };
}

// ── 4. Pay return rider ───────────────────────────────────────────────────────
// Return delivery is a flat 1,000 XAF from platform float.
export async function payReturnRider({ dealId, riderId, phone, network }) {
  const amount     = 1000;
  const externalId = `${dealId}-return-rider`;

  const data = await payoutRequest('POST', '/payout', {
    amount,
    phone:      normalizePhone(phone),
    medium:     network === 'mtn' ? 'MTN' : 'ORANGE',
    name:       'Return rider payout — TrustEscrow',
    externalId,
    message:    `Return delivery payment — Deal ${dealId}`,
  });

  return {
    transId:    data?.transId || externalId,
    amount,
    status:     data?.status || 'PENDING',
  };
}

// ── 5. Check payout service balance ──────────────────────────────────────────
// Fapshi endpoint: GET /balance
export async function getPayoutBalance() {
  const data = await payoutRequest('GET', '/balance');
  return {
    balance:  data?.balance ?? 0,
    currency: data?.currency ?? 'XAF',
  };
}

export { RIDER_PAYOUT_TABLE };
