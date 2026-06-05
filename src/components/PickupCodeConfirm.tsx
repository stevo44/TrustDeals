/**
 * components/PickupCodeConfirm.tsx
 * ----------------------------------
 * Rider enters the 6-digit pickup code given verbally by the seller.
 * Confirms goods collection and transitions deal to IN_TRANSIT.
 *
 * Rendered in RiderPortal when deal is in PICKUP_PENDING state.
 */

import { useState, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { transitionDeal } from '../lib/dealStateMachine';
import { notifyAdminEvent } from '../lib/adminNotifications';
import { notify } from '../lib/notifications';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

const MAX_PICKUP_ATTEMPTS = 3;

interface Props {
  dealId: string;
  riderId: string;
  deal: { buyerId: string; sellerId: string; buyerName: string; sellerName: string };
  onConfirmed: () => void;
}

export default function PickupCodeConfirm({ dealId, riderId, deal, onConfirmed }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
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

  const code = digits.join('');

  const handleSubmit = async () => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError('');

    try {
      const snap = await getDoc(doc(db, 'deals', dealId));
      if (!snap.exists()) throw new Error('Deal not found');
      const data = snap.data();

      const newAttempts = (data.pickupCodeAttempts ?? 0) + 1;

      if (code === data.pickupCode) {
        // ── CORRECT ──
        await transitionDeal(dealId, 'IN_TRANSIT', riderId, {
          goodsCollectedAt: new Date().toISOString(),
          pickupCodeAttempts: newAttempts,
        });

        // Notify buyer and seller
        await notify.goodsCollected(deal.buyerId, deal.sellerId, dealId);

        toast.success('Collection confirmed! Deal is now in transit.');
        onConfirmed();
      } else {
        // ── WRONG ──
        await updateDoc(doc(db, 'deals', dealId), { pickupCodeAttempts: newAttempts });
        setAttempts(newAttempts);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();

        if (newAttempts >= MAX_PICKUP_ATTEMPTS) {
          // Notify admin after 3 failures
          await notifyAdminEvent(
            'PICKUP_CODE_FAILED',
            dealId,
            `3 failed pickup code attempts on Deal ${dealId}. Rider ${riderId} may have the wrong code. Manual review required.`,
          );
          setError('Maximum attempts reached. Admin has been notified. Please contact support.');
        } else {
          const left = MAX_PICKUP_ATTEMPTS - newAttempts;
          setError(`Wrong code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`);
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const maxReached = attempts >= MAX_PICKUP_ATTEMPTS;

  return (
    <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800 overflow-hidden bg-white dark:bg-slate-900">
      <div className="px-4 py-3 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-200 dark:border-purple-800 flex items-center gap-2">
        <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <h3 className="font-bold text-purple-800 dark:text-purple-200 text-sm">Confirm Goods Collection</h3>
      </div>

      <div className="p-5 flex flex-col items-center gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          Ask the seller for their <strong>6-digit pickup code</strong> and enter it below to confirm collection.
        </p>

        <div className="flex gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={maxReached}
              className="w-10 h-12 text-center text-xl font-bold rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-purple-500 focus:outline-none disabled:opacity-40"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        )}

        {!maxReached && (
          <button
            onClick={handleSubmit}
            disabled={code.length !== 6 || loading}
            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            {loading ? 'Verifying…' : 'Confirm Collection'}
          </button>
        )}
      </div>
    </div>
  );
}
