// import { useState, useEffect } from 'react';
// import { db, auth } from '../lib/firebase';
// import { collection, query, where, onSnapshot, addDoc, getDocs, or } from 'firebase/firestore';
// import { Deal, UserProfile, Notification } from '../types';
// import {
//   ShieldCheck, Plus, ArrowRight, User, Diamond, Brush, Car,
//   LogOut, Clock, Bell, X, Check, Link, Copy, Send
// } from 'lucide-react';
// import { toast } from 'sonner';
// import { signOut } from 'firebase/auth';
// import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
// import { sendDealInviteEmail } from '../lib/emailjs';
// import { formatXAF } from '../lib/notchpay';

// interface DashboardProps {
//   profile: UserProfile | null;
//   onNavigate: (page: string, dealId?: string) => void;
// }

// export default function Dashboard({ profile, onNavigate }: DashboardProps) {
//   const [deals, setDeals] = useState<Deal[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [showCreateModal, setShowCreateModal] = useState(false);
//   const [showNotifications, setShowNotifications] = useState(false);
//   const [notifications, setNotifications] = useState<Notification[]>([]);
//   const [creating, setCreating] = useState(false);

//   // ─── Fetch all deals where user is buyer OR seller ─────────────────────────
//   useEffect(() => {
//     if (!profile) return;

//     // We query both buyerId and sellerId fields to show deals regardless of role
//     const buyerQ  = query(collection(db, 'deals'), where('buyerId',  '==', profile.uid));
//     const sellerQ = query(collection(db, 'deals'), where('sellerId', '==', profile.uid));

//     const allDeals = new Map<string, Deal>();
//     let buyerLoaded = false;
//     let sellerLoaded = false;

//     const syncDeals = () => {
//       if (buyerLoaded && sellerLoaded) {
//         setDeals(Array.from(allDeals.values()).sort((a, b) =>
//           new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
//         ));
//         setLoading(false);
//       }
//     };

//     const unsubBuyer = onSnapshot(buyerQ, (snap) => {
//       snap.docs.forEach(d => allDeals.set(d.id, { id: d.id, ...d.data() } as Deal));
//       buyerLoaded = true;
//       syncDeals();
//     });

//     const unsubSeller = onSnapshot(sellerQ, (snap) => {
//       snap.docs.forEach(d => allDeals.set(d.id, { id: d.id, ...d.data() } as Deal));
//       sellerLoaded = true;
//       syncDeals();
//     });

//     return () => { unsubBuyer(); unsubSeller(); };
//   }, [profile]);

//   // ─── Notifications ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!profile) return;
//     const q = query(
//       collection(db, 'notifications', profile.uid, 'items'),
//       where('read', '==', false)
//     );
//     const unsub = onSnapshot(q, (snap) => {
//       setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
//     });
//     return () => unsub();
//   }, [profile]);

//   const unreadCount = notifications.length;

//   const handleLogout = async () => { await signOut(auth); onNavigate('landing'); };

//   const markAsRead = async (notifId: string) => {
//     const { doc, updateDoc } = await import('firebase/firestore');
//     await updateDoc(doc(db, 'notifications', profile!.uid, 'items', notifId), { read: true });
//   };

//   // ─── CREATE DEAL (buyer invites seller OR seller invites buyer) ─────────────
//   const createDeal = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setCreating(true);

//     const fd = new FormData(e.currentTarget);
//     const title       = fd.get('title') as string;
//     const price       = Number(fd.get('price'));
//     const description = fd.get('description') as string;
//     const otherEmail  = (fd.get('otherEmail') as string).trim().toLowerCase();

//     const isSeller = profile?.role === 'seller';

//     try {
//       // ── Look up the other party by email ────────────────────────────────────
//       const usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', otherEmail)));
//       const otherExists = !usersSnap.empty;
//       const otherData = otherExists ? usersSnap.docs[0].data() as UserProfile : undefined;

