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
import type { AdminRfq, Paged, RfqDetail, RfqStatus, RfqSummary, RfqVendor } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/rfqs',
  'GET    /api/admin/rfqs/summary',
  'GET    /api/admin/rfqs/:id',
  'POST   /api/admin/rfqs/:id/invite',
  'POST   /api/admin/rfqs/:id/close',
  'POST   /api/admin/rfqs/:id/cancel',
];

const FILTERS = ['open', 'closed', 'awarded', 'expired', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<RfqStatus, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  open: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  closed: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  awarded: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
  expired: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
};

const VENDOR_TONE: Record<RfqVendor['status'], string> = {
  invited: 'bg-slate-100 text-slate-500',
  viewed: 'bg-state-pending/12 text-state-pending-ink',
  quoted: 'bg-state-success/12 text-state-success-ink',
  declined: 'bg-state-error/12 text-state-error-ink',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * How long a vendor still has. Returned as a phrase because "closes in 3 h" is
 * what an operator acts on, where a timestamp needs working out.
 */
function closesIn(value: string | null): { text: string; urgent: boolean } | null {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return { text: 'closed', urgent: true };
  const hours = ms / 3600000;
  if (hours < 1) return { text: `closes in ${Math.round(ms / 60000)} min`, urgent: true };
  if (hours < 24) return { text: `closes in ${Math.round(hours)} h`, urgent: true };
  return { text: `closes in ${Math.round(hours / 24)} d`, urgent: false };
}

export default function RfqPage() {
  const [filter, setFilter] = useState<Filter>('open');
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

  const { data, loading, error, reload } = useApiData<Paged<AdminRfq>>(`/api/admin/rfqs?${query}`, [
    filter,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<RfqSummary>('/api/admin/rfqs/summary');

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">RFQ Management</h1>
        <p className="text-sm text-slate-500">
          A business asking for a price on a basket no listing covers. Vendors are invited, not matched — the buyer
          wants competing quotes, not one shop chosen for them.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 11 RFQ" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open RFQs" value={String(summary.open)} icon="filetext" tone="accent" />
          <StatCard
            label="Closing with no quotes"
            value={String(summary.closingSoon)}
            icon="clock"
            tone={summary.closingSoon > 0 ? 'critical' : 'neutral'}
            hint="Invite someone, or they expire"
          />
          <StatCard
            label="Awaiting quotes"
            value={String(summary.awaitingQuotes)}
            icon="quote"
            tone="pending"
            hint="Invited, nothing back yet"
          />
          <StatCard
            label="Awarded this month"
            value={rupees(summary.awardedValueCents)}
            icon="coins"
            tone="gold"
            hint={`${summary.awardedThisMonth} RFQs`}
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
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-all duration-200 ${
                filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Reference, title or business…"
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
            emptyMessage={filter === 'open' ? 'No RFQ is open right now.' : 'Nothing matches this filter.'}
            columns={[
              {
                header: 'RFQ',
                render: (r) => (
                  <span>
                    <span className="block font-semibold text-ink">{r.title}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{r.reference}</span>
                  </span>
                ),
              },
              {
                header: 'Business',
                render: (r) => (
                  <span>
                    <span className="block text-ink">{r.businessName}</span>
                    <span className="block text-[11px] text-slate-400">{r.buyerName}</span>
                  </span>
                ),
              },
              {
                header: 'Basket',
                className: 'text-right tabular-nums',
                render: (r) => (
                  <span>
                    <span className="block">
                      {r.itemCount} line{r.itemCount === 1 ? '' : 's'}
                    </span>
                    {r.estimatedValueCents != null && (
                      <span className="block text-[11px] text-slate-400">
                        ~{rupees(r.estimatedValueCents)} target
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Responses',
                render: (r) => (
                  <span>
                    <span className="block text-sm font-semibold text-ink tabular-nums">
                      {r.quotedCount}
                      <span className="text-slate-400"> / {r.invitedCount} quoted</span>
                    </span>
                    {r.invitedCount === 0 && (
                      <span className="block text-[11px] font-semibold text-rose-600">nobody invited</span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Best quote',
                className: 'text-right tabular-nums',
                render: (r) =>
                  r.bestQuoteCents == null ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span className="font-bold text-ink">{rupees(r.bestQuoteCents)}</span>
                  ),
              },
              {
                header: 'Deadline',
                className: 'whitespace-nowrap',
                render: (r) => {
                  const timing = r.status === 'open' ? closesIn(r.closesAt) : null;
                  return (
                    <span>
                      <span className="block">{formatDate(r.closesAt)}</span>
                      {timing && (
                        <span
                          className={`block text-[11px] font-semibold ${
                            timing.urgent ? 'text-state-error' : 'text-slate-400'
                          }`}
                        >
                          {timing.text}
                        </span>
                      )}
                    </span>
                  );
                },
              },
              {
                header: 'Status',
                render: (r) => (
                  <span className="flex flex-col gap-1">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[r.status]}`}
                    >
                      {r.status}
                    </span>
                    {r.awardedVendorName && (
                      <span className="text-[10px] text-slate-400">to {r.awardedVendorName}</span>
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
        <RfqModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function RfqModal({
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
  const { data, loading, error, reload } = useApiData<RfqDetail>(`/api/admin/rfqs/${id}`, [id]);

  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: unknown, message?: string) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/rfqs/${id}/${path}`, body);
      setPicked(new Set());
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
      onError('Say why — invited vendors are told.');
      return;
    }
    run('cancel', { reason: reason.trim() }, 'Could not cancel the RFQ.');
  }

  function toggle(vendorId: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  }

  const timing = data?.status === 'open' ? closesIn(data.closesAt) : null;
  const quoted = data ? data.vendors.filter((v) => v.status === 'quoted') : [];

  return (
    <Modal title={data ? data.title : 'RFQ'} onClose={onClose} wide>
      {loading && <div className="py-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] uppercase ${STATUS_TONE[data.status]}`}
            >
              {data.status}
            </span>
            <span className="font-mono text-xs text-slate-500">{data.reference}</span>
            {timing && (
              <span className={`text-xs font-semibold ${timing.urgent ? 'text-state-error' : 'text-slate-400'}`}>
                {timing.text}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Business" value={data.businessName} />
            <Field label="Raised by" value={data.buyerName} />
            <Field label="Raised on" value={formatDate(data.createdAt)} />
            <Field label="Wanted by" value={formatDate(data.deliveryBy)} />
            <Field label="Deliver to" value={data.deliveryCity ?? '—'} />
            <Field label="Quotes closed" value={formatDate(data.closesAt)} />
          </dl>

          {data.notes && (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">{data.notes}</p>
          )}

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">What is being asked for</h3>
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <span className="block font-medium text-ink">{item.productName}</span>
                        {item.specification && (
                          <span className="block text-[11px] text-slate-500">{item.specification}</span>
                        )}
                        {/* Off-catalogue lines are the ones a vendor has to
                            read carefully before pricing. */}
                        {item.productId == null && (
                          <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-700">
                            NOT IN CATALOGUE
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-slate-500 tabular-nums">
                        {item.targetPriceCents == null ? (
                          <span className="text-slate-300">no target</span>
                        ) : (
                          `target ${rupees(item.targetPriceCents)}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Invited vendors ({data.vendors.length})
            </h3>
            {data.vendors.length === 0 ? (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                Nobody has been invited. This RFQ will expire without a single quote.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {data.vendors.map((v) => (
                  <div
                    key={v.vendorId}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{v.vendorName}</span>
                      <span className="block text-[11px] text-slate-400">
                        invited {formatDate(v.invitedAt)}
                        {v.distanceKm != null && ` · ${v.distanceKm.toFixed(1)} km`}
                        {v.declineReason && ` · ${v.declineReason}`}
                      </span>
                    </span>
                    {v.quotedTotalCents != null && (
                      <span
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          v.quotedTotalCents === data.bestQuoteCents ? 'text-state-success' : 'text-ink'
                        }`}
                      >
                        {rupees(v.quotedTotalCents)}
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${VENDOR_TONE[v.status]}`}
                    >
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suggestions only matter while the RFQ can still take quotes. */}
          {data.status === 'open' && data.suggestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Worth inviting</h3>
                {picked.size > 0 && (
                  <button
                    onClick={() => run('invite', { vendorIds: [...picked] }, 'Could not send the invitations.')}
                    disabled={busy}
                    className="rounded-lg bg-emerald px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                  >
                    {busy ? 'Inviting…' : `Invite ${picked.size}`}
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {data.suggestions.map((s) => (
                  <label
                    key={s.vendorId}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                      picked.has(s.vendorId) ? 'border-emerald/40 bg-mint-mist' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(s.vendorId)}
                      onChange={() => toggle(s.vendorId)}
                      className="h-4 w-4 shrink-0 accent-emerald"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{s.vendorName}</span>
                      <span className="block text-[11px] text-slate-400">
                        covers {s.matchedItems} of {data.items.length} lines
                        {s.distanceKm != null && ` · ${s.distanceKm.toFixed(1)} km`}
                        {s.ratingAvg != null && ` · ${s.ratingAvg.toFixed(1)}★`}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {cancelling ? (
            <form onSubmit={submitCancel} className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Why is it cancelled?
                </span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelling(false)}
                  className="text-xs font-semibold text-slate-500"
                >
                  Keep it open
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy ? 'Cancelling…' : 'Cancel RFQ'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {data.status === 'open' && (
                <>
                  <button
                    onClick={() => setCancelling(true)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    Cancel RFQ
                  </button>
                  <button
                    onClick={() => run('close', undefined, 'Could not close the RFQ.')}
                    disabled={busy || quoted.length === 0}
                    className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                  >
                    {quoted.length === 0
                      ? 'No quotes to compare yet'
                      : `Close and compare ${quoted.length} quote${quoted.length === 1 ? '' : 's'}`}
                  </button>
                </>
              )}
              {data.status === 'closed' && (
                <span className="text-[11px] text-slate-400">
                  Closed to new quotes. Award it from Quotations.
                </span>
              )}
              {data.status === 'awarded' && (
                <span className="text-[11px] text-slate-400">Awarded to {data.awardedVendorName}.</span>
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
