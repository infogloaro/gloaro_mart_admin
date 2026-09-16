import { useMemo, useState } from 'react';
import { isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type { VendorPerformance } from '../lib/types';

const ENDPOINTS = ['GET    /api/admin/vendors/performance', 'GET    /api/admin/vendors/:id/performance'];

const FILTERS = ['all', 'active', 'idle'] as const;
type Filter = (typeof FILTERS)[number];

/** A missing rate is not a zero rate — a vendor with no orders has neither. */
function percent(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

/**
 * Acceptance is read as "higher is better", rejection and cancellation the
 * opposite, so the same number has to be tinted differently per column.
 */
function rateTone(rate: number | null, goodIsHigh: boolean): string {
  if (rate == null) return 'text-slate-400';
  const good = goodIsHigh ? rate >= 0.8 : rate <= 0.1;
  const bad = goodIsHigh ? rate < 0.5 : rate > 0.25;
  if (good) return 'text-state-success font-semibold';
  if (bad) return 'text-state-error font-semibold';
  return 'text-slate-600';
}

function fulfilment(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

export default function VendorPerformancePage() {
  const [filter, setFilter] = useState<Filter>('all');
  const { data, loading, error } = useApiData<VendorPerformance[]>('/api/admin/vendors/performance');

  const rows = useMemo(() => data ?? [], [data]);

  const visible = useMemo(() => {
    if (filter === 'active') return rows.filter((r) => r.orders_total > 0);
    if (filter === 'idle') return rows.filter((r) => r.orders_total === 0);
    return rows;
  }, [rows, filter]);

  const totals = useMemo(() => {
    const orders = rows.reduce((sum, r) => sum + r.orders_total, 0);
    const accepted = rows.reduce((sum, r) => sum + r.orders_accepted, 0);
    const open = rows.reduce((sum, r) => sum + r.open_orders, 0);
    return {
      orders,
      open,
      idle: rows.filter((r) => r.orders_total === 0).length,
      // Weighted across the platform, not an average of per-vendor averages —
      // that would let a vendor with one order swing the headline number.
      acceptance: orders > 0 ? accepted / orders : null,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Vendor Performance</h1>
        <p className="text-sm text-slate-500">
          Acceptance, rejection and fulfilment per vendor. These are the same counters the matching engine ranks on, so a
          vendor sliding here will win fewer orders.
        </p>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Sprint 5 vendor matching" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Orders matched" value={String(totals.orders)} icon="box" tone="accent" />
            <StatCard
              label="Acceptance rate"
              value={percent(totals.acceptance)}
              icon="gauge"
              tone="positive"
              hint="Across all vendors"
            />
            <StatCard
              label="Open orders"
              value={String(totals.open)}
              icon="clock"
              tone="warning"
              hint="Accepted, not yet delivered"
            />
            <StatCard
              label="Vendors with no orders"
              value={String(totals.idle)}
              icon="store"
              tone="neutral"
              hint={`of ${rows.length} total`}
            />
          </div>

          <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

          <div className="card overflow-hidden">
            <DataTable
              rows={visible}
              keyFor={(r) => r.vendor_id}
              emptyMessage={
                filter === 'idle'
                  ? 'Every vendor has been matched at least once.'
                  : 'No vendor performance recorded yet.'
              }
              columns={[
                {
                  header: 'Vendor',
                  render: (r) => (
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-ink">{r.business_name}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  ),
                },
                {
                  header: 'Orders',
                  className: 'text-right tabular-nums',
                  render: (r) => r.orders_total,
                },
                {
                  header: 'Accepted',
                  className: 'text-right tabular-nums',
                  render: (r) => (
                    <span className={rateTone(r.acceptance_rate, true)}>
                      {percent(r.acceptance_rate)}
                      <span className="ml-1 text-xs font-normal text-slate-400">({r.orders_accepted})</span>
                    </span>
                  ),
                },
                {
                  header: 'Rejected',
                  className: 'text-right tabular-nums',
                  render: (r) => (
                    <span className={rateTone(r.rejection_rate, false)}>{percent(r.rejection_rate)}</span>
                  ),
                },
                {
                  header: 'Cancelled',
                  className: 'text-right tabular-nums',
                  render: (r) => (
                    <span className={rateTone(r.cancellation_rate, false)}>{percent(r.cancellation_rate)}</span>
                  ),
                },
                {
                  header: 'Delivered',
                  className: 'text-right tabular-nums',
                  render: (r) => r.orders_delivered,
                },
                {
                  header: 'Open',
                  className: 'text-right tabular-nums',
                  render: (r) =>
                    r.open_orders > 0 ? (
                      <span className="font-semibold text-state-shipped-ink">{r.open_orders}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    ),
                },
                {
                  header: 'Avg fulfilment',
                  className: 'text-right tabular-nums',
                  render: (r) => (
                    <span className={r.avg_fulfilment_minutes == null ? 'text-slate-400' : ''}>
                      {fulfilment(r.avg_fulfilment_minutes)}
                    </span>
                  ),
                },
                {
                  header: 'Rating',
                  className: 'text-right tabular-nums',
                  render: (r) =>
                    r.rating_avg == null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span>
                        {r.rating_avg.toFixed(1)}
                        <span className="ml-1 text-xs font-normal text-slate-400">({r.rating_count})</span>
                      </span>
                    ),
                },
              ]}
            />
          </div>

          <p className="text-xs text-slate-400">
            A dash means there is nothing to measure yet, not a score of zero. Counters update as orders are matched,
            accepted and delivered.
          </p>
        </>
      )}
    </div>
  );
}
