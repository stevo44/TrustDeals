/**
 * components/AdminNotificationsBell.tsx
 * ----------------------------------------
 * Real-time admin notification bell with dropdown panel.
 * Subscribes to Firestore adminNotifications collection.
 */

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import {
  subscribeToAdminNotifications,
  markAdminNotifRead,
  getAdminNotifColor,
  getAdminNotifIcon,
} from '../lib/adminNotifications';
import { AdminNotification } from '../types';

interface Props {
  onNavigateToDeal?: (dealId: string) => void;
}

export default function AdminNotificationsBell({ onNavigateToDeal }: Props) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const unsub = subscribeToAdminNotifications(setNotifications);
    return unsub;
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = async (notif: AdminNotification) => {
    if (!notif.read) await markAdminNotifRead(notif.id);
    if (notif.dealId && onNavigateToDeal) {
      onNavigateToDeal(notif.dealId);
      setOpen(false);
    }
  };

  const markAllRead = async () => {
    const unreadNotifs = notifications.filter((n) => !n.read);
    await Promise.all(unreadNotifs.map((n) => markAdminNotifRead(n.id)));
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Admin notifications"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-96 max-h-[520px] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Admin Alerts</h3>
              {unread > 0 && (
                <p className="text-xs text-red-500">{unread} unread</p>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                No alerts
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`px-4 py-3 border-b border-slate-50 dark:border-slate-800 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    !notif.read ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{getAdminNotifIcon(notif.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getAdminNotifColor(notif.type)}`}>
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        {new Date(notif.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
