/**
 * WalletPanel
 * Shows wallet balance, pending escrow, and recent transactions.
 * Used in both buyer and seller dashboards.
 */
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Wallet, WalletTransaction, UserProfile } from '../types';
import { Wallet as WalletIcon, TrendingUp, Clock, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';

interface WalletPanelProps {
  profile: UserProfile | null;
  onClose: () => void;
}

const TX_ICONS: Record<string, React.ReactNode> = {
  fund:    <ArrowUpRight className="w-4 h-4 text-red-400" />,
  release:    <ArrowDownLeft className="w-4 h-4 text-emerald-500" />,
  fee:        <ArrowUpRight className="w-4 h-4 text-amber-500" />,
  payout_fee: <ArrowUpRight className="w-4 h-4 text-slate-400" />,
  refund:     <ArrowDownLeft className="w-4 h-4 text-blue-400" />,
  withdraw:   <ArrowUpRight className="w-4 h-4 text-red-500" />,
};

export default function WalletPanel({ profile, onClose }: WalletPanelProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(doc(db, 'wallets', profile.uid), (snap) => {
      if (snap.exists()) setWallet(snap.data() as Wallet);
      else setWallet({ userId: profile.uid, balance: 0, pendingBalance: 0, totalReceived: 0, totalSent: 0, updatedAt: '' });
    });
    return () => unsub();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'wallets', profile.uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction)));
    });
    return () => unsub();
  }, [profile]);

  const isSeller = profile?.role === 'seller';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-end p-4 pt-20 bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <WalletIcon className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-slate-900 dark:text-white">My Wallet</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Balance card */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-white shadow-lg shadow-primary/20">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 mb-1">Available Balance</p>
            <p className="text-3xl font-black mb-4">
              {(wallet?.balance ?? 0).toLocaleString()}{' '}
              <span className="text-base font-bold opacity-70">FCFA</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[10px] opacity-70 font-bold uppercase tracking-wider mb-1">
                  {isSeller ? 'In Escrow' : 'Locked'}
                </p>
                <p className="text-lg font-black">
                  {(wallet?.pendingBalance ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] opacity-60">FCFA</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[10px] opacity-70 font-bold uppercase tracking-wider mb-1">
                  Total {isSeller ? 'Received' : 'Sent'}
                </p>
                <p className="text-lg font-black">
                  {isSeller
                    ? (wallet?.totalReceived ?? 0).toLocaleString()
                    : (wallet?.totalSent ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] opacity-60">FCFA</p>
              </div>
            </div>
          </div>

          {/* Pending Escrow Info */}
          {isSeller && wallet && wallet.pendingBalance > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
                 <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Release</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">These funds are locked in escrow and will be released to your balance as soon as the buyer confirms delivery.</p>
              </div>
            </div>
          )}

          {/* Withdrawal Button */}
          {isSeller && (
            <button 
              disabled={!wallet || wallet.balance <= 0}
              onClick={() => alert("Withdrawal feature coming soon! Funds are safely stored in your wallet.")}
              className="w-full py-4 bg-emerald-600 dark:bg-emerald-500 text-white rounded-xl font-bold font-display shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-2"
            >
              <ArrowDownLeft className="w-5 h-5 translate-y-0.5" />
              Request Withdrawal
            </button>
          )}

          {/* Info banner */}
          {!isSeller && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-800 dark:text-blue-200">Escrow Protection</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  Your funds are held securely until you confirm receipt. Release with your OTP.
                </p>
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
              Recent Transactions
            </h4>
            {transactions.length === 0 ? (
              <div className="py-8 text-center">
                <WalletIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
                  >
                    <div className="size-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center shrink-0">
                      {TX_ICONS[tx.type] ?? <WalletIcon className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {tx.description}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString([], { month: 'short', day: '2-digit', year: '2-digit' })}
                      </p>
                    </div>
                    <p className={`text-sm font-black shrink-0 ${
                      tx.type === 'release' ? 'text-emerald-600' :
                      tx.type === 'refund'  ? 'text-blue-600' :
                      'text-red-500'
                    }`}>
                      {tx.type === 'release' || tx.type === 'refund' ? '+' : '-'}
                      {tx.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Compact wallet badge for headers ─────────────────────────────────────────
export function WalletBadge({ profile, onOpen }: { profile: UserProfile | null; onOpen: () => void }) {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(doc(db, 'wallets', profile.uid), (snap) => {
      if (snap.exists()) setBalance(snap.data().balance ?? 0);
    });
    return () => unsub();
  }, [profile]);

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 px-3 py-2 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl transition-colors"
    >
      <WalletIcon className="w-4 h-4 text-primary" />
      <span className="text-xs font-black text-primary">{balance.toLocaleString()} FCFA</span>
    </button>
  );
}
