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
  AdminReturn,
  Paged,
  ReturnCondition,
  ReturnDetail,
  ReturnReason,
  ReturnStatus,
  ReturnSummary,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/returns',
  'GET    /api/admin/returns/summary',
  'GET    /api/admin/returns/:id',
  'POST   /api/admin/returns/:id/approve',
  'POST   /api/admin/returns/:id/reject',
  'POST   /api/admin/returns/:id/receive',
  'POST   /api/admin/returns/:id/refund',
];

const FILTERS = ['requested', 'approved', 'received', 'disputed', 'refunded', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<ReturnStatus, string> = {
  requested: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  approved: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  rejected: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  pickup_scheduled: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  picked_up: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  received: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  refunded: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  disputed: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
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

const CONDITIONS: { value: ReturnCondition; label: string }[] = [
  { value: 'unopened', label: 'Unopened — resellable' },
  { value: 'opened', label: 'Opened but intact' },
  { value: 'used', label: 'Used' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'missing', label: 'Items missing' },
];

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

function StatusPill({ status }: { status: ReturnStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[status]}`}
    >
      {label(status)}
    </span>
  );
}

export default function ReturnsPage() {
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

  const { data, loading, error, reload } = useApiData<Paged<AdminReturn>>(`/api/admin/returns?${query}`, [
    filter,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<ReturnSummary>('/api/admin/returns/summary');

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Returns</h1>
        <p className="text-sm text-slate-500">
          Approving a return is not refunding it. The goods come back first, and what arrives is often not what was
          claimed — the refund is decided at inspection.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 10 returns" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting on a decision"
            value={String(summary.requested)}
            icon="undo"
            tone={summary.requested > 0 ? 'pending' : 'neutral'}
          />
          <StatCard
            label="Goods on the way back"
            value={String(summary.awaitingPickup)}
            icon="truck"
            tone="processing"
            hint="Approved, not yet collected"
          />
          <StatCard
            label="Awaiting inspection"
            value={String(summary.awaitingInspection)}
            icon="shield"
            tone="warning"
            hint="Received, refund not decided"
          />
          <StatCard
            label="Refunded this month"
            value={rupees(summary.refundedCents)}
            icon="refund"
            tone="gold"
            hint={`${summary.refundedThisMonth} returns`}
          />
        </div>
      )}

      {summary && summary.disputed > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{summary.disputed}</span> return
            {summary.disputed === 1 ? ' is' : 's are'} disputed — a customer is contesting the outcome.
          </span>
          <button
            onClick={() => {
              setFilter('disputed');
              setPage(1);
            }}
            className="ml-auto shrink-0 rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold hover:bg-rose-100"
          >
            Show them
          </button>
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
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-all duration-200 ${
                filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {f}
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
            placeholder="Return, order or customer…"
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
            emptyMessage={filter === 'requested' ? 'No return is waiting on a decision.' : 'Nothing matches this filter.'}
            columns={[
              {
                header: 'Return',
                render: (r) => (
                  <span>
                    <span className="block font-mono text-xs font-semibold text-ink">{r.reference}</span>
                    <span className="block text-[11px] text-slate-400">{r.orderReference}</span>
                  </span>
                ),
              },
              {
                header: 'Customer',
                render: (r) => (
                  <span>
                    <span className="block font-medium text-ink">{r.customerName}</span>
                    <span className="block text-[11px] text-slate-400">{r.vendorName}</span>
                  </span>
                ),
              },
              {
                header: 'Reason',
                render: (r) => (
                  <span>
                    <span className="block text-xs font-semibold text-slate-600">{REASON_LABEL[r.reason]}</span>
                    <span className="block text-[11px] text-slate-400">
                      {r.itemCount} item{r.itemCount === 1 ? '' : 's'}
                      {r.evidenceCount > 0 && ` · ${r.evidenceCount} photo${r.evidenceCount === 1 ? '' : 's'}`}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Requested',
                className: 'whitespace-nowrap',
                render: (r) => (
                  <span>
                    <span className="block">{formatWhen(r.requestedAt)}</span>
                    {/* Outside the window is the single fact that most changes
                        the decision, so it is flagged in the list, not buried. */}
                    {!r.isWithinWindow && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-700">
                        <Icon name="clock" className="h-2.5 w-2.5" />
                        OUTSIDE WINDOW
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Refundable',
                className: 'text-right tabular-nums',
                render: (r) => (
                  <span>
                    <span className="block font-semibold text-ink">{rupees(r.refundableCents)}</span>
                    {r.approvedRefundCents != null && r.approvedRefundCents !== r.refundableCents && (
                      <span className="block text-[11px] text-amber-600">
                        {rupees(r.approvedRefundCents)} approved
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
                    {r.refundStatus && (
                      <span className="text-[10px] text-slate-400 capitalize">refund {r.refundStatus}</span>
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
                    Review
                  </button>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {openId != null && (
        <ReturnModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ review */

type Pending = 'approve' | 'reject' | 'receive' | null;

function ReturnModal({
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
  const { data, loading, error, reload } = useApiData<ReturnDetail>(`/api/admin/returns/${id}`, [id]);

  const [pending, setPending] = useState<Pending>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [condition, setCondition] = useState<ReturnCondition>('unopened');
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: unknown, message?: string) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/returns/${id}/${path}`, body);
      setPending(null);
      setNote('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : (message ?? 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitApprove(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    const rupeesValue = Number(amount);
    if (!Number.isFinite(rupeesValue) || rupeesValue <= 0) {
      onError('Enter the amount to authorise.');
      return;
    }
    const cents = Math.round(rupeesValue * 100);
    if (cents > data.refundableCents) {
      onError('The refund cannot exceed what was paid for these items.');
      return;
    }
    run('approve', { refundCents: cents, note: note.trim() || null }, 'Could not approve the return.');
  }

  function submitReject(e: FormEvent) {
    e.preventDefault();
    // A rejection the customer cannot understand becomes a dispute.
    if (!note.trim()) {
      onError('Give a reason the customer can read.');
      return;
    }
    run('reject', { reason: note.trim() }, 'Could not reject the return.');
  }

  function submitReceive(e: FormEvent) {
    e.preventDefault();
    run('receive', { condition, note: note.trim() || null }, 'Could not record the inspection.');
  }

  function startApprove() {
    if (!data) return;
    setPending('approve');
    setNote('');
    // Seeded with the full refundable amount — deductions are a deliberate edit.
    setAmount((data.refundableCents / 100).toFixed(2));
  }

  return (
    <Modal title={data ? `Return ${data.reference}` : 'Return'} onClose={onClose} wide>
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
            {!data.isWithinWindow && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                OUTSIDE THE RETURN WINDOW
              </span>
            )}
          </div>

          {data.disputeReason && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <span className="font-semibold">Disputed:</span> {data.disputeReason}
            </p>
          )}

          {data.reasonNote && (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">
              {data.reasonNote}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Order" value={data.orderReference} />
            <Field label="Customer" value={data.customerName} />
            <Field label="Phone" value={data.customerPhone ?? '—'} />
            <Field label="Vendor" value={data.vendorName} />
            <Field label="Window closes" value={formatWhen(data.windowClosesAt)} />
            <Field label="Received" value={formatWhen(data.receivedAt)} />
          </dl>

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Items coming back</h3>
            <div className="mt-2 space-y-1.5">
              {data.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                      <Icon name="box" className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{item.productName}</span>
                    <span className="block text-[11px] text-slate-400">
                      {item.quantity} × {rupees(item.unitPriceCents)}
                      {item.sku && ` · ${item.sku}`}
                      {item.condition && ` · arrived ${label(item.condition)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                    {rupees(item.refundableCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {data.evidence.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Evidence from the customer
              </h3>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {data.evidence.map((e) => (
                  <a
                    key={e.id}
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    title={e.caption ?? 'Open full size'}
                    className="group relative block overflow-hidden rounded-xl border border-slate-200"
                  >
                    {e.kind === 'video' ? (
                      <span className="flex aspect-square items-center justify-center bg-slate-100 text-slate-400">
                        <Icon name="chevron" className="h-6 w-6" />
                      </span>
                    ) : (
                      <img src={e.url} alt={e.caption ?? ''} className="aspect-square w-full object-cover" />
                    )}
                    {e.caption && (
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                        {e.caption}
                      </span>
                    )}
                  </a>
                ))}
              </div>
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

          {pending === 'approve' && (
            <form onSubmit={submitApprove} className="space-y-2.5 rounded-xl border border-emerald/30 bg-mint-mist/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Refund to authorise (₹)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Up to {rupees(data.refundableCents)}. Lower it to deduct shipping or damage.
                </span>
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note for the customer (optional)"
                className={inputClass}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  {busy ? 'Approving…' : 'Approve and schedule pickup'}
                </button>
              </div>
            </form>
          )}

          {pending === 'reject' && (
            <form onSubmit={submitReject} className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Why is it rejected?
                </span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
                <span className="mt-1 block text-[11px] text-slate-500">
                  The customer sees this, and can dispute it.
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy ? 'Rejecting…' : 'Reject return'}
                </button>
              </div>
            </form>
          )}

          {pending === 'receive' && (
            <form onSubmit={submitReceive} className="space-y-2.5 rounded-xl border border-slate-200 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  How did the goods arrive?
                </span>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as ReturnCondition)}
                  className={inputClass}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What the inspection found"
                className={inputClass}
              />
              <p className="text-[11px] text-slate-500">
                Recording a worse condition than claimed does not change the approved amount on its own — reduce the
                refund before releasing it.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Record inspection'}
                </button>
              </div>
            </form>
          )}

          {pending === null && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {data.creditNoteNumber && (
                <span className="mr-auto font-mono text-[11px] text-slate-400">
                  Credit note {data.creditNoteNumber}
                </span>
              )}
              {(data.status === 'requested' || data.status === 'disputed') && (
                <>
                  <button
                    onClick={() => {
                      setPending('reject');
                      setNote('');
                    }}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    Reject
                  </button>
                  <button
                    onClick={startApprove}
                    className="rounded-lg border border-state-success/30 bg-state-success/10 px-3.5 py-1.5 text-xs font-semibold text-state-success-ink hover:bg-state-success/20"
                  >
                    Approve
                  </button>
                </>
              )}
              {(data.status === 'picked_up' || data.status === 'pickup_scheduled') && (
                <button
                  onClick={() => {
                    setPending('receive');
                    setNote('');
                  }}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep"
                >
                  Record inspection
                </button>
              )}
              {data.status === 'received' && (
                <button
                  onClick={() => run('refund', undefined, 'Could not release the refund.')}
                  disabled={busy || data.approvedRefundCents == null}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  {data.approvedRefundCents == null
                    ? 'No amount approved'
                    : `Release ${rupees(data.approvedRefundCents)}`}
                </button>
              )}
              {data.status === 'refunded' && (
                <span className="text-[11px] text-slate-400">
                  Refunded{data.refundStatus ? ` · ${data.refundStatus}` : ''}. Closed.
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