//       // ── Build deal document ─────────────────────────────────────────────────
//       const dealData: Omit<Deal, 'id'> = {
//         title,
//         description: description || '',
//         price,
//         currency: 'XAF',
//         origin: isSeller ? 'seller' : 'buyer',

//         // Seller creates deal → seller is filled, buyer is the invitee
//         buyerId:    isSeller ? (otherExists ? otherData!.uid : '') : profile!.uid,
//         buyerName:  isSeller ? (otherExists ? otherData!.displayName : '') : (profile!.displayName || profile!.email),
//         buyerEmail: isSeller ? otherEmail : profile!.email,

//         sellerId:   isSeller ? profile!.uid : (otherExists ? otherData!.uid : ''),
//         sellerName: isSeller ? (profile!.displayName || profile!.email) : (otherExists ? otherData!.displayName : ''),
//         sellerEmail: isSeller ? profile!.email : otherEmail,

//         status: otherExists ? 'active' : 'waiting',
//         milestone: 0,
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString(),
//       };

//       const docRef = await addDoc(collection(db, 'deals'), dealData);
//       const dealId = docRef.id;

//       // ── Notify other party ─────────────────────────────────────────────────
//       if (otherExists && otherData) {
//         const notifType = isSeller ? 'deal_created_by_seller' : 'deal_invite';
//         const notifTitle = isSeller
//           ? 'Seller has created a deal for you'
//           : 'New Deal Room Invitation';
//         const notifBody = isSeller
//           ? `${profile?.displayName || 'A seller'} created a deal for "${title}" at ${formatXAF(price)}. Open the deal room to review and pay.`
//           : `${profile?.displayName || 'A buyer'} invited you to a secure deal: "${title}" for ${formatXAF(price)}.`;

//         await addDoc(collection(db, 'notifications', otherData.uid, 'items'), {
//           userId: otherData.uid,
//           type: notifType,
//           title: notifTitle,
//           body: notifBody,
//           dealId,
//           read: false,
//           createdAt: new Date().toISOString(),
//         });

//         toast.success(`Deal created! ${otherData.displayName} has been notified.`);
//       } else {
//         // Send email invite
//         try {
//           await sendDealInviteEmail({
//             sellerEmail: isSeller ? otherEmail : otherEmail,
//             sellerName: otherEmail.split('@')[0],
//             buyerName: isSeller ? otherEmail.split('@')[0] : (profile?.displayName || 'A buyer'),
//             productTitle: title,
//             price,
//             dealId,
//           });
//           toast.success(`Deal created! Invite email sent to ${otherEmail}.`);
//         } catch {
//           toast.warning('Deal created, but invite email failed. Share the link manually.');
//         }
//       }

//       setShowCreateModal(false);
//       onNavigate('deal-room', dealId);
//     } catch (error: any) {
//       handleFirestoreError(error, OperationType.CREATE, 'deals');
//     } finally {
//       setCreating(false);
//     }
//   };

//   const isSeller = profile?.role === 'seller';

//   return (
//     <div className="bg-background-light dark:bg-background-dark min-h-screen font-display">
//       {/* Header */}
//       <header className="flex items-center justify-between border-b border-primary/5 bg-white dark:bg-slate-900 px-6 py-4 lg:px-40 sticky top-0 z-50">
//         <div className="flex items-center gap-3 text-primary">
//           <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
//             <ShieldCheck className="w-6 h-6" />
//           </div>
//           <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">TrustDeals</h2>
//         </div>
//         <div className="flex items-center gap-4">
//           <div className="hidden md:flex flex-col items-end">
//             <span className="text-sm font-bold text-slate-900 dark:text-white">{profile?.displayName}</span>
//             <span className={`text-[10px] font-bold uppercase tracking-widest ${isSeller ? 'text-emerald-500' : 'text-accent'}`}>{profile?.role}</span>
//           </div>
//           <button
//             onClick={() => setShowNotifications(true)}
//             className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
//           >
//             <Bell className="w-5 h-5" />
//             {unreadCount > 0 && (
//               <span className="absolute top-1.5 right-1.5 size-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
//                 <span className="text-[9px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
//               </span>
//             )}
//           </button>
//           <button onClick={handleLogout} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
//             <LogOut className="w-5 h-5" />
//           </button>
//         </div>
//       </header>

