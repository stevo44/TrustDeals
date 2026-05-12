/**
 * services/paymentService.js
 * ---------------------------
 * Fapshi payment gateway integration.
 *
 * ALL calls to the Fapshi API live here.
 * Controllers never call Fapshi directly.
 *
 * Fapshi API docs: https://fapshi.com/developers
 *
 * Environment variables required:
 *   FAPSHI_API_USER      – your Fapshi API user (from dashboard)
 *   FAPSHI_API_KEY       – your Fapshi API key  (from dashboard)
 *   FAPSHI_BASE_URL      – https://live.fapshi.com  (or https://sandbox.fapshi.com for testing)
 */

import crypto from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────
const FAPSHI_BASE     = process.env.FAPSHI_BASE_URL || 'https://live.fapshi.com';
const FAPSHI_API_USER = process.env.FAPSHI_API_USER;
const FAPSHI_API_KEY  = process.env.FAPSHI_API_KEY;

if (!FAPSHI_API_USER || !FAPSHI_API_KEY) {
  console.warn('[PaymentService] FAPSHI_API_USER or FAPSHI_API_KEY not set. Payment calls will fail.');
}

// ─── Retry helper ─────────────────────────────────────────────────────────────
async function withRetry(fn, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fn();
      if (res.status >= 500 && attempt < maxRetries) {
        const backoff = 200 * 2 ** (attempt - 1);
        console.warn(`[PaymentService] Fapshi returned ${res.status}. Retrying in ${backoff}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const backoff = 200 * 2 ** (attempt - 1);
        console.warn(`[PaymentService] Network error: ${err.message}. Retrying in ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────
async function fapshiRequest(method, path, body = null) {
  const url = `${FAPSHI_BASE}${path}`;

  const options = {
    method,
    headers: {
      'apiuser':      FAPSHI_API_USER,
      'apikey':       FAPSHI_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await withRetry(() => fetch(url, options));
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.message || `Fapshi API error: HTTP ${response.status}`);
    error.status     = response.status;
    error.fapshiCode = data?.code;
    error.fapshiData = data;
    throw error;
  }

  return data;
}

// ─── Generate transaction reference ───────────────────────────────────────────
export function generateTransactionRef(sessionId) {
  const shortId = String(sessionId).slice(-8);
  const ts      = Date.now().toString(36);
  const rand    = crypto.randomBytes(2).toString('hex');
  return `td-${shortId}-${ts}-${rand}`;
}

// ─── Normalize phone for Fapshi ───────────────────────────────────────────────
// Fapshi expects phone WITHOUT country code prefix: "671234567" not "237671234567"
export function normalizeFapshiPhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length === 12) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ─── 1. INITIATE PAYMENT (collect from buyer) ─────────────────────────────────
// Fapshi endpoint: POST /initiate-pay
export async function initiateKangPayment({ amount, phone, network, reference, session_id, description }) {
  const cleanPhone = normalizeFapshiPhone(phone);

  const payload = {
    amount,
    phone:       cleanPhone,
    medium:      network === 'mtn' ? 'MTN' : 'ORANGE',
    name:        description || 'TrustDeals escrow',
    userId:      String(session_id),
    externalId:  reference,
    message:     description || `Escrow payment - session ${session_id}`,
    redirectUrl: `${process.env.APP_BASE_URL}/payment/callback?ref=${reference}`,
  };

  const data = await fapshiRequest('POST', '/initiate-pay', payload);

  return {
    fapshi_trans_id: data?.transId || data?.trans_id,
    status:          data?.status  || 'PENDING',
    reference,
    raw: data,
  };
}

// ─── 2. CHECK PAYMENT STATUS ──────────────────────────────────────────────────
// Fapshi endpoint: GET /payment-status/:transId
export async function checkKangPaymentStatus(transId) {
  const data = await fapshiRequest('GET', `/payment-status/${transId}`);

  return {
    status:  data?.status,
    amount:  data?.amount,
    transId: data?.transId || transId,
    raw:     data,
  };
}

// ─── 3. PAYOUT TO SELLER ──────────────────────────────────────────────────────
// Fapshi endpoint: POST /payout
export async function payoutToSeller({ amount, phone, network, session_id, description }) {
  const cleanPhone = normalizeFapshiPhone(phone);
  const payoutRef  = `payout-${String(session_id).slice(-8)}-${Date.now().toString(36)}`;

  const payload = {
    amount,
    phone:      cleanPhone,
    medium:     network === 'mtn' ? 'MTN' : 'ORANGE',
    name:       description || 'Seller payout - TrustDeals',
    externalId: payoutRef,
    message:    description || `Payout for session ${session_id}`,
  };

  const data = await fapshiRequest('POST', '/payout', payload);

  return {
    payout_reference: data?.transId || data?.trans_id || payoutRef,
    status:           data?.status  || 'PENDING',
    raw:              data,
  };
}

// ─── 4. REFUND TO BUYER ───────────────────────────────────────────────────────
// Same Fapshi /payout endpoint — just targeting the buyer's number
export async function refundToBuyer({ amount, phone, network, session_id }) {
  const cleanPhone = normalizeFapshiPhone(phone);
  const refundRef  = `refund-${String(session_id).slice(-8)}-${Date.now().toString(36)}`;

  const payload = {
    amount,
    phone:      cleanPhone,
    medium:     network === 'mtn' ? 'MTN' : 'ORANGE',
    name:       'Buyer refund - TrustDeals',
    externalId: refundRef,
    message:    `Refund for session ${session_id}`,
  };

  const data = await fapshiRequest('POST', '/payout', payload);

  return {
    refund_reference: data?.transId || data?.trans_id || refundRef,
    status:           data?.status  || 'PENDING',
    raw:              data,
  };
}

// ─── 5. WEBHOOK SIGNATURE VERIFICATION ───────────────────────────────────────
// Fapshi signs webhooks with HMAC-SHA512 using your API key as the secret.
// Signature arrives in the x-fapshi-signature header.
export function verifyKangWebhookSignature(rawBody, signature) {
  if (!FAPSHI_API_KEY) {
    console.warn('[PaymentService] FAPSHI_API_KEY not set - skipping signature verification (dev mode)');
    return true;
  }

  if (!signature) {
    console.warn('[PaymentService] No x-fapshi-signature header received');
    return process.env.NODE_ENV !== 'production';
  }

  const expected = crypto
    .createHmac('sha512', FAPSHI_API_KEY)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected,  'hex')
    );
  } catch {
    return false;
  }
}

// ─── 6. NORMALIZE FAPSHI STATUS ───────────────────────────────────────────────
// Fapshi statuses: SUCCESSFUL | FAILED | EXPIRED | PENDING | CREATED
export function normalizeKangStatus(fapshiStatus) {
  const s = (fapshiStatus || '').toUpperCase();
  if (s === 'SUCCESSFUL')                 return 'success';
  if (['FAILED', 'EXPIRED'].includes(s))  return 'failed';
  if (['PENDING', 'CREATED'].includes(s)) return 'pending';
  return 'unknown';
}
