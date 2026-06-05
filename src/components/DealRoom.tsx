import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import {
  doc, onSnapshot, collection, query,
  orderBy, addDoc, updateDoc,
} from 'firebase/firestore';
import { Deal, Message, UserProfile, BuyerPaymentForm } from '../types';
import {
  ShieldCheck, Lock, Send, Check, Package, Bell, Settings,
  ArrowLeft, Copy, X, Wifi, WifiOff, Clock, ImagePlus, Upload,
  Wallet, KeyRound, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { initiatePayment, checkPaymentStatus, formatFapshiPhone, normalizeStatus } from '../lib/fapshi';
import { usePresence } from '../hooks/usePresence';
import PresenceBadge from './PresenceBadge';
import NotificationCenter, { NotificationBell } from './NotificationCenter';
import WalletPanel, { WalletBadge } from './WalletPanel';
import { notify, generateOTP } from '../lib/notifications';
import { lockEscrow, releaseEscrow } from '../lib/wallet';
import { triggerPayoutSequence } from '../lib/payouts';
import CitySelector from './CitySelector';
import { transitionDeal } from '../lib/dealStateMachine';
import { calculateFees } from '../lib/fees';
import FeeBreakdownDisplay from './FeeBreakdownDisplay';
import DisputeForm from './DisputeForm';
import VerificationBanner from './VerificationBanner';
import VerificationWizard from './VerificationWizard';

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
  const [activeTab,        setActiveTab]        = useState<'chat' | 'details' | 'timeline'>('chat');
  const [sellerCity,      setSellerCity]      = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeType,      setDisputeType]     = useState<'buyer' | 'seller' | 'rider'>('buyer');
  const [showVerificationWizard, setShowVerificationWizard] = useState(false);

  // Product image upload (buyer)
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [productImagePreview,   setProductImagePreview]   = useState<string | null>(null);

  // Chat image upload
  const [chatImageUploading, setChatImageUploading] = useState(false);

  // Payment modal (buyer)
  const [showPayModal,  setShowPayModal]  = useState(false);
  const [payForm,       setPayForm]       = useState<BuyerPaymentForm>({ momoNumber: '', momoName: '', network: 'mtn' });
  const [paying,        setPaying]        = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);



  const chatEndRef = useRef<HTMLDivElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef    = useRef<HTMLInputElement>(null);

  // ── Determine counterpart ID ─────────────────────────────────────────────
  const isBuyer  = deal?.buyerId  === profile?.uid;
  const isSeller = deal?.sellerId === profile?.uid;
  const isRider  = deal?.riderId  === profile?.uid;
  const isAdmin  = profile?.role  === 'admin';
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
      if (data.status) data.status = data.status.toUpperCase() as any;


      const isBuyerSnap  = data.buyerId  === profile?.uid;
      const isSellerSnap = data.sellerId === profile?.uid;
      const isInvitedBuyer = !data.buyerId && data.buyerEmail === profile?.email;
      const isInvitedSeller = !data.sellerId && data.sellerEmail === profile?.email;
      
      const waitingAndCreator =
        data.status === 'WAITING' &&
        ((data.createdBy === 'buyer' && isBuyerSnap) ||
         (data.createdBy === 'seller' && isSellerSnap));

      // Grant access if they match ID OR match invited email OR is rider OR is admin
      if (!isBuyerSnap && !isSellerSnap && !waitingAndCreator && !isInvitedBuyer && !isInvitedSeller && !isAdmin && data.riderId !== profile?.uid) {
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
      if (deal.status === 'WAITING') {
        if (!deal.buyerId && deal.buyerEmail === profile.email) {
          updates.buyerId = profile.uid;
          updates.buyerName = profile.displayName || profile.email;
          updates.status = 'ACTIVE';
          needsUpdate = true;
        } else if (!deal.sellerId && deal.sellerEmail === profile.email) {
          updates.sellerId = profile.uid;
          updates.sellerName = profile.displayName || profile.email;
          updates.status = 'ACTIVE';
          needsUpdate = true;
        }
      }

      // Case 2: Both IDs are present but status is stuck in 'WAITING'
      if (deal.status === 'WAITING' && deal.buyerId && deal.sellerId) {
        updates.status = 'ACTIVE';
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

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

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
      const result = await initiatePayment({
        amount:      deal.price,
        phone:       payForm.momoNumber,
        network:     payForm.network,
        dealId,
        description: `Payment for: ${deal.title}`,
      });

      // Fapshi returns a transId — poll on that, not a redirect URL
      const transId   = result.transId;
      const reference = result.reference;
      if (!transId) throw new Error('No transId returned from Fapshi.');

      // Platform fee already included in totalCharged paid by buyer.
      // Seller receives the full product price — nothing deducted here.
      await updateDoc(doc(db, 'deals', dealId), {
        paymentReference: reference,
        fapshiTransId:    transId,
        sellerReceives:   deal.price,   // seller gets the full agreed amount
        updatedAt:        new Date().toISOString(),
      });

      toast.info('MoMo prompt sent to your phone. Approve it to fund the escrow.');
      setShowPayModal(false);

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const sr     = await checkPaymentStatus(transId);
          const status = normalizeStatus(sr.status);

          if (status === 'success') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;

            // Generate OTP only after payment confirmed
            const otp6 = generateOTP();

            await updateDoc(doc(db, 'deals', dealId), {
              status:         'PAYMENT_LOCKED',
              buyerOtp:       otp6,
              updatedAt:      new Date().toISOString(),
            });
            await addDoc(collection(db, 'deals', dealId, 'messages'), {
              dealId, senderId: 'system',
              text:      `Escrow funded! ${deal.price.toLocaleString()} FCFA held securely.`,
              timestamp: new Date().toISOString(), type: 'system',
            });

            await lockEscrow(profile.uid, deal.price, dealId);

            await notify.dealFunded(profile.uid, dealId, deal.price);
            if (deal.sellerId) {
              await notify.dealFunded(deal.sellerId, dealId, deal.price);
            }
            // Send OTP directly to buyer
            await notify.otpGenerated(profile.uid, dealId, otp6);

            toast.success('Payment confirmed! Escrow funded. Check your notifications for your delivery code.');
          } else if (status === 'failed' || attempts >= 24) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            toast.error('Payment timed out or failed. Please try again.');
          }
        } catch { /* network hiccup — keep polling */ }
      }, 5000);

      pollingRef.current = interval;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payment');
    } finally {
      setPaying(false);
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
  if (deal.status === 'WAITING') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background-light dark:bg-background-dark px-4 py-8">
        <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100 text-center">Waiting for other party to join</p>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Share the invite link. The deal room activates automatically once they join.
        </p>
        <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-500 break-all font-mono">
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
    <div className="flex flex-col h-[100dvh] bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-6 py-3 sm:py-4 shrink-0 shadow-sm z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="size-8 sm:size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-slate-900 dark:text-slate-100 text-sm sm:text-lg font-bold leading-tight truncate">
              Deal #{deal.id.slice(0, 4).toUpperCase()}
            </h1>
            <p className="text-[9px] sm:text-[10px] text-accent font-bold uppercase tracking-widest hidden xs:block">Escrow Active</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {/* ── Live presence pill — hidden on very small screens ── */}
          <span className="hidden sm:flex">
            <PresenceStatusPill
              status={counterpartPresence?.status ?? 'not_joined'}
              label={counterpartLabel}
              isSocketConnected={isConnected}
            />
          </span>

          {/* ── Presence panel toggle ── */}
          <button
            onClick={() => setShowPresencePanel(p => !p)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Participant Status"
          >
            {counterpartPresence?.status === 'online'
              ? <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              : counterpartPresence?.status === 'joined_offline'
              ? <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              : <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            }
          </button>

          {isBuyer && deal.status !== 'COMPLETED' && (
            <button onClick={copyInviteLink} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors hidden sm:flex" title="Copy invite link">
              <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
            </button>
          )}
          <WalletBadge profile={profile} onOpen={() => setShowWallet(true)} />
          <NotificationBell profile={profile} onOpen={() => setShowNotifications(true)} />
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors hidden sm:flex">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
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

      {/* ── Presence Slide-out Panel ─────────────────────────────────────── */}
      {showPresencePanel && (
        <div className="absolute right-2 sm:right-4 top-16 sm:top-20 z-50 w-[calc(100vw-16px)] max-w-xs bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 animate-fade-in">
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
      {/* ── Mobile Tab Switcher ─────────────────────────────────────── */}
      <div className="lg:hidden flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-slate-400'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-slate-400'
          }`}
        >
          Product
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'timeline' ? 'border-primary text-primary' : 'border-transparent text-slate-400'
          }`}
        >
          Status
        </button>
      </div>

      {/* ── Action Banner (Mobile & Desktop) ─────────────────────────── */}
      <div className="shrink-0 z-10">
        {isBuyer && deal.status === 'ACTIVE' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 px-4 py-3 flex items-center gap-3 animate-fade-in text-slate-900 dark:text-slate-100">
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Waiting for Seller</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300">The seller must confirm the product details before you can fund the escrow.</p>
            </div>
          </div>
        )}
        {isBuyer && deal.status === 'PRODUCT_CONFIRMED' && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex items-center justify-between gap-4 animate-fade-in shadow-sm">
            <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
              <div className="p-2 bg-primary rounded-lg text-white">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-primary uppercase tracking-wider">Action Required</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Product confirmed. Fund the escrow to secure this transaction.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 whitespace-nowrap active:scale-95 transition-all"
            >
              Fund Escrow
            </button>
          </div>
        )}
        {isSeller && deal.status === 'ACTIVE' && (
           <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg text-white text-slate-900 dark:text-slate-100">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0 text-slate-900 dark:text-slate-100">
                <p className="text-xs font-black text-primary uppercase tracking-wider">Step 1: Action Required</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Please confirm product & pickup city to enable buyer payment.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('details')}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold whitespace-nowrap lg:hidden"
            >
              Go to Product
            </button>
          </div>
        )}
        {isBuyer && deal.status === 'AT_BUYER_LOCATION' && !deal.buyerConfirmedDelivery && (
           <div className="bg-emerald-50 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-800 px-4 py-3 flex items-center justify-between gap-4 animate-fade-in shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-lg text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 text-slate-900 dark:text-slate-100">
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Package Arrived!</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Inspect the goods, then enter your 6-digit code to release funds.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('timeline')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold whitespace-nowrap active:scale-95 transition-all lg:hidden"
            >
              Enter Code
            </button>
          </div>
        )}
      </div>

      <main className="flex flex-1 overflow-hidden p-2 sm:p-4 lg:p-6 gap-3 sm:gap-6 relative">

        {/* ── LEFT: Product Details ─────────────────────────────────────── */}
        <aside className={`${activeTab === 'details' ? 'flex' : 'hidden lg:flex'} w-full lg:w-80 flex-col gap-4 overflow-y-auto no-scrollbar animate-fade-in`}>

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
              {isBuyer && deal.status !== 'COMPLETED' && (
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
            {isBuyer && deal.status !== 'COMPLETED' && (
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
              {deal.status === 'PAYMENT_LOCKED' && deal.totalCharged && (
                <div className="mt-2 pt-2 border-t border-primary/10 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Product price</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{deal.price.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Platform fee (paid by buyer)</span>
                    <span className="font-bold text-amber-600">{(deal.platformFee ?? 0).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Delivery fee (paid by buyer)</span>
                    <span className="font-bold text-amber-600">{(deal.deliveryFee ?? 0).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-[10px] border-t border-primary/10 pt-1">
                    <span className="text-slate-500 font-bold">Seller receives</span>
                    <span className="font-bold text-emerald-600">{deal.price.toLocaleString()} FCFA</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          {isBuyer && deal.status === 'PRODUCT_CONFIRMED' && (
            <button
              onClick={() => setShowPayModal(true)}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" /> Fund Escrow
            </button>
          )}

          {isSeller && deal.status === 'ACTIVE' && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-primary/20 dark:border-primary/20 space-y-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Step 1: Confirm Product & Logistics</h2>
              
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Product Details</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{deal.title}</p>
                <p className="text-lg font-black text-primary mt-1">{deal.price.toLocaleString()} FCFA</p>
              </div>

              <CitySelector
                label="Your Pickup City"
                value={sellerCity}
                onChange={setSellerCity}
              />
              <button
                onClick={async () => {
                  if (!sellerCity) {
                    toast.error('Please select your pickup city');
                    return;
                  }
                  try {
                    const breakdown = await calculateFees(deal.price, sellerCity, deal.buyerCity);
                    await transitionDeal(dealId, 'PRODUCT_CONFIRMED', profile!.uid, {
                      sellerCity,
                      platformFee: breakdown.platformFee,
                      deliveryFee: breakdown.deliveryFee,
                      totalCharged: breakdown.totalCharged,
                      sellerReceives: breakdown.sellerReceives,
                    });
                    toast.success('Product and pickup city confirmed!');
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to confirm product');
                  }
                }}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Confirm Product & Pickup City
              </button>
            </div>
          )}

          {isSeller && deal.status === 'PAYMENT_LOCKED' && (
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
          {isSeller && deal.status === 'COMPLETED' && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Funds Released to Your Wallet</h3>
              </div>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mb-1">
                {deal.price.toLocaleString()}{' '}
                <span className="text-sm font-bold">FCFA</span>
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Full product price credited to your wallet. Open your wallet to withdraw.
              </p>
            </div>
          )}

          {/* Dispute Button */}
          {deal.status !== 'COMPLETED' && deal.status !== 'CANCELLED' && !deal.status.includes('DISPUTED') && (
            <button
              onClick={() => {
                setDisputeType(isBuyer ? 'buyer' : isSeller ? 'seller' : 'rider');
                setShowDisputeModal(true);
              }}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              <AlertTriangle className="w-4 h-4" /> Raise Dispute
            </button>
          )}
          {isSeller && deal.status === 'IN_TRANSIT' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200">In Transit</p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                The rider is delivering the package. Funds will be released once the buyer confirms delivery.
              </p>
            </div>
          )}

          {isSeller && deal.status === 'AT_BUYER_LOCATION' && !deal.buyerConfirmedDelivery && (
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

          {isSeller && !['PAYMENT_LOCKED', 'COMPLETED', 'DISPUTED', 'CANCELLED'].includes(deal.status) && deal.status !== 'ACTIVE' && deal.status !== 'PRODUCT_CONFIRMED' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 text-center">
              Funds will be available after delivery confirmation.
            </div>
          )}
        </aside>

        {/* ── CENTER: Chat ──────────────────────────────────────────────── */}
        <div className={`${activeTab === 'chat' ? 'flex' : 'hidden lg:flex'} flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl lg:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in`}>
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
                  <div className={`max-w-[85%] sm:max-w-xs rounded-2xl text-sm font-medium shadow-sm overflow-hidden ${
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
        <aside className={`${activeTab === 'timeline' ? 'flex' : 'hidden lg:flex'} w-full lg:w-72 flex-col gap-4 overflow-y-auto no-scrollbar animate-fade-in`}>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-5">Deal Timeline</h2>
            <TimelineStep completed={true} title="Deal Created" time={new Date(deal.createdAt).toLocaleDateString()} />
            <TimelineStep completed={!!(deal.buyerId && deal.sellerId)} active={deal.status === 'ACTIVE'} title="Both Parties Joined" time={deal.buyerId && deal.sellerId ? 'Ready' : 'Waiting...'} />
            <TimelineStep completed={['PAYMENT_LOCKED', 'RIDER_ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'AT_BUYER_LOCATION', 'COMPLETED'].includes(deal.status)} active={deal.status === 'ACTIVE'} title="Escrow Funded" time={deal.status === 'PAYMENT_LOCKED' ? 'Paid' : 'Pending'} />
            <TimelineStep completed={['IN_TRANSIT', 'AT_BUYER_LOCATION', 'COMPLETED'].includes(deal.status)} active={deal.status === 'IN_TRANSIT'} title="In Transit" time={deal.status === 'IN_TRANSIT' ? 'SHIPPED' : 'Pending'} />
            <TimelineStep completed={['COMPLETED'].includes(deal.status)} active={deal.status === 'AT_BUYER_LOCATION'} title="Delivered" time={deal.status === 'AT_BUYER_LOCATION' ? 'Reviewing' : 'Pending'} />
            <TimelineStep completed={deal.status === 'COMPLETED'} active={false} title="Funds Released" time={deal.status === 'COMPLETED' ? '✓ Complete' : 'Pending'} />
          </div>

          {/* OTP release (buyer, after delivery) */}
          {isBuyer && deal.status === 'AT_BUYER_LOCATION' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Release Funds</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Enter your 6-digit delivery code from your notifications to confirm receipt and release payment to the seller.
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

                  if (deal.buyerOtp && entered !== deal.buyerOtp) {
                    toast.error('Incorrect code. Please check your notifications for the correct code.');
                    return;
                  }

                  try {
                    // 1. Mark deal COMPLETED in Firestore
                    await updateDoc(doc(db, 'deals', dealId), {
                      buyerConfirmedDelivery: true,
                      status: 'COMPLETED',
                      completedAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });

                    // 2. Release escrow — seller gets full product price, fee already collected from buyer
                    if (deal.buyerId && deal.sellerId) {
                      await releaseEscrow(deal.buyerId, deal.sellerId, deal.price, dealId);
                    }

                    // 3. Trigger backend: pays rider correct amount + sends seller MoMo transfer
                    const payoutResult = await triggerPayoutSequence(dealId);
                    if (!payoutResult.success) {
                      console.error('[DealRoom] Backend payout failed:', payoutResult.error);
                      toast.warning('Funds logged. Payout is processing — you will be notified when complete.');
                    }

                    // 4. Post system message to chat
                    await addDoc(collection(db, 'deals', dealId, 'messages'), {
                      dealId, senderId: 'system',
                      text: `✅ Delivery confirmed! ${deal.price.toLocaleString()} FCFA released to seller.`,
                      timestamp: new Date().toISOString(), type: 'system',
                    });

                    // 5. Notify both parties
                    await notify.dealFinalized(profile!.uid, dealId, deal.price);
                    if (deal.sellerId) {
                      await notify.dealFinalized(deal.sellerId, dealId, deal.price);
                      await notify.walletCredited(
                        deal.sellerId,
                        deal.price,
                        `Payment for "${deal.title}"`,
                        dealId
                      );
                    }

                    toast.success(`Funds released! ${deal.price.toLocaleString()} FCFA sent to seller.`);
                  } catch (err) {
                    console.error('Fund release failed:', err);
                    toast.error('Something went wrong releasing funds. Please contact support.');
                  }
                }}
                disabled={otp.join('').length !== 6}
                className="w-full py-2.5 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-slate-800 transition-all"
              >
                Confirm Receipt & Release Funds
              </button>
            </div>
          )}

          {/* Seller Escrow Hold Panel */}
          {isSeller && ['PAYMENT_LOCKED', 'RIDER_ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'AT_BUYER_LOCATION'].includes(deal.status) && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Funds in Escrow</h3>
              </div>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mb-1">
                {deal.price.toLocaleString()} <span className="text-sm font-bold">FCFA</span>
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-3">
                (your full product price — secured)
              </p>
              <div className="bg-emerald-100 dark:bg-emerald-900/40 rounded-lg p-3">
                <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                  🔒 This amount is securely held in escrow. It will be automatically released to your wallet once the buyer confirms delivery with their code.
                </p>
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
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPayModal(false)}
        >

          <div 
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 overflow-y-auto max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Fund Escrow</h2>
                <p className="text-sm text-slate-500 mt-0.5">Pay {deal.price.toLocaleString()} FCFA via MoMo</p>
              </div>
              <button onClick={() => setShowPayModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="mb-6">
              <FeeBreakdownDisplay
                breakdown={{
                  productPrice: deal.price,
                  platformFee: deal.platformFee ?? 0,
                  deliveryFee: deal.deliveryFee ?? 0,
                  totalCharged: deal.totalCharged ?? 0,
                  sellerReceives: deal.sellerReceives ?? 0,
                  sellerCity: deal.sellerCity ?? '',
                  buyerCity: deal.buyerCity ?? '',
                  routeLabel: `${deal.sellerCity} → ${deal.buyerCity}`,
                }}
              />
            </div>

            <form onSubmit={handleInitiatePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mobile Network</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['mtn', 'orange'] as const).map(net => (
                    <button key={net} type="button" onClick={() => setPayForm(f => ({ ...f, network: net }))}
                      className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        payForm.network === net
                          ? net === 'mtn' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}>{net === 'mtn' ? '📱 MTN MoMo' : '📱 Orange Money'}</button>
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
      {showDisputeModal && (
        <div 
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDisputeModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-6 shadow-2xl border border-slate-100 dark:border-slate-800 overflow-y-auto max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Raise Dispute
              </h2>
              <button onClick={() => setShowDisputeModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <DisputeForm
              deal={deal}
              disputeType={disputeType}
              userId={profile!.uid}
              onClose={() => setShowDisputeModal(false)}
            />
          </div>
        </div>
      )}
      {showVerificationWizard && profile && (
        <VerificationWizard
          profile={profile}
          onClose={() => setShowVerificationWizard(false)}
        />
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
