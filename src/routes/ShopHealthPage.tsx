import { useState } from 'react';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';

/** One shop's health (GET /api/admin/vendors/health, VD29). */
interface ShopHealth {
  vendorId: number;
  shop: string;
  status: string;
  city: string | null;
  score: number;
  basedOnOrders: boolean;
  reliabilityPercent: number | null;
  rating: { average: number; count: number } | null;
  ordersTotal: number;
  setupDone: number;
  setupTotal: number;
  missing: { key: string; label: string; fix: string | null }[];
}

const FILTERS = ['approved', 'pending', 'suspended', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const tone = (score: number) =>
  score >= 75 ? 'bg-emerald-100 text-emerald-800' : score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';

/**
 * Vendors → Shop health: the same score each shop sees on its Health page in
 * the vendor app — reliability (acceptance and cancellations), rating and
 * setup — lowest first, with the setup steps each shop is missing so you can
 * help it fix them.
 */
export default function ShopHealthPage() {
  const [filter, setFilter] = useState<Filter>('approved');
  const qs = filter === 'all' ? '' : `?status=${filter}`;
  const { data, loading, error } = useApiData<{ rows: ShopHealth[] }>(`/api/admin/vendors/health${qs}`, [filter]);
  const rows = data?.rows ?? [];
  const low = rows.filter((r) => r.score < 50).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Shop health</h1>
        <p className="text-sm text-slate-500">
          The score each shop sees in the vendor app: 60% reliability (acceptance, cancellations), 20% rating, 20% setup — setup
          alone before a shop's first order. Lowest first.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
        {data && (
          <span className="text-xs text-slate-500">
            {rows.length} {rows.length === 1 ? 'shop' : 'shops'} · {low} below 50
          </span>
        )}
      </div>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Score',
                render: (r) => <span className={`inline-block min-w-11 rounded-full px-2 py-0.5 text-center text-sm font-bold tabular-nums ${tone(r.score)}`}>{r.score}</span>,
              },
              {
                header: 'Shop',
                render: (r) => (
                  <div>
                    <div className="font-medium">{r.shop}</div>
                    <div className="text-xs text-slate-400">{[r.city, r.status !== 'approved' ? r.status : null].filter(Boolean).join(' · ')}</div>
                  </div>
                ),
              },
              {
                header: 'Orders',
                render: (r) =>
                  r.basedOnOrders ? (
                    <div className="text-xs">
                      <div>{r.ordersTotal} orders · {r.reliabilityPercent}% reliable</div>
                      <div className="text-slate-500">{r.rating ? `★ ${r.rating.average} (${r.rating.count})` : 'No ratings yet'}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">No orders yet — setup only</span>
                  ),
              },
              { header: 'Setup', render: (r) => <span className="tabular-nums">{r.setupDone}/{r.setupTotal}</span> },
              {
                header: 'Missing setup',
                render: (r) =>
                  r.missing.length === 0 ? (
                    <span className="text-xs font-medium text-emerald-700">All done</span>
                  ) : (
                    <ul className="max-w-md space-y-1">
                      {r.missing.map((m) => (
                        <li key={m.key} className="text-xs">
                          <span className="font-medium text-slate-800">{m.label}</span>
                          {m.fix && <span className="text-slate-500"> — {m.fix}</span>}
                        </li>
                      ))}
                    </ul>
                  ),
              },
            ]}
            rows={rows}
            keyFor={(r) => r.vendorId}
            emptyMessage="No shops here."
          />
        </div>
      )}
    </div>
  );
}
