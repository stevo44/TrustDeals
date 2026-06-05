// /**
//  * Notch Pay Integration
//  * ---------------------
//  * Notch Pay is the leading payment gateway for Cameroon / Central Africa.
//  * It supports MTN Mobile Money, Orange Money, and card payments in XAF.
//  *
//  * API docs: https://developer.notchpay.co
//  *
//  * TO CONFIGURE:
//  *   1. Sign up at https://business.notchpay.co
//  *   2. Grab your Public Key from Settings > API Keys
//  *   3. Replace NOTCH_PAY_PUBLIC_KEY below with your real key
//  *   4. Set up a webhook endpoint to receive payment confirmations
//  *
//  * ⚠️  Never expose your SECRET KEY in client-side code.
//  *     All webhook verification should happen server-side.
//  */

// // ─── CONFIG ──────────────────────────────────────────────────────────────────
// // Replace this with your actual Notch Pay public key from the dashboard
// const NOTCH_PAY_PUBLIC_KEY = import.meta.env.VITE_NOTCH_PAY_PUBLIC_KEY ?? 'pk.YOUR_PUBLIC_KEY_HERE';
// const NOTCH_PAY_API_BASE   = 'https://api.notchpay.co';

// // ─── TYPES ───────────────────────────────────────────────────────────────────
// export interface InitiatePaymentParams {
//   amount: number;           // Amount in XAF (e.g. 15000)
//   email: string;            // Buyer's email address
//   name: string;             // Buyer's full name
//   phone?: string;           // Buyer's phone (MTN/Orange number, e.g. 237671234567)
//   description: string;      // What the payment is for
//   dealId: string;           // Used to link payment back to the deal in Firestore
//   callbackUrl?: string;     // URL Notch Pay redirects to after payment
// }

// export interface NotchPayTransaction {
//   reference: string;
//   amount: number;
//   fee: number;
//   status: 'pending' | 'complete' | 'failed' | 'expired';
//   currency: string;
//   customer: { email: string; name: string; phone?: string };
//   authorization_url: string; // redirect buyer here to complete payment
//   created_at: string;
// }

// export interface InitiatePaymentResult {
//   success: boolean;
//   reference?: string;
//   authorization_url?: string;
//   transaction?: NotchPayTransaction;
//   error?: string;
// }

// export interface VerifyPaymentResult {
//   success: boolean;
//   status?: 'pending' | 'complete' | 'failed' | 'expired';
//   transaction?: NotchPayTransaction;
//   error?: string;
// }

// // ─── INITIATE PAYMENT ────────────────────────────────────────────────────────
// /**
//  * Creates a Notch Pay charge and returns the authorization_url.
//  * The buyer is then redirected to that URL to complete the payment
//  * via MTN MoMo, Orange Money, or card.
//  */
// export async function initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
//   const {
//     amount, email, name, phone, description, dealId, callbackUrl
//   } = params;

//   const payload: Record<string, any> = {
//     amount,
//     currency: 'XAF',
//     description,
//     email,
//     name,
//     // Notch Pay uses "reference" as the unique transaction ID you generate
//     // We use the dealId so we can look it up on webhook
//     reference: `deal-${dealId}-${Date.now()}`,
//     callback: callbackUrl ?? `${window.location.origin}/?payment=callback&dealId=${dealId}`,
//     metadata: {
//       deal_id: dealId,
//       buyer_email: email,
//     },
//   };

//   if (phone) payload.phone = phone;

//   try {
//     const response = await fetch(`${NOTCH_PAY_API_BASE}/payments/initialize`, {
//       method: 'POST',
//       headers: {
//         'Authorization': NOTCH_PAY_PUBLIC_KEY,
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//       },
//       body: JSON.stringify(payload),
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       console.error('[NotchPay] Initialize error:', data);
//       return {
//         success: false,
//         error: data?.message ?? `Payment failed: HTTP ${response.status}`,
//       };
//     }

//     // Notch Pay returns { code: 201, transaction: { ... } }
//     const tx: NotchPayTransaction = data.transaction;

//     return {
//       success: true,
//       reference: tx.reference,
//       authorization_url: tx.authorization_url,
//       transaction: tx,
//     };
//   } catch (err: any) {
//     console.error('[NotchPay] Network error:', err);
//     return { success: false, error: err?.message ?? 'Network error. Please try again.' };
//   }
// }

// // ─── VERIFY PAYMENT ──────────────────────────────────────────────────────────
// /**
//  * Polls Notch Pay to verify whether a payment was completed.
//  * Call this after the buyer returns from the authorization_url.
//  */
// export async function verifyPayment(reference: string): Promise<VerifyPaymentResult> {
//   try {
//     const response = await fetch(`${NOTCH_PAY_API_BASE}/payments/${reference}`, {
//       method: 'GET',
//       headers: {
//         'Authorization': NOTCH_PAY_PUBLIC_KEY,
//         'Accept': 'application/json',
//       },
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       return { success: false, error: data?.message ?? 'Verification failed' };
//     }