//       <main className="max-w-7xl mx-auto px-6 py-8 lg:px-40">
//         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
//           <div>
//             <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
//               {isSeller ? 'My Deals' : 'Active Deals'}
//             </h1>
//             <p className="text-slate-500 mt-1">
//               {isSeller
//                 ? 'Create deals and invite buyers — XAF held in escrow until delivery'
//                 : 'Manage your secure XAF transactions'}
//             </p>
//           </div>

//           {/* Both buyers and sellers can create a deal */}
//           <button
//             onClick={() => setShowCreateModal(true)}
//             className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-xl shadow-primary/20 hover:translate-y-[-2px] transition-all"
//           >
//             <Plus className="w-5 h-5" />
//             {isSeller ? 'Create Deal & Invite Buyer' : 'New Transaction'}
//           </button>
//         </div>

//         {/* Seller banner */}
//         {isSeller && (
//           <div className="mb-8 flex items-start gap-4 p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
//             <div className="size-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
//               <Send className="w-5 h-5 text-white" />
//             </div>
//             <div>
//               <p className="font-bold text-emerald-800 dark:text-emerald-200">Seller Dashboard</p>
//               <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5 leading-relaxed">
//                 Create a deal, set your price, and invite a buyer by email. Once they pay into escrow, ship the goods — funds are released after the buyer confirms receipt.
//               </p>
//             </div>
//           </div>
//         )}

//         {loading ? (
//           <div className="flex justify-center py-20">
//             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
//           </div>
//         ) : deals.length === 0 ? (
//           <div className="bg-white dark:bg-slate-900 rounded-2xl p-20 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
//             <div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
//               <ShieldCheck className="w-10 h-10 text-slate-300" />
//             </div>
//             <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No deals yet</h3>
//             <p className="text-slate-500 max-w-xs mx-auto">
//               {isSeller
//                 ? 'Create your first deal and invite a buyer to get started.'
//                 : 'Start a new secure transaction to protect your XAF payments.'}
//             </p>
//           </div>
//         ) : (
//           <div className="grid md:grid-cols-2 gap-6">
//             {deals.map(deal => <DealCard key={deal.id} deal={deal} profile={profile} onNavigate={onNavigate} />)}
//           </div>
//         )}
//       </main>

//       {/* ── NOTIFICATIONS MODAL ────────────────────────────────────────────── */}
//       {showNotifications && (
//         <div
//           className="fixed inset-0 z-[100] flex items-start justify-end p-4 pt-20 bg-black/20 backdrop-blur-sm"
//           onClick={() => setShowNotifications(false)}
//         >
//           <div
//             className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
//             onClick={e => e.stopPropagation()}
//           >
//             <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
//               <div className="flex items-center gap-2">
//                 <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
//                 {unreadCount > 0 && <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">{unreadCount} new</span>}
//               </div>
//               <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
//                 <X className="w-5 h-5" />
//               </button>
//             </div>
//             <div className="max-h-96 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
//               {notifications.length === 0 ? (
//                 <div className="py-12 text-center">
//                   <Bell className="w-8 h-8 text-slate-200 mx-auto mb-3" />
//                   <p className="text-sm font-bold text-slate-400">You're all caught up!</p>
//                 </div>
//               ) : (
//                 notifications.map(notif => (
//                   <div
//                     key={notif.id}
//                     className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer bg-primary/[0.02]"
//                     onClick={() => { markAsRead(notif.id); setShowNotifications(false); onNavigate('deal-room', notif.dealId); }}
//                   >
//                     <div className="flex items-start gap-3">
//                       <div className="mt-1.5 size-2 rounded-full bg-primary flex-shrink-0" />
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-bold text-slate-900 dark:text-white">{notif.title}</p>
//                         <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.body}</p>
//                         <p className="text-[10px] text-slate-400 mt-1 font-medium">
//                           {new Date(notif.createdAt).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
//                         </p>
//                       </div>
//                       <button onClick={e => { e.stopPropagation(); markAsRead(notif.id); }} className="flex-shrink-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
//                         <Check className="w-4 h-4 text-slate-400" />
//                       </button>
//                     </div>
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── CREATE DEAL MODAL ──────────────────────────────────────────────── */}
//       {showCreateModal && (
//         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
//           <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
//             <div className="flex items-center justify-between mb-6">
//               <h2 className="text-2xl font-black text-slate-900 dark:text-white">
//                 {isSeller ? 'Create Deal & Invite Buyer' : 'New Transaction'}
//               </h2>
//               <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
//                 <X className="w-5 h-5" />
//               </button>
//             </div>

