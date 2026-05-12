// import { useState } from 'react';
// import { ShieldCheck, CreditCard, Smartphone, X, ExternalLink, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
// import { initiatePayment, verifyPayment, formatXAF, computeFee } from '../lib/notchpay';
// import { db } from '../lib/firebase';
// import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
// import { toast } from 'sonner';
// import { Deal, UserProfile } from '../types';

// interface PaymentModalProps {
//   deal: Deal;
//   profile: UserProfile;
//   onClose: () => void;
//   onSuccess: () => void;
// }

// type PaymentStep = 'choose' | 'processing' | 'redirect' | 'verifying' | 'success' | 'failed';

// export default function PaymentModal({ deal, profile, onClose, onSuccess }: PaymentModalProps) {
//   const [step, setStep] = useState<PaymentStep>('choose');
//   const [phone, setPhone] = useState(profile.phoneNumber?.replace('+237', '') ?? '');
//   const [authUrl, setAuthUrl] = useState('');
//   const [reference, setReference] = useState('');
//   const [errorMsg, setErrorMsg] = useState('');

//   const { fee, total, feePercent } = computeFee(deal.price);

//   // ─── STEP 1: Initiate Payment ─────────────────────────────────────────────
//   const handlePay = async () => {
//     if (!phone.trim() || phone.length < 9) {
//       toast.error('Please enter a valid phone number (9 digits)');
//       return;
//     }

//     setStep('processing');
//     setErrorMsg('');

//     const result = await initiatePayment({
//       amount: total,
//       email: profile.email,
//       name: profile.displayName,
//       phone: `237${phone.replace(/\s/g, '')}`,
//       description: `Escrow payment for: ${deal.title}`,
//       dealId: deal.id,
//       callbackUrl: `${window.location.origin}/?payment=callback&dealId=${deal.id}`,
//     });

//     if (!result.success || !result.authorization_url) {
//       setStep('failed');
//       setErrorMsg(result.error ?? 'Payment initiation failed. Please try again.');
//       return;
//     }

//     setAuthUrl(result.authorization_url);
//     setReference(result.reference ?? '');

//     // Save the pending reference to Firestore so we can verify later
//     try {
//       await updateDoc(doc(db, 'deals', deal.id), {
//         paymentReference: result.reference,
//         paymentStatus: 'pending',
//         updatedAt: new Date().toISOString(),
//       });
//     } catch (e) {
//       console.error('Failed to save payment reference:', e);
//     }

//     setStep('redirect');
//   };

//   // ─── STEP 2: Open Notch Pay checkout in new tab ───────────────────────────
//   const openCheckout = () => {
//     window.open(authUrl, '_blank', 'noopener,noreferrer');
//     // After opening, show verify button
//   };

//   // ─── STEP 3: Verify payment after buyer returns ───────────────────────────
//   const handleVerify = async () => {
//     if (!reference) return;
//     setStep('verifying');

//     const result = await verifyPayment(reference);

//     if (!result.success) {
//       setStep('failed');
//       setErrorMsg(result.error ?? 'Could not verify payment.');
//       return;
//     }

//     if (result.status === 'complete') {
//       // Update deal in Firestore → funded
//       try {
//         await updateDoc(doc(db, 'deals', deal.id), {
//           status: 'funded',
//           milestone: 25,
//           paymentStatus: 'complete',
//           notchPayTransactionId: reference,
//           escrowFundedAt: new Date().toISOString(),
//           updatedAt: new Date().toISOString(),
//         });

//         // Post system message to chat
//         await addDoc(collection(db, 'deals', deal.id, 'messages'), {
//           dealId: deal.id,
//           senderId: 'system',
//           text: `✅ Escrow funded! ${formatXAF(total)} locked securely. Seller can now ship the goods.`,
//           timestamp: new Date().toISOString(),
//           type: 'system',
//         });

