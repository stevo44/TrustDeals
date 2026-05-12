// import { useState, useEffect, useRef } from 'react';
// import { db } from '../lib/firebase';
// import { doc, onSnapshot, collection, query, orderBy, addDoc, updateDoc } from 'firebase/firestore';
// import { Deal, Message, UserProfile } from '../types';
// import { ShieldCheck, Lock, Send, PlusCircle, Check, Package, Bell, Settings, ArrowLeft, Copy } from 'lucide-react';
// import { toast } from 'sonner';
// import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

// interface DealRoomProps {
//   dealId: string;
//   profile: UserProfile | null;
//   onNavigate: (page: string) => void;
// }

// export default function DealRoom({ dealId, profile, onNavigate }: DealRoomProps) {
//   const [deal, setDeal] = useState<Deal | null>(null);
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [newMessage, setNewMessage] = useState('');
//   const [otp, setOtp] = useState(['', '', '', '', '', '']);
//   const [unauthorized, setUnauthorized] = useState(false);
//   const chatEndRef = useRef<HTMLDivElement>(null);

//   // =============================================
//   // REAL-TIME DEAL LISTENER
//   // Firestore onSnapshot keeps both buyer and seller
//   // in sync automatically — no polling needed
//   // =============================================
//   useEffect(() => {
//     const dealRef = doc(db, 'deals', dealId);

//     const unsubscribeDeal = onSnapshot(dealRef, (snapshot) => {
//       if (!snapshot.exists()) {
//         onNavigate('dashboard');
//         return;
//       }

//       const data = { id: snapshot.id, ...snapshot.data() } as Deal;

//       // Guard: only buyer and seller can be in this room.
//       // Note: seller may not have joined yet (sellerId is empty while 'waiting')
//       // so we allow the buyer through even when sellerId is empty.
//       const isBuyer = data.buyerId === profile?.uid;
//       const isSeller = data.sellerId === profile?.uid;
//       const isWaitingAndBuyer = data.status === 'waiting' && isBuyer;

//       if (!isBuyer && !isSeller && !isWaitingAndBuyer) {
//         setUnauthorized(true);
//         return;
//       }

//       setDeal(data);
//     });

//     // =============================================
//     // REAL-TIME CHAT LISTENER
//     // Messages stored as subcollection: deals/{dealId}/messages
//     // =============================================
//     const messagesQuery = query(
//       collection(db, 'deals', dealId, 'messages'),
//       orderBy('timestamp', 'asc')
//     );

//     const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
//       const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
//       setMessages(msgs);
//     });

//     return () => {
//       unsubscribeDeal();
//       unsubscribeMessages();
//     };
//   }, [dealId, profile?.uid]);

//   // Auto-scroll chat to bottom on new messages
//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   const isBuyer = deal?.buyerId === profile?.uid;

//   // =============================================
//   // COPY INVITE LINK
//   // Generates: yourdomain.com/join/{dealId}
//   // App.tsx intercepts this on load and joins the deal
//   // =============================================
//   const copyInviteLink = () => {
//     const link = `${window.location.origin}/join/${dealId}`;
//     navigator.clipboard.writeText(link);
//     toast.success('Invite link copied! Share it with the seller.');
//   };

//   // =============================================
//   // SEND MESSAGE
//   // =============================================
//   const sendMessage = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!newMessage.trim() || !profile) return;

//     try {
//       await addDoc(collection(db, 'deals', dealId, 'messages'), {
//         dealId,
//         senderId: profile.uid,
//         senderName: profile.displayName || 'User',
//         text: newMessage,
//         timestamp: new Date().toISOString(),
//         type: 'text',
//       });
//       setNewMessage('');
//     } catch (error) {
//       handleFirestoreError(error, OperationType.CREATE, `deals/${dealId}/messages`);
//     }
//   };

//   // =============================================
//   // OTP INPUT — auto-advance to next box
//   // =============================================
//   const handleOtpChange = (index: number, value: string) => {
//     if (value.length > 1) return;
//     const newOtp = [...otp];
//     newOtp[index] = value;
//     setOtp(newOtp);

//     if (value && index < 5) {
//       document.getElementById(`otp-${index + 1}`)?.focus();
//     }
//   };

//   // =============================================
//   // RELEASE FUNDS
//   // Only buyer can do this. Updates Firestore deal
//   // status to 'finalized' and posts a system message.
//   // =============================================
//   const releaseFunds = async () => {
//     if (otp.join('').length !== 6 || !isBuyer) return;
//     try {
//       await updateDoc(doc(db, 'deals', dealId), {
//         status: 'finalized',
//         milestone: 100,
//         updatedAt: new Date().toISOString(),
//       });
//       await addDoc(collection(db, 'deals', dealId, 'messages'), {
//         dealId,
//         senderId: 'system',
//         text: 'Transaction Finalized. Funds released to seller.',
//         timestamp: new Date().toISOString(),
//         type: 'system',
//       });
//       toast.success('Funds released successfully!');
//     } catch (error) {
//       handleFirestoreError(error, OperationType.UPDATE, `deals/${dealId}`);
//     }
//   };

//   // =============================================
//   // UNAUTHORIZED STATE
//   // =============================================
//   if (unauthorized) {
//     return (
//       <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background-light dark:bg-background-dark">
//         <ShieldCheck className="w-12 h-12 text-slate-300" />
//         <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Access Denied</p>
//         <p className="text-sm text-slate-400">You are not a participant in this deal.</p>
//         <button
//           onClick={() => onNavigate('dashboard')}
//           className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold"
//         >
//           Back to Dashboard
//         </button>
//       </div>
//     );
//   }

//   // Loading state
//   if (!deal) return null;

//   // =============================================
//   // WAITING STATE
//   // Buyer sees this screen until seller joins.
//   // Shows the invite link to copy and share.
//   // Firestore listener will auto-update once seller joins.
//   // =============================================
//   if (deal.status === 'waiting' && isBuyer) {
//     return (
//       <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background-light dark:bg-background-dark px-6">
//         <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center">
//           <ShieldCheck className="w-8 h-8 text-primary" />
//         </div>
//         <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Waiting for seller to join</p>
//         <p className="text-sm text-slate-400 text-center max-w-sm">
//           Share the invite link below with your seller. The deal room will activate automatically once they join.
//         </p>

