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
import type { AdminQuotation, Paged, QuotationDetail, QuotationStatus, QuotationSummary } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/quotations',
  'GET    /api/admin/quotations/summary',
  'GET    /api/admin/quotations/:id',
  'POST   /api/admin/quotations/:id/award',
  'POST   /api/admin/quotations/:id/reject',
  'POST   /api/admin/quotations/:id/request-revision',
  'POST   /api/admin/quotations/:id/messages',
];

const FILTERS = ['submitted', 'revision_requested', 'accepted', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<QuotationStatus, string> = {
  submitted: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  revision_requested: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  revised: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  accepted: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  rejected: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  withdrawn: 'border-slate-200 bg-slate-100 text-slate-500',
  expired: 'border-slate-200 bg-slate-100 text-slate-500',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A quote past its validity is a number the vendor no longer stands behind. */
function isExpired(q: { validUntil: string | null; status: QuotationStatus }): boolean {
  if (!q.validUntil || q.status === 'accepted' || q.status === 'rejected') return false;
  return new Date(q.validUntil).getTime() < Date.now();
}

export default function QuotationsPage() {
  const [filter, setFilter] = useState<Filter>('submitted');
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

  const { data, loading, error, reload } = useApiData<Paged<AdminQuotation>>(`/api/admin/quotations?${query}`, [
    filter,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<QuotationSummary>('/api/admin/quotations/summary');

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Quotations</h1>
        <p className="text-sm text-slate-500">
          Priced answers to an RFQ. Quotes are versioned, not edited — asking for a better price produces a new
          revision, so the negotiation still reads back afterwards.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 11 quotations" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Awaiting review"
            value={String(summary.awaitingReview)}
            icon="quote"
            tone={summary.awaitingReview > 0 ? 'pending' : 'neutral'}
          />
          <StatCard
            label="In negotiation"
            value={String(summary.inNegotiation)}
            icon="chat"
            tone="processing"
            hint="Revision asked for"
          />
          <StatCard
            label="Awarded this month"
            value={rupees(summary.acceptedValueCents)}
            icon="coins"
            tone="gold"
            hint={`${summary.acceptedThisMonth} quotes`}
          />
          <StatCard
            label="Against target"
            value={summary.avgSavingPercent == null ? '—' : `${summary.avgSavingPercent.toFixed(1)}%`}
            icon="trenddown"
            tone={summary.avgSavingPercent != null && summary.avgSavingPercent > 0 ? 'positive' : 'neutral'}
            hint="Average saving on awarded quotes"
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
        <div className="relative w-64">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Quote, RFQ or vendor…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(q) => q.id}
            emptyMessage={filter === 'submitted' ? 'No quote is waiting on review.' : 'Nothing matches this filter.'}
            columns={[
              {
                header: 'Quote',
                render: (q) => (
                  <span>
                    <span className="block font-mono text-xs font-semibold text-ink">
                      {q.reference}
                      {q.revision > 1 && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-500">
                          v{q.revision}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-400">{q.rfqReference}</span>
                  </span>
                ),
              },
              {
                header: 'Vendor',
                render: (q) => (
                  <span>
                    <span className="block font-medium text-ink">{q.vendorName}</span>
                    <span className="block text-[11px] text-slate-400">for {q.businessName}</span>
                  </span>
                ),
              },
              {
                header: 'Coverage',
                render: (q) =>
                  q.unavailableCount > 0 ? (
                    // A cheap quote that skips half the basket is not cheap.
                    <span className="text-xs font-semibold text-amber-600">
                      {q.lineCount - q.unavailableCount} of {q.lineCount} lines
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">all {q.lineCount} lines</span>
                  ),
              },
              {
                header: 'Total',
                className: 'text-right tabular-nums',
                render: (q) => (
                  <span>
                    <span className="block font-bold text-ink">{rupees(q.totalCents)}</span>
                    {q.deltaVsBestCents == null ? (
                      <span className="block text-[11px] font-semibold text-state-success">lowest</span>
                    ) : (
                      <span className="block text-[11px] text-state-error">
                        +{rupees(q.deltaVsBestCents)} vs best
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Terms',
                className: 'whitespace-nowrap',
                render: (q) => (
                  <span className="text-xs text-slate-500">
                    {q.deliveryDays == null ? '—' : `${q.deliveryDays}d delivery`}
                    {q.paymentTermsDays != null && ` · ${q.paymentTermsDays}d credit`}
                  </span>
                ),
              },
              {
                header: 'Valid until',
                className: 'whitespace-nowrap',
                render: (q) => (
                  <span className={isExpired(q) ? 'font-semibold text-state-error' : ''}>
                    {formatDate(q.validUntil)}
                    {isExpired(q) && <span className="block text-[11px]">expired</span>}
                  </span>
                ),
              },
              {
                header: 'Status',
                render: (q) => (
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[q.status]}`}
                  >
                    {label(q.status)}
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (q) => (
                  <button
                    onClick={() => {
                      setOpenId(q.id);
                      setActionError(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    Compare
                  </button>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {openId != null && (
        <QuotationModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

type Pending = 'revision' | 'reject' | 'award' | null;

function QuotationModal({
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
  const { data, loading, error, reload } = useApiData<QuotationDetail>(`/api/admin/quotations/${id}`, [id]);

  const [pending, setPending] = useState<Pending>(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: unknown, fallback?: string) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/quotations/${id}/${path}`, body);
      setPending(null);
      setText('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : (fallback ?? 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitText(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      onError(pending === 'reject' ? 'Give the vendor a reason.' : 'Say what needs to change.');
      return;
    }
    run(
      pending === 'reject' ? 'reject' : 'request-revision',
      pending === 'reject' ? { reason: text.trim() } : { message: text.trim() },
    );
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/quotations/${id}/messages`, { body: message.trim() });
      setMessage('');
      reload();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not send the message.');
    } finally {
      setBusy(false);
    }
  }

  const open = data != null && !['accepted', 'rejected', 'withdrawn'].includes(data.status);
  // The cheapest across this quote and its rivals — the yardstick for whether
  // awarding this one needs a second thought.
  const cheapest = data
    ? data.competing.reduce((min, c) => Math.min(min, c.totalCents), data.totalCents)
    : null;
  const notCheapest = data != null && cheapest != null && data.totalCents > cheapest;

  return (
    <Modal title={data ? `${data.reference} · ${data.vendorName}` : 'Quotation'} onClose={onClose} wide>
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
              {label(data.status)}
            </span>
            <span className="text-xs text-slate-500">revision {data.revision}</span>
            <span className="text-xs text-slate-400">{data.rfqTitle}</span>
            {isExpired(data) && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                PAST ITS VALIDITY
              </span>
            )}
          </div>

          {data.competing.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Others quoting this RFQ
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { quotationId: data.id, vendorName: data.vendorName, totalCents: data.totalCents, status: data.status },
                  ...data.competing,
                ]
                  .sort((a, b) => a.totalCents - b.totalCents)
                  .map((c) => (
                    <span
                      key={c.quotationId}
                      className={`rounded-xl border px-3 py-2 ${
                        c.quotationId === data.id ? 'border-emerald bg-mint-mist' : 'border-slate-200'
                      }`}
                    >
                      <span className="block text-xs font-semibold text-ink">{c.vendorName}</span>
                      <span className="block text-sm font-bold text-ink tabular-nums">{rupees(c.totalCents)}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                  {['Line', 'Qty', 'Unit price', 'Target', 'Tax', 'Total'].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap text-slate-500 uppercase ${
                        h === 'Line' ? '' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lines.map((l) => {
                  const over =
                    l.targetPriceCents != null && !l.unavailable && l.unitPriceCents > l.targetPriceCents;
                  return (
                    <tr key={l.id} className={l.unavailable ? 'bg-slate-50/70 text-slate-400' : ''}>
                      <td className="px-3 py-2">
                        <span className={`block font-medium ${l.unavailable ? '' : 'text-ink'}`}>
                          {l.description}
                        </span>
                        {l.unavailable && (
                          <span className="inline-block rounded bg-rose-50 px-1.5 py-px text-[10px] font-bold text-rose-600">
                            CANNOT SUPPLY
                          </span>
                        )}
                        {l.note && <span className="block text-[11px] text-slate-400">{l.note}</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {l.quantity} {l.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {l.unavailable ? '—' : rupees(l.unitPriceCents)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">
                        {l.targetPriceCents == null ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          // Over the buyer's target is the thing to negotiate on,
                          // so it is tinted per line rather than only in the total.
                          <span className={over ? 'font-semibold text-state-error' : 'text-state-success'}>
                            {rupees(l.targetPriceCents)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500 tabular-nums">{l.taxPercent}%</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {l.unavailable ? '—' : rupees(l.lineTotalCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <Row label="Subtotal" value={rupees(data.subtotalCents)} />
            <Row label="Delivery" value={rupees(data.deliveryCents)} />
            <Row label="Tax" value={rupees(data.taxCents)} />
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{rupees(data.totalCents)}</span>
            </div>
          </div>

          {data.notes && (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">{data.notes}</p>
          )}

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Negotiation</h3>
            <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
              {data.messages.length === 0 && (
                <p className="text-sm text-slate-400">Nothing said yet.</p>
              )}
              {data.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    m.from === 'admin' ? 'ml-auto bg-mint-mist' : 'bg-slate-100'
                  }`}
                >
                  <p className="text-sm text-slate-700">{m.body}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {m.authorName ?? m.from} · {formatWhen(m.createdAt)}
                  </p>
                </div>
              ))}
            </div>
            {open && (
              <form onSubmit={send} className="mt-2 flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message the vendor"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={busy || !message.trim()}
                  className="shrink-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            )}
          </div>

          {(pending === 'revision' || pending === 'reject') && (
            <form onSubmit={submitText} className="space-y-2.5 rounded-xl border border-slate-200 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  {pending === 'reject' ? 'Why is it rejected?' : 'What should change?'}
                </span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className={inputClass} />
                <span className="mt-1 block text-[11px] text-slate-500">
                  {pending === 'reject'
                    ? 'The vendor is told, and cannot re-quote on this RFQ.'
                    : 'The vendor submits a new revision. This one stays on record.'}
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                    pending === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald hover:bg-emerald-deep'
                  }`}
                >
                  {busy ? 'Sending…' : pending === 'reject' ? 'Reject quote' : 'Ask for a revision'}
                </button>
              </div>
            </form>
          )}

          {pending === 'award' && (
            <div className="space-y-2.5 rounded-xl border border-emerald/30 bg-mint-mist/60 p-4">
              <p className="text-sm text-slate-700">
                Awarding {data.reference} raises a purchase order for {rupees(data.totalCents)} and closes every other
                quote on {data.rfqReference}. It cannot be undone.
              </p>
              {notCheapest && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This is not the lowest quote — {rupees(data.totalCents - (cheapest ?? 0))} above the cheapest. Fine if
                  it is deliberate; worth a second look if not.
                </p>
              )}
              {data.unavailableCount > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {data.unavailableCount} line{data.unavailableCount === 1 ? '' : 's'} cannot be supplied. The buyer
                  will need those from somewhere else.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Not yet
                </button>
                <button
                  onClick={() => run('award', undefined, 'Could not award the quote.')}
                  disabled={busy}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  {busy ? 'Awarding…' : 'Award and raise the PO'}
                </button>
              </div>
            </div>
          )}

          {pending === null && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {open ? (
                <>
                  <button
                    onClick={() => {
                      setPending('reject');
                      setText('');
                    }}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setPending('revision');
                      setText('');
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    Ask for a revision
                  </button>
                  <button
                    onClick={() => setPending('award')}
                    className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep"
                  >
                    Award
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {label(data.status)} {formatDate(data.decidedAt)} — nothing further to do.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
