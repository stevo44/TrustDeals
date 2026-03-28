import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { Deal, UserProfile } from '../types';
import { ShieldCheck, Search, Bell, Settings, TrendingUp, TrendingDown, ArrowRight, Flag, Users, Bike, Handshake, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState({
    totalVolume: 0,
    activeUsers: 0,
    fees: 0,
    disputes: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dealsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
      setDeals(dealsData);
      
      const volume = dealsData.reduce((acc, d) => acc + d.price, 0);
      setStats({
        totalVolume: volume,
        activeUsers: 12450, // Mocked for demo
        fees: volume * 0.035,
        disputes: dealsData.filter(d => d.status === 'dispute').length
      });
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    onNavigate('landing');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light text-slate-900 font-display">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-8 h-8 font-bold" />
            <h1 className="text-xl font-bold tracking-tight">TrustDeals Admin</h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Overview</div>
          <NavItem active icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
          <NavItem icon={<TrendingUp className="w-5 h-5" />} label="Reports" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-6">Management</div>
          <NavItem icon={<Users className="w-5 h-5" />} label="Users" />
          <NavItem icon={<Bike className="w-5 h-5" />} label="Riders" />
          <NavItem icon={<Handshake className="w-5 h-5" />} label="Active Deals" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-6">Risk Control</div>
          <NavItem icon={<AlertTriangle className="w-5 h-5" />} label="Dispute Center" badge={12} />
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full hover:bg-slate-50 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-primary font-bold border border-slate-200">AD</div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-slate-900 truncate">Admin User</p>
              <p className="text-xs text-slate-500 font-medium truncate">Logout</p>
            </div>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder="Search transactions..." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-600 rounded-full border-2 border-white"></span>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-6">Platform Overview (Cameroon)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Volume" value={`${stats.totalVolume.toLocaleString()} FCFA`} trend="+12.5%" />
              <StatCard title="Active Users" value={stats.activeUsers.toLocaleString()} trend="+5.2%" />
              <StatCard title="Platform Fees (30d)" value={`${stats.fees.toLocaleString()} FCFA`} trend="+8.1%" />
              <StatCard title="Open Disputes" value={stats.disputes.toString()} trend="-2.4%" negative />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 tracking-tight">Recent Active Deals</h3>
              <button className="text-sm font-bold text-primary flex items-center gap-1.5 hover:gap-2 transition-all">
                See All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Buyer</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deals.map(deal => (
                    <tr key={deal.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">#{deal.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">User_{deal.buyerId.slice(0, 4)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${deal.status === 'finalized' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {deal.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{deal.price.toLocaleString()} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, icon, label, badge }: { active?: boolean, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}`} href="#">
      <div className="w-5 h-5">{icon}</div>
      <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      {badge && <span className="ml-auto bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
    </a>
  );
}

// StatCard component
function StatCard({ title, value, trend, negative }: { title: string, value: string, trend: string, negative?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-primary/20 transition-colors">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
      <div className="flex items-baseline justify-between mt-3">
        <h3 className="text-xl font-extrabold text-slate-900">{value}</h3>
      </div>
      <div className={`mt-4 flex items-center text-xs font-bold ${negative ? 'text-red-600' : 'text-emerald-600'}`}>
        {trend} <span className="text-slate-400 font-medium ml-1">vs last month</span>
      </div>
    </div>
  );
}
