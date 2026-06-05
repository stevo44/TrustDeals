/**
 * MockPaymentBanner
 * Shows a dismissable dev-mode banner when VITE_FAPSHI_MOCK=true.
 * Renders nothing in production.
 */
import { useState } from 'react';
import { FlaskConical, X } from 'lucide-react';
import { getFapshiEnvInfo } from '../lib/fapshi';

export default function MockPaymentBanner() {
  const { isMock, env } = getFapshiEnvInfo();
  const [dismissed, setDismissed] = useState(false);

  if (!isMock || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 px-5 py-3 bg-amber-400 text-amber-900 rounded-2xl shadow-xl border border-amber-500 text-sm font-bold max-w-[90vw]">
      <FlaskConical className="w-4 h-4 shrink-0" />
      <span>
        🧪 <span className="uppercase tracking-wide">Mock Payment Mode</span> — Payments are simulated.
        Use phone <code className="bg-amber-300 px-1 rounded font-mono">000</code> to test failure.
        <span className="ml-2 text-amber-700 font-normal">Set <code className="font-mono">VITE_FAPSHI_MOCK=false</code> for real payments.</span>
      </span>
      <button onClick={() => setDismissed(true)} className="ml-2 p-1 hover:bg-amber-500 rounded-lg transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
