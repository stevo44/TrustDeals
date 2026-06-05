/**
 * components/OtpDisplay.tsx
 * --------------------------
 * Displays the buyer's 6-digit delivery OTP prominently.
 * Only rendered for the buyer, never exposed to seller or rider.
 *
 * Per spec:
 * - Large, spaced digits
 * - Copy button
 * - Clear warning about sharing only after inspection
 */

import { useState } from 'react';
import { Copy, CheckCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  otp: string;
  dealStatus: string;
}

export default function OtpDisplay({ otp, dealStatus }: Props) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(otp);
    setCopied(true);
    toast.success('Delivery code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const isActiveOtp = ['PAYMENT_LOCKED', 'RIDER_ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'AT_BUYER_LOCATION'].includes(dealStatus);

  if (!isActiveOtp) return null;

  return (
    <div className="rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-100 dark:bg-indigo-900/60 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-bold text-indigo-800 dark:text-indigo-200 text-sm tracking-wide uppercase">
          Your Delivery Code
        </h3>
      </div>

      <div className="p-5 flex flex-col items-center gap-4">
        {/* Warning: share with no one */}
        <p className="text-xs text-indigo-700 dark:text-indigo-300 text-center max-w-xs">
          Share this code with <strong>NO ONE</strong> except when you are satisfied with your goods and ready to confirm delivery.
        </p>

        {/* OTP digits */}
        <div className="flex gap-2 my-1">
          {otp.split('').map((digit, i) => (
            <div
              key={i}
              className="w-10 h-12 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 text-2xl font-bold text-indigo-700 dark:text-indigo-300 shadow-sm select-none"
            >
              {digit}
            </div>
          ))}
        </div>

        {/* Copy button */}
        <button
          onClick={copyCode}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          {copied ? (
            <>
              <CheckCheck className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Code
            </>
          )}
        </button>

        {/* Post-inspection warning */}
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-center">
          <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
            Only share this <strong>AFTER inspecting</strong> your goods in front of the rider. Sharing it before inspection means you <strong>lose the right to dispute</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
