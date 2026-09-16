import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type {
  AdminReplacement,
  Paged,
  ReplacementDetail,
  ReplacementStatus,
  ReplacementSummary,
  ReturnReason,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/replacements',
  'GET    /api/admin/replacements/summary',
  'GET    /api/admin/replacements/:id',
  'POST   /api/admin/replacements/:id/approve',
  'POST   /api/admin/replacements/:id/cancel',
  'POST   /api/admin/replacements/:id/reassign',
];

const FILTERS = ['requested', 'awaiting_stock', 'approved', 'delivered', 'failed', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<ReplacementStatus, string> = {
  requested: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  awaiting_stock: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  approved: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  order_created: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  shipped: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  delivered: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
  failed: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
};

const REASON_LABEL: Record<ReturnReason, string> = {
  damaged: 'Arrived damaged',
  wrong_item: 'Wrong item',
  not_as_described: 'Not as described',
  quality: 'Quality issue',
  expired: 'Expired stock',
  missing_parts: 'Missing parts',
  other: 'Other',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusPill({ status }: { status: ReplacementStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[status]}`}
    >
      {label(status)}
    </span>
  );
}

export default function ReplacementsPage() {
  const [filter, setFilter] = useState<Filter>('requested');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [openId, setOpenId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    filter === 'all' ? '' : `status=${filter}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminReplacement>>(`/api/admin/replacements?${query}`, [
    filter,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<ReplacementSummary>('/api/admin/replacements/summary');

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Replacements</h1>
        <p className="text-sm text-slate-500">
          Raised from an approved return when the customer wants the item, not the money. Nothing is promised until
          stock is confirmed — and it may have to come from a different shop.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 10 replacements" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting on a decision"
            value={String(summary.awaitingDecision)}
            icon="swap"
            tone={summary.awaitingDecision > 0 ? 'pending' : 'neutral'}
          />
          <StatCard
            label="Blocked on stock"
            value={String(summary.awaitingStock)}
            icon="package"
            tone={summary.awaitingStock > 0 ? 'critical' : 'neutral'}
            hint="Nobody can fulfil these yet"
          />
          <StatCard
            label="In fulfilment"
            value={String(summary.inFulfilment)}
            icon="truck"
            tone="processing"
            hint="Replacement order placed"
          />
          <StatCard
            label="Cost absorbed"
            value={rupees(summary.priceDifferenceCents)}
            icon="coins"
            tone="gold"
            hint={`${summary.deliveredThisMonth} delivered this month`}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap capitalize transition-all duration-200 ${
                filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {label(f)}
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
            placeholder="Replacement, return or customer…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(r) => r.id}
            emptyMessage={
              filter === 'requested' ? 'No replacement is waiting on a decision.' : 'Nothing matches this filter.'
            }
            columns={[
              {
                header: 'Replacement',
                render: (r) => (
                  <span>
                    <span className="block font-mono text-xs font-semibold text-ink">{r.reference}</span>
                    <span className="block text-[11px] text-slate-400">from {r.returnReference}</span>
                  </span>
                ),
              },
              {
                header: 'Customer',
                render: (r) => (
                  <span>
                    <span className="block font-medium text-ink">{r.customerName}</span>
                    <span className="block text-[11px] text-slate-400">{r.originalOrderReference}</span>
                  </span>
                ),
              },
              {
                header: 'Fulfilled by',
                render: (r) =>
                  r.fulfilVendorId && r.fulfilVendorId !== r.vendorId ? (
                    // Worth showing on the row: a replacement sourced elsewhere
                    // is a different commercial arrangement, not a detail.
                    <span>
                      <span className="block font-medium text-ink">{r.fulfilVendorName}</span>
                      <span className="block text-[11px] text-amber-600">instead of {r.vendorName}</span>
                    </span>
                  ) : (
                    <span className="text-ink">{r.vendorName}</span>
                  ),
              },
              {
                header: 'Reason',
                render: (r) => (
                  <span>
                    <span className="block text-xs font-semibold text-slate-600">{REASON_LABEL[r.reason]}</span>
                    <span className="block text-[11px] text-slate-400">
                      {r.itemCount} item{r.itemCount === 1 ? '' : 's'}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Value',
                className: 'text-right tabular-nums',
                render: (r) => (
                  <span>
                    <span className="block font-semibold text-ink">{rupees(r.valueCents)}</span>
                    {r.priceDifferenceCents !== 0 && (
                      <span
                        className={`block text-[11px] ${
                          r.priceDifferenceCents > 0 ? 'text-state-error' : 'text-state-success'
                        }`}
                      >
                        {r.priceDifferenceCents > 0 ? '+' : '−'}
                        {rupees(Math.abs(r.priceDifferenceCents))}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Status',
                render: (r) => (
                  <span className="flex flex-col gap-1">
                    <StatusPill status={r.status} />
                    {r.replacementOrderReference && (
                      <span className="font-mono text-[10px] text-slate-400">{r.replacementOrderReference}</span>
                    )}
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (r) => (
                  <button
                    onClick={() => {
                      setOpenId(r.id);
                      setActionError(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    Open
                  </button>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {openId != null && (
        <ReplacementModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function ReplacementModal({
  id,
  onClose,
  onError,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useApiData<ReplacementDetail>(`/api/admin/replacements/${id}`, [id]);

  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: unknown, message?: string) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/replacements/${id}/${path}`, body);
      setCancelling(false);
      setReason('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : (message ?? 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitCancel(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      onError('Say why — the customer is expecting this replacement.');
      return;
    }
    run('cancel', { reason: reason.trim() }, 'Could not cancel the replacement.');
  }

  // Every line must be coverable by the vendor set to fulfil, or approving it
  // just promises the customer something nobody has.
  const shortfall = data ? data.items.filter((i) => i.availableQty < i.quantity) : [];
  const canApprove = data != null && shortfall.length === 0;
  const decidable = data != null && (data.status === 'requested' || data.status === 'awaiting_stock');

  return (
    <Modal title={data ? `Replacement ${data.reference}` : 'Replacement'} onClose={onClose} wide>
      {loading && <div className="py-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={data.status} />
            <span className="text-sm font-semibold text-ink">{REASON_LABEL[data.reason]}</span>
            {data.priceDifferenceCents > 0 && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                +{rupees(data.priceDifferenceCents)} ABSORBED
              </span>
            )}
          </div>

          {data.blockedReason && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{data.blockedReason}</p>
          )}

          {data.note && (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">{data.note}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="From return" value={data.returnReference} />
            <Field label="Original order" value={data.originalOrderReference} />
            <Field label="Replacement order" value={data.replacementOrderReference ?? 'Not created yet'} />
            <Field label="Customer" value={data.customerName} />
            <Field label="Phone" value={data.customerPhone ?? '—'} />
            <Field label="Fulfilled by" value={data.fulfilVendorName ?? data.vendorName} />
          </dl>

          {data.deliveryAddress && (
            <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
              <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Ship to</div>
              <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{data.deliveryAddress}</p>
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Items to send again</h3>
            <div className="mt-2 space-y-1.5">
              {data.items.map((item) => {
                const short = item.availableQty < item.quantity;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      short ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'
                    }`}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                        <Icon name="box" className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.productName}
                        {item.variantLabel && <span className="text-slate-400"> · {item.variantLabel}</span>}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {item.quantity} × {rupees(item.unitPriceCents)}
                        {item.sku && ` · ${item.sku}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`block text-xs font-bold tabular-nums ${short ? 'text-state-error' : 'text-state-success'}`}
                      >
                        {item.availableQty} in stock
                      </span>
                      {short && <span className="block text-[10px] font-semibold text-rose-600">SHORT</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alternates only earn their space when the chosen vendor is short. */}
          {shortfall.length > 0 && decidable && (
            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Shops that could fulfil instead
              </h3>
              {data.alternates.length === 0 ? (
                <p className="mt-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-400">
                  No other shop in range has these items. The customer has to take a refund instead.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {data.alternates.map((alt) => (
                    <div
                      key={alt.vendorId}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{alt.vendorName}</span>
                        <span className="block text-[11px] text-slate-400">
                          {alt.availableQty} in stock
                          {alt.distanceKm != null && ` · ${alt.distanceKm.toFixed(1)} km away`}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                        {rupees(alt.priceCents)}
                      </span>
                      <button
                        onClick={() =>
                          run('reassign', { vendorId: alt.vendorId }, 'Could not move the replacement.')
                        }
                        disabled={busy}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-50"
                      >
                        Fulfil here
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">History</h3>
            <ol className="mt-2">
              {data.timeline.map((ev, i) => (
                <li key={ev.id} className="flex gap-3">
                  <div className="flex w-4 shrink-0 flex-col items-center">
                    <span className={`mt-1.5 h-2 w-2 rounded-full ${i === 0 ? 'bg-emerald' : 'bg-slate-300'}`} />
                    {i < data.timeline.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-ink capitalize">{label(ev.status)}</span>
                      <span className="text-[11px] text-slate-400">{formatWhen(ev.createdAt)}</span>
                    </div>
                    {ev.note && <p className="text-xs text-slate-500">{ev.note}</p>}
                    <p className="text-[11px] text-slate-400">{ev.actorName ?? ev.actorRole}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {cancelling ? (
            <form onSubmit={submitCancel} className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Why is it cancelled?
                </span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Cancelling here sends the customer back to a refund on {data.returnReference}.
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelling(false)}
                  className="text-xs font-semibold text-slate-500"
                >
                  Keep it
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy ? 'Cancelling…' : 'Cancel replacement'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {decidable && (
                <>
                  <button
                    onClick={() => setCancelling(true)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    Cancel replacement
                  </button>
                  <button
                    onClick={() => run('approve', undefined, 'Could not approve the replacement.')}
                    disabled={busy || !canApprove}
                    className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                  >
                    {canApprove ? 'Approve and create order' : 'Not enough stock to approve'}
                  </button>
                </>
              )}
              {data.status === 'delivered' && (
                <span className="text-[11px] text-slate-400">
                  Delivered {formatWhen(data.deliveredAt)}. Closed.
                </span>
              )}
              {(data.status === 'order_created' || data.status === 'shipped') && (
                <span className="text-[11px] text-slate-400">
                  Tracked as an order now — follow {data.replacementOrderReference} in Shipments.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="truncate font-medium text-ink">{value}</dd>
    </div>
  );
}