//             <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl mb-6">
//               <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
//               <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
//                 {isSeller
//                   ? "Enter the buyer's email. They'll receive a notification with a link to the deal room where they can pay via Mobile Money or card."
//                   : "Enter the seller's email. If they have an account, they get an in-app notification. If not, they receive an email invite."}
//               </p>
//             </div>

//             <form onSubmit={createDeal} className="space-y-4">
//               <div>
//                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
//                   {isSeller ? "Buyer's Email Address" : "Seller's Email Address"}
//                 </label>
//                 <input
//                   name="otherEmail"
//                   type="email"
//                   required
//                   className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
//                   placeholder={isSeller ? 'buyer@example.cm' : 'seller@example.cm'}
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Product / Deal Title</label>
//                 <input
//                   name="title"
//                   required
//                   className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
//                   placeholder="e.g. iPhone 14 Pro Max"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Price (XAF / FCFA)</label>
//                 <input
//                   name="price"
//                   type="number"
//                   required
//                   min="1000"
//                   className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
//                   placeholder="e.g. 450000"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
//                   Description <span className="font-normal text-slate-400">(optional)</span>
//                 </label>
//                 <textarea
//                   name="description"
//                   rows={2}
//                   className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
//                   placeholder="Product condition, terms, delivery details..."
//                 />
//               </div>
//               <div className="flex gap-3 pt-2">
//                 <button
//                   type="button"
//                   onClick={() => setShowCreateModal(false)}
//                   className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={creating}
//                   className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
//                 >
//                   {creating
//                     ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
//                     : isSeller ? 'Create & Invite Buyer' : 'Create & Notify Seller'}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Deal Card ────────────────────────────────────────────────────────────────
// function DealCard({ deal, profile, onNavigate }: { deal: Deal; profile: UserProfile | null; onNavigate: (page: string, dealId?: string) => void }) {
//   const isBuyer  = deal.buyerId === profile?.uid;
//   const isSeller = deal.sellerId === profile?.uid;
//   const isWaiting = deal.status === 'waiting' || deal.status === 'created';

//   const copyInviteLink = (e: React.MouseEvent) => {
//     e.stopPropagation();
//     navigator.clipboard.writeText(`${window.location.origin}/join/${deal.id}`);
//     toast.success('Invite link copied!');
//   };