//     const tx: NotchPayTransaction = data.transaction;

//     return {
//       success: true,
//       status: tx.status,
//       transaction: tx,
//     };
//   } catch (err: any) {
//     return { success: false, error: err?.message ?? 'Network error' };
//   }
// }

// // ─── FORMAT XAF ──────────────────────────────────────────────────────────────
// export function formatXAF(amount: number): string {
//   return `${amount.toLocaleString('fr-CM')} FCFA`;
// }

// // ─── COMPUTE PLATFORM FEE ────────────────────────────────────────────────────
// /**
//  * TrustDeals charges a 2% platform fee on the deal amount.
//  * Returns { fee, total } where total = amount + fee.
//  */
// export function computeFee(amount: number): { fee: number; total: number; feePercent: number } {
//   const feePercent = 2;
//   const fee = Math.ceil(amount * (feePercent / 100));
//   return { fee, total: amount + fee, feePercent };
// }


// =============================================
// lib/notchpay.ts
// All Notchpay API calls live here.
// Uses only the PUBLIC key — safe for frontend.
// =============================================

const NOTCHPAY_PUBLIC_KEY = import.meta.env.VITE_NOTCHPAY_PUBLIC_KEY ?? 'pk_test.Q6hNe9ME8XSf9PpZZZ5Y4Fr7Lbz6em5N1qUMd7ob4c7m8P2FWzzdXKrHCKHnbMgjcsEgoLkggHmhu9LkPBZmXkO4MwNnYDKwLhpRRNkvrvgoYcuRYKLtc6JicCzvn';
const NOTCHPAY_BASE = 'https://api.notchpay.co';

// =============================================
// INITIALIZE PAYMENT (buyer pays)
// Charges the buyer's MoMo number directly.
// Returns a payment reference to track the tx.
// =============================================
export async function initializePayment({
  amount,
  currency = 'XAF',
  email,
  phone,
  name,
  channel,
  dealId,
  description,
}: {
  amount: number;
  currency?: string;
  email: string;
  phone: string;
  name: string;
  channel: 'cm.mtn' | 'cm.orange';
  dealId: string;
  description: string;
}) {
  const response = await fetch(`${NOTCHPAY_BASE}/payments/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': NOTCHPAY_PUBLIC_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      email,
      phone,
      name,
      channel,
      reference: `deal-${dealId}-${Date.now()}`,
      description,
      // Notchpay will charge the MoMo number directly
      // without redirecting if channel is specified
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || `Payment initialization failed (${response.status})`);
  }

  return response.json();
}

// =============================================
// CHECK PAYMENT STATUS
// Poll this after initialization to confirm
// whether the buyer approved the MoMo prompt.
// =============================================
export async function checkPaymentStatus(reference: string) {
  const response = await fetch(`${NOTCHPAY_BASE}/payments/${reference}`, {
    headers: {
      'Authorization': NOTCHPAY_PUBLIC_KEY,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || `Failed to check payment status (${response.status})`);
  }

  return response.json();
}

// =============================================
// =============================================
// TRANSFER TO SELLER (payout)
// ⚠️  WARNING: Notch Pay transfers require your SECRET key, not the public key.
// This function WILL FAIL in production because secret keys must never be
// exposed in frontend code.
//
// The correct architecture is:
//   Frontend → calls your backend API (e.g. POST /payments/release)
//   Backend  → calls Notch Pay /transfers with the SECRET key
//
// This frontend function is kept here for reference only.
// The actual payout is handled by the backend paymentController.js → payoutToSeller().
// =============================================
export async function transferToSeller({
  amount,
  currency = 'XAF',
  phone,
  name,
  channel,
  dealId,
  description,
}: {
  amount: number;
  currency?: string;
  phone: string;
  name: string;
  channel: 'cm.mtn' | 'cm.orange';
  dealId: string;
  description: string;
}) {
  // ⚠️  This call will be rejected by Notch Pay unless you switch to the secret key.
  // Move this logic to your backend and call your own API instead.
  const response = await fetch(`${NOTCHPAY_BASE}/transfers`, {
    method: 'POST',
    headers: {
      'Authorization': NOTCHPAY_PUBLIC_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      destination: phone,
      name,
      channel,
      reference: `payout-${dealId}-${Date.now()}`,
      description,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || `Transfer failed (${response.status})`);
  }

  return response.json();
}

// =============================================
// FORMAT PHONE NUMBER
// Notchpay expects international format: 237XXXXXXXXX
// Strips leading 0, +237, or spaces
// =============================================
export function formatCamPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('237')) return digits;
  if (digits.startsWith('0')) return `237${digits.slice(1)}`;
  return `237${digits}`;
}
