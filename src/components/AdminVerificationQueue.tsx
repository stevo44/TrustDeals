/**
 * components/AdminVerificationQueue.tsx
 * Admin panel for reviewing pending verifications.
 */
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';
import {
  collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { Verification, UserProfile } from '../types';
import { approveVerification, rejectVerification } from '../lib/verification';
import { toast } from 'sonner';
import {
  ShieldCheck, Shield, Clock, Check, X, ChevronDown, ChevronUp, Users,
} from 'lucide-react';

interface AdminVerificationQueueProps {
  adminProfile: UserProfile;
}

interface VerificationWithUser extends Verification {
  displayName?: string;
  email?: string;
}

export default function AdminVerificationQueue({ adminProfile }: AdminVerificationQueueProps) {
  const [pending, setPending] = useState<VerificationWithUser[]>([]);
  const [verified, setVerified] = useState<VerificationWithUser[]>([]);
  const [tab, setTab] = useState<'pending' | 'verified'>('pending');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  // ── Enrich with user data ─────────────────────────────────────────────────
  const enrichWithUser = async (docs: Verification[]): Promise<VerificationWithUser[]> => {
    const results: VerificationWithUser[] = [];
    for (const d of docs) {
      try {
        const userSnap = await getDoc(doc(db, 'users', d.userId));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          results.push({
            ...d,
            displayName: userData?.displayName || 'Unknown User',
            email: userData?.email || '',
          });
        } else {
          results.push({ ...d, displayName: `User (${d.userId.slice(0, 5)})`, email: 'No email found' });
        }
      } catch (err) {
        console.error('Error fetching user for verification:', err);
        results.push(d);
      }
    }
    return results;
  };

  // ── Pending listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'verifications'),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map(d => d.data() as Verification);
      // Client-side sort to avoid index requirement
      raw.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
      setPending(await enrichWithUser(raw));
    });
    return () => unsub();
  }, []);

  // ── Verified listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'verified') return;
    const q = query(
      collection(db, 'verifications'),
      where('status', '==', 'verified'),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map(d => d.data() as Verification);
      // Client-side sort
      raw.sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());
      setVerified(await enrichWithUser(raw));
    });
    return () => unsub();
  }, [tab]);

  const handleApprove = async (userId: string) => {
    setProcessing(userId);
    try {
      const adminUid = adminProfile.uid || auth.currentUser?.uid || '';
      await approveVerification(userId, adminUid);
      toast.success('User verified successfully!');
    } catch {
      toast.error('Failed to approve verification.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!rejectReason.trim()) { toast.error('Please enter a rejection reason.'); return; }
    setProcessing(userId);
    try {
      const adminUid = adminProfile.uid || auth.currentUser?.uid || '';
      await rejectVerification(userId, adminUid, rejectReason.trim());
      toast.success('Verification rejected.');
      setRejectingId(null);
      setRejectReason('');
    } catch {
      toast.error('Failed to reject verification.');
    } finally {
      setProcessing(null);
    }
  };

  const roleBadgeColor = (role: string) => {
    if (role === 'seller') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (role === 'rider') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const list = tab === 'pending' ? pending : verified;

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Document" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
          <button className="absolute top-4 right-4 text-white hover:text-slate-300">
            <X className="w-8 h-8" />
          </button>
        </div>
      )}

      <div>
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setTab('pending')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'pending' ? 'bg-white dark:bg-slate-900 shadow text-primary' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Reviews
            {pending.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">{pending.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('verified')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'verified' ? 'bg-white dark:bg-slate-900 shadow text-primary' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            All Verified
          </button>
        </div>

        {/* Empty state */}
        {list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {tab === 'pending' ? 'All clear — no pending verifications.' : 'No verified users yet.'}
            </p>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-4">
          {list.map(item => (
            <div key={item.userId} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              {/* User info */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-slate-900 dark:text-white">{item.displayName}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${roleBadgeColor(item.role)}`}>
                      {item.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{item.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submitted: {new Date(item.submittedAt).toLocaleString()}
                  </p>
                </div>
                {item.status === 'verified' && (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-xs font-bold">Verified</span>
                  </div>
                )}
              </div>

              {/* Document thumbnails */}
              <div className="flex flex-wrap gap-3 mb-4">
                <DocThumb label="ID Front" url={item.idFrontUrl} onExpand={setLightboxUrl} />
                <DocThumb label="ID Back" url={item.idBackUrl} onExpand={setLightboxUrl} />
                <DocThumb label="Selfie" url={item.selfieUrl} onExpand={setLightboxUrl} />
                {item.businessRegUrl && <DocThumb label="Business Reg" url={item.businessRegUrl} onExpand={setLightboxUrl} />}
                {item.vehiclePhotoUrl && <DocThumb label="Vehicle" url={item.vehiclePhotoUrl} onExpand={setLightboxUrl} />}
                {item.licenseUrl && <DocThumb label="License" url={item.licenseUrl} onExpand={setLightboxUrl} />}
              </div>

              {/* Actions — only for pending */}
              {tab === 'pending' && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(item.userId)}
                      disabled={!!processing}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {processing === item.userId ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === item.userId ? null : item.userId)}
                      disabled={!!processing}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Reject
                      {rejectingId === item.userId ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {rejectingId === item.userId && (
                    <div className="flex gap-2">
                      <input
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Enter rejection reason..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-red-200 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        onClick={() => handleReject(item.userId)}
                        disabled={!!processing || !rejectReason.trim()}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Show rejection reason for reference */}
              {item.rejectionReason && tab === 'verified' && (
                <p className="text-xs text-red-500 mt-2">Rejection reason: {item.rejectionReason}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Document thumbnail ─────────────────────────────────────────────────────────
function DocThumb({ label, url, onExpand }: { label: string; url: string; onExpand: (u: string) => void }) {
  if (!url) return null;
  return (
    <button
      onClick={() => onExpand(url)}
      className="flex flex-col items-center gap-1 group"
      title={`Click to expand — ${label}`}
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 group-hover:border-primary transition-colors">
        {url.startsWith('data:image') ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Shield className="w-6 h-6 text-slate-400" />
          </div>
        )}
      </div>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
    </button>
  );
}