//   const statusMeta: Record<string, { label: string; color: string }> = {
//     created:   { label: 'Waiting for other party', color: 'bg-amber-50 text-amber-700 border-amber-200' },
//     waiting:   { label: 'Waiting for other party', color: 'bg-amber-50 text-amber-700 border-amber-200' },
//     active:    { label: 'Active · Awaiting Payment', color: 'bg-blue-50 text-blue-700 border-blue-200' },
//     funded:    { label: 'Escrow Funded ✓', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
//     transit:   { label: 'In Transit', color: 'bg-violet-50 text-violet-700 border-violet-200' },
//     delivered: { label: 'Delivered · Awaiting Confirmation', color: 'bg-orange-50 text-orange-700 border-orange-200' },
//     finalized: { label: 'Completed ✓', color: 'bg-slate-100 text-slate-500 border-slate-200' },
//     dispute:   { label: 'In Dispute', color: 'bg-red-50 text-red-700 border-red-200' },
//     cancelled: { label: 'Cancelled', color: 'bg-slate-50 text-slate-400 border-slate-200' },
//   };
//   const sm = statusMeta[deal.status] ?? statusMeta.active;

//   return (
//     <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-6 hover:shadow-lg transition-all shadow-sm group">
//       <div className="flex items-start justify-between mb-4">
//         <div className="flex gap-4">
//           <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
//             <Diamond className="text-slate-400 w-5 h-5" />
//           </div>
//           <div>
//             <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{deal.title}</h4>
//             <p className="text-xs text-slate-400 mt-0.5">
//               {isBuyer ? `Seller: ${deal.sellerName || deal.sellerEmail || '—'}` : `Buyer: ${deal.buyerName || deal.buyerEmail || '—'}`}
//             </p>
//           </div>
//         </div>
//         <p className="text-lg font-bold text-primary dark:text-slate-200 shrink-0">{formatXAF(deal.price)}</p>
//       </div>

//       <div className="mb-4 flex items-center gap-2 flex-wrap">
//         <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sm.color}`}>
//           {isWaiting && <Clock className="w-3 h-3" />}
//           {sm.label}
//         </span>
//         {deal.origin === 'seller' && (
//           <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200">
//             Seller-initiated
//           </span>
//         )}
//       </div>

//       <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
//         <span>Progress</span>
//         <span className="text-primary dark:text-slate-300">{deal.milestone}%</span>
//       </div>
//       <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-5 overflow-hidden">
//         <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${deal.milestone}%` }} />
//       </div>

//       <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
//         {isWaiting && (
//           <button
//             onClick={copyInviteLink}
//             className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-primary transition-colors"
//             title="Copy invite link"
//           >
//             <Copy className="w-3.5 h-3.5" />
//             Copy invite
//           </button>
//         )}
//         {!isWaiting && <div />}
//         <button
//           onClick={() => onNavigate('deal-room', deal.id)}
//           className="text-xs font-bold text-primary dark:text-slate-300 hover:text-accent flex items-center gap-1 transition-colors ml-auto"
//         >
//           OPEN ROOM <ArrowRight className="w-4 h-4" />
//         </button>
//       </div>
//     </div>
//   );
// }


