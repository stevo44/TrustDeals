/**
 * components/AdminDisputeDashboard.tsx
 * -------------------------------------
 * Admin panel for reviewing and ruling on disputes.
 * Real-time Firestore subscription on deals with disputed statuses.
 */

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { transitionDeal } from '../lib/dealStateMachine';
import { notifyAdminEvent } from '../lib/adminNotifications';
import { notify } from '../lib/notifications';
import { Deal, DealStatus } from '../types';
import { formatXAF } from '../lib/fees';
import { AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const DISPUTED_STATUSES: DealStatus[] = ['DISPUTED', 'SELLER_DISPUTED', 'RIDER_DISPUTED'];

const DISPUTE_LABEL: Record<string, { label: string; color: string }> = {
  DISPUTED:        { label: 'BUYER',  color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  SELLER_DISPUTED: { label: 'SELLER', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  RIDER_DISPUTED:  { label: 'RIDER',  color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
};

const BUYER_DISPUTE_REASON_LABELS: Record<string, string> = {
  wrong_item:              'Wrong item received',
  item_damaged:            'Item damaged',
  not_matching_description:'Item does not match description',
  quantity_incorrect:      'Quantity incorrect',
  other:                   'Other',
};

const SELLER_DISPUTE_REASON_LABELS: Record<string, string> = {
  buyer_unreachable:         'Buyer is unreachable',
  wrong_delivery_address:    'Buyer gave wrong delivery address',
  buyer_refusing_inspection: 'Buyer is refusing inspection',
  false_dispute:             'Buyer raised false dispute',
  other:                     'Other',
};

const RIDER_DISPUTE_REASON_LABELS: Record<string, string> = {
  buyer_not_present:    'Buyer not present at address',
  buyer_unreachable:    'Buyer unreachable after phone calls',
  buyer_refusing_goods: 'Buyer refusing to accept goods',
  other:                'Other',
};

function getReasonLabel(deal: Deal): string {
  const reason = deal.disputeReason ?? '';
  const all = { ...BUYER_DISPUTE_REASON_LABELS, ...SELLER_DISPUTE_REASON_LABELS, ...RIDER_DISPUTE_REASON_LABELS };
  return all[reason] ?? reason;
}

interface DisputeCardProps {
  deal: Deal;
}

function DisputeCard({ deal }: DisputeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [ruling, setRuling] = useState(false);
  const disputeInfo = DISPUTE_LABEL[deal.status] ?? { label: 'UNKNOWN', color: 'bg-slate-100 text-slate-800' };

  const handleRuleForBuyer = async () => {
    if (ruling) return;
    if (!confirm(`Rule in favour of BUYER on deal ${deal.id}? This will initiate a return and log a debt on the seller's account.`)) return;
    setRuling(true);
    try {
      await transitionDeal(deal.id, 'RETURN_APPROVED', 'admin', {
        disputeResolution: 'buyer',
        disputeResolvedAt: new Date().toISOString(),
      });

      // Log seller debt: 2,000 XAF penalty + 1,000 XAF return delivery = 3,000 XAF
      const sellerDebt = 3000;
      await updateDoc(doc(db, 'users', deal.sellerId), {
        accountDebt: (await getDoc(doc(db, 'users', deal.sellerId))).data()?.accountDebt
          ? (await getDoc(doc(db, 'users', deal.sellerId))).data()?.accountDebt + sellerDebt
          : sellerDebt,
        debtDealId: deal.id,
        debtAcknowledged: false,
        accountStatus: 'debt_hold',
        debtHistory: (await getDoc(doc(db, 'users', deal.sellerId))).data()?.debtHistory
          ? [...(await getDoc(doc(db, 'users', deal.sellerId))).data()?.debtHistory, {
              amount: sellerDebt,
              dealId: deal.id,
              reason: 'Dispute ruled against seller: 2,000 XAF penalty + 1,000 XAF return delivery',
              createdAt: new Date().toISOString(),
            }]
          : [{
              amount: sellerDebt,
              dealId: deal.id,
              reason: 'Dispute ruled against seller: 2,000 XAF penalty + 1,000 XAF return delivery',
              createdAt: new Date().toISOString(),
            }],
      });

      // Notify all parties
      if (deal.riderId) {
        await notify.returnApproved(deal.buyerId, deal.sellerId, deal.riderId, deal.id);
      }
      await notify.debtNotice(deal.sellerId, sellerDebt, deal.id);

      toast.success('Ruled in favour of buyer. Return approved. Seller debt logged.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to rule. Please try again.');
    } finally {
      setRuling(false);
    }
  };

  const handleRuleForSeller = async () => {
    if (ruling) return;
    if (!confirm(`Rule in favour of SELLER on deal ${deal.id}? Funds will be auto-released to seller.`)) return;
    setRuling(true);
    try {
      await transitionDeal(deal.id, 'AUTO_RELEASED', 'admin', {
        disputeResolution: 'seller',
        disputeResolvedAt: new Date().toISOString(),
      });
      await notifyAdminEvent('AUTO_RELEASE', deal.id, `Admin ruled for seller on deal ${deal.id}. Auto-release triggered.`);
      await notify.dealFinalized(deal.sellerId, deal.id, deal.sellerReceives ?? deal.productPrice ?? 0);
      toast.success('Ruled in favour of seller. Auto-release triggered.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to rule. Please try again.');
    } finally {
      setRuling(false);
    }
  };

  const handleEscalate = async () => {
    if (ruling) return;
    setRuling(true);
    try {
      await updateDoc(doc(db, 'deals', deal.id), {
        disputeEscalated: true,
        disputeEscalatedAt: new Date().toISOString(),
      });
      await notify.disputeRaised(deal.buyerId, deal.id, deal.disputeType ?? 'buyer');
      await notify.disputeRaised(deal.sellerId, deal.id, deal.disputeType ?? 'buyer');
      toast.info('Case escalated for senior review. Parties notified.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to escalate.');
    } finally {
      setRuling(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${disputeInfo.color}`}>
                {disputeInfo.label} DISPUTE
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Deal #{deal.id.slice(-8)}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {deal.disputeRaisedAt ? new Date(deal.disputeRaisedAt).toLocaleString() : ''}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{deal.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatXAF(deal.productPrice ?? deal.price ?? 0)} • {getReasonLabel(deal)}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-4 space-y-4">
          {/* Description */}
          {deal.disputeDescription && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{deal.disputeDescription}</p>
            </div>
          )}

          {/* Evidence photos */}
          {deal.disputeEvidenceUrls && deal.disputeEvidenceUrls.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Evidence</p>
              <div className="flex gap-2 flex-wrap">
                {deal.disputeEvidenceUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-90" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Counter evidence */}
          {deal.disputeCounterEvidenceUrls && deal.disputeCounterEvidenceUrls.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Counter Evidence</p>
              <div className="flex gap-2 flex-wrap">
                {deal.disputeCounterEvidenceUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-90" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Deal parties */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <p className="font-semibold text-slate-600 dark:text-slate-400">Buyer</p>
              <p className="text-slate-800 dark:text-slate-200">{deal.buyerName}</p>
              <p className="text-slate-500">{deal.buyerCity}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <p className="font-semibold text-slate-600 dark:text-slate-400">Seller</p>
              <p className="text-slate-800 dark:text-slate-200">{deal.sellerName}</p>
              <p className="text-slate-500">{deal.sellerCity}</p>
            </div>
          </div>

          {/* Admin ruling buttons */}
          <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleRuleForBuyer}
              disabled={ruling}
              className="flex-1 min-w-[140px] py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              Rule for Buyer
            </button>
            <button
              onClick={handleRuleForSeller}
              disabled={ruling}
              className="flex-1 min-w-[140px] py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              Rule for Seller
            </button>
            <button
              onClick={handleEscalate}
              disabled={ruling}
              className="flex-1 min-w-[100px] py-2 rounded-lg bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              Escalate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDisputeDashboard() {
  const [disputes, setDisputes] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'deals'),
      where('status', 'in', DISPUTED_STATUSES),
    );

    const unsub = onSnapshot(q, (snap) => {
      const deals = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal));
      // Sort by dispute raised time, newest first
      deals.sort((a, b) => {
        const ta = a.disputeRaisedAt ?? a.updatedAt ?? '';
        const tb = b.disputeRaisedAt ?? b.updatedAt ?? '';
        return tb.localeCompare(ta);
      });
      setDisputes(deals);
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Active Disputes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {disputes.length === 0 ? 'No active disputes' : `${disputes.length} dispute${disputes.length > 1 ? 's' : ''} require attention`}
          </p>
        </div>
        {disputes.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-full text-sm font-semibold">
            <AlertTriangle className="w-4 h-4" />
            {disputes.length}
          </div>
        )}
      </div>

      {/* Dispute cards */}
      {disputes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">All clear — no active disputes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((deal) => (
            <DisputeCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
