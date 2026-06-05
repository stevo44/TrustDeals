/**
 * lib/fapshi.ts
 * -------------
 * Fapshi payment gateway integration — frontend (public key only).
 *
 * ── Environment switching ───────────────────────────────────────────────────
 *   Development  → VITE_FAPSHI_MOCK=true  (no credentials needed)
 *                  Uses an in-browser mock that simulates the full MoMo flow.
 *
 *   Sandbox      → VITE_FAPSHI_MOCK=false (or unset)
 *                  VITE_FAPSHI_API_USER + VITE_FAPSHI_API_KEY from sandbox.fapshi.com
 *                  VITE_FAPSHI_BASE_URL=https://sandbox.fapshi.com  (default)
 *
 *   Production   → VITE_FAPSHI_MOCK=false (or unset)
 *                  VITE_FAPSHI_API_USER + VITE_FAPSHI_API_KEY from live dashboard
 *                  VITE_FAPSHI_BASE_URL=https://live.fapshi.com
 *
 * Only ONE flag flips to go live: set VITE_FAPSHI_BASE_URL=https://live.fapshi.com
 * and provide live credentials. Nothing else changes.
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const IS_MOCK         = import.meta.env.VITE_FAPSHI_MOCK === 'true';
const FAPSHI_BASE     = import.meta.env.VITE_FAPSHI_BASE_URL || 'https://sandbox.fapshi.com';
const FAPSHI_API_USER = import.meta.env.VITE_FAPSHI_API_USER as string;
const FAPSHI_API_KEY  = import.meta.env.VITE_FAPSHI_API_KEY  as string;
console.log('[Fapshi] IS_MOCK =', IS_MOCK);

if (!IS_MOCK && (!FAPSHI_API_USER || !FAPSHI_API_KEY)) {
  console.warn(
    '[Fapshi] VITE_FAPSHI_MOCK is not "true" but credentials are missing.\n' +
    '         Set VITE_FAPSHI_MOCK=true in .env for local dev, or provide real credentials.'
  );
}

if (IS_MOCK) {
  console.info('[Fapshi] 🧪 MOCK MODE — payments are simulated. Set VITE_FAPSHI_MOCK=false to use real API.');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FapshiNetwork = 'mtn' | 'orange';

export interface InitiatePaymentParams {
  amount:      number;
  phone:       string;
  network:     FapshiNetwork;
  dealId:      string;
  description: string;
}

export interface FapshiPaymentResult {
  transId:    string;
  reference:  string;
  status:     string;
  isMock?:    boolean;
}

export interface FapshiStatusResult {
  transId:    string;
  status:     'CREATED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'EXPIRED' | string;
  amount:     number;
  medium:     string;
  isMock?:    boolean;
}

// ─── Phone normalisation ──────────────────────────────────────────────────────
export function formatFapshiPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length === 12) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ─── Mock store (in-memory, persists for the browser session) ─────────────────
// Each entry: { transId, status, amount, medium, createdAt }
const _mockStore = new Map<string, {
  transId:   string;
  status:    string;
  amount:    number;
  medium:    string;
  createdAt: number;
}>();

/**
 * MOCK: initiatePayment
 * Simulates the Fapshi POST /initiate-pay endpoint.
 *
 * Behaviour:
 *  - Always creates a transaction in CREATED state.
 *  - After 4 seconds, advances to PENDING.
 *  - After 10 seconds, advances to SUCCESSFUL.
 *
 * To test failure: set phone to "000" — the mock will mark FAILED at step 2.
 */