import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, getDocs } from 'firebase/firestore';
import { Deal, UserProfile } from '../types';
import {
  ShieldCheck, Plus, ArrowRight, User, Diamond, Brush, Car,
  LogOut, Clock, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { sendDealInviteEmail } from '../lib/emailjs';
import { usePresence } from '../hooks/usePresence';
import PresenceBadge from './PresenceBadge';
import NotificationCenter, { NotificationBell } from './NotificationCenter';
import WalletPanel, { WalletBadge } from './WalletPanel';
import CitySelector from './CitySelector';
import SellerDebtBanner from './SellerDebtBanner';
import VerificationBanner from './VerificationBanner';
import VerificationWizard from './VerificationWizard';

interface DashboardProps {
  profile: UserProfile | null;
  onNavigate: (page: string, dealId?: string) => void;
}

export default function Dashboard({ profile, onNavigate }: DashboardProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [creating, setCreating] = useState(false);
  const [city, setCity] = useState('');
  const [showVerificationWizard, setShowVerificationWizard] = useState(false);

  const isBuyer = profile?.role === 'buyer';
  const isSeller = profile?.role === 'seller';

  // =============================================
  // FETCH DEALS — real-time, both buyer & seller
  // =============================================
  useEffect(() => {
    if (!profile) return;

    // Sellers may appear as buyerId (when they initiate) or sellerId (when invited)
    // Buyers may appear as buyerId (when they initiate) or buyerId on seller-created deals
    const field = isSeller ? 'sellerId' : 'buyerId';
    const q = query(collection(db, 'deals'), where(field, '==', profile.uid));

    // Also listen for deals where this seller was invited as buyer (seller-created deals)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dealsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
      setDeals(dealsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleLogout = async () => {
    await signOut(auth);
    onNavigate('landing');
  };

  // =============================================
  // CREATE DEAL
  // Buyer invites seller → sellerId is target
  // Seller invites buyer → buyerId is target
  // =============================================
  const createDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const price = Number(formData.get('price'));
    const description = formData.get('description') as string;
    const otherPartyEmail = (formData.get('otherPartyEmail') as string).trim().toLowerCase();

    if (!city) {
      toast.error('Please select a city');
      setCreating(false);
      return;
    }

    try {
      // Look up other party by email
      const usersRef = collection(db, 'users');
      const partyQuery = query(usersRef, where('email', '==', otherPartyEmail));
      const partySnapshot = await getDocs(partyQuery);

      const partyExists = !partySnapshot.empty;
      const partyDoc = partyExists ? partySnapshot.docs[0] : null;
      const partyData = partyDoc?.data() as UserProfile | undefined;

      // Soft warning if the seller (other party) is not verified
      if (partyExists && partyData) {
        const targetRole = isBuyer ? 'seller' : 'buyer';
        if (targetRole === 'seller' && partyData.verificationStatus !== 'verified') {
          toast.warning('⚠️ This seller is not yet verified. Proceed with caution.');
        }
      }

      // Build deal based on who is creating it
      const dealData = isBuyer
        ? {
            title,
            description: description || '',
            price,
            buyerId: profile?.uid,
            buyerName: profile?.displayName || profile?.email || 'Buyer',
            buyerEmail: profile?.email,
            sellerId: partyExists ? partyData!.uid : '',
            sellerName: partyExists ? partyData!.displayName : '',
            sellerEmail: otherPartyEmail,
            createdBy: 'buyer',
            buyerCity: isBuyer ? city : '',
            sellerCity: '',
            status: partyExists ? 'active' : 'waiting',
            milestone: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : {
            // Seller creates deal, invites buyer
            title,
            description: description || '',
            price,
            sellerId: profile?.uid,
            sellerName: profile?.displayName || profile?.email || 'Seller',
            sellerEmail: profile?.email,
            buyerId: partyExists ? partyData!.uid : '',
            buyerName: partyExists ? partyData!.displayName : '',
            buyerEmail: otherPartyEmail,
            createdBy: 'seller',
            buyerCity: '',
            sellerCity: isSeller ? city : '',
            status: partyExists ? 'active' : 'waiting',
            milestone: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      const docRef = await addDoc(collection(db, 'deals'), dealData);

      // In-app notification if other party exists
      if (partyExists && partyData) {
        const notifBody = isBuyer
          ? `${profile?.displayName || 'A buyer'} has invited you to a secure deal: "${title}" for ${price.toLocaleString()} FCFA.`
          : `${profile?.displayName || 'A seller'} has created a deal for you: "${title}" for ${price.toLocaleString()} FCFA. Join to review and pay.`;

        await addDoc(collection(db, 'notifications', partyData.uid, 'items'), {
          userId: partyData.uid,
          type: 'deal_invite',
          title: 'New Deal Room Invitation',
          body: notifBody,
          dealId: docRef.id,
          read: false,
          createdAt: new Date().toISOString(),
        });

        toast.success(`Deal created! ${partyData.displayName} has been notified.`);
      }

      // Email invite if other party not in system
      if (!partyExists) {
        try {
          await sendDealInviteEmail({
            sellerEmail: otherPartyEmail,
            sellerName: otherPartyEmail.split('@')[0],
            buyerName: profile?.displayName || 'A user',
            productTitle: title,
            price,
            dealId: docRef.id,
          });
          toast.success(`Deal created! An invite has been sent to ${otherPartyEmail}.`);
        } catch (emailError) {
          console.error('Email send failed:', emailError);
          toast.warning('Deal created, but the invite email failed. Share the link manually.');
        }
      }

      setShowCreateModal(false);
      setCity('');
      onNavigate('deal-room', docRef.id);

    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'deals');
    } finally {
      setCreating(false);
    }
  };

  const otherPartyLabel = isBuyer ? "Seller's Email Address" : "Buyer's Email Address";
  const otherPartyPlaceholder = isBuyer ? 'seller@example.cm' : 'buyer@example.cm';
  const createBtnLabel = isBuyer ? 'Create & Notify Seller' : 'Create & Notify Buyer';
  const modalTitle = isBuyer ? 'New Transaction' : 'Create a Deal';
  const modalHint = isBuyer
    ? "Enter the seller's email. They'll get an in-app notification or invite email."
    : "Enter the buyer's email. They'll get an in-app notification or invite email to review and pay.";

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen font-display">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-primary/5 bg-white dark:bg-slate-900 px-6 py-4 lg:px-40 sticky top-0 z-50">
        <div className="flex items-center gap-3 text-primary">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">TrustDeals</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold text-slate-900 dark:text-white">{profile?.displayName}</span>
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{profile?.role}</span>
          </div>
          <WalletBadge profile={profile} onOpen={() => setShowWallet(true)} />
          <NotificationBell profile={profile} onOpen={() => setShowNotifications(true)} />
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── VERIFICATION BANNER ── */}
      {profile && ['buyer', 'seller', 'rider'].includes(profile.role) && (
        <VerificationBanner
          profile={profile}
          onStartVerification={() => setShowVerificationWizard(true)}
        />
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 lg:px-40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Active Deals</h1>
            <p className="text-slate-500 mt-1">Manage your secure XAF transactions</p>
          </div>
          {/* Both buyers and sellers can create deals */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-xl shadow-primary/20 hover:translate-y-[-2px] transition-all"
          >
            <Plus className="w-5 h-5" />
            {isBuyer ? 'New Transaction' : 'Create a Deal'}
          </button>
        </div>

        {profile?.role === 'seller' && (
          <div className="mb-8">
            <SellerDebtBanner
              profile={profile}
              onViewDeal={(dealId) => onNavigate('deal-room', dealId)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-20 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No active deals</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              {isBuyer
                ? 'Start a new secure transaction to protect your XAF payments.'
                : 'Create a deal and invite a buyer, or wait for a buyer to invite you.'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} profile={profile} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </main>

      {/* ── NOTIFICATION CENTER ── */}
      {showNotifications && (
        <NotificationCenter
          profile={profile}
          onNavigate={onNavigate}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* ── WALLET PANEL ── */}
      {showWallet && (
        <WalletPanel
          profile={profile}
          onClose={() => setShowWallet(false)}
        />
      )}

      {/* ── CREATE DEAL MODAL ── */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-800 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{modalTitle}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl mb-6">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{modalHint}</p>
            </div>

            <form onSubmit={createDeal} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{otherPartyLabel}</label>
                <input
                  name="otherPartyEmail"
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-900 dark:text-slate-100"
                  placeholder={otherPartyPlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Product / Deal Title</label>
                <input
                  name="title"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-900 dark:text-slate-100"
                  placeholder="e.g. iPhone 14 Pro Max"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Price (XAF / FCFA)</label>
                <input
                  name="price"
                  type="number"
                  required
                  min="1"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-900 dark:text-slate-100"
                  placeholder="e.g. 450000"
                />
              </div>

              <CitySelector
                label={isBuyer ? "Delivery City" : "Your Pickup City"}
                value={city}
                onChange={setCity}
                className="mb-4"
              />

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-slate-900 dark:text-slate-100"
                  placeholder="Any details about the product or deal..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : createBtnLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VERIFICATION WIZARD ── */}
      {showVerificationWizard && profile && (
        <VerificationWizard
          profile={profile}
          onComplete={() => setShowVerificationWizard(false)}
        />
      )}
    </div>
  );
}

// ── DEAL CARD ──────────────────────────────────────────────
function DealCard({ deal, profile, onNavigate }: {
  deal: Deal;
  profile: UserProfile | null;
  onNavigate: (page: string, dealId?: string) => void;
}) {
  const getIcon = () => {
    const t = deal.title.toLowerCase();
    if (t.includes('macbook') || t.includes('laptop') || t.includes('phone') || t.includes('iphone')) return <Diamond className="text-slate-500" />;
    if (t.includes('design') || t.includes('brand')) return <Brush className="text-slate-500" />;
    if (t.includes('part') || t.includes('car') || t.includes('toyota')) return <Car className="text-slate-500" />;
    return <ShieldCheck className="text-slate-500" />;
  };

  const isWaiting = deal.status === 'WAITING';
  const isFunded  = deal.status === 'PAYMENT_LOCKED';

  const isBuyer  = deal.buyerId  === profile?.uid;
  const counterpartId = isBuyer ? (deal.sellerId ?? null) : (deal.buyerId ?? null);
  const { counterpartPresence } = usePresence({
    profile,
    dealId: deal.id,
    counterpartId,
  });

  const statusBadge = () => {
    if (isWaiting) return (
      <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" />
        Waiting · {deal.createdBy === 'buyer' ? deal.sellerEmail : deal.buyerEmail}
      </span>
    );
    if (deal.status === 'PRODUCT_CONFIRMED') return (
      <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
        <ShieldCheck className="w-3 h-3" />
        Ready to Fund
      </span>
    );
    if (isFunded) return (
      <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
        Escrow Funded
      </span>
    );
    return (
      <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
        {deal.status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-6 hover:shadow-lg transition-all shadow-sm group">
      <div className="flex items-start justify-between mb-6">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{deal.title}</h4>
              <PresenceBadge presence={counterpartPresence} compact />
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <User className="w-3 h-3" />
              #{deal.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <p className="text-lg font-bold text-primary dark:text-slate-200">{deal.price.toLocaleString()} FCFA</p>
      </div>

      <div className="mb-3">{statusBadge()}</div>

      <div className="mb-3">
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-6 overflow-hidden">
          <div 
            className="bg-primary h-full rounded-full transition-all duration-500" 
            style={{ width: `${
              deal.status === 'COMPLETED' ? 100 :
              deal.status === 'AT_BUYER_LOCATION' ? 75 :
              deal.status === 'IN_TRANSIT' ? 50 :
              deal.status === 'PAYMENT_LOCKED' ? 25 : 10
            }%` }}
          ></div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
        <div className="flex -space-x-2.5">
          <img className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" src={`https://picsum.photos/seed/${deal.buyerId || 'buyer'}/100/100`} alt="Buyer" />
          {deal.sellerId ? (
            <img className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" src={`https://picsum.photos/seed/${deal.sellerId}/100/100`} alt="Seller" />
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>
        <button
          onClick={() => onNavigate('deal-room', deal.id)}
          className="text-xs font-bold text-primary dark:text-slate-300 hover:text-accent flex items-center gap-1 transition-colors"
        >
          {isWaiting ? 'VIEW INVITE LINK' : 
           (isBuyer && deal.status === 'PRODUCT_CONFIRMED') ? 'FUND ESCROW' : 'GO TO ROOM'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
