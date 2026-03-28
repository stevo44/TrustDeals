import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Deal, Message, UserProfile } from '../types';
import { ShieldCheck, Lock, Send, PlusCircle, Check, Package, Verified, Bell, Settings, Phone, MessageSquare, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

interface DealRoomProps {
  dealId: string;
  profile: UserProfile | null;
  onNavigate: (page: string) => void;
}

export default function DealRoom({ dealId, profile, onNavigate }: DealRoomProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dealRef = doc(db, 'deals', dealId);
    const unsubscribeDeal = onSnapshot(dealRef, (doc) => {
      if (doc.exists()) {
        setDeal({ id: doc.id, ...doc.data() } as Deal);
      }
    });

    const messagesQuery = query(
      collection(db, 'deals', dealId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });

    return () => {
      unsubscribeDeal();
      unsubscribeMessages();
    };
  }, [dealId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    try {
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId,
        senderId: profile.uid,
        text: newMessage,
        timestamp: new Date().toISOString(),
        type: 'text',
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `deals/${dealId}/messages`);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const releaseFunds = async () => {
    if (otp.join('').length !== 6) return;
    try {
      await updateDoc(doc(db, 'deals', dealId), {
        status: 'finalized',
        milestone: 100,
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId,
        senderId: 'system',
        text: 'Transaction Finalized. Funds released to seller.',
        timestamp: new Date().toISOString(),
        type: 'system',
      });
      toast.success('Funds released successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deals/${dealId}`);
    }
  };

  if (!deal) return null;

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight">Secure Deal Room #{deal.id.slice(0, 4)}</h1>
            <p className="text-[10px] text-accent font-bold uppercase tracking-widest">Escrow Protection Active</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3 mr-4">
            <img className="size-9 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" src={`https://picsum.photos/seed/${deal.buyerId}/100/100`} alt="Buyer" />
            <img className="size-9 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" src={`https://picsum.photos/seed/${deal.sellerId}/100/100`} alt="Seller" />
          </div>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
          </button>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-6 gap-6">
        <aside className="w-80 flex flex-col gap-6 overflow-y-auto no-scrollbar">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-5">Product Details</h2>
            <div className="aspect-square rounded-lg bg-slate-50 dark:bg-slate-800/50 mb-5 overflow-hidden relative group border border-slate-100 dark:border-slate-800">
              <img alt="Product" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" src={`https://picsum.photos/seed/${deal.id}/400/400`} />
              <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md font-medium">1/1</div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Item</p>
                <p className="text-sm font-semibold leading-relaxed">{deal.title}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Price</p>
                <p className="text-xl font-bold text-primary dark:text-white">{deal.price.toLocaleString()} FCFA</p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-3">Merchant Verification</p>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                  <div className="size-9 rounded-full bg-accent/10 flex items-center justify-center">
                    <ShieldCheck className="text-accent w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Verified Trader</p>
                    <p className="text-[10px] text-slate-500">4.8/5 • 156 Trades</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-auto space-y-3">
            <button className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-slate-800 transition-all transform active:scale-[0.98]">
              Confirm Product Details
            </button>
            <button className="w-full py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              Request Modifications
            </button>
          </div>
        </aside>

        <section className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-sm font-bold tracking-tight">Live Secure Session</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AES-256 Encrypted</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.senderId === profile?.uid ? 'flex-row-reverse ml-auto' : ''}`}>
                {msg.type === 'system' ? (
                  <div className="flex justify-center w-full">
                    <div className="bg-accent/5 border border-accent/10 rounded-full px-5 py-1.5 flex items-center gap-3">
                      <ShieldCheck className="text-accent w-4 h-4" />
                      <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{msg.text}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`size-9 rounded-full shrink-0 overflow-hidden shadow-sm border border-white dark:border-slate-800 ${msg.senderId === profile?.uid ? 'bg-primary text-white flex items-center justify-center text-[10px] font-bold' : 'bg-slate-200'}`}>
                      {msg.senderId === profile?.uid ? 'ME' : <img src={`https://picsum.photos/seed/${msg.senderId}/100/100`} alt="Sender" />}
                    </div>
                    <div className={`space-y-1 ${msg.senderId === profile?.uid ? 'flex flex-col items-end' : ''}`}>
                      <div className={`p-4 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 ${msg.senderId === profile?.uid ? 'bg-primary text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 rounded-tl-none'}`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-1.5 focus-within:ring-2 ring-primary/10 transition-all shadow-inner">
              <button type="button" className="text-slate-400 hover:text-primary transition-colors">
                <PlusCircle className="w-6 h-6" />
              </button>
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 placeholder:text-slate-400" 
                placeholder="Tapez un message sécurisé..." 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="bg-primary text-white size-10 rounded-xl flex items-center justify-center hover:bg-slate-800 shadow-md transition-all">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </section>

        <aside className="w-80 flex flex-col gap-6 overflow-y-auto no-scrollbar">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-8">Transaction Lifecycle</h2>
            <div className="relative space-y-0">
              <div className="absolute left-[13px] top-2 bottom-2 w-[1px] bg-slate-100 dark:bg-slate-800"></div>
              <TimelineStep completed title="Deal Created" time="Oct 24, 09:15 AM" />
              <TimelineStep completed={deal.milestone >= 25} title="Escrow Funded" time="Oct 24, 10:02 AM" />
              <TimelineStep active={deal.status === 'transit'} title="Dispatch in Progress" time="Awaiting tracking" />
              <TimelineStep title="Buyer Inspection" time="Pending arrival" />
              <TimelineStep title="Funds Released" time="Final step" />
            </div>
          </div>

          <div className="bg-primary/5 dark:bg-slate-900/50 border border-primary/10 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="text-primary w-5 h-5" />
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-slate-300">Release Verification</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed font-medium">Entrez le code à 6 chiffres reçu par SMS pour confirmer la réception et libérer les fonds FCFA.</p>
            <div className="flex gap-2 justify-between mb-5">
              {otp.map((digit, i) => (
                <input 
                  key={i}
                  id={`otp-${i}`}
                  className="size-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-primary dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" 
                  maxLength={1} 
                  type="text" 
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                />
              ))}
            </div>
            <button 
              onClick={releaseFunds}
              disabled={otp.join('').length !== 6 || deal.status === 'finalized'}
              className={`w-full py-3 font-bold text-[11px] uppercase tracking-widest rounded-xl transition-all ${otp.join('').length === 6 && deal.status !== 'finalized' ? 'bg-primary text-white shadow-lg' : 'bg-primary/20 text-primary dark:text-slate-300 cursor-not-allowed opacity-60'}`}
            >
              {deal.status === 'finalized' ? 'Funds Released' : 'Release Funds (FCFA)'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

function TimelineStep({ completed, active, title, time }: { completed?: boolean, active?: boolean, title: string, time: string }) {
  return (
    <div className="relative flex gap-5 pb-10">
      <div className={`size-7 rounded-full flex items-center justify-center z-10 shadow-sm ${completed ? 'bg-green-500 ring-4 ring-green-500/10' : active ? 'bg-primary ring-4 ring-primary/20' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
        {completed ? <Check className="text-white w-4 h-4 font-bold" /> : active ? <ShieldCheck className="text-white w-4 h-4 animate-spin-slow" /> : <Package className="text-slate-400 w-4 h-4" />}
      </div>
      <div>
        <p className={`text-sm font-bold ${completed ? 'text-slate-900 dark:text-slate-100' : active ? 'text-primary dark:text-white' : 'text-slate-400'}`}>{title}</p>
        <p className={`text-[10px] font-medium mt-0.5 ${active ? 'text-accent font-bold uppercase tracking-wider' : 'text-slate-400'}`}>{time}</p>
      </div>
    </div>
  );
}
