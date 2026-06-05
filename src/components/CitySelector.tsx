/**
 * components/CitySelector.tsx
 * ----------------------------
 * Reusable city dropdown for buyer (delivery city) and seller (pickup city).
 */

import { AVAILABLE_CITIES } from '../lib/fees';
import { MapPin } from 'lucide-react';

interface Props {
  value: string;
  onChange: (city: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function CitySelector({
  value,
  onChange,
  label,
  placeholder = 'Select city…',
  disabled = false,
  className = '',
}: Props) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          {label}
        </span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {AVAILABLE_CITIES.map((city) => (
          <option key={city} value={city}>{city}</option>
        ))}
      </select>
    </div>
  );
}
