import { useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type {
  AdminSettlement,
  Paged,
  SettlementDetail,
  SettlementStatus,
  SettlementSummary,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/settlements',
  'GET    /api/admin/settlements/summary',
  'GET    /api/admin/settlements/:id',
  'POST   /api/admin/settlements/approve',
  'POST   /api/admin/settlements/:id/hold',
  'POST   /api/admin/settlements/:id/pay',
];

const FILTERS = ['pending_approval', 'approved', 'paid', 'on_hold', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<SettlementStatus, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  pending_approval: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  approved: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  paid: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  on_hold: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  failed: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

function rupees(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  return `${sign}₹${(Math.abs(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function period(s: { periodStart: string; periodEnd: string }): string {
  const from = new Date(s.periodStart);
  const to = new Date(s.periodEnd);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${from.toLocaleDateString(undefined, opts)} – ${to.toLocaleDateString(undefined, opts)}`;
}

function StatusPill({ status }: { status: SettlementStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[status]}`}
    >
      {label(status)}
    </span>
  );
}

export default function SettlementsPage() {
  const can = useCan('settlements');
  const [filter, setFilter] = useState<Filter>('pending_approval');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    filter === 'all' ? '' : `status=${filter}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminSettlement>>(`/api/admin/settlements?${query}`, [
    filter,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<SettlementSummary>('/api/admin/settlements/summary');

  const rows = data?.items ?? [];
  const approvable = rows.filter((r) => r.status === 'pending_approval');
  const chosen = approvable.filter((r) => selected.has(r.id));
  const chosenTotal = chosen.reduce((sum, r) => sum + r.netPayableCents, 0);

  function refresh() {
    reload();
    reloadSummary();
    setSelected(new Set());
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approveChosen() {
    if (chosen.length === 0) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.post('/api/admin/settlements/approve', { ids: chosen.map((r) => r.id) });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not approve the selected settlements.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Settlements</h1>
        <p className="text-sm text-slate-500">
          What each vendor is owed for a cycle, after commission and deductions. Approval authorises the payout;
          marking it paid records that the money actually left.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 9 settlements" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Awaiting approval"
            value={rupees(summary.pendingCents)}
            icon="clock"
            tone={summary.pendingCount > 0 ? 'pending' : 'neutral'}
            hint={`${summary.pendingCount} settlement${summary.pendingCount === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Approved, not yet paid"
            value={rupees(summary.approvedCents)}
            icon="wallet"
            tone="processing"
            hint={`${summary.approvedCount} owed right now`}
          />
          <StatCard label="Paid this month" value={rupees(summary.paidThisMonthCents)} icon="coins" tone="gold" />
          <StatCard
            label="Held or failed"
            value={String(summary.onHoldCount + summary.failedCount)}
            icon="alert"
            tone={summary.onHoldCount + summary.failedCount > 0 ? 'critical' : 'neutral'}
            hint="Needs someone to look"
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
                setSelected(new Set());
              }}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap capitalize transition-all duration-200 ${
                filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {label(f)}
            </button>
          ))}
        </div>
        <div className="relative w-56">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Vendor or reference…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Payouts are approved in batches, so the bar shows the total being
          authorised — the number that matters is the money, not the count. */}
      {can.edit && chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald/30 bg-mint-mist px-4 py-2.5">
          <span className="text-sm text-emerald-deep">
            <span className="font-bold">{chosen.length}</span> selected ·{' '}
            <span className="font-bold tabular-nums">{rupees(chosenTotal)}</span> to authorise
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-semibold text-slate-500 hover:text-ink"
          >
            Clear
          </button>
          <button
            onClick={approveChosen}
            disabled={busy}
            className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
          >
            {busy ? 'Approving…' : 'Approve selected'}
          </button>
        </div>
      )}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(s) => s.id}
            emptyMessage={
              filter === 'pending_approval' ? 'Nothing is waiting for approval.' : 'No settlement matches this filter.'
            }
            columns={[
              {
                header: '',
                render: (s) =>
                  can.edit && s.status === 'pending_approval' ? (
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      aria-label={`Select ${s.reference}`}
                      className="h-4 w-4 accent-emerald"
                    />
                  ) : null,
              },
              {
                header: 'Vendor',
                render: (s) => (
                  <span>
                    <span className="block font-semibold text-ink">{s.vendorName}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{s.reference}</span>
                  </span>
                ),
              },
              {
                header: 'Cycle',
                className: 'whitespace-nowrap',
                render: (s) => (
                  <span>
                    <span className="block text-ink">{period(s)}</span>
                    <span className="block text-[11px] text-slate-400">
                      {s.orderCount} order{s.orderCount === 1 ? '' : 's'}
                    </span>
                  </span>
                ),
              },
              { header: 'Gross', className: 'text-right tabular-nums', render: (s) => rupees(s.grossCents) },
              {
                header: 'Commission',
                className: 'text-right tabular-nums',
                render: (s) => <span className="text-slate-500">−{rupees(s.commissionCents)}</span>,
              },
              {
                header: 'Deductions',
                className: 'text-right tabular-nums',
                render: (s) => {
                  const total = s.deductionCents - s.adjustmentCents;
                  return total === 0 ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span className="text-slate-500">{total > 0 ? `−${rupees(total)}` : `+${rupees(-total)}`}</span>
                  );
                },
              },
              {
                header: 'Net payable',
                className: 'text-right tabular-nums',
                render: (s) => <span className="font-bold text-ink">{rupees(s.netPayableCents)}</span>,
              },
              {
                header: 'Status',
                render: (s) => (
                  <span className="flex flex-col gap-1">
                    <StatusPill status={s.status} />
                    {s.payoutUtr && <span className="font-mono text-[10px] text-slate-400">{s.payoutUtr}</span>}
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (s) => (
                  <button
                    onClick={() => {
                      setOpenId(s.id);
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
        <SettlementModal
          id={openId}
          onClose={() => setOpenId(null)}
          onError={setActionError}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

type Pending = 'hold' | 'pay' | null;

function SettlementModal({
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
  const can = useCan('settlements');
  const { data, loading, error, reload } = useApiData<SettlementDetail>(`/api/admin/settlements/${id}`, [id]);

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: unknown, message?: string) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/settlements/${id}/${path}`, body);
      setPending(null);
      setReason('');
      setUtr('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : (message ?? 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitHold(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      onError('Say why the payout is held — the vendor will ask.');
      return;
    }
    run('hold', { reason: reason.trim() }, 'Could not hold the settlement.');
  }

  function submitPay(e: FormEvent) {
    e.preventDefault();
    // Without a UTR there is no proof the transfer happened, and reconciliation
    // has nothing to match the bank statement against.
    if (!utr.trim()) {
      onError('Enter the bank UTR for the transfer.');
      return;
    }
    run('pay', { utr: utr.trim() }, 'Could not record the payout.');
  }

  return (
    <Modal title={data ? `Settlement ${data.reference}` : 'Settlement'} onClose={onClose} wide>
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
            <span className="text-sm font-semibold text-ink">{data.vendorName}</span>
            <span className="text-xs text-slate-400">{period(data)}</span>
          </div>

          {data.status === 'on_hold' && data.holdReason && (
            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{data.holdReason}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Bank account</div>
              <div className="font-mono text-sm text-ink">{data.bankAccountMasked ?? 'Not on file'}</div>
              <div className="text-[11px] text-slate-400">{data.bankIfsc ?? '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Payout</div>
              <div className="font-mono text-sm text-ink">{data.payoutUtr ?? 'Not paid yet'}</div>
              <div className="text-[11px] text-slate-400">
                {data.paidAt
                  ? formatDate(data.paidAt)
                  : data.approvedAt
                    ? `Approved ${formatDate(data.approvedAt)} by ${data.approvedByName ?? 'an admin'}`
                    : 'Awaiting approval'}
              </div>
            </div>
          </div>

          {/* Gross → net, in the order the money is taken off. A single "net"
              figure with no trail is what vendors dispute. */}
          <div className="space-y-1.5 rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <Row label={`Gross sales · ${data.orderCount} orders`} value={rupees(data.grossCents)} />
            <Row label="Platform commission" value={`−${rupees(data.commissionCents)}`} muted />
            {data.deductions.map((d) => (
              <Row
                key={d.id}
                label={
                  <span>
                    {d.label}
                    <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-500 uppercase">
                      {d.kind}
                    </span>
                    {d.note && <span className="block text-[11px] text-slate-400">{d.note}</span>}
                  </span>
                }
                value={`−${rupees(d.amountCents)}`}
                muted
              />
            ))}
            {data.adjustmentCents !== 0 && (
              <Row
                label="Adjustment"
                value={`${data.adjustmentCents > 0 ? '+' : '−'}${rupees(Math.abs(data.adjustmentCents))}`}
                muted
              />
            )}
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-ink">
              <span>Net payable</span>
              <span className="tabular-nums">{rupees(data.netPayableCents)}</span>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Orders in this cycle</h3>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.orders.map((o) => (
                    <tr key={o.orderId}>
                      <td className="px-3 py-2">
                        <span className="block font-medium text-ink">{o.orderReference}</span>
                        <span className="block text-[11px] text-slate-400">
                          delivered {formatDate(o.deliveredAt)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{rupees(o.grossCents)}</td>
                      <td className="px-3 py-2 text-right text-slate-400 tabular-nums">
                        −{rupees(o.commissionCents)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">
                        {rupees(o.netCents)}
                      </td>
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-sm text-slate-400">
                        No orders — this cycle is deductions only.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pending === 'hold' && (
            <form onSubmit={submitHold} className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Why is this held?
                </span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {busy ? 'Holding…' : 'Hold payout'}
                </button>
              </div>
            </form>
          )}

          {pending === 'pay' && (
            <form onSubmit={submitPay} className="space-y-2.5 rounded-xl border border-emerald/30 bg-mint-mist/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Bank UTR
                </span>
                <input
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="Reference from the transfer"
                  className={inputClass}
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Recording a payout cannot be undone. A mistake is corrected by an adjustment on the next cycle, so
                check the UTR against the bank before you save.
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
                  {busy ? 'Saving…' : 'Mark as paid'}
                </button>
              </div>
            </form>
          )}

          {pending === null && !can.edit && (
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
              View only — your role cannot change settlements.
            </p>
          )}
          {pending === null && can.edit && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {(data.status === 'pending_approval' || data.status === 'approved') && (
                <button
                  onClick={() => setPending('hold')}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Hold
                </button>
              )}
              {(data.status === 'pending_approval' || data.status === 'on_hold') && (
                <button
                  onClick={() => run('approve', undefined, 'Could not approve the settlement.')}
                  disabled={busy || data.bankAccountMasked == null}
                  className="rounded-lg border border-state-success/30 bg-state-success/10 px-3.5 py-1.5 text-xs font-semibold text-state-success-ink hover:bg-state-success/20 disabled:opacity-50"
                >
                  {data.bankAccountMasked == null ? 'No bank account on file' : 'Approve payout'}
                </button>
              )}
              {(data.status === 'approved' || data.status === 'failed') && (
                <button
                  onClick={() => setPending('pay')}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep"
                >
                  Record payout
                </button>
              )}
              {data.status === 'paid' && (
                <span className="text-[11px] text-slate-400">
                  Paid and closed. Corrections go on the next cycle as an adjustment.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, muted = false }: { label: ReactNode; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? 'text-slate-500' : 'text-slate-600'}>{label}</span>
      <span className={`shrink-0 tabular-nums ${muted ? 'text-slate-500' : 'font-semibold text-ink'}`}>{value}</span>
    </div>
  );
}
