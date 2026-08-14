import { useMemo, useState } from 'react';
import { useApiData } from '../../lib/useApiData';
import { Icon } from './Icon';
import type { AdminVendor } from '../../lib/types';

interface VendorPickerProps {
  value: AdminVendor | null;
  onChange: (vendor: AdminVendor | null) => void;
}

/**
 * Shared vendor selector for the per-vendor configuration modules.
 *
 * Only approved vendors are offered: configuring delivery for a pending or
 * rejected shop has no effect, since it cannot receive orders anyway.
 */
export function VendorPicker({ value, onChange }: VendorPickerProps) {
  const { data: vendors, loading, error } = useApiData<AdminVendor[]>('/api/admin/vendors?status=approved');
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const list = vendors ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.business_name.toLowerCase().includes(q) ||
        (v.city ?? '').toLowerCase().includes(q) ||
        (v.pincode ?? '').includes(q),
    );
  }, [vendors, query]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Select vendor</h2>
          <p className="text-xs text-slate-400">
            {loading ? 'Loading vendors…' : `${vendors?.length ?? 0} approved vendors`}
          </p>
        </div>
        <div className="relative w-56">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shop, city, pincode…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && matches.length === 0 && (
        <p className="py-6 text-center text-sm font-medium text-slate-400">No approved vendor matches that search.</p>
      )}

      <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((v) => {
          const selected = value?.id === v.id;
          const hasPin = v.latitude != null && v.longitude != null;
          return (
            <button
              key={v.id}
              onClick={() => onChange(selected ? null : v)}
              className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                selected
                  ? 'border-emerald bg-mint-mist shadow-[0_10px_26px_-16px_rgba(31,111,91,0.8)]'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:border-mint-soft'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{v.business_name}</span>
                {selected && <Icon name="shield" className="h-4 w-4 shrink-0 text-emerald" />}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">
                {[v.city, v.pincode].filter(Boolean).join(' · ') || 'No location set'}
              </div>
              {!hasPin && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-px text-[9px] font-bold text-amber-700 uppercase">
                  <Icon name="alert" className="h-2.5 w-2.5" />
                  No map pin
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