//         {/* Invite link display */}
//         <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-500 break-all font-mono">
//           {`${window.location.origin}/join/${dealId}`}
//         </div>

//         <button
//           onClick={copyInviteLink}
//           className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-primary/20"
//         >
//           <Copy className="w-4 h-4" />
//           Copy Invite Link
//         </button>

//         {/* Pulse indicator — waiting */}
//         <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
//           <span className="relative flex h-2 w-2">
//             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
//             <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
//           </span>
//           Waiting for seller to open the link...
//         </div>

//         <button
//           onClick={() => onNavigate('dashboard')}
//           className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
//         >
//           Back to Dashboard
//         </button>
//       </div>
//     );
//   }

//   // =============================================
//   // MAIN DEAL ROOM UI
//   // Three-panel layout: Product | Chat | Timeline+OTP
//   // =============================================
//   return (
//     <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
//       {/* Header */}
//       <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shrink-0 shadow-sm z-20">
//         <div className="flex items-center gap-4">
//           <button
//             onClick={() => onNavigate('dashboard')}
//             className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
//           >
//             <ArrowLeft className="w-5 h-5" />
//           </button>
//           <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
//             <ShieldCheck className="w-6 h-6" />
//           </div>
//           <div>
//             <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight">
//               Secure Deal Room #{deal.id.slice(0, 4).toUpperCase()}
//             </h1>
//             <p className="text-[10px] text-accent font-bold uppercase tracking-widest">Escrow Protection Active</p>
//           </div>
//         </div>

//         <div className="flex items-center gap-4">
//           {/* Participant avatars */}
//           <div className="flex -space-x-3 mr-2">
//             <img
//               className="size-9 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"
//               src={`https://picsum.photos/seed/${deal.buyerId}/100/100`}
//               alt="Buyer"
//             />
//             {deal.sellerId ? (
//               <img
//                 className="size-9 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"
//                 src={`https://picsum.photos/seed/${deal.sellerId}/100/100`}
//                 alt="Seller"
//               />
//             ) : (
//               <div className="size-9 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
//                 <span className="text-[10px] font-bold text-slate-400">?</span>
//               </div>
//             )}
//           </div>

//           {/* Buyer can re-copy invite link from header even after entering the room */}
//           {isBuyer && deal.status !== 'finalized' && (
//             <button
//               onClick={copyInviteLink}
//               className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
//               title="Copy invite link"
//             >
//               <Copy className="w-5 h-5 text-slate-600 dark:text-slate-400" />
//             </button>
//           )}
//           <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
//             <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
//             <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
//           </button>
//           <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
//             <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
//           </button>
//         </div>
//       </header>

//       <main className="flex flex-1 overflow-hidden p-6 gap-6">
//         {/* ==================== LEFT: Product Details ==================== */}
//         <aside className="w-80 flex flex-col gap-6 overflow-y-auto no-scrollbar">
//           <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
//             <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-5">Product Details</h2>
//             <div className="aspect-square rounded-lg bg-slate-50 dark:bg-slate-800/50 mb-5 overflow-hidden relative group border border-slate-100 dark:border-slate-800">
//               <img
//                 alt="Product"
//                 className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
//                 src={`https://picsum.photos/seed/${deal.id}/400/400`}
//               />
//               <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md font-medium">
//                 1/1
//               </div>
//             </div>
//             <div className="space-y-4">
//               <div>
//                 <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Item</p>
//                 <p className="text-sm font-semibold leading-relaxed">{deal.title}</p>
//               </div>
//               {deal.description && (
//                 <div>
//                   <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Description</p>
//                   <p className="text-xs text-slate-500 leading-relaxed">{deal.description}</p>
//                 </div>
//               )}
//               <div>
//                 <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Price</p>
//                 <p className="text-xl font-bold text-primary dark:text-white">{deal.price.toLocaleString()} FCFA</p>
//               </div>
//               <div>
//                 <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Seller</p>
//                 <p className="text-sm font-semibold">{deal.sellerName || (deal.sellerId ? 'Connected' : '— Awaiting seller')}</p>
//               </div>
//               <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
//                 <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-3">Merchant Verification</p>
//                 <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
//                   <div className="size-9 rounded-full bg-accent/10 flex items-center justify-center">
//                     <ShieldCheck className="text-accent w-5 h-5" />
//                   </div>
//                   <div>
//                     <p className="text-xs font-bold">Verified Trader</p>
//                     <p className="text-[10px] text-slate-500">4.8/5 • 156 Trades</p>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Action buttons — only show when deal is active */}
//           {deal.status !== 'waiting' && deal.status !== 'finalized' && (
//             <div className="space-y-3">
//               <button className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-slate-800 transition-all transform active:scale-[0.98]">
//                 Confirm Product Details
//               </button>
//               <button className="w-full py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
//                 Request Modifications
//               </button>
//             </div>
//           )}
//         </aside>

//         {/* ==================== CENTER: Chat ==================== */}
//         <section className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
//           <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30">
//             <div className="flex items-center gap-3">
//               <span className="relative flex h-2.5 w-2.5">
//                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
//                 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
//               </span>
//               <span className="text-sm font-bold tracking-tight">Live Secure Session</span>
//             </div>
//             <div className="flex items-center gap-2">
//               <Lock className="w-4 h-4 text-slate-400" />
//               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AES-256 Encrypted</span>
//             </div>
//           </div>

