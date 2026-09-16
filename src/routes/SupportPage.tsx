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
  AdminTicket,
  Paged,
  SupportAgent,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  TicketSummary,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/support/tickets',
  'GET    /api/admin/support/tickets/summary',
  'GET    /api/admin/support/tickets/:id',
  'GET    /api/admin/support/agents',
  'POST   /api/admin/support/tickets/:id/messages',
  'PATCH  /api/admin/support/tickets/:id',
];

const FILTERS = ['open', 'unassigned', 'breached', 'resolved', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUSES: TicketStatus[] = ['open', 'pending_customer', 'pending_vendor', 'resolved', 'closed'];
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

const STATUS_TONE: Record<TicketStatus, string> = {
  open: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  pending_customer: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  pending_vendor: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  resolved: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  closed: 'border-slate-200 bg-slate-100 text-slate-500',
};

const PRIORITY_TONE: Record<TicketPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-slate-100 text-slate-600',
  high: 'bg-state-shipped/15 text-state-shipped-ink',
  urgent: 'bg-state-error/15 text-state-error-ink',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function label(value: string): string {
  return value.replace(/_/g, ' ');
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

function sinceText(value: string): string {
  const minutes = (Date.now() - new Date(value).getTime()) / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

/**
 * A deadline is only breached while it is still unmet — once the first reply
 * has gone out, a late timestamp is history, not a live alarm.
 */
function breach(ticket: AdminTicket): 'response' | 'resolution' | null {
  const now = Date.now();
  if (ticket.firstRespondedAt == null && ticket.firstResponseDueAt && new Date(ticket.firstResponseDueAt).getTime() < now) {
    return 'response';
  }
  if (
    ticket.resolvedAt == null &&
    ticket.resolutionDueAt &&
    new Date(ticket.resolutionDueAt).getTime() < now
  ) {
    return 'resolution';
  }
  return null;
}

/** True when the ball is in our court — the last word came from outside. */
function awaitingUs(ticket: AdminTicket): boolean {
  return ticket.status === 'open' && (ticket.lastMessageFrom === 'customer' || ticket.lastMessageFrom === 'vendor');
}

export default function SupportPage() {
  const [filter, setFilter] = useState<Filter>('open');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [openId, setOpenId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    filter === 'all' ? '' : `filter=${filter}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminTicket>>(`/api/admin/support/tickets?${query}`, [
    filter,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<TicketSummary>('/api/admin/support/tickets/summary');

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Support Tickets</h1>
        <p className="text-sm text-slate-500">
          A conversation with a clock on it. The first reply and the resolution each have a deadline, and a ticket
          nobody owns is the one that misses both.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 20 support" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Open tickets"
            value={String(summary.open)}
            icon="headset"
            tone="processing"
            hint={`${summary.awaitingUs} waiting on us`}
          />
          <StatCard
            label="Nobody assigned"
            value={String(summary.unassigned)}
            icon="users"
            tone={summary.unassigned > 0 ? 'critical' : 'neutral'}
            hint="No owner, no reply"
          />
          <StatCard
            label="Past a deadline"
            value={String(summary.breached)}
            icon="clock"
            tone={summary.breached > 0 ? 'critical' : 'neutral'}
          />
          <StatCard
            label="First reply"
            value={
              summary.avgFirstResponseMinutes == null
                ? '—'
                : summary.avgFirstResponseMinutes < 60
                  ? `${Math.round(summary.avgFirstResponseMinutes)} min`
                  : `${(summary.avgFirstResponseMinutes / 60).toFixed(1)} h`
            }
            icon="chat"
            tone="positive"
            hint={`${summary.resolvedToday} resolved today`}
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
            placeholder="Subject, requester or order…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(t) => t.id}
            emptyMessage={filter === 'open' ? 'No ticket is open.' : 'Nothing matches this filter.'}
            columns={[
              {
                header: 'Ticket',
                render: (t) => (
                  <span>
                    <span className="block max-w-xs truncate text-sm font-semibold text-ink">{t.subject}</span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {t.reference} · {t.category}
                      {t.orderReference && ` · ${t.orderReference}`}
                    </span>
                  </span>
                ),
              },
              {
                header: 'From',
                render: (t) => (
                  <span>
                    <span className="block text-ink">{t.requesterName}</span>
                    <span className="block text-[11px] text-slate-400 capitalize">
                      {t.requesterType}
                      {t.vendorName && ` · ${t.vendorName}`}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Owner',
                render: (t) =>
                  t.assigneeName ? (
                    <span className="text-sm text-ink">{t.assigneeName}</span>
                  ) : (
                    <span className="text-xs font-semibold text-rose-600">Unassigned</span>
                  ),
              },
              {
                header: 'Priority',
                render: (t) => (
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_TONE[t.priority]}`}
                  >
                    {t.priority}
                  </span>
                ),
              },
              {
                header: 'Last word',
                className: 'whitespace-nowrap',
                render: (t) => (
                  <span>
                    <span className="block text-xs text-slate-600">{sinceText(t.lastMessageAt)}</span>
                    <span className="block text-[11px] text-slate-400 capitalize">
                      from {t.lastMessageFrom}
                      {/* The queue's real question is not "how old" but "whose
                          turn" — an old ticket we already answered is fine. */}
                      {awaitingUs(t) && <span className="font-bold text-amber-600"> · our turn</span>}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Deadline',
                className: 'whitespace-nowrap',
                render: (t) => {
                  const missed = breach(t);
                  if (!missed) {
                    return (
                      <span className="text-xs text-slate-500">
                        {formatWhen(t.firstRespondedAt == null ? t.firstResponseDueAt : t.resolutionDueAt)}
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 uppercase">
                      <Icon name="clock" className="h-2.5 w-2.5" />
                      {missed} late
                    </span>
                  );
                },
              },
              {
                header: 'Status',
                render: (t) => (
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[t.status]}`}
                  >
                    {label(t.status)}
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (t) => (
                  <button
                    onClick={() => {
                      setOpenId(t.id);
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
        <TicketModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function TicketModal({
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
  const { data, loading, error, reload } = useApiData<TicketDetail>(`/api/admin/support/tickets/${id}`, [id]);
  const { data: agents } = useApiData<SupportAgent[]>('/api/admin/support/agents');

  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function patch(changes: Record<string, unknown>, fallback: string) {
    onError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/support/tickets/${id}`, changes);
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/support/tickets/${id}/messages`, { body: body.trim(), internal });
      setBody('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not send the reply.');
    } finally {
      setBusy(false);
    }
  }

  const closed = data != null && (data.status === 'resolved' || data.status === 'closed');
  const missed = data ? breach(data) : null;

  return (
    <Modal title={data ? data.subject : 'Ticket'} onClose={onClose} wide>
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
            <span className="font-mono text-xs text-slate-500">{data.reference}</span>
            <span className="text-xs text-slate-400 capitalize">{data.category}</span>
            {missed && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 uppercase">
                {missed} deadline missed
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="From" value={`${data.requesterName} (${data.requesterType})`} />
            <Field label="Email" value={data.requesterEmail ?? '—'} />
            <Field label="Phone" value={data.requesterPhone ?? '—'} />
            <Field label="Order" value={data.orderReference ?? '—'} />
            <Field label="Opened" value={formatWhen(data.createdAt)} />
            <Field label="First reply" value={formatWhen(data.firstRespondedAt)} />
          </dl>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Owner</span>
              <select
                value={data.assigneeId ?? ''}
                disabled={busy}
                onChange={(e) =>
                  patch(
                    { assigneeId: e.target.value === '' ? null : Number(e.target.value) },
                    'Could not reassign the ticket.',
                  )
                }
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {(agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.openTickets} open)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Priority
              </span>
              <select
                value={data.priority}
                disabled={busy}
                onChange={(e) => patch({ priority: e.target.value }, 'Could not change the priority.')}
                className={`${inputClass} capitalize`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Status</span>
              <select
                value={data.status}
                disabled={busy}
                onChange={(e) => patch({ status: e.target.value }, 'Could not change the status.')}
                className={`${inputClass} capitalize`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Conversation ({data.messages.length})
            </h3>
            <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
              {data.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    m.internal
                      ? // Internal notes are visually unlike anything the
                        // requester sees, so nobody mistakes one for a reply.
                        'ml-auto border border-dashed border-amber-300 bg-amber-50'
                      : m.from === 'admin'
                        ? 'ml-auto bg-mint-mist'
                        : m.from === 'system'
                          ? 'mx-auto bg-slate-50 text-center'
                          : 'bg-slate-100'
                  }`}
                >
                  {m.internal && (
                    <p className="text-[10px] font-bold tracking-wide text-amber-700 uppercase">Internal note</p>
                  )}
                  <p className="text-sm whitespace-pre-line text-slate-700">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.attachments.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {m.authorName ?? m.from} · {formatWhen(m.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {closed ? (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-400">
              {label(data.status)} {formatWhen(data.resolvedAt)}. Set it back to open to carry on.
            </p>
          ) : (
            <form onSubmit={send} className="space-y-2.5 rounded-xl border border-slate-200 p-4">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder={internal ? 'A note only staff can read' : `Reply to ${data.requesterName}`}
                className={inputClass}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Internal note
                </label>
                <span className="text-[11px] text-slate-400">
                  {internal ? 'Not sent to the requester.' : 'The requester is emailed.'}
                </span>
                <button
                  type="submit"
                  disabled={busy || !body.trim()}
                  className="ml-auto rounded-xl bg-emerald px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                >
                  {busy ? 'Sending…' : internal ? 'Add note' : 'Send reply'}
                </button>
              </div>
            </form>
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