function mockInitiatePayment(params: InitiatePaymentParams): FapshiPaymentResult {
  const transId   = `MOCK-${params.dealId}-${Date.now()}`;
  const reference = `deal-${params.dealId}-${Date.now()}`;
  const isFail    = formatFapshiPhone(params.phone) === '000';

  _mockStore.set(transId, {
    transId,
    status:    'CREATED',
    amount:    params.amount,
    medium:    params.network === 'mtn' ? 'MTN' : 'ORANGE',
    createdAt: Date.now(),
  });

  // Advance status asynchronously
  setTimeout(() => {
    const entry = _mockStore.get(transId);
    if (entry) _mockStore.set(transId, { ...entry, status: isFail ? 'FAILED' : 'PENDING' });
  }, 4_000);

  if (!isFail) {
    setTimeout(() => {
      const entry = _mockStore.get(transId);
      if (entry) _mockStore.set(transId, { ...entry, status: 'SUCCESSFUL' });
    }, 10_000);
  }

  console.info(`[Fapshi Mock] Payment initiated — transId: ${transId} | phone: ${params.phone} | amount: ${params.amount} XAF`);
  return { transId, reference, status: 'CREATED', isMock: true };
}

/**
 * MOCK: checkPaymentStatus
 * Reads the in-memory mock store.
 */
function mockCheckPaymentStatus(transId: string): FapshiStatusResult {
  const entry = _mockStore.get(transId);
  if (!entry) {
    // HMR wiped the store — treat as still pending rather than failed
    return { transId, status: 'PENDING', amount: 0, medium: 'UNKNOWN', isMock: true };
  }
  return { ...entry, isMock: true };
}

// ─── Live request helper ──────────────────────────────────────────────────────
async function fapshiRequest(method: string, path: string, body?: object) {
  const url = `${FAPSHI_BASE}${path}`;
  const res  = await fetch(url, {
    method,
    headers: {
      'apiuser':      FAPSHI_API_USER,
      'apikey':       FAPSHI_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (data as any)?.message || `Fapshi error: HTTP ${res.status}`;
    const err  = new Error(msg) as any;
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data as any;
}

// ─── 1. Initiate payment (buyer pays into escrow) ─────────────────────────────
export async function initiatePayment(params: InitiatePaymentParams): Promise<FapshiPaymentResult> {
  if (IS_MOCK) {
    return mockInitiatePayment(params);
  }

  const { amount, phone, network, dealId, description } = params;
  const cleanPhone = formatFapshiPhone(phone);
  const reference  = `deal-${dealId}-${Date.now()}`;

  const data = await fapshiRequest('POST', '/initiate-pay', {
    amount,
    phone:       cleanPhone,
    medium:      network === 'mtn' ? 'MTN' : 'ORANGE',
    name:        description,
    externalId:  reference,
    message:     description,
    redirectUrl: `${window.location.origin}/?payment=callback&dealId=${dealId}`,
  });

  return {
    transId:   data?.transId   || data?.trans_id,
    reference,
    status:    data?.status    || 'CREATED',
  };
}

// ─── 2. Check payment status ──────────────────────────────────────────────────
export async function checkPaymentStatus(transId: string): Promise<FapshiStatusResult> {
  if (IS_MOCK) {
    return mockCheckPaymentStatus(transId);
  }

  const data = await fapshiRequest('GET', `/payment-status/${transId}`);
  return {
    transId: data?.transId || transId,
    status:  data?.status,
    amount:  data?.amount,
    medium:  data?.medium,
  };
}

// ─── 3. Normalise Fapshi status ───────────────────────────────────────────────
export function normalizeStatus(fapshiStatus: string): 'success' | 'failed' | 'pending' {
  const s = (fapshiStatus || '').toUpperCase();
  if (s === 'SUCCESSFUL')                        return 'success';
  if (['FAILED', 'EXPIRED'].includes(s))         return 'failed';
  return 'pending'; // CREATED | PENDING | unknown
}

// ─── 4. Environment info (for debug panels) ───────────────────────────────────
export function getFapshiEnvInfo() {
  return {
    isMock:  IS_MOCK,
    baseUrl: IS_MOCK ? 'in-browser mock' : FAPSHI_BASE,
    env:     IS_MOCK
      ? 'mock'
      : FAPSHI_BASE.includes('sandbox')
      ? 'sandbox'
      : 'live',
  };
}
