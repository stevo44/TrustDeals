/**
 * AdminDashboard.tsx
 * Full-featured admin panel with:
 * - Real-time deal tracking (Firestore + Socket.io)
 * - Rider assignment system
 * - Business logic validation
 * - Reports with charts
 * - Status management
 */

import { useState, useEffect, useMemo } from 'react';
import { db, auth }  from '../lib/firebase';
import {
  collection, query, onSnapshot, limit,
  orderBy, doc, updateDoc, getDocs, where,
} from 'firebase/firestore';
import { signOut }   from 'firebase/auth';
import { Deal, UserProfile } from '../types';
import {
  ShieldCheck, Search, Bell, Settings, TrendingUp, TrendingDown,
  ArrowRight, Flag, Users, Bike, Handshake, AlertTriangle,
  LayoutDashboard, ChevronDown, ChevronUp, X, Check, Menu,
  RefreshCw, Filter, Download, Calendar, Package, Truck,
  DollarSign, Clock, Wifi, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminVerificationQueue from './AdminVerificationQueue';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Rider {
  id         : string;
  displayName: string;
  status     : 'available' | 'busy' | 'offline';
  phone      ?: string;
  rating     ?: number;
  location   ?: string;
}

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

type Section = 'overview' | 'deals' | 'riders' | 'reports' | 'verification';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  WAITING           : 'bg-slate-100 text-slate-600',
  ACTIVE            : 'bg-blue-50 text-blue-700',
  PAYMENT_LOCKED    : 'bg-indigo-50 text-indigo-700',
  IN_TRANSIT        : 'bg-amber-50 text-amber-700',
  AT_BUYER_LOCATION : 'bg-purple-50 text-purple-700',
  COMPLETED         : 'bg-emerald-50 text-emerald-700',
  DISPUTED          : 'bg-red-50 text-red-700',
};

