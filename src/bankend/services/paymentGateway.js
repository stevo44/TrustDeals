/**
 * services/paymentGateway.js
 * ---------------------------
 * Auto-selects mock or real Fapshi service based on environment.
 *
 * Usage (import this everywhere, never import paymentService or
 * mockPaymentService directly):
 *
 *   import { paySeller, refundBuyer, payRider } from './paymentGateway.js';
 *
 * Switching to production:
 *   1. Set FAPSHI_MOCK=false (or remove it) in .env
 *   2. Set FAPSHI_BASE_URL=https://live.fapshi.com
 *   3. Set FAPSHI_PAYOUT_API_USER and FAPSHI_PAYOUT_API_KEY to live credentials
 *   → Done. Zero code changes required.
 */

const USE_MOCK = process.env.FAPSHI_MOCK === 'true' || process.env.NODE_ENV === 'development' && !process.env.FAPSHI_PAYOUT_API_KEY;

let gateway;

if (USE_MOCK) {
  console.info('[PaymentGateway] 🧪 Using MOCK payment service (FAPSHI_MOCK=true or no live credentials).');
  gateway = await import('./mockPaymentService.js');
} else {
  console.info('[PaymentGateway] 🔴 Using LIVE Fapshi payment service.');
  gateway = await import('./paymentService.js');
}

export const {
  payRider,
  paySeller,
  refundBuyer,
  payReturnRider,
  getPayoutBalance,
  RIDER_PAYOUT_TABLE,
} = gateway;

export const isMockMode = USE_MOCK;
