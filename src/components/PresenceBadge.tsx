/**
 * PresenceBadge.tsx
 * Displays real-time presence status with color indicator.
 *
 * Green  → Online (in room right now)
 * Yellow → Joined (offline – visited before)
 * Gray   → Not Joined (never entered the Deal Room)
 */

import { PresenceState, PresenceStatus } from '../contexts/PresenceContext';
import { UserCheck, UserX, Clock, Wifi, WifiOff }   from 'lucide-react';

interface PresenceBadgeProps {
  presence    : PresenceState | null;
  /** The role we're describing from the viewer's perspective, e.g. "Buyer" */
  label      ?: string;
  showMeta   ?: boolean;
  compact    ?: boolean;
}

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PresenceStatus, {
  dot  : string;
  text : string;
  badge: string;
  icon : React.FC<{ className?: string }>;
  label: string;
}> = {
  online: {
    dot  : 'bg-emerald-500 shadow-emerald-400/60 shadow-[0_0_8px_2px]',
    text : 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700',
    icon : Wifi,
    label: 'Online',
  },
  joined_offline: {
    dot  : 'bg-amber-400',
    text : 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700',
    icon : WifiOff,
    label: 'Joined (Offline)',
  },
  not_joined: {
    dot  : 'bg-slate-300 dark:bg-slate-600',
    text : 'text-slate-500',
    badge: 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700',
    icon : Clock,
    label: 'Not Joined',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PresenceBadge({
  presence,
  label,
  showMeta = true,
  compact  = false,
}: PresenceBadgeProps) {
  const status = presence?.status ?? 'not_joined';
  const cfg    = STATUS_CONFIG[status];
  const Icon   = cfg.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold ${cfg.badge} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${cfg.badge} transition-all duration-300`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`relative flex h-3 w-3`}>
            {status === 'online' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dot}`} />
          </span>
          <span className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</span>
        </div>
        <Icon className={`w-4 h-4 ${cfg.text}`} />
      </div>

      {/* Name & role */}
      {presence && showMeta && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/80 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-sm">
              {presence.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {presence.displayName}
              </p>
              {label && (
                <p className="text-[10px] text-slate-500 font-medium capitalize">{label}</p>
              )}
            </div>
          </div>

          {/* Registered / Guest chip */}
          <div className="flex items-center gap-2 flex-wrap">
            {presence.isRegistered ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 px-2 py-0.5 rounded-full">
                <UserCheck className="w-3 h-3" />
                Registered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                <UserX className="w-3 h-3" />
                Guest
              </span>
            )}
          </div>

          {/* Last seen */}
          {presence.lastSeen && status !== 'online' && (
            <p className="text-[10px] text-slate-400 font-medium">
              Last seen {formatRelative(presence.lastSeen)}
            </p>
          )}
        </div>
      )}

      {/* Placeholder when no presence data */}
      {!presence && showMeta && (
        <p className="text-xs text-slate-400 mt-1">
          Waiting for {label ?? 'participant'} to join…
        </p>
      )}
    </div>
  );
}

// ── Time helper ───────────────────────────────────────────────────────────────
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
