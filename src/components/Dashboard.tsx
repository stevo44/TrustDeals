import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Deal, UserProfile } from '../types';
import { ShieldCheck, Plus, ArrowRight, User, Diamond, Brush, Car, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

interface DashboardProps {
  profile: UserProfile | null;
  onNavigate: (page: string, dealId?: string) => void;
}

export default function Dashboard({ profile, onNavigate }: DashboardProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'deals'),
      where(profile.role === 'buyer' ? 'buyerId' : 'sellerId', '==', profile.uid)
    );

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

  const createDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const price = Number(formData.get('price'));
    const sellerEmail = formData.get('sellerEmail') as string;

    try {
      // In a real app, we'd look up the seller by email
      // For this demo, we'll just use a placeholder sellerId if not found
      await addDoc(collection(db, 'deals'), {
        title,
        price,
        buyerId: profile?.uid,
        sellerId: 'placeholder-seller-id', // Simplified for demo
        status: 'created',
        milestone: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Deal created successfully!');
      setShowCreateModal(false);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'deals');
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen font-display">
      <header className="flex items-center justify-between border-b border-primary/5 bg-white dark:bg-slate-900 px-6 py-4 lg:px-40 sticky top-0 z-50">
        <div className="flex items-center gap-3 text-primary">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">TrustDeals</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold text-slate-900 dark:text-white">{profile?.displayName}</span>
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{profile?.role}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 lg:px-40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Active Deals</h1>
            <p className="text-slate-500 mt-1">Manage your secure XAF transactions</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-xl shadow-primary/20 hover:translate-y-[-2px] transition-all"
          >
            <Plus className="w-5 h-5" />
            New Transaction
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-20 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No active deals found</h3>
            <p className="text-slate-500 max-w-xs mx-auto">Start a new secure transaction to protect your XAF payments.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">New Transaction</h2>
            <form onSubmit={createDeal} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Item Title</label>
                <input name="title" required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="e.g. MacBook Pro M3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Price (XAF)</label>
                <input name="price" type="number" required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="e.g. 1500000" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Seller Email</label>
                <input name="sellerEmail" type="email" required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="seller@example.cm" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all">Create Deal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, onNavigate }: { deal: Deal, onNavigate: (page: string, dealId?: string) => void }) {
  const getIcon = () => {
    if (deal.title.toLowerCase().includes('macbook') || deal.title.toLowerCase().includes('laptop')) return <Diamond className="text-slate-500" />;
    if (deal.title.toLowerCase().includes('design')) return <Brush className="text-slate-500" />;
    if (deal.title.toLowerCase().includes('part') || deal.title.toLowerCase().includes('car')) return <Car className="text-slate-500" />;
    return <ShieldCheck className="text-slate-500" />;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-6 hover:shadow-lg transition-all shadow-sm group">
      <div className="flex items-start justify-between mb-6">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
            {getIcon()}
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{deal.title}</h4>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <User className="w-3 h-3" />
              ID: #{deal.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <p className="text-lg font-bold text-primary dark:text-slate-200">{deal.price.toLocaleString()} FCFA</p>
      </div>
      <div className="mb-2.5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span>Status: {deal.status.replace('_', ' ')}</span>
        <span className="text-primary dark:text-slate-300">{deal.milestone}%</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-6 overflow-hidden">
        <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${deal.milestone}%` }}></div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
        <div className="flex -space-x-2.5">
          <img className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" src={`https://picsum.photos/seed/${deal.buyerId}/100/100`} alt="Buyer" />
          <img className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" src={`https://picsum.photos/seed/${deal.sellerId}/100/100`} alt="Seller" />
        </div>
        <button 
          onClick={() => onNavigate('deal-room', deal.id)}
          className="text-xs font-bold text-primary dark:text-slate-300 hover:text-accent flex items-center gap-1 transition-colors"
        >
          GO TO ROOM
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
