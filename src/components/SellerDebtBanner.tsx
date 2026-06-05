/**
 * components/SellerDebtBanner.tsx
 * ---------------------------------
 * Persistent banner shown to sellers with outstanding account debt.
 * Displays debt amount, source deal, and a "View Details" action.
 */

import { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { UserProfile } from '../types';
import { formatXAF } from '../lib/fees';

interface Props {
  profile: UserProfile;
  onViewDeal?: (dealId: string) => void;
}

export default function SellerDebtBanner({ profile, onViewDeal }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const debt = profile.accountDebt ?? 0;
  const dealId = profile.debtDealId;

  if (debt <= 0 || dismissed) return null;

  return (
    <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 overflow-hidden">
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Outstanding account balance: {formatXAF(debt)}
          </p>
          {dealId && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              From Deal #{dealId.slice(-8)}. This will be automatically deducted from your next deal payout.
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {dealId && onViewDeal && (
            <button
              onClick={() => onViewDeal(dealId)}
              className="text-xs font-semibold text-amber-700 dark:text-amber-300 underline whitespace-nowrap"
            >
              View Deal
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
          </button>
        </div>
      </div>

      {/* Expanded: debt history */}
      {expanded && profile.debtHistory && profile.debtHistory.length > 0 && (
        <div className="border-t border-amber-200 dark:border-amber-800 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Debt History</p>
          {profile.debtHistory.map((record, i) => (
            <div key={i} className="flex items-start justify-between text-xs text-amber-800 dark:text-amber-200">
              <div>
                <p>{record.reason}</p>
                <p className="text-amber-600 dark:text-amber-400">
                  Deal #{record.dealId.slice(-8)} · {new Date(record.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{formatXAF(record.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Policy note */}
      <div className="border-t border-amber-200 dark:border-amber-800 px-4 py-2 bg-amber-100/50 dark:bg-amber-900/20">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          You can continue joining deals and completing orders. Payouts will be applied toward your balance first.
          Manual withdrawals are suspended until the balance is cleared.
        </p>
      </div>
    </div>
  );
}