//         // Notify the seller
//         if (deal.sellerId) {
//           await addDoc(collection(db, 'notifications', deal.sellerId, 'items'), {
//             userId: deal.sellerId,
//             type: 'payment_received',
//             title: 'Escrow Payment Received',
//             body: `${profile.displayName} has funded the escrow for "${deal.title}". You can now ship the item.`,
//             dealId: deal.id,
//             read: false,
//             createdAt: new Date().toISOString(),
//           });
//         }

//         setStep('success');
//         toast.success('Escrow funded! The seller has been notified.');
//         setTimeout(() => { onSuccess(); onClose(); }, 2000);
//       } catch (err) {
//         console.error('Firestore update failed:', err);
//         setStep('failed');
//         setErrorMsg('Payment verified but failed to update deal. Please contact support.');
//       }
//     } else if (result.status === 'pending') {
//       toast.warning('Payment still pending. Complete the payment in your browser, then click Verify again.');
//       setStep('redirect');
//     } else {
//       setStep('failed');
//       setErrorMsg(`Payment ${result.status}. Please try again.`);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
//       <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
//         {/* Header */}
//         <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
//           <div className="flex items-center gap-3">
//             <div className="size-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
//               <ShieldCheck className="w-5 h-5 text-white" />
//             </div>
//             <div>
//               <h2 className="font-bold text-slate-900 dark:text-white">Secure Escrow Payment</h2>
//               <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Powered by Notch Pay</p>
//             </div>
//           </div>
//           {step !== 'processing' && step !== 'verifying' && (
//             <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
//               <X className="w-5 h-5 text-slate-400" />
//             </button>
//           )}
//         </div>

//         <div className="p-6">
//           {/* ── CHOOSE / ENTER PHONE ──────────────────────────── */}
//           {step === 'choose' && (
//             <div className="space-y-6">
//               {/* Price breakdown */}
//               <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
//                 <div className="flex justify-between text-sm">
//                   <span className="text-slate-500">Deal amount</span>
//                   <span className="font-bold text-slate-900 dark:text-white">{formatXAF(deal.price)}</span>
//                 </div>
//                 <div className="flex justify-between text-sm">
//                   <span className="text-slate-500">Platform fee ({feePercent}%)</span>
//                   <span className="font-medium text-slate-600 dark:text-slate-400">{formatXAF(fee)}</span>
//                 </div>
//                 <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between">
//                   <span className="font-bold text-slate-900 dark:text-white">Total to pay</span>
//                   <span className="text-xl font-black text-primary">{formatXAF(total)}</span>
//                 </div>
//               </div>

//               {/* Payment methods info */}
//               <div>
//                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Accepted methods</p>
//                 <div className="grid grid-cols-2 gap-2">
//                   {[
//                     { icon: '📱', label: 'MTN Mobile Money', color: 'bg-yellow-50 border-yellow-200' },
//                     { icon: '📱', label: 'Orange Money', color: 'bg-orange-50 border-orange-200' },
//                     { icon: '💳', label: 'Visa / Mastercard', color: 'bg-blue-50 border-blue-200' },
//                     { icon: '🏦', label: 'Bank Transfer', color: 'bg-slate-50 border-slate-200' },
//                   ].map(m => (
//                     <div key={m.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold text-slate-700 ${m.color}`}>
//                       <span>{m.icon}</span> {m.label}
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* Phone number */}
//               <div>
//                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
//                   Your Mobile Money Number
//                 </label>
//                 <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
//                   <span className="pl-4 pr-2 py-3.5 text-sm font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shrink-0">+237</span>
//                   <input
//                     type="tel"
//                     value={phone}
//                     onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
//                     placeholder="671 234 567"
//                     maxLength={9}
//                     className="flex-1 px-3 py-3.5 text-sm bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400"
//                   />
//                 </div>
//                 <p className="text-[11px] text-slate-400 mt-1.5">For MTN/Orange MoMo — you'll approve the payment on your phone</p>
//               </div>