//           {/* Messages */}
//           <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
//             {messages.length === 0 && (
//               <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
//                 <ShieldCheck className="w-10 h-10 text-slate-300" />
//                 <p className="text-sm font-bold text-slate-400">Secure channel ready</p>
//                 <p className="text-xs text-slate-400">Messages are end-to-end encrypted</p>
//               </div>
//             )}
//             {messages.map((msg) => (
//               <div
//                 key={msg.id}
//                 className={`flex gap-4 max-w-[85%] ${msg.senderId === profile?.uid ? 'flex-row-reverse ml-auto' : ''}`}
//               >
//                 {msg.type === 'system' ? (
//                   <div className="flex justify-center w-full">
//                     <div className="bg-accent/5 border border-accent/10 rounded-full px-5 py-1.5 flex items-center gap-3">
//                       <ShieldCheck className="text-accent w-4 h-4" />
//                       <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{msg.text}</span>
//                     </div>
//                   </div>
//                 ) : (
//                   <>
//                     <div className={`size-9 rounded-full shrink-0 overflow-hidden shadow-sm border border-white dark:border-slate-800 ${msg.senderId === profile?.uid ? 'bg-primary text-white flex items-center justify-center text-[10px] font-bold' : 'bg-slate-200'}`}>
//                       {msg.senderId === profile?.uid
//                         ? 'ME'
//                         : <img src={`https://picsum.photos/seed/${msg.senderId}/100/100`} alt="Sender" />
//                       }
//                     </div>
//                     <div className={`space-y-1 ${msg.senderId === profile?.uid ? 'flex flex-col items-end' : ''}`}>
//                       <div className={`p-4 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 ${msg.senderId === profile?.uid ? 'bg-primary text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 rounded-tl-none'}`}>
//                         <p className="text-sm leading-relaxed">{msg.text}</p>
//                       </div>
//                       <span className="text-[10px] text-slate-400 font-medium">
//                         {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                       </span>
//                     </div>
//                   </>
//                 )}
//               </div>
//             ))}
//             <div ref={chatEndRef} />
//           </div>

//           {/* Chat input */}
//           <form onSubmit={sendMessage} className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
//             <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-1.5 focus-within:ring-2 ring-primary/10 transition-all shadow-inner">
//               <button type="button" className="text-slate-400 hover:text-primary transition-colors">
//                 <PlusCircle className="w-6 h-6" />
//               </button>
//               <input
//                 className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 placeholder:text-slate-400 outline-none"
//                 placeholder="Type a secure message..."
//                 type="text"
//                 value={newMessage}
//                 onChange={(e) => setNewMessage(e.target.value)}
//               />
//               <button
//                 type="submit"
//                 className="bg-primary text-white size-10 rounded-xl flex items-center justify-center hover:bg-slate-800 shadow-md transition-all"
//               >
//                 <Send className="w-5 h-5" />
//               </button>
//             </div>
//           </form>
//         </section>

//         {/* ==================== RIGHT: Timeline + OTP ==================== */}
//         <aside className="w-80 flex flex-col gap-6 overflow-y-auto no-scrollbar">
//           {/* Transaction timeline */}
//           <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
//             <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-8">Transaction Lifecycle</h2>
//             <div className="relative space-y-0">
//               <div className="absolute left-[13px] top-2 bottom-2 w-[1px] bg-slate-100 dark:bg-slate-800"></div>
//               <TimelineStep completed title="Deal Created" time="Deal room opened" />
//               <TimelineStep
//                 completed={!!deal.sellerId && deal.sellerId !== ''}
//                 title="Seller Joined"
//                 time={deal.sellerId ? `${deal.sellerName || 'Seller'} connected` : 'Awaiting seller'}
//               />
//               <TimelineStep completed={deal.milestone >= 25} title="Escrow Funded" time="Payment locked" />
//               <TimelineStep active={deal.status === 'transit'} title="Dispatch in Progress" time="Awaiting tracking" />
//               <TimelineStep completed={deal.status === 'delivered' || deal.status === 'finalized'} title="Buyer Inspection" time="Pending arrival" />
//               <TimelineStep completed={deal.status === 'finalized'} title="Funds Released" time="Final step" />
//             </div>
//           </div>

//           {/* OTP release — only visible to buyer, only when deal is active */}
//           {isBuyer && deal.status !== 'waiting' && (
//             <div className="bg-primary/5 dark:bg-slate-900/50 border border-primary/10 rounded-2xl p-6 shadow-sm">
//               <div className="flex items-center gap-3 mb-4">
//                 <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
//                   <Lock className="text-primary w-5 h-5" />
//                 </div>
//                 <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-slate-300">
//                   Release Verification
//                 </h3>
//               </div>
//               <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed font-medium">
//                 Enter the 6-digit code received by SMS to confirm receipt and release the FCFA funds.
//               </p>
//               <div className="flex gap-2 justify-between mb-5">
//                 {otp.map((digit, i) => (
//                   <input
//                     key={i}
//                     id={`otp-${i}`}
//                     className="size-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-primary dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm outline-none"
//                     maxLength={1}
//                     type="text"
//                     value={digit}
//                     onChange={(e) => handleOtpChange(i, e.target.value)}
//                   />
//                 ))}
//               </div>
//               <button
//                 onClick={releaseFunds}
//                 disabled={otp.join('').length !== 6 || deal.status === 'finalized'}
//                 className={`w-full py-3 font-bold text-[11px] uppercase tracking-widest rounded-xl transition-all ${
//                   otp.join('').length === 6 && deal.status !== 'finalized'
//                     ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-slate-800'
//                     : 'bg-primary/20 text-primary dark:text-slate-300 cursor-not-allowed opacity-60'
//                 }`}
//               >
//                 {deal.status === 'finalized' ? '✓ Funds Released' : 'Release Funds (FCFA)'}
//               </button>
//             </div>
//           )}

//           {/* Seller sees a note instead of OTP box */}
//           {!isBuyer && deal.status !== 'waiting' && deal.status !== 'finalized' && (
//             <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
//               <div className="flex items-center gap-3 mb-3">
//                 <Lock className="text-slate-400 w-5 h-5" />
//                 <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Awaiting Buyer Confirmation</h3>
//               </div>
//               <p className="text-[11px] text-slate-400 leading-relaxed">
//                 The buyer will enter their OTP code to confirm receipt and release the funds to you.
//               </p>
//             </div>
//           )}
//         </aside>
//       </main>
//     </div>
//   );
// }

