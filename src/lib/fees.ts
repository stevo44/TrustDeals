/**
 * lib/fees.ts
 * -----------
 * Fee calculation utilities for TrustEscrow.
 *
 * Platform fee:  5.5% of product price (NEVER refunded)
 * Delivery fee:  determined by route, stored in Firestore config
 *                (refunded ONLY if no rider assigned yet)
 *
 * Delivery fee rates are fetched from Firestore at:
 *   config/deliveryFees → { routes: { "SellerCity→BuyerCity": XAF } }
 *
 * This allows rate updates without redeploying code.
 */

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FeeBreakdown } from '../types';

export const PLATFORM_FEE_RATE = 0.05; // 5%

// ── Default delivery fee table (seed for Firestore) ──────────────────────────
// Key format: "SellerCity→BuyerCity"
const DEFAULT_DELIVERY_FEES: Record<string, number> = {
  'Buea→Buea':    1500,
  'Buea→Douala':  2500,
  'Douala→Douala': 1500,
  'Douala→Buea':  2500,
  'Yaoundé→Yaoundé': 1500,
  'Yaoundé→Douala':  3000,
  'Douala→Yaoundé':  3000,
  'Yaoundé→Buea':    3500,
  'Buea→Yaoundé':    3500,
};

// Rider payout per route (paid from platform float, not from escrow)
// Rule: 1,000 FCFA for jobs within Buea | 1,500 FCFA for all other routes
const RIDER_PAYOUT_PER_ROUTE: Record<string, number> = {
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

// ── Available cities ──────────────────────────────────────────────────────────
export const AVAILABLE_CITIES = [
  'Buea',
  'Douala',
  'Yaoundé',
  'Bamenda',
  'Bafoussam',
];

// ── Cache delivery fee config ─────────────────────────────────────────────────
let cachedRoutes: Record<string, number> | null = null;
let cacheExpiry = 0;

export async function getDeliveryFeeConfig(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRoutes && now < cacheExpiry) return cachedRoutes;

  try {
    const ref = doc(db, 'config', 'deliveryFees');
    const snap = await getDoc(ref);

    if (snap.exists()) {
      cachedRoutes = snap.data().routes as Record<string, number>;
    } else {
      // First run: seed defaults into Firestore
      await setDoc(ref, { routes: DEFAULT_DELIVERY_FEES, riderPayouts: RIDER_PAYOUT_PER_ROUTE });
      cachedRoutes = DEFAULT_DELIVERY_FEES;
    }

    cacheExpiry = now + 5 * 60 * 1000; // cache for 5 minutes
    return cachedRoutes;
  } catch {
    // Fallback to defaults if Firestore unreachable
    return DEFAULT_DELIVERY_FEES;
  }
}

export async function getRiderPayoutConfig(): Promise<Record<string, number>> {
  try {
    const ref = doc(db, 'config', 'deliveryFees');
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().riderPayouts) {
      return snap.data().riderPayouts as Record<string, number>;
    }
    return RIDER_PAYOUT_PER_ROUTE;
  } catch {
    return RIDER_PAYOUT_PER_ROUTE;
  }
}

// ── Route key helper ──────────────────────────────────────────────────────────
export function routeKey(sellerCity: string, buyerCity: string): string {
  return `${sellerCity}→${buyerCity}`;
}

// ── Main fee calculation ──────────────────────────────────────────────────────
export async function calculateFees(
  productPrice: number,
  sellerCity: string,
  buyerCity: string,
): Promise<FeeBreakdown> {
  const routes = await getDeliveryFeeConfig();
  const key = routeKey(sellerCity, buyerCity);

  const deliveryFee = routes[key] ?? 2500; // default if route not found
  const platformFee = Math.round(productPrice * PLATFORM_FEE_RATE);
  const totalCharged = productPrice + platformFee + deliveryFee;
  const sellerReceives = productPrice; // platform fee + delivery fee stay with platform

  return {
    productPrice,
    platformFee,
    deliveryFee,
    totalCharged,
    sellerReceives,
    sellerCity,
    buyerCity,
    routeLabel: `${sellerCity} → ${buyerCity}`,
  };
}

// ── Synchronous calculation (when config is already known) ────────────────────
export function calculateFeesSync(
  productPrice: number,
  sellerCity: string,
  buyerCity: string,
  routes: Record<string, number>,
): FeeBreakdown {
  const key = routeKey(sellerCity, buyerCity);
  const deliveryFee = routes[key] ?? 2500;
  const platformFee = Math.round(productPrice * PLATFORM_FEE_RATE);
  const totalCharged = productPrice + platformFee + deliveryFee;

  return {
    productPrice,
    platformFee,
    deliveryFee,
    totalCharged,
    sellerReceives: productPrice,
    sellerCity,
    buyerCity,
    routeLabel: `${sellerCity} → ${buyerCity}`,
  };
}

// ── Refund calculation ────────────────────────────────────────────────────────
// Returns the amount to refund to buyer based on current deal state.
// Platform fee: NEVER refunded
// Delivery fee: only refunded if rider NOT yet assigned
export function calculateRefundAmount(
  deal: { productPrice?: number; platformFee?: number; deliveryFee?: number; totalCharged?: number },
  riderAssigned: boolean,
): { refundAmount: number; breakdown: string } {
  const productPrice = deal.productPrice ?? 0;
  const deliveryFee  = deal.deliveryFee  ?? 0;

  if (riderAssigned) {
    return {
      refundAmount: productPrice,
      breakdown: `Product price only (${productPrice.toLocaleString()} XAF). Platform fee and delivery fee are non-refundable.`,
    };
  }

  return {
    refundAmount: productPrice + deliveryFee,
    breakdown: `Product price (${productPrice.toLocaleString()} XAF) + delivery fee (${deliveryFee.toLocaleString()} XAF). Platform fee is non-refundable.`,
  };
}

// ── Format XAF currency ───────────────────────────────────────────────────────
export function formatXAF(amount: number): string {
  return `${amount.toLocaleString('fr-CM')} XAF`;
}