//               {/* Security note */}
//               <div className="flex gap-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
//                 <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
//                 <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
//                   Funds are held in <strong>secure escrow</strong> until you confirm receipt. Your money is 100% protected.
//                 </p>
//               </div>

//               <button
//                 onClick={handlePay}
//                 className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
//               >
//                 <CreditCard className="w-5 h-5" />
//                 Pay {formatXAF(total)} via Notch Pay
//               </button>
//             </div>
//           )}

//           {/* ── PROCESSING ────────────────────────────────────── */}
//           {step === 'processing' && (
//             <div className="py-12 flex flex-col items-center gap-4 text-center">
//               <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
//                 <Loader2 className="w-7 h-7 text-primary animate-spin" />
//               </div>
//               <p className="font-bold text-slate-900 dark:text-white">Initialising secure payment...</p>
//               <p className="text-sm text-slate-400">Connecting to Notch Pay</p>
//             </div>
//           )}

//           {/* ── REDIRECT ──────────────────────────────────────── */}
//           {step === 'redirect' && (
//             <div className="space-y-6">
//               <div className="py-4 flex flex-col items-center gap-3 text-center">
//                 <div className="size-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
//                   <ExternalLink className="w-6 h-6 text-amber-500" />
//                 </div>
//                 <p className="font-bold text-slate-900 dark:text-white">Complete payment in your browser</p>
//                 <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
//                   Click the button below to open the Notch Pay checkout. Approve the payment on your phone, then return here and click <strong>Verify Payment</strong>.
//                 </p>
//               </div>

//               <div className="space-y-3">
//                 <button
//                   onClick={openCheckout}
//                   className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
//                 >
//                   <ExternalLink className="w-4 h-4" />
//                   Open Notch Pay Checkout
//                 </button>
//                 <button
//                   onClick={handleVerify}
//                   className="w-full py-3.5 border-2 border-primary/30 text-primary dark:text-slate-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
//                 >
//                   <RefreshCw className="w-4 h-4" />
//                   I've Paid — Verify Now
//                 </button>
//               </div>
//               <p className="text-[10px] text-slate-400 text-center">Reference: <span className="font-mono">{reference}</span></p>
//             </div>
//           )}

//           {/* ── VERIFYING ─────────────────────────────────────── */}
//           {step === 'verifying' && (
//             <div className="py-12 flex flex-col items-center gap-4 text-center">
//               <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
//                 <Loader2 className="w-7 h-7 text-primary animate-spin" />
//               </div>
//               <p className="font-bold text-slate-900 dark:text-white">Verifying your payment...</p>
//               <p className="text-sm text-slate-400">Checking Notch Pay servers</p>
//             </div>
//           )}

//           {/* ── SUCCESS ───────────────────────────────────────── */}
//           {step === 'success' && (
//             <div className="py-12 flex flex-col items-center gap-4 text-center">
//               <div className="size-14 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
//                 <CheckCircle2 className="w-7 h-7 text-green-500" />
//               </div>
//               <p className="font-bold text-slate-900 dark:text-white text-lg">Escrow Funded!</p>
//               <p className="text-sm text-slate-500">{formatXAF(total)} locked securely. The seller can now ship.</p>
//             </div>
//           )}

//           {/* ── FAILED ────────────────────────────────────────── */}
//           {step === 'failed' && (
//             <div className="space-y-5">
//               <div className="py-6 flex flex-col items-center gap-3 text-center">
//                 <div className="size-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
//                   <AlertCircle className="w-7 h-7 text-red-500" />
//                 </div>
//                 <p className="font-bold text-slate-900 dark:text-white">Payment Failed</p>
//                 <p className="text-sm text-slate-500 max-w-xs">{errorMsg}</p>
//               </div>
//               <div className="flex gap-3">
//                 <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 transition-all">
//                   Cancel
//                 </button>
//                 <button onClick={() => setStep('choose')} className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary text-white shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all">
//                   Try Again
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
