/**
 * components/VerificationBanner.tsx
 * Slim, role-aware banner displayed on dashboards for unverified users.
 */
import { UserProfile } from '../types';
import { ShieldAlert, Clock, XCircle } from 'lucide-react';

interface VerificationBannerProps {
  profile: UserProfile;
  onStartVerification: () => void;
}

export default function VerificationBanner({ profile, onStartVerification }: VerificationBannerProps) {
  const status = profile.verificationStatus ?? 'unverified';

  if (status === 'verified') return null;

  const roleMessage: Record<string, string> = {
    seller: 'Verify your account to receive deals and access escrow payouts.',
    rider: 'Verify your account to receive delivery assignments.',
    buyer: 'Verify your phone number to fund escrow.',
    admin: '',
  };

  if (status === 'unverified') {
    return (
      <div className="w-full py-3 px-5 flex items-center gap-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="flex-1 text-sm font-bold text-amber-800 dark:text-amber-300">
          {roleMessage[profile.role] || 'Verify your account to access all features.'}
        </p>
        <button
          onClick={onStartVerification}
          className="shrink-0 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
        >
          Start Verification →
        </button>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="w-full py-3 px-5 flex items-center gap-3 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800">
        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="flex-1 text-sm font-bold text-blue-800 dark:text-blue-300">
          Your documents are under review. We'll notify you once approved (usually within 24 hours).
        </p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="w-full py-3 px-5 flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800">
        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
        <p className="flex-1 text-sm font-bold text-red-800 dark:text-red-300">
          Verification rejected. Tap to view the reason and resubmit your documents.
        </p>
        <button
          onClick={onStartVerification}
          className="shrink-0 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
        >
          Resubmit →
        </button>
      </div>
    );
  }

  return null;
}
