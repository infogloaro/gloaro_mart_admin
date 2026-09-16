import { useState } from 'react';
import { isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { Icon } from '../components/ui/Icon';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type { Paged, TowerGroup, TowerOrder, TowerSummary } from '../lib/types';

const ENDPOINTS = ['GET    /api/admin/control-tower', 'GET    /api/admin/control-tower/summary'];

const VIEWS = ['exceptions', 'open', 'delivered', 'all'] as const;
type View = (typeof VIEWS)[number];

const VIEW_LABEL: Record<View, string> = {
  exceptions: 'Needs attention',
  open: 'In progress',
  delivered: 'Completed',
  all: 'Everything',
};

function rupees(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}

/** Minutes read badly past an hour or two, which is where these numbers live. */
function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function ControlTowerPage() {
  const [view, setView] = useState<View>('exceptions');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const debounced = useDebounced(search, 300);

  const query = [
    view === 'exceptions' ? 'exceptionsOnly=true' : '',
    view === 'open' || view === 'delivered' ? `status=${view}` : '',
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
    `page=${page}`,
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error } = useApiData<Paged<TowerGroup>>(`/api/admin/control-tower?${query}`, [
    view,
    debounced,
    page,
  ]);
  const { data: summary } = useApiData<TowerSummary>('/api/admin/control-tower/summary');

  const groups = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Order Control Tower</h1>
        <p className="text-sm text-slate-500">
          Purchases, not vendor orders. A customer who bought from three shops is one row here — which is how they
          describe it when something goes wrong.
        </p>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 18 control tower" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open orders" value={String(summary.openOrders)} icon="cart" tone="accent" />
          <StatCard
            label="Past target time"
            value={String(summary.lateOrders)}
            icon="clock"
            tone={summary.lateOrders > 0 ? 'critical' : 'positive'}
            hint="across all shops"
          />
          <StatCard
            label="Awaiting customer"
            value={String(summary.awaitingCustomer)}
            icon="chat"
            tone={summary.awaitingCustomer > 0 ? 'warning' : 'neutral'}
            hint="dearer replacement offered"
          />
          <StatCard
            label="Payment problems"
            value={String(summary.paymentFailed + summary.paymentIncomplete)}
            icon="card"
            tone={summary.paymentFailed > 0 ? 'critical' : 'neutral'}
            hint={`${summary.paymentFailed} failed · ${summary.paymentIncomplete} incomplete`}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                view === v
                  ? 'bg-gradient-to-r from-emerald to-mint text-white'
                  : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="relative w-60">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Reference or customer…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && groups.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">
            {view === 'exceptions' ? 'Nothing needs attention right now.' : 'No purchases match this view.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((g) => {
          const open = expanded === g.id;
          const worst = g.exceptions[0];
          return (
            <div
              key={g.id}
              className={`card overflow-hidden ${
                worst?.severity === 'high' ? 'border-state-error/30' : worst ? 'border-state-shipped/30' : ''
              }`}
            >
              <button
                onClick={() => setExpanded(open ? null : g.id)}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-mint-mist/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">{g.reference}</span>
                    <StatusBadge status={g.derivedStatus} />
                    <span className="text-xs text-slate-400">{duration(g.ageMinutes)} old</span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <span className="font-semibold text-ink">{g.customerName}</span>
                    <span className="text-slate-500">
                      {g.orders.length} shop{g.orders.length === 1 ? '' : 's'}
                    </span>
                    <span className="font-semibold text-ink tabular-nums">{rupees(g.totalCents)}</span>
                    <span className="text-slate-400">
                      {g.paymentMethod?.toUpperCase()} · {g.paymentStatus}
                    </span>
                  </div>

                  {g.exceptions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.exceptions.map((e) => (
                        <span
                          key={e.code}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                            e.severity === 'high'
                              ? 'bg-state-error/10 text-state-error-ink'
                              : 'bg-state-shipped/12 text-state-shipped-ink'
                          }`}
                        >
                          <Icon name="alert" className="h-3 w-3" />
                          {e.message}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Icon
                  name="chevron"
                  className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
                />
              </button>

              {open && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  {g.customerPhone && (
                    <p className="mb-2 text-xs text-slate-500">
                      Customer phone <span className="font-mono text-slate-700">{g.customerPhone}</span>
                    </p>
                  )}

                  {g.orders.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      This purchase has no vendor orders. Nothing was ever sent to a shop.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {g.orders.map((o) => (
                        <OrderRow key={o.id} order={o} />
                      ))}
                    </div>
                  )}

                  {g.reassignments.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                        Re-routing history
                      </h3>
                      {g.reassignments.map((r) => (
                        <p key={r.id} className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">{r.status.replace(/_/g, ' ')}</span>
                          {r.proposedVendorName && ` → ${r.proposedVendorName}`}
                          {r.reason && ` · ${r.reason}`}
                          {r.proposedTotalCents !== r.originalTotalCents &&
                            ` · ${rupees(r.originalTotalCents)} → ${rupees(r.proposedTotalCents)}`}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data && data.total > 0 && (
        <div className="card overflow-hidden">
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {summary && (
        <p className="text-xs text-slate-400">
          An order counts as late after{' '}
          {Object.entries(summary.slaMinutes)
            .map(([status, mins]) => `${status.replace(/_/g, ' ')} ${mins}m`)
            .join(' · ')}
          . Lateness is worked out from the timeline on each read, never stored.
        </p>
      )}
    </div>
  );
}

/** One shop's slice of the purchase, with how long it has sat where it is. */
function OrderRow({ order }: { order: TowerOrder }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{order.vendorName}</span>
      <StatusBadge status={order.status} />
      <span
        className={`text-xs tabular-nums ${order.isLate ? 'font-bold text-state-error' : 'text-slate-400'}`}
        title={order.slaMinutes ? `Target ${order.slaMinutes} min` : undefined}
      >
        {duration(order.minutesInStatus)}
        {order.slaMinutes != null && ` / ${duration(order.slaMinutes)}`}
      </span>
      <span className="text-xs font-semibold text-slate-600 tabular-nums">{rupees(order.totalCents)}</span>
      {order.deliveryPartnerName && (
        <span className="text-xs text-slate-400">via {order.deliveryPartnerName}</span>
      )}
    </div>
  );
}