// // =============================================
// // TIMELINE STEP COMPONENT
// // =============================================
// function TimelineStep({
//   completed,
//   active,
//   title,
//   time,
// }: {
//   completed?: boolean;
//   active?: boolean;
//   title: string;
//   time: string;
// }) {
//   return (
//     <div className="relative flex gap-5 pb-10 last:pb-0">
//       <div className={`size-7 rounded-full flex items-center justify-center z-10 shadow-sm flex-shrink-0 ${
//         completed
//           ? 'bg-green-500 ring-4 ring-green-500/10'
//           : active
//           ? 'bg-primary ring-4 ring-primary/20'
//           : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
//       }`}>
//         {completed
//           ? <Check className="text-white w-4 h-4" />
//           : active
//           ? <ShieldCheck className="text-white w-4 h-4 animate-spin-slow" />
//           : <Package className="text-slate-400 w-4 h-4" />
//         }
//       </div>
//       <div className="pt-0.5">
//         <p className={`text-sm font-bold ${
//           completed ? 'text-slate-900 dark:text-slate-100' :
//           active ? 'text-primary dark:text-white' :
//           'text-slate-400'
//         }`}>
//           {title}
//         </p>
//         <p className={`text-[10px] font-medium mt-0.5 ${
//           active ? 'text-accent font-bold uppercase tracking-wider' : 'text-slate-400'
//         }`}>
//           {time}
//         </p>
//       </div>
//     </div>
//   );
// }