// Valid status transitions (business rules)
const VALID_TRANSITIONS: Record<string, string[]> = {
  WAITING           : ['ACTIVE'],
  ACTIVE            : ['PAYMENT_LOCKED', 'DISPUTED'],
  PAYMENT_LOCKED    : ['IN_TRANSIT', 'DISPUTED'],
  IN_TRANSIT        : ['AT_BUYER_LOCATION', 'DISPUTED'],
  AT_BUYER_LOCATION : ['COMPLETED', 'DISPUTED'],
  COMPLETED         : [],
  DISPUTED          : ['COMPLETED'],
};

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [section,          setSection]          = useState<Section>('overview');
  const [deals,            setDeals]            = useState<Deal[]>([]);
  const [riders,           setRiders]           = useState<Rider[]>([]);
  const [adminProfile,     setAdminProfile]     = useState<UserProfile | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [selectedDeal,     setSelectedDeal]     = useState<Deal | null>(null);
  const [showDealModal,    setShowDealModal]     = useState(false);
  const [showRiderModal,   setShowRiderModal]   = useState(false);
  const [assigningDealId,  setAssigningDealId]  = useState<string | null>(null);
  const [updatingStatus,   setUpdatingStatus]   = useState(false);
  const [isSidebarOpen,    setIsSidebarOpen]    = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [reportRange,  setReportRange]  = useState<'7d' | '30d' | '90d'>('30d');

  // ── Real-time deals listener ─────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // ── Real-time riders listener ────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'rider'));
    const unsub = onSnapshot(q, (snap) => {
      setRiders(snap.docs.map(d => ({
        id         : d.id,
        displayName: d.data().displayName || 'Unknown Rider',
        status     : d.data().riderStatus || 'available',
        phone      : d.data().phoneNumber,
        rating     : d.data().rating,
        location   : d.data().location,
      })));
    });
    return () => unsub();
  }, []);

  // ── Admin profile listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setAdminProfile(snap.data() as UserProfile);
    });
    return () => unsub();
  }, []);

  // ── Computed stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = deals.length;
    const completed = deals.filter(d => d.status === 'COMPLETED').length;
    const pending   = deals.filter(d => !['COMPLETED', 'DISPUTED', 'SELLER_DISPUTED', 'RIDER_DISPUTED', 'CANCELLED'].includes(d.status)).length;
    const disputes  = deals.filter(d => ['DISPUTED', 'SELLER_DISPUTED', 'RIDER_DISPUTED'].includes(d.status)).length;
    const volume    = deals.filter(d => d.status === 'COMPLETED').reduce((acc, d) => acc + d.price, 0);
    const inTransit = deals.filter(d => d.status === 'IN_TRANSIT').length;
    return { total, completed, pending, disputes, volume, inTransit };
  }, [deals]);

  // ── Filtered deals ────────────────────────────────────────────────────────
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterSearch) {
        const s = filterSearch.toLowerCase();
        return (
          d.id.toLowerCase().includes(s) ||
          d.buyerName?.toLowerCase().includes(s) ||
          d.sellerName?.toLowerCase().includes(s) ||
          d.title.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [deals, filterStatus, filterSearch]);

  // ── Report data ───────────────────────────────────────────────────────────
  const reportData = useMemo(() => {
    const days = reportRange === '7d' ? 7 : reportRange === '30d' ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const inRange = deals.filter(d => new Date(d.createdAt) >= cutoff);
    const byStatus = Object.fromEntries(
      ['WAITING', 'ACTIVE', 'PAYMENT_LOCKED', 'IN_TRANSIT', 'AT_BUYER_LOCATION', 'COMPLETED', 'DISPUTED']
        .map(s => [s, inRange.filter(d => d.status === s).length])
    );
    const volume = inRange
      .filter(d => d.status === 'COMPLETED')
      .reduce((acc, d) => acc + d.price, 0);

    return { inRange: inRange.length, byStatus, volume };
  }, [deals, reportRange]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const updateDealStatus = async (dealId: string, newStatus: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const valid = VALID_TRANSITIONS[deal.status] || [];
    if (!valid.includes(newStatus)) {
      toast.error(`Cannot move from "${deal.status}" to "${newStatus}".`);
      return;
    }

    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'deals', dealId), {
        status   : newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Deal status updated to "${newStatus}"`);
    } catch {
      toast.error('Failed to update deal status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const assignRider = async (dealId: string, riderId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    // Business rule: payment must be completed
    if (!['PAYMENT_LOCKED', 'IN_TRANSIT', 'AT_BUYER_LOCATION'].includes(deal.status)) {
      toast.error('Cannot assign rider: payment not completed yet.');
      return;
    }

    try {
      await updateDoc(doc(db, 'deals', dealId), {
        riderId  : riderId,
        status   : 'IN_TRANSIT',
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', riderId), {
        riderStatus: 'busy',
        updatedAt  : new Date().toISOString(),
      });
      toast.success('Rider assigned successfully!');
      setShowRiderModal(false);
    } catch {
      toast.error('Failed to assign rider.');
    }
  };

  const markDelivered = async (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    if (deal.status !== 'IN_TRANSIT') {
      toast.error('Cannot mark delivered: rider has not picked up yet.');
      return;
    }
    await updateDealStatus(dealId, 'AT_BUYER_LOCATION');
  };

  const resolveDispute = async (dealId: string) => {
    await updateDealStatus(dealId, 'COMPLETED');
    toast.success('Dispute resolved — funds released.');
  };

  const handleLogout = async () => {
    await signOut(auth);
    onNavigate('landing');
  };

  const exportCSV = () => {
    const rows = [
      ['ID', 'Buyer', 'Seller', 'Status', 'Amount (FCFA)', 'Created'],
      ...filteredDeals.map(d => [
        d.id.slice(0, 8),
        d.buyerName,
        d.sellerName,
        d.status,
        d.price,
        new Date(d.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'deals.csv'; a.click();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-display relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
 
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 
        flex flex-col shadow-xl lg:shadow-sm z-40 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tight">TrustDeals Admin</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Overview</div>
          <NavItem active={section === 'overview'} icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard"    onClick={() => { setSection('overview'); setIsSidebarOpen(false); }} />
          <NavItem active={section === 'reports'}  icon={<TrendingUp     className="w-5 h-5" />} label="Reports"       onClick={() => { setSection('reports'); setIsSidebarOpen(false); }}  />

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-6">Management</div>
          <NavItem active={section === 'deals'}    icon={<Handshake      className="w-5 h-5" />} label="Active Deals"  onClick={() => { setSection('deals'); setIsSidebarOpen(false); }}    />
          <NavItem active={section === 'riders'}   icon={<Bike           className="w-5 h-5" />} label="Riders"        onClick={() => { setSection('riders'); setIsSidebarOpen(false); }}   />

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-6">Risk Control</div>
          <NavItem icon={<AlertTriangle className="w-5 h-5" />} label="Dispute Center" badge={stats.disputes} onClick={() => { setSection('deals'); setFilterStatus('DISPUTED'); setIsSidebarOpen(false); }} />
          <NavItem active={section === 'verification'} icon={<ShieldAlert className="w-5 h-5" />} label="Verification" onClick={() => { setSection('verification'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full hover:bg-slate-50 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20">AD</div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-slate-900 truncate">Admin User</p>
              <p className="text-xs text-slate-500 font-medium">Logout</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
 
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 lg:hidden text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Search deals, buyers, sellers…"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Live
            </span>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative">
              <Bell className="w-5 h-5" />
              {stats.disputes > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-white" />}
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto w-full">

            {/* ── OVERVIEW ──────────────────────────────────────────────── */}
            {section === 'overview' && (
              <>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-6">Platform Overview</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                    <StatCard title="Total Volume"      value={`${stats.volume.toLocaleString()} FCFA`} icon={<DollarSign className="w-5 h-5" />} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard title="Total Deals"       value={stats.total.toString()}   icon={<Handshake  className="w-5 h-5" />} color="text-blue-600"    bg="bg-blue-50"    />
                    <StatCard title="In Transit"        value={stats.inTransit.toString()} icon={<Truck    className="w-5 h-5" />} color="text-amber-600"   bg="bg-amber-50"   />
                    <StatCard title="Open Disputes"     value={stats.disputes.toString()} icon={<Flag     className="w-5 h-5" />} color="text-red-600"     bg="bg-red-50"     />
                  </div>
                </div>

                {/* Recent deals table */}
                <DealsTable
                  deals={deals.slice(0, 10)}
                  riders={riders}
                  onViewDeal={(d) => { setSelectedDeal(d); setShowDealModal(true); }}
                  onAssignRider={(id) => { setAssigningDealId(id); setShowRiderModal(true); }}
                  onMarkDelivered={markDelivered}
                  onResolveDispute={resolveDispute}
                  onUpdateStatus={updateDealStatus}
                  compact
                />
              </>
            )}

            {/* ── DEALS ─────────────────────────────────────────────────── */}
            {section === 'deals' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Active Deals</h2>
                  <div className="flex items-center gap-3">
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">All Status</option>
                      {Object.keys(STATUS_COLORS).map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
                      <Download className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>

                <DealsTable
                  deals={filteredDeals}
                  riders={riders}
                  onViewDeal={(d) => { setSelectedDeal(d); setShowDealModal(true); }}
                  onAssignRider={(id) => { setAssigningDealId(id); setShowRiderModal(true); }}
                  onMarkDelivered={markDelivered}
                  onResolveDispute={resolveDispute}
                  onUpdateStatus={updateDealStatus}
                />
              </>
            )}

            {/* ── RIDERS ────────────────────────────────────────────────── */}
            {section === 'riders' && (
              <>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Rider Management</h2>
                {riders.length === 0 ? (
                  <EmptyState icon={<Bike className="w-8 h-8" />} title="No riders found" message="Riders with role='rider' will appear here." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {riders.map(rider => (
                      <RiderCard key={rider.id} rider={rider} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── REPORTS ───────────────────────────────────────────────── */}
            {section === 'reports' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reports</h2>
                  <div className="flex gap-2">
                    {(['7d', '30d', '90d'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setReportRange(r)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${reportRange === r ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                  <StatCard title="Total Deals"      value={reportData.inRange.toString()}            icon={<Package    className="w-5 h-5" />} color="text-slate-600"   bg="bg-slate-100" />
                  <StatCard title="Completed"        value={(reportData.byStatus.COMPLETED || 0).toString()} icon={<Check className="w-5 h-5" />} color="text-emerald-600" bg="bg-emerald-50" />
                  <StatCard title="Pending"          value={((reportData.byStatus.ACTIVE || 0) + (reportData.byStatus.PAYMENT_LOCKED || 0) + (reportData.byStatus.IN_TRANSIT || 0)).toString()} icon={<Clock className="w-5 h-5" />} color="text-blue-600" bg="bg-blue-50" />
                  <StatCard title="Transaction Vol." value={`${reportData.volume.toLocaleString()} XAF`} icon={<DollarSign className="w-5 h-5" />} color="text-indigo-600"  bg="bg-indigo-50" />
                </div>

                {/* Bar chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 mb-6">Deal Status Distribution</h3>
                  <div className="space-y-3">
                    {Object.entries(reportData.byStatus).map(([status, count]) => {
                      const max   = Math.max(...Object.values(reportData.byStatus), 1);
                      const pct   = (count / max) * 100;
                      const color = { WAITING: 'bg-slate-400', ACTIVE: 'bg-blue-500', PAYMENT_LOCKED: 'bg-indigo-500', IN_TRANSIT: 'bg-amber-500', AT_BUYER_LOCATION: 'bg-purple-500', COMPLETED: 'bg-emerald-500', DISPUTED: 'bg-red-500' }[status] ?? 'bg-slate-400';
                      return (
                        <div key={status} className="flex items-center gap-4">
                          <div className="w-24 text-xs font-bold text-slate-600 capitalize">{status}</div>
                          <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                            <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="w-8 text-sm font-bold text-slate-900 text-right">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={exportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all">
                    <Download className="w-4 h-4" /> Export Report CSV
                  </button>
                </div>
              </>
            )}
            {/* ── VERIFICATION ──────────────────────────────────────────── */}
            {section === 'verification' && (
              <>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Verification Queue</h2>
                {adminProfile ? (
                  <AdminVerificationQueue adminProfile={adminProfile} />
                ) : (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── Deal Detail Modal ─────────────────────────────────────────────── */}
      {showDealModal && selectedDeal && (
        <Modal onClose={() => setShowDealModal(false)} title={`Deal #${selectedDeal.id.slice(0, 8).toUpperCase()}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Title"    value={selectedDeal.title} />
              <InfoRow label="Amount"   value={`${selectedDeal.price.toLocaleString()} FCFA`} />
              <InfoRow label="Buyer"    value={selectedDeal.buyerName} />
              <InfoRow label="Seller"   value={selectedDeal.sellerName} />
              <InfoRow label="Rider"    value={selectedDeal.riderId ? `ID: ${selectedDeal.riderId.slice(0, 8)}` : 'None'} />
              <InfoRow label="Created"  value={new Date(selectedDeal.createdAt).toLocaleDateString()} />
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Status</p>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[selectedDeal.status]}`}>
                {selectedDeal.status}
              </span>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {(VALID_TRANSITIONS[selectedDeal.status] || []).map(s => (
                  <button
                    key={s}
                    disabled={updatingStatus}
                    onClick={() => updateDealStatus(selectedDeal.id, s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${STATUS_COLORS[s]} border-current/20 hover:opacity-80 disabled:opacity-40`}
                  >
                    → {s}
                  </button>
                ))}
                {(VALID_TRANSITIONS[selectedDeal.status] || []).length === 0 && (
                  <p className="text-xs text-slate-400">No further transitions available.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {['PAYMENT_LOCKED', 'IN_TRANSIT'].includes(selectedDeal.status) && (
                <button
                  onClick={() => { setShowDealModal(false); setAssigningDealId(selectedDeal.id); setShowRiderModal(true); }}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all"
                >
                  <Truck className="inline w-4 h-4 mr-1" /> Assign Rider
                </button>
              )}
              {selectedDeal.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => { markDelivered(selectedDeal.id); setShowDealModal(false); }}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all"
                >
                  <Check className="inline w-4 h-4 mr-1" /> Mark Delivered
                </button>
              )}
              {selectedDeal.status === 'DISPUTED' && (
                <button
                  onClick={() => { resolveDispute(selectedDeal.id); setShowDealModal(false); }}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                >
                  <Flag className="inline w-4 h-4 mr-1" /> Resolve Dispute
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Rider Assignment Modal ────────────────────────────────────────── */}
      {showRiderModal && assigningDealId && (
        <Modal onClose={() => setShowRiderModal(false)} title="Assign Rider">
          <div className="space-y-3">
            {(() => {
              const deal = deals.find(d => d.id === assigningDealId);
              if (!deal || !['PAYMENT_LOCKED', 'IN_TRANSIT', 'AT_BUYER_LOCATION', 'COMPLETED'].includes(deal.status)) {
                return (
                  <div className="text-center py-6">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">Cannot assign rider</p>
                    <p className="text-xs text-slate-400 mt-1">Payment must be completed first.</p>
                  </div>
                );
              }
              return null;
            })()}

            {riders.length === 0 ? (
              <EmptyState icon={<Bike className="w-6 h-6" />} title="No riders available" message="Add riders with role='rider' in Firebase." />
            ) : (
              riders.map(rider => (
                <div key={rider.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 border border-amber-200">
                      {rider.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{rider.displayName}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          rider.status === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {rider.status}
                        </span>
                        {rider.rating && <span className="text-[10px] text-slate-400">⭐ {rider.rating.toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={rider.status !== 'available'}
                    onClick={() => assignRider(assigningDealId, rider.id)}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Assign
                  </button>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function NavItem({ active, icon, label, badge, onClick }: {
  active?: boolean; icon: React.ReactNode; label: string; badge?: number; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left ${active ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}`}
    >
      <div className="w-5 h-5">{icon}</div>
      <span className={`text-sm flex-1 ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon, color, bg }: {
  title: string; value: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-primary/20 transition-colors">
      <div className={`inline-flex p-2.5 rounded-lg ${bg} ${color} mb-3`}>{icon}</div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <p className="text-xl font-extrabold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function DealsTable({ deals, riders, onViewDeal, onAssignRider, onMarkDelivered, onResolveDispute, onUpdateStatus, compact }: {
  deals: Deal[]; riders: Rider[];
  onViewDeal: (d: Deal) => void;
  onAssignRider: (id: string) => void;
  onMarkDelivered: (id: string) => void;
  onResolveDispute: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  compact?: boolean;
}) {
  if (deals.length === 0) {
    return <EmptyState icon={<Handshake className="w-8 h-8" />} title="No deals found" message="Deals will appear here in real-time." />;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {compact && (
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 tracking-tight">Recent Deals</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-5 py-4">Deal ID</th>
              <th className="px-5 py-4">Participants</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Rider</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deals.map(deal => {
              const riderName = riders.find(r => r.id === deal.riderId)?.displayName;
              return (
                <tr key={deal.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">#{deal.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-5 py-4">
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">{deal.buyerName || 'Unknown'} <span className="text-slate-400 font-normal">(B)</span></p>
                      <p className="text-slate-500">{deal.sellerName || 'Awaiting'} <span className="text-slate-400">(S)</span></p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[deal.status]}`}>
                      {deal.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-900">{deal.price.toLocaleString()} FCFA</td>
                  <td className="px-5 py-4 text-xs text-slate-500">{riderName || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-4 text-xs text-slate-400">{new Date(deal.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onViewDeal(deal)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-primary hover:text-white text-slate-600 rounded-lg text-xs font-bold transition-all">
                        View
                      </button>
                      {['PAYMENT_LOCKED', 'IN_TRANSIT'].includes(deal.status) && !deal.riderId && (
                        <button onClick={() => onAssignRider(deal.id)} className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-all">
                          <Truck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {deal.status === 'IN_TRANSIT' && (
                        <button onClick={() => onMarkDelivered(deal.id)} className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-all">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {deal.status === 'DISPUTED' && (
                        <button onClick={() => onResolveDispute(deal.id)} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all">
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiderCard({ rider }: { rider: Rider }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-primary/20 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-lg font-black text-amber-700 border border-amber-200">
          {rider.displayName.charAt(0)}
        </div>
        <div>
          <p className="font-bold text-slate-900">{rider.displayName}</p>
          {rider.location && <p className="text-xs text-slate-400">📍 {rider.location}</p>}
        </div>
        <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full border ${
          rider.status === 'available'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : rider.status === 'busy'
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          {rider.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {rider.phone  && <InfoRow label="Phone"  value={rider.phone} />}
        {rider.rating && <InfoRow label="Rating" value={`⭐ ${rider.rating.toFixed(1)}`} />}
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}

function EmptyState({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-slate-100 rounded-2xl text-slate-400 mb-4">{icon}</div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">{message}</p>
    </div>
  );
}
