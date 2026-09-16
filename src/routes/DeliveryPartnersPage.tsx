import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type {
  AdminDeliveryPartner,
  DeliveryPartnerDetail,
  DeliveryPartnerSummary,
  Paged,
  PartnerDocument,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/delivery-partners',
  'GET    /api/admin/delivery-partners/summary',
  'GET    /api/admin/delivery-partners/:id',
  'POST   /api/admin/delivery-partners/:id/approve',
  'POST   /api/admin/delivery-partners/:id/reject',
  'POST   /api/admin/delivery-partners/:id/suspend',
  'PATCH  /api/admin/delivery-partners/:id',
];

const FILTERS = ['pending', 'active', 'suspended', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

/** Nobody may be given work without these on file and in date. */
const REQUIRED_DOCS: PartnerDocument['type'][] = ['licence', 'id_proof'];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function percent(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

/** Lapsed, or close enough that it will lapse mid-assignment. */
function docState(doc: PartnerDocument): 'expired' | 'expiring' | 'ok' {
  if (!doc.expiresAt) return 'ok';
  const days = (new Date(doc.expiresAt).getTime() - Date.now()) / 86400000;
  if (days < 0) return 'expired';
  if (days < 30) return 'expiring';
  return 'ok';
}

/** What stops this partner being approved, in plain words. */
function blockers(docs: PartnerDocument[]): string[] {
  const reasons: string[] = [];
  for (const type of REQUIRED_DOCS) {
    const doc = docs.find((d) => d.type === type);
    if (!doc) reasons.push(`No ${type.replace('_', ' ')} on file`);
    else if (docState(doc) === 'expired') reasons.push(`The ${type.replace('_', ' ')} has expired`);
    else if (doc.status === 'rejected') reasons.push(`The ${type.replace('_', ' ')} was rejected`);
  }
  return reasons;
}

export default function DeliveryPartnersPage() {
  const [filter, setFilter] = useState<Filter>('pending');
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

  const { data, loading, error, reload } = useApiData<Paged<AdminDeliveryPartner>>(
    `/api/admin/delivery-partners?${query}`,
    [filter, page, debounced],
  );
  const { data: summary, reload: reloadSummary } = useApiData<DeliveryPartnerSummary>(
    '/api/admin/delivery-partners/summary',
  );

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Delivery Partners</h1>
        <p className="text-sm text-slate-500">
          Riders and courier agencies. Two things decide whether one can be given work: paperwork that is in date, and
          capacity left today.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 21 delivery partners" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting to be onboarded"
            value={String(summary.pending)}
            icon="idcard"
            tone={summary.pending > 0 ? 'pending' : 'neutral'}
          />
          <StatCard
            label="On the road now"
            value={String(summary.online)}
            icon="bike"
            tone="processing"
            hint={`of ${summary.active} active partners`}
          />
          <StatCard
            label="Delivered today"
            value={String(summary.deliveredToday)}
            icon="package"
            tone="positive"
            hint={`${summary.failedToday} failed`}
          />
          <StatCard
            label="Cash held by riders"
            value={rupees(summary.codHeldCents)}
            icon="coins"
            tone={summary.codHeldCents > 0 ? 'gold' : 'neutral'}
            hint="Collected, not yet handed over"
          />
        </div>
      )}

      {summary && summary.expiringDocuments > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{summary.expiringDocuments}</span> partner
            {summary.expiringDocuments === 1 ? ' has' : 's have'} paperwork that has lapsed or is about to. They should
            not be carrying orders on an expired licence.
          </span>
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
            placeholder="Name, phone or vehicle…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(p) => p.id}
            emptyMessage={filter === 'pending' ? 'Nobody is waiting to be onboarded.' : 'Nothing matches this filter.'}
            columns={[
              {
                header: 'Partner',
                render: (p) => (
                  <span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink">{p.name}</span>
                      {p.status === 'active' && (
                        // Online is a live fact, not a status — an active
                        // partner who is off shift cannot take work either.
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${p.isOnline ? 'bg-state-success' : 'bg-slate-300'}`}
                          title={p.isOnline ? 'Online' : 'Offline'}
                        />
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-400 capitalize">
                      {p.type} · {p.phone}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Vehicle',
                render: (p) => (
                  <span>
                    <span className="block text-sm text-ink capitalize">{p.vehicleType ?? '—'}</span>
                    {p.vehicleNumber && (
                      <span className="block font-mono text-[11px] text-slate-400">{p.vehicleNumber}</span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Covers',
                render: (p) => (
                  <span className="block max-w-[10rem] truncate text-xs text-slate-500">
                    {p.serviceAreas.length === 0 ? 'No area set' : p.serviceAreas.join(', ')}
                  </span>
                ),
              },
              {
                header: 'Load',
                className: 'text-right tabular-nums',
                render: (p) => (
                  <span>
                    <span
                      className={`block font-semibold ${
                        p.activeAssignments >= p.dailyCapacity ? 'text-state-error' : 'text-ink'
                      }`}
                    >
                      {p.activeAssignments} / {p.dailyCapacity}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {p.deliveredToday} done today
                    </span>
                  </span>
                ),
              },
              {
                header: 'On time',
                className: 'text-right tabular-nums',
                render: (p) => (
                  <span>
                    <span
                      className={`block font-semibold ${
                        p.onTimeRate != null && p.onTimeRate < 0.8 ? 'text-state-error' : 'text-slate-600'
                      }`}
                    >
                      {percent(p.onTimeRate)}
                    </span>
                    {p.failureRate != null && p.failureRate > 0.05 && (
                      <span className="block text-[11px] text-state-error">{percent(p.failureRate)} failed</span>
                    )}
                  </span>
                ),
              },
              {
                header: 'COD held',
                className: 'text-right tabular-nums',
                render: (p) =>
                  p.codHeldCents === 0 ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span className="font-semibold text-gold-deep">{rupees(p.codHeldCents)}</span>
                  ),
              },
              { header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
              {
                header: '',
                className: 'text-right',
                render: (p) => (
                  <button
                    onClick={() => {
                      setOpenId(p.id);
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
        <PartnerModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

type Pending = 'reject' | 'suspend' | 'capacity' | null;

function PartnerModal({
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
  const { data, loading, error, reload } = useApiData<DeliveryPartnerDetail>(`/api/admin/delivery-partners/${id}`, [
    id,
  ]);

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(method: 'post' | 'patch', path: string, body?: unknown, fallback?: string) {
    onError(null);
    setBusy(true);
    try {
      const url = path ? `/api/admin/delivery-partners/${id}/${path}` : `/api/admin/delivery-partners/${id}`;
      await api[method](url, body);
      setPending(null);
      setReason('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : (fallback ?? 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitReason(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      onError('Give a reason — the partner is told what it says.');
      return;
    }
    run('post', pending === 'reject' ? 'reject' : 'suspend', { reason: reason.trim() });
  }

  function submitCapacity(e: FormEvent) {
    e.preventDefault();
    const value = Number(capacity);
    if (!Number.isInteger(value) || value < 0) {
      onError('Capacity must be a whole number of deliveries.');
      return;
    }
    run('patch', '', { dailyCapacity: value }, 'Could not change the capacity.');
  }

  const stopping = data ? blockers(data.documents) : [];

  return (
    <Modal title={data ? data.name : 'Delivery partner'} onClose={onClose} wide>
      {loading && <div className="py-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <span className="text-xs text-slate-500 capitalize">{data.type}</span>
            {data.status === 'active' && (
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  data.isOnline ? 'bg-state-success/12 text-state-success-ink' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${data.isOnline ? 'bg-state-success' : 'bg-slate-400'}`} />
                {data.isOnline ? 'online' : 'offline'}
              </span>
            )}
          </div>

          {data.statusReason && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{data.statusReason}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Phone" value={data.phone} />
            <Field label="Email" value={data.email ?? '—'} />
            <Field label="Vehicle" value={[data.vehicleType, data.vehicleNumber].filter(Boolean).join(' · ') || '—'} />
            <Field label="Onboarded" value={formatDate(data.onboardedAt)} />
            <Field label="Deliveries" value={String(data.deliveriesTotal)} />
            <Field
              label="Rating"
              value={data.ratingAvg == null ? '—' : `${data.ratingAvg.toFixed(1)} (${data.ratingCount})`}
            />
          </dl>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="On time" value={percent(data.onTimeRate)} bad={data.onTimeRate != null && data.onTimeRate < 0.8} />
            <Metric
              label="Failed deliveries"
              value={percent(data.failureRate)}
              bad={data.failureRate != null && data.failureRate > 0.05}
            />
            <Metric
              label="Cash held"
              value={rupees(data.codHeldCents)}
              hint={`last handed over ${formatDate(data.lastSettlementAt)}`}
              bad={data.codHeldCents > 0}
            />
          </div>

          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Load today</span>
              <button onClick={() => { setPending('capacity'); setCapacity(String(data.dailyCapacity)); }} className="text-xs font-semibold text-emerald-deep hover:underline">
                Change capacity
              </button>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="font-bold text-ink tabular-nums">
                {data.activeAssignments} of {data.dailyCapacity} slots used
              </span>
              <span className="text-slate-500 tabular-nums">
                {data.deliveredToday} delivered · {data.failedToday} failed
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  data.activeAssignments >= data.dailyCapacity ? 'bg-state-error' : 'bg-emerald'
                }`}
                style={{
                  width: `${Math.max(2, Math.min(1, data.dailyCapacity > 0 ? data.activeAssignments / data.dailyCapacity : 0) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Paperwork</h3>
            <div className="mt-2 space-y-1.5">
              {data.documents.map((doc) => {
                const state = docState(doc);
                return (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 hover:border-emerald ${
                      state === 'expired' ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200'
                    }`}
                  >
                    <Icon name="filetext" className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink capitalize">
                        {doc.type.replace('_', ' ')}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        uploaded {formatDate(doc.uploadedAt)}
                        {doc.expiresAt && ` · expires ${formatDate(doc.expiresAt)}`}
                      </span>
                    </span>
                    {state !== 'ok' && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          state === 'expired' ? 'bg-state-error/15 text-state-error-ink' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {state}
                      </span>
                    )}
                    <span className="shrink-0 text-[10px] font-bold text-slate-400 uppercase">{doc.status}</span>
                  </a>
                );
              })}
              {data.documents.length === 0 && (
                <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-400">
                  Nothing uploaded yet.
                </p>
              )}
            </div>
          </div>

          {data.assignments.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Carrying now ({data.assignments.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {data.assignments.map((a) => (
                  <div
                    key={a.shipmentId}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs font-semibold text-ink">{a.trackingNumber}</span>
                      <span className="block text-[11px] text-slate-400">
                        {a.area ?? 'Area unknown'} · {a.status.replace(/_/g, ' ')}
                      </span>
                    </span>
                    {a.codAmountCents != null && (
                      <span className="shrink-0 text-sm font-semibold text-gold-deep tabular-nums">
                        {rupees(a.codAmountCents)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(pending === 'reject' || pending === 'suspend') && (
            <form onSubmit={submitReason} className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  {pending === 'reject' ? 'Why are they turned down?' : 'Why are they suspended?'}
                </span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
                {pending === 'suspend' && data.activeAssignments > 0 && (
                  <span className="mt-1 block text-[11px] font-semibold text-amber-700">
                    They are carrying {data.activeAssignments} shipment
                    {data.activeAssignments === 1 ? '' : 's'} right now. Those need reassigning.
                  </span>
                )}
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
                  {busy ? 'Saving…' : pending === 'reject' ? 'Turn down' : 'Suspend'}
                </button>
              </div>
            </form>
          )}

          {pending === 'capacity' && (
            <form onSubmit={submitCapacity} className="space-y-2.5 rounded-xl border border-slate-200 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Deliveries per day
                </span>
                <input
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={inputClass}
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Zero stops new assignments without suspending them.
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save capacity'}
                </button>
              </div>
            </form>
          )}

          {pending === null && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              {/* The reasons are listed rather than left implicit — a disabled
                  button with no explanation is the worst of both. */}
              {data.status === 'pending' && stopping.length > 0 && (
                <ul className="space-y-0.5">
                  {stopping.map((r) => (
                    <li key={r} className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
                      <Icon name="alert" className="h-3 w-3 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {data.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        setPending('reject');
                        setReason('');
                      }}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      Turn down
                    </button>
                    <button
                      onClick={() => run('post', 'approve', undefined, 'Could not onboard the partner.')}
                      disabled={busy || stopping.length > 0}
                      className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                    >
                      {stopping.length > 0 ? 'Paperwork incomplete' : 'Onboard partner'}
                    </button>
                  </>
                )}
                {data.status === 'active' && (
                  <button
                    onClick={() => {
                      setPending('suspend');
                      setReason('');
                    }}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Suspend
                  </button>
                )}
                {(data.status === 'suspended' || data.status === 'rejected') && (
                  <button
                    onClick={() => run('post', 'approve', undefined, 'Could not reinstate the partner.')}
                    disabled={busy || stopping.length > 0}
                    className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                  >
                    {stopping.length > 0 ? 'Paperwork incomplete' : 'Reinstate'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Metric({ label, value, hint, bad }: { label: string; value: string; hint?: string; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
      <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${bad ? 'text-state-error' : 'text-ink'}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
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
