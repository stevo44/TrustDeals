/**
 * lib/verification.ts
 * Firestore operations for the user verification system.
 */
import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs, limit,
} from 'firebase/firestore';
import { Verification } from '../types';
import { notify } from './notifications';

// ── Get a verification document ────────────────────────────────────────────────
export async function getVerification(userId: string): Promise<Verification | null> {
  const snap = await getDoc(doc(db, 'verifications', userId));
  if (!snap.exists()) return null;
  return snap.data() as Verification;
}

// ── Submit a verification document ─────────────────────────────────────────────
export async function submitVerification(data: Verification): Promise<void> {
  // Write verification doc
  await setDoc(doc(db, 'verifications', data.userId), data, { merge: true });

  // Mark user as pending
  await updateDoc(doc(db, 'users', data.userId), { verificationStatus: 'pending' });

  // Find first admin and notify them
  try {
    const adminQuery = query(
      collection(db, 'users'),
      where('role', '==', 'admin'),
      limit(1),
    );
    const adminSnap = await getDocs(adminQuery);
    if (!adminSnap.empty) {
      const adminUid = adminSnap.docs[0].id;
      await notify.verificationSubmitted(adminUid, data.userId, data.role);
    }
  } catch (err) {
    console.error('[Verification] Failed to notify admin:', err);
  }
}

// ── Approve a verification ──────────────────────────────────────────────────────
export async function approveVerification(userId: string, adminUid: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'verifications', userId), {
    status: 'verified',
    reviewedAt: now,
    reviewedBy: adminUid,
  });
  await updateDoc(doc(db, 'users', userId), { verificationStatus: 'verified' });
  await notify.verificationApproved(userId);
}

// ── Reject a verification ───────────────────────────────────────────────────────
export async function rejectVerification(
  userId: string,
  adminUid: string,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'verifications', userId), {
    status: 'rejected',
    rejectionReason: reason,
    reviewedAt: now,
    reviewedBy: adminUid,
  });
  await updateDoc(doc(db, 'users', userId), { verificationStatus: 'rejected' });
  await notify.verificationRejected(userId, reason);
}
