/**
 * components/DisputeForm.tsx
 * ---------------------------
 * Dispute initiation form — supports buyer, seller, and rider dispute types.
 * Each type has its own reason list and field set.
 */

import { useState } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { transitionDeal } from '../lib/dealStateMachine';
import { notifyAdminEvent } from '../lib/adminNotifications';
import { notify } from '../lib/notifications';
import { Deal, BuyerDisputeReason, SellerDisputeReason, RiderDisputeReason } from '../types';
import { AlertTriangle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

const BUYER_REASONS: { value: BuyerDisputeReason; label: string }[] = [
  { value: 'wrong_item',              label: 'Wrong item received' },
  { value: 'item_damaged',            label: 'Item damaged' },
  { value: 'not_matching_description', label: 'Item does not match description' },
  { value: 'quantity_incorrect',      label: 'Quantity incorrect' },
  { value: 'other',                   label: 'Other' },
];

const SELLER_REASONS: { value: SellerDisputeReason; label: string }[] = [
  { value: 'buyer_unreachable',          label: 'Buyer is unreachable' },
  { value: 'wrong_delivery_address',     label: 'Buyer gave wrong delivery address' },
  { value: 'buyer_refusing_inspection',  label: 'Buyer is refusing inspection' },
  { value: 'false_dispute',             label: 'Buyer raised false dispute' },
  { value: 'other',                     label: 'Other' },
];

const RIDER_REASONS: { value: RiderDisputeReason; label: string }[] = [
  { value: 'buyer_not_present',     label: 'Buyer not present at address' },
  { value: 'buyer_unreachable',     label: 'Buyer unreachable after phone calls' },
  { value: 'buyer_refusing_goods',  label: 'Buyer refusing to accept goods' },
  { value: 'other',                 label: 'Other' },
];

interface Props {
  deal: Deal;
  disputeType: 'buyer' | 'seller' | 'rider';
  userId: string;
  onClose: () => void;
}

export default function DisputeForm({ deal, disputeType, userId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [callAttempts, setCallAttempts] = useState(1);
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = disputeType === 'buyer' ? BUYER_REASONS
    : disputeType === 'seller' ? SELLER_REASONS
    : RIDER_REASONS;

  const requiresEvidence = disputeType === 'buyer';
  const canSubmit = reason && description.trim().length >= 10 &&
    (!requiresEvidence || photos.length >= 1);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos((prev) => [...prev, ...files].slice(0, 5)); // max 5
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit || uploading) return;
    setUploading(true);

    try {
      // Upload evidence photos to local backend
      const evidenceUrls: string[] = [];
      for (const file of photos) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload image to local server');
        }

        const data = await response.json();
        evidenceUrls.push(data.url);
      }

      // Determine new status
      const newStatus = disputeType === 'buyer' ? 'DISPUTED'
        : disputeType === 'seller' ? 'SELLER_DISPUTED'
        : 'RIDER_DISPUTED';

      // Update deal document
      await transitionDeal(deal.id, newStatus as any, userId, {
        disputeType,
        disputeRaisedAt: new Date().toISOString(),
        disputeRaisedBy: userId,
        disputeReason: reason,
        disputeDescription: description,
        ...(evidenceUrls.length > 0 ? { disputeEvidenceUrls: evidenceUrls } : {}),
        ...(disputeType === 'rider' ? { riderCallAttempts: callAttempts } : {}),
      });

      // Admin notification
      await notifyAdminEvent(
        'NEW_DISPUTE',
        deal.id,
        `${disputeType.toUpperCase()} DISPUTE — Deal #${deal.id}: ${reason}`,
      );

      // Party notifications
      if (disputeType === 'buyer') {
        await notify.riderHoldGoods(deal.riderId!, deal.id);
        await notify.disputeRaised(deal.sellerId, deal.id, 'buyer');
      } else if (disputeType === 'seller') {
        await notify.disputeRaised(deal.buyerId, deal.id, 'seller');
      } else {
        await notify.disputeRaised(deal.buyerId, deal.id, 'rider');
        await notify.disputeRaised(deal.sellerId, deal.id, 'rider');
      }

      setSubmitted(true);
      toast.success('Dispute submitted. Our team will review it shortly.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit dispute. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8 px-4">
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">Dispute Submitted</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
          All funds are now frozen. Our team has been notified.
        </p>
        {disputeType === 'buyer' && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-4 py-2">
            The rider has been told to hold the goods and not leave your location.
          </p>
        )}
        <button onClick={onClose} className="mt-5 px-6 py-2 rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Policy notice */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
        <p>⚠ Raising a dispute will <strong>freeze all funds</strong> and notify our team.</p>
        <p>⚠ If ruled in your favour, your product price will be refunded. Platform and delivery fees are non-refundable.</p>
      </div>

      {/* Reason dropdown */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select a reason…</option>
          {reasons.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Rider: call attempts */}
      {disputeType === 'rider' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Number of call attempts <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={callAttempts}
            onChange={(e) => setCallAttempts(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the issue in detail…"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <p className="text-xs text-slate-400 mt-1">{description.length} chars (min 10)</p>
      </div>

      {/* Photo evidence */}
      {disputeType !== 'rider' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Evidence photos {requiresEvidence && <span className="text-red-500">* (min 1)</span>}
          </label>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-indigo-400 transition-colors">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Add photos (up to 5)</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
          </label>

          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {photos.map((file, i) => (
                <div key={i} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || uploading}
        className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {uploading ? 'Submitting…' : 'Submit Dispute'}
      </button>
    </div>
  );
}
