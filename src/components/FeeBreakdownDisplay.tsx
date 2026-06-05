/**
 * components/FeeBreakdownDisplay.tsx
 * ------------------------------------
 * Shows the complete fee breakdown before the buyer funds escrow.
 * Used on the funding screen / PaymentModal.
 */

import { FeeBreakdown } from '../types';
import { formatXAF } from '../lib/fees';

interface Props {
  breakdown: FeeBreakdown;
  className?: string;
}

export default function FeeBreakdownDisplay({ breakdown, className = '' }: Props) {
  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>💰</span>
          Payment Breakdown
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Review all charges before paying</p>
      </div>

      {/* Line items */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {/* Product price */}
        <div className="flex justify-between items-start px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Product price</p>
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
            {formatXAF(breakdown.productPrice)}
          </p>
        </div>

        {/* Platform fee */}
        <div className="flex justify-between items-start px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Service fee <span className="text-xs font-normal text-slate-400">(5%)</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Escrow protection and secure payment processing
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
            {formatXAF(breakdown.platformFee)}
          </p>
        </div>

        {/* Delivery fee */}
        <div className="flex justify-between items-start px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Delivery <span className="text-xs font-normal text-slate-400">({breakdown.routeLabel})</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paid to rider upon successful delivery
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
            {formatXAF(breakdown.deliveryFee)}
          </p>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center px-4 py-4 bg-indigo-50 dark:bg-indigo-950/40">
          <p className="font-bold text-slate-800 dark:text-slate-100">Total to pay</p>
          <p className="font-bold text-lg text-indigo-700 dark:text-indigo-300 tabular-nums">
            {formatXAF(breakdown.totalCharged)}
          </p>
        </div>
      </div>

      {/* Policy warnings */}
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/50 space-y-1.5">
        <p className="text-xs text-amber-800 dark:text-amber-300 flex gap-1.5 items-start">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>Platform fee is <strong>non-refundable</strong> under any circumstance.</span>
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300 flex gap-1.5 items-start">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>Delivery fee is <strong>non-refundable</strong> once a rider has been assigned.</span>
        </p>
      </div>
    </div>
  );
}
