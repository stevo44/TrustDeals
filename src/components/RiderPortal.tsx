import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDoc } from 'firebase/firestore';
import { Deal, UserProfile } from '../types';
import { Truck, Bell, MapPin, Navigation, CheckCircle, Package, History, LayoutDashboard, Wallet, Shield, Settings, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import VerificationBanner from './VerificationBanner';
import VerificationWizard from './VerificationWizard';
import { ShieldAlert } from 'lucide-react';

interface RiderPortalProps {
  profile: UserProfile;
  onNavigate: (page: string) => void;
}

export default function RiderPortal({ profile, onNavigate }: RiderPortalProps) {
  const [availableDeals, setAvailableDeals] = useState<Deal[]>([]);
  const [activeDeals, setActiveDeals] = useState<Deal[]>([]);
  const [historyDeals, setHistoryDeals] = useState<Deal[]>([]);
  const [view, setView] = useState<'available' | 'active' | 'history'>('available');
  const [showVerificationWizard, setShowVerificationWizard] = useState(false);
  const isVerified = profile?.verificationStatus === 'verified';

  useEffect(() => {
    const qAvailable = query(collection(db, 'deals'), where('status', '==', 'PAYMENT_LOCKED'));
    const unsubscribeAvailable = onSnapshot(qAvailable, (snapshot) => {
      setAvailableDeals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal)));
    });

    const qActive = query(
      collection(db, 'deals'), 
      where('riderId', '==', auth.currentUser?.uid), 
      where('status', 'in', ['RIDER_ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'AT_BUYER_LOCATION'])
    );
    const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
      setActiveDeals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal)));
    });

    const qHistory = query(
      collection(db, 'deals'), 
      where('riderId', '==', auth.currentUser?.uid), 
      where('status', 'in', ['COMPLETED', 'CANCELLED_OTP_FAILED', 'AUTO_RELEASED', 'RESOLVED'])
    );
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      setHistoryDeals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal)));
    });

    return () => {
      unsubscribeAvailable();
      unsubscribeActive();
      unsubscribeHistory();
    };
  }, []);

  const acceptJob = async (dealId: string) => {
    try {
      await updateDoc(doc(db, 'deals', dealId), {
        riderId: auth.currentUser?.uid,
        riderName: (await getDoc(doc(db, 'users', auth.currentUser!.uid))).data()?.displayName || 'Rider',
        riderPhone: (await getDoc(doc(db, 'users', auth.currentUser!.uid))).data()?.phoneNumber || '',
        riderNetwork: (await getDoc(doc(db, 'users', auth.currentUser!.uid))).data()?.momoNetwork || 'mtn',
        status: 'RIDER_ASSIGNED',
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId,
        senderId: 'system',
        text: 'Rider assigned and in transit.',
        timestamp: new Date().toISOString(),
        type: 'system',
      });
      toast.success('Job accepted!');
      setView('active');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deals/${dealId}`);
    }
  };

  const markDelivered = async (dealId: string) => {
    try {
      await updateDoc(doc(db, 'deals', dealId), {
        status: 'AT_BUYER_LOCATION',
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'deals', dealId, 'messages'), {
        dealId,
        senderId: 'system',
        text: 'Package delivered. Awaiting buyer verification.',
        timestamp: new Date().toISOString(),
        type: 'system',
      });
      toast.success('Marked as delivered!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deals/${dealId}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    onNavigate('landing');
  };

  return (
    <div className="bg-background-light text-slate-900 font-display min-h-screen">
      <header className="flex items-center justify-between border-b border-primary/5 bg-white px-4 md:px-10 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-primary p-2 rounded-lg text-white shadow-lg shadow-primary/20">
            <Truck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold leading-tight tracking-tight text-primary">TrustDeals Rider</h2>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-primary/5 rounded-xl text-slate-600 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="p-2 hover:bg-primary/5 rounded-xl text-slate-600 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── VERIFICATION BANNER ── */}
      <VerificationBanner
        profile={profile}
        onStartVerification={() => setShowVerificationWizard(true)}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 pb-24 md:pb-6">
        {!isVerified ? (
          /* Blocked state for unverified riders */
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <ShieldAlert className="w-16 h-16 text-amber-400 mb-6" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Account Not Verified</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-8">
              Complete identity verification to start receiving delivery assignments.
            </p>
            <button
              onClick={() => setShowVerificationWizard(true)}
              className="px-8 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Verify Now
            </button>
          </div>
        ) : (
          <>
        <div className="flex bg-white rounded-xl p-1 mb-8 shadow-lg border border-primary/5">
          <TabButton active={view === 'available'} onClick={() => setView('available')} icon={<Navigation className="w-4 h-4" />} label="Available" />
          <TabButton active={view === 'active'} onClick={() => setView('active')} icon={<MapPin className="w-4 h-4" />} label="Active" />
          <TabButton active={view === 'history'} onClick={() => setView('history')} icon={<History className="w-4 h-4" />} label="History" />
        </div>

        {view === 'available' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-5 text-primary">Available Requests ({availableDeals.length})</h2>
            {availableDeals.map(deal => (
              <JobCard key={deal.id} deal={deal} onAccept={() => acceptJob(deal.id)} />
            ))}
          </div>
        )}

        {view === 'active' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-5 text-primary">Active Delivery</h2>
            {activeDeals.map(deal => (
              <ActiveDeliveryCard key={deal.id} deal={deal} onDelivered={() => markDelivered(deal.id)} />
            ))}
          </div>
        )}

        {view === 'history' && (
          <div className="bg-white rounded-xl overflow-hidden shadow-lg border border-primary/5">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                <tr>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Earning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historyDeals.map(deal => (
                  <tr key={deal.id}>
                    <td className="px-6 py-5">
                      <p className="font-bold text-primary">#{deal.id.slice(0, 8)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Completed</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">Verified</span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-primary">{(deal.price * 0.05).toLocaleString()} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50 shadow-lg">
        <NavButton active icon={<LayoutDashboard />} label="Dashboard" />
        <NavButton icon={<Wallet />} label="Wallet" />
        <NavButton icon={<Shield />} label="Identity" />
        <NavButton icon={<Settings />} label="Settings" />
      </nav>

      {/* ── VERIFICATION WIZARD ── */}
      {showVerificationWizard && (
        <VerificationWizard
          profile={profile}
          onComplete={() => setShowVerificationWizard(false)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${active ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function NavButton({ active, icon, label }: { active?: boolean, icon: React.ReactNode, label: string }) {
  return (
    <button className={`flex flex-col items-center ${active ? 'text-primary' : 'text-slate-300'}`}>
      <div className="w-6 h-6">{icon}</div>
      <span className="text-[9px] font-bold uppercase mt-1">{label}</span>
    </button>
  );
}

function JobCard({ deal, onAccept }: { deal: Deal, onAccept: () => void }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-lg border border-primary/5 flex flex-col md:flex-row gap-5 hover:border-primary/20 transition-all group">
      <div className="size-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors">
        <Package className="text-primary w-8 h-8" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg text-primary">{deal.title}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <Shield className="w-3 h-3" />
              <span className="font-medium">Premium Insured Delivery</span>
            </div>
          </div>
          <span className="text-primary font-black text-xl">{(deal.price * 0.05).toLocaleString()} <span className="text-xs font-bold opacity-60">FCFA</span></span>
        </div>
        <div className="flex items-center justify-between pt-5 border-t border-slate-50">
          <div className="text-[10px] tracking-wide">
            <p className="font-bold text-slate-400 uppercase">From: {deal.sellerCity || 'Seller City'}</p>
            <p className="font-bold text-primary uppercase mt-0.5">To: {deal.buyerCity || 'Buyer City'}</p>
          </div>
          <button onClick={onAccept} className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 transition-all">Accept Job</button>
        </div>
      </div>
    </div>
  );
}

function ActiveDeliveryCard({ deal, onDelivered }: { deal: Deal, onDelivered: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-primary/10 overflow-hidden">
      <div className="h-56 w-full bg-slate-100 relative">
        <img src="https://picsum.photos/seed/map/800/400" className="w-full h-full object-cover opacity-90 grayscale" alt="Map" />
        <div className="absolute inset-0 bg-primary/5"></div>
      </div>
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-black text-primary">{deal.title}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Order #{deal.id.slice(0, 8)}</p>
        </div>
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="size-3 rounded-full bg-primary ring-4 ring-primary/10"></div>
              <div className="w-px h-12 bg-slate-200 my-1"></div>
              <MapPin className="text-accent w-5 h-5" />
            </div>
            <div className="flex flex-col gap-6 flex-1">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pickup</p>
                <p className="font-bold text-primary">{deal.sellerCity || 'Contact Seller'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Delivery</p>
                <p className="font-bold text-primary">{deal.buyerCity || 'Contact Buyer'}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button disabled className="flex flex-col items-center justify-center py-4 bg-primary text-white rounded-lg shadow-lg opacity-50">
            <Package className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">In Transit</span>
          </button>
          <button 
            onClick={onDelivered}
            disabled={deal.status === 'AT_BUYER_LOCATION'}
            className={`flex flex-col items-center justify-center py-4 rounded-lg border ${deal.status === 'AT_BUYER_LOCATION' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
          >
            <CheckCircle className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{deal.status === 'AT_BUYER_LOCATION' ? 'Arrived' : 'Mark Arrival'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
