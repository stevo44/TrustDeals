/**
 * Wallet Module
 * Manages wallet operations in Firestore.
 * Path: wallets/{userId}
 * Transactions: wallets/{userId}/transactions/{txId}
 */
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, increment } from 'firebase/firestore';
import { Wallet, WalletTransaction } from '../types';

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

/**
 * Release escrow: clear buyer pending balance, credit seller the full product price.
 * The platform fee was already collected from the buyer's totalCharged upfront.
 * Nothing is deducted from the seller here.
 */
export async function releaseEscrow(
  buyerId:      string,
  sellerId:     string,
  productPrice: number,  // the agreed deal price — seller receives this in full
  dealId:       string,
): Promise<void> {
  // 1. Clear buyer pending balance
  const buyerRef = doc(db, 'wallets', buyerId);
  await getOrCreateWallet(buyerId);
  await updateDoc(buyerRef, {
    pendingBalance: increment(-productPrice),
    updatedAt: new Date().toISOString(),
  });

  // 2. Credit seller the full agreed amount — no fee deduction
  await creditWallet(
    sellerId,
    productPrice,
    `Payment received for deal ${dealId}`,
    dealId,
  );
}
