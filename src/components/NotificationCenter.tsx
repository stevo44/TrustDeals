/**
 * NotificationCenter
 * A reusable slide-in panel showing all notifications for the current user.
 * Supports mark-as-read, clear-all, and click-to-navigate.
 */
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection, query, onSnapshot, updateDoc, doc, writeBatch, orderBy,
} from 'firebase/firestore';
import { Notification, UserProfile } from '../types';
import {
  Bell, X, Check, CheckCheck, ShieldCheck, Package, MessageSquare,
  Wallet, AlertTriangle, KeyRound, Truck, PartyPopper, RefreshCw,
} from 'lucide-react';

interface NotificationCenterProps {
  profile: UserProfile | null;
  onNavigate: (page: string, dealId?: string) => void;
  onClose: () => void;
}

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  deal_invite:           <ShieldCheck className="w-4 h-4 text-primary" />,
  deal_created_by_seller:<ShieldCheck className="w-4 h-4 text-emerald-500" />,
  deal_update:           <RefreshCw className="w-4 h-4 text-blue-500" />,
  deal_funded:           <Wallet className="w-4 h-4 text-emerald-500" />,
  deal_in_transit:       <Truck className="w-4 h-4 text-violet-500" />,
  deal_delivered:        <Package className="w-4 h-4 text-orange-500" />,
  deal_finalized:        <PartyPopper className="w-4 h-4 text-emerald-600" />,
  deal_disputed:         <AlertTriangle className="w-4 h-4 text-red-500" />,
  otp_generated:         <KeyRound className="w-4 h-4 text-amber-500" />,
  message:               <MessageSquare className="w-4 h-4 text-blue-500" />,
  wallet_credited:       <Wallet className="w-4 h-4 text-emerald-500" />,
  wallet_debited:        <Wallet className="w-4 h-4 text-red-400" />,
  funds_released:        <Wallet className="w-4 h-4 text-emerald-600" />,
  payment_received:      <Wallet className="w-4 h-4 text-emerald-500" />,
  funds_requested:       <Wallet className="w-4 h-4 text-amber-500" />,
};

export default function NotificationCenter({ profile, onNavigate, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications', profile.uid, 'items'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });
    return () => unsub();
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notifId: string) => {
    if (!profile) return;
    await updateDoc(doc(db, 'notifications', profile.uid, 'items', notifId), { read: true });
  };

  const markAllRead = async () => {
    if (!profile) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', profile.uid, 'items', n.id), { read: true });
    });
    await batch.commit();
  };

  const handleClick = (notif: Notification) => {
    markAsRead(notif.id);
    onClose();
    if (notif.dealId) onNavigate('deal-room', notif.dealId);
  };

  const displayed = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-end p-4 pt-20 bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
                All read
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0">
          {(['all', 'unread'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                filter === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 dark:divide-slate-800">
          {displayed.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">
                {filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
              </p>
            </div>
          ) : (
            displayed.map(notif => (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`px-5 py-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  !notif.read ? 'bg-primary/[0.03]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`mt-0.5 size-8 rounded-lg flex items-center justify-center shrink-0 ${
                    !notif.read ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    {NOTIF_ICONS[notif.type] ?? <Bell className="w-4 h-4 text-slate-400" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-bold leading-tight ${
                        !notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <button
                          onClick={e => { e.stopPropagation(); markAsRead(notif.id); }}
                          className="shrink-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">
                      {new Date(notif.createdAt).toLocaleString([], {
                        month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="mt-2 size-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline notification bell for headers ──────────────────────────────────────
export function NotificationBell({
  profile,
  onOpen,
}: {
  profile: UserProfile | null;
  onOpen: () => void;
}) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications', profile.uid, 'items'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnread(snap.docs.filter(d => !d.data().read).length);
    });
    return () => unsub();
  }, [profile]);

  return (
    <button
      onClick={onOpen}
      className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
    >
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 size-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
          <span className="text-[9px] font-black text-white">{unread > 9 ? '9+' : unread}</span>
        </span>
      )}
    </button>
  );
}