import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import {
  doc, onSnapshot, collection, query,
  orderBy, addDoc, updateDoc,
} from 'firebase/firestore';
import { Deal, Message, UserProfile, BuyerPaymentForm, SellerPayoutForm } from '../types';
import {
  ShieldCheck, Lock, Send, Check, Package, Bell, Settings,
  ArrowLeft, Copy, X, Wifi, WifiOff, Clock, ImagePlus, Upload,
  Wallet, KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { initializePayment, checkPaymentStatus, formatCamPhone } from '../lib/notchpay';
import { usePresence } from '../hooks/usePresence';
import PresenceBadge from './PresenceBadge';
import NotificationCenter, { NotificationBell } from './NotificationCenter';
import WalletPanel, { WalletBadge } from './WalletPanel';
import { notify, generateOTP } from '../lib/notifications';
import { lockEscrow, releaseEscrow, calcPlatformFee, calcSellerReceives } from '../lib/wallet';

interface DealRoomProps {
  dealId   : string;
  profile  : UserProfile | null;
  onNavigate: (page: string) => void;
}

export default function DealRoom({ dealId, profile, onNavigate }: DealRoomProps) {
  const [deal,             setDeal]             = useState<Deal | null>(null);
  const [messages,         setMessages]         = useState<Message[]>([]);
  const [newMessage,       setNewMessage]       = useState('');
  const [otp,              setOtp]              = useState(['', '', '', '', '', '']);
  const [unauthorized,     setUnauthorized]     = useState(false);
  const [showPresencePanel,setShowPresencePanel]= useState(false);
  const [showNotifications,setShowNotifications]= useState(false);
  const [showWallet,       setShowWallet]       = useState(false);

  // Product image upload (buyer)
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [productImagePreview,   setProductImagePreview]   = useState<string | null>(null);

  // Chat image upload
  const [chatImageUploading, setChatImageUploading] = useState(false);

  // Payment modal (buyer)
  const [showPayModal,  setShowPayModal]  = useState(false);
  const [payForm,       setPayForm]       = useState<BuyerPaymentForm>({ momoNumber: '', momoName: '', channel: 'cm.mtn' });
  const [paying,        setPaying]        = useState(false);
  const [pollingRef,    setPollingRef]    = useState<ReturnType<typeof setInterval> | null>(null);

  // Payout modal (seller)
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm,      setPayoutForm]      = useState<SellerPayoutForm>({ momoNumber: '', momoName: '', channel: 'cm.mtn' });
  const [payingOut,       setPayingOut]       = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef    = useRef<HTMLInputElement>(null);

  // ── Determine counterpart ID ─────────────────────────────────────────────
  const isBuyer  = deal?.buyerId  === profile?.uid;
  const isSeller = deal?.sellerId === profile?.uid;
  const counterpartId = isBuyer ? (deal?.sellerId ?? null) : (deal?.buyerId ?? null);

  // ── Real-time Presence (Socket.io) ───────────────────────────────────────
  const { counterpartPresence, isConnected } = usePresence({
    profile,
    dealId,
    counterpartId,
  });

  // ── Real-time deal + messages (Firestore) ────────────────────────────────
  useEffect(() => {
    const dealRef = doc(db, 'deals', dealId);

    const unsubscribeDeal = onSnapshot(dealRef, (snapshot) => {
      if (!snapshot.exists()) { onNavigate('dashboard'); return; }

      const data = { id: snapshot.id, ...snapshot.data() } as Deal;

      const isBuyerSnap  = data.buyerId  === profile?.uid;
      const isSellerSnap = data.sellerId === profile?.uid;
      const isInvitedBuyer = !data.buyerId && data.buyerEmail === profile?.email;
      const isInvitedSeller = !data.sellerId && data.sellerEmail === profile?.email;
      
      const waitingAndCreator =
        data.status === 'waiting' &&
        ((data.createdBy === 'buyer' && isBuyerSnap) ||
         (data.createdBy === 'seller' && isSellerSnap));

      // Grant access if they match ID OR match invited email
      if (!isBuyerSnap && !isSellerSnap && !waitingAndCreator && !isInvitedBuyer && !isInvitedSeller) {
        setUnauthorized(true);
        return;
      }

      setDeal(data);
    });

    const msgsQ = query(
      collection(db, 'deals', dealId, 'messages'),
      orderBy('timestamp', 'asc'),
    );
    const unsubscribeMsgs = onSnapshot(msgsQ, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });

    return () => { unsubscribeDeal(); unsubscribeMsgs(); };
  }, [dealId, profile?.uid, profile?.email]);

  // ── Auto-join & Activation ───────────────────────────────────────────────
  // If user is inside but ID is missing, or both are in but status is 'waiting'
  useEffect(() => {
    if (!deal || !profile) return;

    const runCheck = async () => {
      const dealRef = doc(db, 'deals', dealId);
      let needsUpdate = false;
      const updates: any = {};

      // Case 1: Invited user is in, but UID isn't saved yet (Auto-join)
      if (deal.status === 'waiting') {
        if (!deal.buyerId && deal.buyerEmail === profile.email) {
          updates.buyerId = profile.uid;
          updates.buyerName = profile.displayName || profile.email;
          updates.status = 'active';
          updates.milestone = 10;
          needsUpdate = true;
        } else if (!deal.sellerId && deal.sellerEmail === profile.email) {
          updates.sellerId = profile.uid;
          updates.sellerName = profile.displayName || profile.email;
          updates.status = 'active';
          updates.milestone = 10;
          needsUpdate = true;
        }
      }

      // Case 2: Both IDs are present but status is stuck in 'waiting'
      if (deal.status === 'waiting' && deal.buyerId && deal.sellerId) {
        updates.status = 'active';
        updates.milestone = 10;
        needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          updates.updatedAt = new Date().toISOString();
          await updateDoc(dealRef, updates);
          toast.success('Joined secure deal room.');
        } catch (err) {
          console.error('Auto-join failed:', err);
        }
      }
    };

    runCheck();
  }, [deal, profile?.uid]);

  useEffect(() => () => { if (pollingRef) clearInterval(pollingRef); }, [pollingRef]);

  useEffect(() => () => { if (pollingRef) clearInterval(pollingRef); }, [pollingRef]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Copy invite link ─────────────────────────────────────────────────────
  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${dealId}`);
    toast.success('Invite link copied! Share it with the other party.');
  };

  // ── Upload image to Cloudinary (free tier) or use base64 preview ────────────
  // For demo: convert to base64 data URL and store directly in Firestore
  const uploadImageAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ── Product image upload (buyer) ─────────────────────────────────────────
  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deal) return;
    if (!isBuyer) { toast.error('Only the buyer can upload a product image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return; }

    setProductImageUploading(true);
    try {
      const dataUrl = await uploadImageAsBase64(file);
      setProductImagePreview(dataUrl);
      await updateDoc(doc(db, 'deals', dealId), {
        productImageUrl: dataUrl,
        updatedAt: new Date().toISOString(),
      });
      // System message
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId, senderId: 'system',
        text: `${profile?.displayName || 'Buyer'} uploaded a product image.`,
        timestamp: new Date().toISOString(), type: 'system',
      });
      toast.success('Product image uploaded!');
    } catch (err) {
      toast.error('Failed to upload image.');
    } finally {
      setProductImageUploading(false);
    }
  };

  // ── Chat image upload (both parties) ─────────────────────────────────────
  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return; }

    setChatImageUploading(true);
    try {
      const dataUrl = await uploadImageAsBase64(file);
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId,
        senderId  : profile.uid,
        senderName: profile.displayName || 'User',
        text      : '📷 Image',
        imageUrl  : dataUrl,
        timestamp : new Date().toISOString(),
        type      : 'image',
      });
    } catch (err) {
      toast.error('Failed to send image.');
    } finally {
      setChatImageUploading(false);
      if (chatImageInputRef.current) chatImageInputRef.current.value = '';
    }
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;
    try {
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId,
        senderId  : profile.uid,
        senderName: profile.displayName || 'User',
        text      : newMessage,
        timestamp : new Date().toISOString(),
        type      : 'text',
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `deals/${dealId}/messages`);
    }
  };

  // ── OTP input ────────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
  };

  // ── Initiate payment (buyer) ─────────────────────────────────────────────
  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal || !profile) return;
    setPaying(true);
    try {
      const phone  = formatCamPhone(payForm.momoNumber);
      const result = await initializePayment({
        amount: deal.price, email: profile.email, phone,
        name: payForm.momoName, channel: payForm.channel,
        dealId, description: `Payment for: ${deal.title}`,
      });
      const reference = result?.transaction?.reference;
      if (!reference) throw new Error('No payment reference returned.');

      // Generate OTP immediately on funding
      const otp6 = generateOTP();
      const platformFee   = calcPlatformFee(deal.price);
      const sellerAmount  = calcSellerReceives(deal.price);

      await updateDoc(doc(db, 'deals', dealId), {
        paymentReference: reference,
        releaseOtp      : otp6,
        platformFee,
        sellerReceives  : sellerAmount,
        updatedAt       : new Date().toISOString(),
      });

      toast.info('MoMo prompt sent to your phone. Approve it to fund the escrow.');
      setShowPayModal(false);

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const sr     = await checkPaymentStatus(reference);
          const status = sr?.transaction?.status;
          if (status === 'complete') {
            clearInterval(interval);
            await updateDoc(doc(db, 'deals', dealId), {
              status: 'funded', milestone: 25, updatedAt: new Date().toISOString(),
            });
            await addDoc(collection(db, 'deals', dealId, 'messages'), {
              dealId, senderId: 'system',
              text     : `Escrow funded! ${deal.price.toLocaleString()} FCFA held securely.`,
              timestamp: new Date().toISOString(), type: 'system',
            });

            // Lock escrow in buyer's wallet
            await lockEscrow(profile.uid, deal.price, dealId);

            // Notify both parties
            await notify.dealFunded(profile.uid, dealId, deal.price);
            if (deal.sellerId) {
              await notify.dealFunded(deal.sellerId, dealId, deal.price);
              // Send OTP only to seller
              await notify.otpGenerated(deal.sellerId, dealId, otp6);
            }

            toast.success(`Payment confirmed! Escrow funded. OTP sent to seller.`);
          } else if (status === 'failed' || status === 'expired' || attempts >= 24) {
            clearInterval(interval);
            toast.error('Payment timed out or failed. Please try again.');
          }
        } catch { /* network hiccup — keep polling */ }
      }, 5000);

      setPollingRef(interval);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payment');
    } finally {
      setPaying(false);
    }
  };

  // ── Seller payout — only after buyer confirms delivery ───────────────────
  const handleSellerPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal || !profile) return;

    // Guard: only allowed when delivered AND buyer has confirmed with OTP
    if (deal.status !== 'delivered' || !deal.buyerConfirmedDelivery) {
      toast.error('Funds can only be requested after the buyer confirms delivery with OTP.');
      return;
    }

    setPayingOut(true);
    try {
      const platformFee  = deal.platformFee  ?? calcPlatformFee(deal.price);
      const sellerAmount = deal.sellerReceives ?? calcSellerReceives(deal.price);

      await updateDoc(doc(db, 'deals', dealId), {
        status: 'finalized', milestone: 100, updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId, senderId: 'system',
        text     : `Deal finalized! ${sellerAmount.toLocaleString()} FCFA released to seller (5% platform fee: ${platformFee.toLocaleString()} FCFA).`,
        timestamp: new Date().toISOString(), type: 'system',
      });

      // Release escrow: debit buyer, credit seller (minus fee)
      if (deal.buyerId) {
        await releaseEscrow(deal.buyerId, profile.uid, deal.price, dealId);
      }

      // Notifications
      await notify.dealFinalized(profile.uid, dealId, sellerAmount);
      if (deal.buyerId) await notify.dealFinalized(deal.buyerId, dealId, sellerAmount);
      await notify.walletCredited(profile.uid, sellerAmount, `Payout for "${deal.title}"`, dealId);

      toast.success(`Funds released! ${sellerAmount.toLocaleString()} FCFA credited (after 5% fee).`);
      setShowPayoutModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deals/${dealId}`);
    } finally {
      setPayingOut(false);
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background-light dark:bg-background-dark">
        <ShieldCheck className="w-12 h-12 text-slate-300" />
        <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Access Denied</p>
        <button onClick={() => onNavigate('dashboard')} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!deal) return null;

  // ── Waiting state ────────────────────────────────────────────────────────
  if (deal.status === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background-light dark:bg-background-dark px-6">
        <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Waiting for other party to join</p>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Share the invite link. The deal room activates automatically once they join.
        </p>
        <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-500 break-all font-mono">
          {`${window.location.origin}/join/${dealId}`}
        </div>
        <button
          onClick={copyInviteLink}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-primary/20"
        >
          <Copy className="w-4 h-4" /> Copy Invite Link
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Waiting for other party to open the link…
        </div>
        <button onClick={() => onNavigate('dashboard')} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN DEAL ROOM
  // ─────────────────────────────────────────────────────────────────────────
  const counterpartLabel = isBuyer ? 'Seller' : 'Buyer';

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight">
              Secure Deal Room #{deal.id.slice(0, 4).toUpperCase()}
            </h1>
            <p className="text-[10px] text-accent font-bold uppercase tracking-widest">Escrow Protection Active</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* ── Live presence pill in header ── */}
          <PresenceStatusPill
            status={counterpartPresence?.status ?? 'not_joined'}
            label={counterpartLabel}
            isSocketConnected={isConnected}
          />

          {/* ── Presence panel toggle ── */}
          <button
            onClick={() => setShowPresencePanel(p => !p)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
            title="Participant Status"
          >
            {counterpartPresence?.status === 'online'
              ? <Wifi className="w-5 h-5 text-emerald-500" />
              : counterpartPresence?.status === 'joined_offline'
              ? <WifiOff className="w-5 h-5 text-amber-500" />
              : <Clock className="w-5 h-5 text-slate-400" />
            }
          </button>

          {isBuyer && deal.status !== 'finalized' && (
            <button onClick={copyInviteLink} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="Copy invite link">
              <Copy className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          )}
          <WalletBadge profile={profile} onOpen={() => setShowWallet(true)} />
          <NotificationBell profile={profile} onOpen={() => setShowNotifications(true)} />
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </header>

      {/* ── Presence Slide-out Panel ─────────────────────────────────────── */}
      {showPresencePanel && (
        <div className="absolute right-4 top-20 z-50 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Participant Status</h3>
            <button onClick={() => setShowPresencePanel(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Viewer's own status */}
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">You</p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {profile?.displayName || 'You'} ({isBuyer ? 'Buyer' : 'Seller'})
              </span>
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">Online · In Room</p>
          </div>

          {/* Counterpart status */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{counterpartLabel}</p>
            <PresenceBadge
              presence={counterpartPresence}
              label={counterpartLabel}
              showMeta
            />
          </div>

          {/* Socket connection indicator */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className="text-[10px] text-slate-400 font-medium">
              {isConnected ? 'Live connection active' : 'Reconnecting…'}
            </span>
          </div>
        </div>
      )}

      <main className="flex flex-1 overflow-hidden p-6 gap-6">

        {/* ── LEFT: Product Details ─────────────────────────────────────── */}
        <aside className="w-80 flex flex-col gap-4 overflow-y-auto no-scrollbar">

          {/* Compact presence card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {counterpartLabel} Status
              </h3>
              <PresenceBadge presence={counterpartPresence} compact />
            </div>

            {counterpartPresence ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {counterpartPresence.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {counterpartPresence.displayName}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {counterpartPresence.isRegistered ? '✓ Registered' : 'Guest'} · {counterpartLabel}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {counterpartLabel} hasn't entered this room yet.
              </p>
            )}
          </div>

          {/* Product card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Product Details</h2>

            {/* Product image */}
            <div className="aspect-square rounded-lg bg-slate-50 dark:bg-slate-800/50 mb-4 overflow-hidden border border-slate-100 dark:border-slate-800 flex items-center justify-center relative group">
              {(deal.productImageUrl || productImagePreview) ? (
                <img
                  src={deal.productImageUrl || productImagePreview!}
                  alt="Product"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-12 h-12 text-slate-300" />
              )}
              {/* Buyer can upload/replace product image */}
              {isBuyer && deal.status !== 'finalized' && (
                <button
                  onClick={() => productImageInputRef.current?.click()}
                  disabled={productImageUploading}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                  title="Upload product image"
                >
                  {productImageUploading
                    ? <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Upload className="w-8 h-8 text-white drop-shadow-lg" />
                  }
                </button>
              )}
            </div>

            {/* Buyer upload button (explicit, below image) */}
            {isBuyer && deal.status !== 'finalized' && (
              <div className="mb-4">
                <input
                  ref={productImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProductImageUpload}
                />
                <button
                  onClick={() => productImageInputRef.current?.click()}
                  disabled={productImageUploading}
                  className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-400 hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                >
                  <ImagePlus className="w-4 h-4" />
                  {productImageUploading ? 'Uploading...' : deal.productImageUrl ? 'Replace Product Image' : 'Upload Product Image'}
                </button>
              </div>
            )}

            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 mb-1">{deal.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{deal.description || 'No description provided.'}</p>

            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Escrow Amount</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {deal.price.toLocaleString()} <span className="text-sm font-bold text-slate-500">FCFA</span>
              </p>
              {deal.status === 'funded' && (
                <div className="mt-2 pt-2 border-t border-primary/10 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Platform fee (5%)</span>
                    <span className="font-bold text-amber-600">-{(deal.platformFee ?? calcPlatformFee(deal.price)).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Seller receives</span>
                    <span className="font-bold text-emerald-600">{(deal.sellerReceives ?? calcSellerReceives(deal.price)).toLocaleString()} FCFA</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          {isBuyer && deal.status === 'active' && (
            <button
              onClick={() => setShowPayModal(true)}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" /> Fund Escrow
            </button>
          )}
          {isSeller && deal.status === 'funded' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Awaiting Delivery</p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Escrow is funded. Ship the item, then request funds once the buyer confirms delivery.
              </p>
            </div>
          )}
          {isSeller && deal.status === 'delivered' && deal.buyerConfirmedDelivery && (
            <button
              onClick={() => setShowPayoutModal(true)}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" /> Request Funds
            </button>
          )}
          {isSeller && deal.status === 'delivered' && !deal.buyerConfirmedDelivery && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Awaiting OTP Confirmation</p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Share your OTP with the buyer. Once they confirm receipt, you can request funds.
              </p>
            </div>
          )}
          {isSeller && !['funded', 'delivered', 'finalized'].includes(deal.status) && deal.status !== 'active' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 text-center">
              Funds will be available after delivery confirmation.
            </div>
          )}
        </aside>

        {/* ── CENTER: Chat ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Secure Chat</h2>
            {/* Inline presence chip */}
            <PresenceStatusPill
              status={counterpartPresence?.status ?? 'not_joined'}
              label={counterpartLabel}
              isSocketConnected={isConnected}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.map(msg => {
              const isMine = msg.senderId === profile?.uid;
              const isSystem = msg.type === 'system';
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="px-3 py-1.5 bg-primary/5 border border-primary/10 text-primary text-xs font-bold rounded-full">
                      {msg.text}
                    </span>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs rounded-2xl text-sm font-medium shadow-sm overflow-hidden ${
                    isMine
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md'
                  }`}>
                    {msg.type === 'image' && msg.imageUrl ? (
                      <img
                        src={msg.imageUrl}
                        alt="Shared image"
                        className="w-full max-w-xs object-cover cursor-pointer"
                        onClick={() => window.open(msg.imageUrl, '_blank')}
                      />
                    ) : (
                      <p className="px-4 py-2.5">{msg.text}</p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            {/* Hidden image input for chat */}
            <input
              ref={chatImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleChatImageUpload}
            />
            <button
              type="button"
              onClick={() => chatImageInputRef.current?.click()}
              disabled={chatImageUploading}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-500 disabled:opacity-40"
              title="Send image"
            >
              {chatImageUploading
                ? <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                : <ImagePlus className="w-4 h-4" />
              }
            </button>
            <form onSubmit={sendMessage} className="flex flex-1 gap-2">
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Timeline ───────────────────────────────────────────── */}
        <aside className="w-72 flex flex-col gap-4 overflow-y-auto no-scrollbar">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-5">Deal Timeline</h2>
            <TimelineStep completed={true}                        title="Deal Created"        time={new Date(deal.createdAt).toLocaleDateString()} />
            <TimelineStep completed={!!(deal.buyerId && deal.sellerId)}  active={deal.status === 'active'} title="Both Parties Joined" time={deal.buyerId && deal.sellerId ? 'Ready' : 'Waiting...'} />
            <TimelineStep completed={deal.milestone >= 25}  active={deal.status === 'active'} title="Escrow Funded"       time={deal.status === 'funded' ? 'Paid' : deal.status === 'active' ? 'Awaiting payment' : 'Pending'} />
            <TimelineStep completed={deal.milestone >= 50}  active={deal.status === 'transit'} title="In Transit"        time={deal.status === 'transit' ? 'SHIPPED' : 'Pending'} />
            <TimelineStep completed={deal.milestone >= 75}  active={deal.status === 'delivered'} title="Delivered"       time={deal.status === 'delivered' ? 'Reviewing' : 'Pending'} />
            <TimelineStep completed={deal.milestone >= 100} active={false}                    title="Funds Released"     time={deal.status === 'finalized' ? '✓ Complete' : 'Pending'} />
          </div>

          {/* OTP release (buyer, after delivery) */}
          {isBuyer && deal.status === 'delivered' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Release Funds</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Enter the 6-digit OTP shared by your seller to confirm receipt and release payment.
              </p>
              <div className="flex gap-1.5 mb-4">
                {otp.map((digit, i) => (
                  <input
                    key={i} id={`otp-${i}`} maxLength={1}
                    value={digit} onChange={e => handleOtpChange(i, e.target.value)}
                    className="w-9 h-11 text-center font-bold text-lg border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:border-primary outline-none transition-colors"
                  />
                ))}
              </div>
              <button
                onClick={async () => {
                  const entered = otp.join('');
                  if (entered.length !== 6) return;
                  // Validate OTP against stored deal OTP
                  if (deal.releaseOtp && entered !== deal.releaseOtp) {
                    toast.error('Incorrect OTP. Please check with your seller.');
                    return;
                  }

                  await updateDoc(doc(db, 'deals', dealId), {
                    buyerConfirmedDelivery: true,
                    milestone: 75,
                    updatedAt: new Date().toISOString(),
                  });
                  await addDoc(collection(db, 'deals', dealId, 'messages'), {
                    dealId, senderId: 'system',
                    text: `✅ Buyer confirmed receipt with OTP. Seller may now request funds.`,
                    timestamp: new Date().toISOString(), type: 'system',
                  });
                  // Notify seller they can now request funds
                  if (deal.sellerId) {
                    await notify.dealDelivered(deal.sellerId, dealId);
                  }
                  toast.success('Receipt confirmed! Seller has been notified to request funds.');
                }}
                disabled={otp.join('').length !== 6}
                className="w-full py-2.5 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-slate-800 transition-all"
              >
                Confirm Receipt & Notify Seller
              </button>
            </div>
          )}

          {/* Seller OTP info panel (funded state) */}
          {isSeller && deal.status === 'funded' && deal.releaseOtp && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Your Release OTP</h3>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                Share this code with the buyer <strong>only after</strong> they receive the package.
              </p>
              <div className="flex gap-1.5 justify-center">
                {deal.releaseOtp.split('').map((d, i) => (
                  <div key={i} className="w-9 h-11 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-600 rounded-lg font-black text-lg text-amber-700 dark:text-amber-300">
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* ── Notification Center ──────────────────────────────────────────── */}
      {showNotifications && (
        <NotificationCenter
          profile={profile}
          onNavigate={onNavigate}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* ── Wallet Panel ─────────────────────────────────────────────────── */}
      {showWallet && (
        <WalletPanel
          profile={profile}
          onClose={() => setShowWallet(false)}
        />
      )}

      {/* ── Payment Modal ────────────────────────────────────────────────── */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Fund Escrow</h2>
                <p className="text-sm text-slate-500 mt-0.5">Pay {deal.price.toLocaleString()} FCFA via MoMo</p>
              </div>
              <button onClick={() => setShowPayModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleInitiatePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mobile Network</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['cm.mtn', 'cm.orange'] as const).map(ch => (
                    <button key={ch} type="button" onClick={() => setPayForm(f => ({ ...f, channel: ch }))}
                      className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        payForm.channel === ch
                          ? ch === 'cm.mtn' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}>{ch === 'cm.mtn' ? '📱 MTN MoMo' : '📱 Orange Money'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">MoMo Name</label>
                <input required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Name on your MoMo account" value={payForm.momoName} onChange={e => setPayForm(f => ({ ...f, momoName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">MoMo Number</label>
                <div className="flex">
                  <span className="flex items-center px-4 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-xl text-sm font-bold text-slate-600">+237</span>
                  <input required type="tel" className="flex-1 px-4 py-3 rounded-r-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="6XX XXX XXX" value={payForm.momoNumber} onChange={e => setPayForm(f => ({ ...f, momoNumber: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                <button type="submit" disabled={paying} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
                  {paying ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</> : `Pay ${deal.price.toLocaleString()} FCFA`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Payout Modal ─────────────────────────────────────────────────── */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Request Funds</h2>
                <p className="text-sm text-slate-500 mt-0.5">Enter your MoMo details to receive funds</p>
              </div>
              <button onClick={() => setShowPayoutModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSellerPayout} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mobile Network</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['cm.mtn', 'cm.orange'] as const).map(ch => (
                    <button key={ch} type="button" onClick={() => setPayoutForm(f => ({ ...f, channel: ch }))}
                      className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        payoutForm.channel === ch
                          ? ch === 'cm.mtn' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}>{ch === 'cm.mtn' ? '📱 MTN MoMo' : '📱 Orange Money'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">MoMo Name</label>
                <input required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Name on MoMo account" value={payoutForm.momoName} onChange={e => setPayoutForm(f => ({ ...f, momoName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">MoMo Number</label>
                <div className="flex">
                  <span className="flex items-center px-4 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-xl text-sm font-bold">+237</span>
                  <input required type="tel" className="flex-1 px-4 py-3 rounded-r-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="6XX XXX XXX" value={payoutForm.momoNumber} onChange={e => setPayoutForm(f => ({ ...f, momoNumber: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayoutModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                <button type="submit" disabled={payingOut} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
                  {payingOut ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</> : 'Receive Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PresenceStatusPill({ status, label, isSocketConnected }: {
  status: 'online' | 'joined_offline' | 'not_joined';
  label : string;
  isSocketConnected: boolean;
}) {
  if (!isSocketConnected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        Connecting…
      </span>
    );
  }
  const cfg = {
    online         : { dot: 'bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-400/70', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700', label: `${label}: Online` },
    joined_offline : { dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700', label: `${label}: Offline` },
    not_joined     : { dot: 'bg-slate-300', text: 'text-slate-500', bg: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', label: `${label}: Not Joined` },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TimelineStep({ completed, active, title, time }: {
  completed?: boolean; active?: boolean; title: string; time: string;
}) {
  return (
    <div className="relative flex gap-5 pb-10 last:pb-0">
      <div className={`size-7 rounded-full flex items-center justify-center z-10 shadow-sm flex-shrink-0 ${
        completed ? 'bg-green-500 ring-4 ring-green-500/10'
        : active   ? 'bg-primary ring-4 ring-primary/20'
        : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
      }`}>
        {completed ? <Check className="text-white w-4 h-4" />
          : active ? <ShieldCheck className="text-white w-4 h-4 animate-spin-slow" />
          : <Package className="text-slate-400 w-4 h-4" />}
      </div>
      <div className="pt-0.5">
        <p className={`text-sm font-bold ${completed ? 'text-slate-900 dark:text-slate-100' : active ? 'text-primary' : 'text-slate-400'}`}>{title}</p>
        <p className={`text-[10px] font-medium mt-0.5 ${active ? 'text-accent font-bold uppercase tracking-wider' : 'text-slate-400'}`}>{time}</p>
      </div>
    </div>
  );
}
