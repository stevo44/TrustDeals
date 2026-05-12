/**
 * Wallet Module
 * Manages wallet operations in Firestore.
 * Path: wallets/{userId}
 * Transactions: wallets/{userId}/transactions/{txId}
 */
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, increment } from 'firebase/firestore';
import { Wallet, WalletTransaction } from '../types';

const PLATFORM_FEE_PERCENT = 0.05; // 5%

export function calcPlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_PERCENT);
}

export function calcSellerReceives(amount: number): number {
  return amount - calcPlatformFee(amount);
}

// Get or create a wallet for a user
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const walletRef = doc(db, 'wallets', userId);
  const snap = await getDoc(walletRef);
  if (snap.exists()) {
    return snap.data() as Wallet;
  }
  const newWallet: Wallet = {
    userId,
    balance: 0,
    pendingBalance: 0,
    totalReceived: 0,
    totalSent: 0,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(walletRef, newWallet);
  return newWallet;
}

// Credit a user's wallet (e.g. seller receiving funds after deal finalized)
export async function creditWallet(
  userId: string,
  amount: number,
  description: string,
  dealId?: string
): Promise<void> {
  const walletRef = doc(db, 'wallets', userId);
  await getOrCreateWallet(userId);
  await updateDoc(walletRef, {
    balance: increment(amount),
    totalReceived: increment(amount),
    updatedAt: new Date().toISOString(),
  });
  const tx: Omit<WalletTransaction, 'id'> = {
    userId, type: 'release', amount, description, dealId,
    createdAt: new Date().toISOString(),
  };
  await addDoc(collection(db, 'wallets', userId, 'transactions'), tx);
}

// Lock funds in pending (buyer escrow)
export async function lockEscrow(
  userId: string,
  amount: number,
  dealId: string
): Promise<void> {
  const walletRef = doc(db, 'wallets', userId);
  await getOrCreateWallet(userId);
  await updateDoc(walletRef, {
    pendingBalance: increment(amount),
    totalSent: increment(amount),
    updatedAt: new Date().toISOString(),
  });
  const tx: Omit<WalletTransaction, 'id'> = {
    userId, type: 'fund', amount,
    description: `Escrow locked for deal ${dealId}`,
    dealId, createdAt: new Date().toISOString(),
  };
  await addDoc(collection(db, 'wallets', userId, 'transactions'), tx);
}

// Release escrow: deduct from pending, credit seller minus fee
export async function releaseEscrow(
  buyerId: string,
  sellerId: string,
  amount: number,
  dealId: string
): Promise<void> {
  const fee = calcPlatformFee(amount);
  const sellerAmount = calcSellerReceives(amount);

  // Reduce buyer pending
  const buyerRef = doc(db, 'wallets', buyerId);
  await getOrCreateWallet(buyerId);
  await updateDoc(buyerRef, {
    pendingBalance: increment(-amount),
    updatedAt: new Date().toISOString(),
  });

  // Credit seller
  await creditWallet(sellerId, sellerAmount, `Payment received for deal (after 5% platform fee)`, dealId);

  // Log fee transaction
  const feeTx: Omit<WalletTransaction, 'id'> = {
    userId: sellerId, type: 'fee', amount: fee,
    description: `5% platform fee for deal ${dealId}`,
    dealId, createdAt: new Date().toISOString(),
  };
  await addDoc(collection(db, 'wallets', sellerId, 'transactions'), feeTx);
}
