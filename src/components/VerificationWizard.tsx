/**
 * components/VerificationWizard.tsx
 * Full-screen multi-step verification wizard.
 */
import { useState, useCallback } from 'react';
import { UserProfile, Verification, VerificationStatus } from '../types';
import { submitVerification } from '../lib/verification';
import PhoneOtpStep from './PhoneOtpStep';
import { toast } from 'sonner';
import {
  Upload, CheckCircle, XCircle, Shield, ChevronLeft, Loader2,
} from 'lucide-react';
import { auth } from '../lib/firebase';

interface VerificationWizardProps {
  profile: UserProfile;
  onComplete: () => void;
}

type StepId =
  | 'phone'
  | 'id_docs'
  | 'selfie'
  | 'seller_docs'
  | 'rider_docs'
  | 'review';

function buildSteps(role: string): StepId[] {
  const base: StepId[] = ['phone', 'id_docs', 'selfie'];
  if (role === 'seller') base.push('seller_docs');
  if (role === 'rider') base.push('rider_docs');
  base.push('review');
  return base;
}

// ── Image Compression helper ──────────────────────────────────────────────────
function compressImage(file: File, maxWidth = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    // Only compress images
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize logic
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// ── Upload area sub-component ──────────────────────────────────────────────────
function UploadArea({
  label,
  value,
  accept,
  onUpload,
  tip,
}: {
  label: string;
  value: string;
  accept?: string;
  onUpload: (b64: string, name: string) => void;
  tip?: string;
}) {
  const [fileName, setFileName] = useState('');
  const [compressing, setCompressing] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const b64 = await compressImage(file);
      setFileName(file.name);
      onUpload(b64, file.name);
    } catch (err) {
      toast.error('Failed to process image.');
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div className="flex-1">
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{label}</label>
      <label className="cursor-pointer block">
        <div className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 transition-all hover:border-primary/50 ${value ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50'}`}>
          {compressing ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-bold text-primary animate-pulse">Processing...</p>
            </>
          ) : value ? (
            <>
              {value.startsWith('data:image') ? (
                <img src={value} alt={label} className="w-20 h-20 object-cover rounded-lg" />
              ) : (
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-full px-2">{fileName || 'Uploaded'}</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-400" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Click to upload</p>
            </>
          )}
        </div>
        <input type="file" accept={accept || 'image/*'} className="hidden" onChange={handleChange} />
      </label>
      {tip && <p className="text-xs text-slate-400 mt-1">{tip}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VerificationWizard({ profile, onComplete }: VerificationWizardProps) {
  const steps = buildSteps(profile.role);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Local state for collected data
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idFrontUrl, setIdFrontUrl] = useState('');
  const [idBackUrl, setIdBackUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [businessRegUrl, setBusinessRegUrl] = useState('');
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState('');
  const [licenseUrl, setLicenseUrl] = useState('');

  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;
  const progress = Math.round(((stepIndex + 1) / totalSteps) * 100);

  const canProceed = useCallback((): boolean => {
    if (currentStep === 'phone') return phoneVerified;
    if (currentStep === 'id_docs') return !!idFrontUrl && !!idBackUrl;
    if (currentStep === 'selfie') return !!selfieUrl;
    if (currentStep === 'seller_docs') return !!businessRegUrl;
    if (currentStep === 'rider_docs') return !!vehiclePhotoUrl && !!licenseUrl;
    return true;
  }, [currentStep, phoneVerified, idFrontUrl, idBackUrl, selfieUrl, businessRegUrl, vehiclePhotoUrl, licenseUrl]);

  const handleNext = () => {
    if (stepIndex < totalSteps - 1) setStepIndex(s => s + 1);
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex(s => s - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const uid = profile.uid || auth.currentUser?.uid;
      if (!uid) throw new Error('No user ID');

      const verificationData: any = {
        userId: uid,
        role: profile.role,
        status: 'pending' as VerificationStatus,
        phoneVerified,
        phoneNumber,
        idFrontUrl,
        idBackUrl,
        selfieUrl,
        submittedAt: new Date().toISOString(),
      };

      if (businessRegUrl) verificationData.businessRegUrl = businessRegUrl;
      if (vehiclePhotoUrl) verificationData.vehiclePhotoUrl = vehiclePhotoUrl;
      if (licenseUrl) verificationData.licenseUrl = licenseUrl;

      await submitVerification(verificationData);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Documents Submitted!</h2>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
            Our team will review your documents within 24 hours. You'll be notified once approved.
          </p>
          <button
            onClick={onComplete}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // ── Step labels ──────────────────────────────────────────────────────────────
  const stepLabel: Record<StepId, string> = {
    phone: 'Phone Verification',
    id_docs: 'Identity Documents',
    selfie: 'Selfie Photo',
    seller_docs: 'Business Registration',
    rider_docs: 'Vehicle & License',
    review: 'Review & Submit',
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-black text-slate-900 dark:text-white text-sm">Identity Verification</h2>
          <p className="text-xs text-slate-400">Step {stepIndex + 1} of {totalSteps} — {stepLabel[currentStep]}</p>
        </div>
        <span className="text-xs font-bold text-primary">{progress}%</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">

          {/* Step: Phone */}
          {currentStep === 'phone' && (
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Verify Your Phone</h3>
              <p className="text-sm text-slate-500 mb-6">We'll send a one-time code to confirm your number.</p>
              <PhoneOtpStep
                onVerified={(num) => { setPhoneVerified(true); setPhoneNumber(num); }}
                initialPhone={profile.phoneNumber?.replace('+237', '') || ''}
              />
              {phoneVerified && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Phone verified: +237 {phoneNumber}</span>
                </div>
              )}
            </div>
          )}

          {/* Step: ID Docs */}
          {currentStep === 'id_docs' && (
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Identity Documents</h3>
              <p className="text-sm text-slate-500 mb-6">Upload both sides of your National ID or Passport.</p>
              <div className="flex gap-4">
                <UploadArea label="ID Front" value={idFrontUrl} onUpload={(b64) => setIdFrontUrl(b64)} />
                <UploadArea label="ID Back" value={idBackUrl} onUpload={(b64) => setIdBackUrl(b64)} />
              </div>
            </div>
          )}

          {/* Step: Selfie */}
          {currentStep === 'selfie' && (
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Selfie Photo</h3>
              <p className="text-sm text-slate-500 mb-2">Take a clear photo of your face.</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-6 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                💡 Make sure your face is clearly visible and well-lit.
              </p>
              <UploadArea label="Selfie" value={selfieUrl} onUpload={(b64) => setSelfieUrl(b64)} />
            </div>
          )}

          {/* Step: Seller docs */}
          {currentStep === 'seller_docs' && (
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Business Registration</h3>
              <p className="text-xs text-slate-400 mb-6 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                📄 Upload your official business registration certificate.
              </p>
              <UploadArea
                label="Business Registration Document"
                value={businessRegUrl}
                accept="image/*,application/pdf"
                onUpload={(b64) => setBusinessRegUrl(b64)}
              />
            </div>
          )}

          {/* Step: Rider docs */}
          {currentStep === 'rider_docs' && (
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Vehicle & License</h3>
              <p className="text-sm text-slate-500 mb-6">Upload a photo of your vehicle and your driver's license.</p>
              <div className="flex gap-4">
                <UploadArea label="Vehicle Photo" value={vehiclePhotoUrl} onUpload={(b64) => setVehiclePhotoUrl(b64)} />
                <UploadArea label="Driver's License" value={licenseUrl} onUpload={(b64) => setLicenseUrl(b64)} />
              </div>
            </div>
          )}

          {/* Step: Review */}
          {currentStep === 'review' && (
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Review & Submit</h3>
              <p className="text-sm text-slate-500 mb-6">Check that everything is in order before submitting.</p>
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 mb-6">
                <ReviewRow label="Phone Number" ok={phoneVerified} value={phoneNumber ? `+237 ${phoneNumber}` : ''} />
                <ReviewRow label="ID Documents" ok={!!idFrontUrl && !!idBackUrl} />
                <ReviewRow label="Selfie" ok={!!selfieUrl} />
                {profile.role === 'seller' && <ReviewRow label="Business Registration" ok={!!businessRegUrl} />}
                {profile.role === 'rider' && (
                  <>
                    <ReviewRow label="Vehicle Photo" ok={!!vehiclePhotoUrl} />
                    <ReviewRow label="Driver's License" ok={!!licenseUrl} />
                  </>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-all text-base"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</>
                ) : 'Submit for Verification'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
        {stepIndex > 0 && currentStep !== 'review' && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        {currentStep !== 'review' && (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            Next →
          </button>
        )}
        {currentStep === 'review' && stepIndex > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
      </div>
    </div>
  );
}

// ── ReviewRow helper ───────────────────────────────────────────────────────────
function ReviewRow({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}{value ? ` — ${value}` : ''}</span>
      {ok
        ? <CheckCircle className="w-5 h-5 text-emerald-500" />
        : <XCircle className="w-5 h-5 text-red-400" />
      }
    </div>
  );
}
