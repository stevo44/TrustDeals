/**
 * components/OtpConfirmInput.tsx
 * --------------------------------
 * Buyer enters their 6-digit OTP to confirm delivery at AT_BUYER_LOCATION.
 * Tracks failed attempts, triggers CANCELLED_OTP_FAILED after 3 failures.
 */

import { useState, useRef, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { transitionDeal } from '../lib/dealStateMachine';
import { notifyAdminEvent } from '../lib/adminNotifications';
import { notify } from '../lib/notifications';
import { triggerPayoutSequence, triggerBuyerRefund } from '../lib/payouts';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

const MAX_OTP_ATTEMPTS = 3;

interface Props {
  dealId: string;
  userId: string;
  riderId?: string;
  onDispute: () => void;
  onComplete: () => void;
}

export default function OtpConfirmInput({ dealId, userId, riderId, onDispute, onComplete }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load current attempt count from Firestore
  useEffect(() => {
    getDoc(doc(db, 'deals', dealId)).then((snap) => {
      if (snap.exists()) setAttempts(snap.data().otpAttempts ?? 0);
    });
  }, [dealId]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const enteredOtp = digits.join('');
  const remaining = MAX_OTP_ATTEMPTS - attempts;

  const handleConfirm = async () => {
    if (enteredOtp.length !== 6 || loading) return;
    setLoading(true);
    setError('');

    try {
      const dealSnap = await getDoc(doc(db, 'deals', dealId));
      if (!dealSnap.exists()) throw new Error('Deal not found');
      const deal = dealSnap.data();

      const newAttempts = (deal.otpAttempts ?? 0) + 1;

      if (enteredOtp === deal.buyerOtp) {
        // ── OTP CORRECT ──
        // Fire payout sequence (backend handles Fapshi payouts)
        await updateDoc(doc(db, 'deals', dealId), {
          otpAttempts: newAttempts,
          buyerConfirmedDelivery: true,
        });

        const result = await triggerPayoutSequence(dealId);
        if (!result.success) {
          // Payout failed — backend should have already set PAYOUT_FAILED status
          toast.error('Delivery confirmed but payout encountered an issue. Admin has been notified.');
          return;
        }

        // Transition to COMPLETED
        await transitionDeal(dealId, 'COMPLETED', userId, {
          completedAt: new Date().toISOString(),
          buyerOtp: null, // clear OTP from document
        });

        // Notify both parties
        const sellerReceives = deal.sellerReceives ?? deal.productPrice ?? 0;
        await notify.dealCompleted(deal.buyerId, deal.sellerId, dealId, sellerReceives);

        toast.success('Delivery confirmed! Funds released to seller.');
        onComplete();
      } else {
        // ── WRONG OTP ──
        await updateDoc(doc(db, 'deals', dealId), { otpAttempts: newAttempts });
        setAttempts(newAttempts);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();

        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          // ── 3 FAILURES — CANCEL AND REFUND ──
          await transitionDeal(dealId, 'CANCELLED_OTP_FAILED', 'system');

          // Notify admin
          await notifyAdminEvent(
            'OTP_CANCELLED',
            dealId,
            `3 failed OTP attempts on deal ${dealId}. Rider notified to return goods.`,
          );

          // Notify rider
          if (riderId) {
            await notify.dealDisputed(riderId, dealId); // repurpose as "return goods" alert
          }

          // Notify buyer
          await notify.dealCancelled(deal.buyerId, dealId, deal.productPrice);

          // Fire refund (product price only — delivery fee non-refundable)
          await triggerBuyerRefund(dealId, 'otp_failed_3_attempts');

          toast.error('Transaction cancelled after 3 failed attempts. Refund is being processed.');
        } else {
          const left = MAX_OTP_ATTEMPTS - newAttempts;
          const msg = left === 1
            ? 'Incorrect code. 1 attempt remaining. Next failure will cancel this transaction.'
            : `Incorrect code. ${left} attempts remaining.`;
          setError(msg);
          toast.error(msg);
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isCancelled = attempts >= MAX_OTP_ATTEMPTS;

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="font-semibold text-red-700 dark:text-red-300">Transaction Cancelled</p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
          Maximum OTP attempts reached. Your refund is being processed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Confirm Delivery</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Enter your 6-digit delivery code to release payment to the seller.
        </p>
      </div>

      <div className="p-5 flex flex-col items-center gap-4">
        {/* Digit inputs */}
        <div className="flex gap-2" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              id={`otp-confirm-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-10 h-12 text-center text-xl font-bold rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        )}

        {/* Attempts warning */}
        <div className="text-center">
          {attempts > 0 && (
            <p className={`text-sm font-medium ${remaining === 1 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
              ⚠ {remaining === 1
                ? 'Last attempt. Next failure will cancel this transaction.'
                : `${remaining} attempts remaining.`
              }
            </p>
          )}
          {attempts === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ⚠ 3 failed attempts will cancel this transaction and the product will be returned to the seller.
            </p>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={enteredOtp.length !== 6 || loading}
          className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          {loading ? 'Confirming...' : 'Confirm Delivery'}
        </button>

        {/* Dispute button */}
        <button
          onClick={onDispute}
          className="w-full py-2 text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          I have a problem with this order
        </button>
      </div>
    </div>
  );
}
