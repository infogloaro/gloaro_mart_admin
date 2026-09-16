import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  AdminCancellation,
  CancellationRule,
  CancellationRules,
  CancellationStatus,
  CancellationSummary,
  Paged,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/cancellations',
  'GET    /api/admin/cancellations/summary',
  'GET    /api/admin/cancellations/rules',
  'PUT    /api/admin/cancellations/rules',
  'POST   /api/admin/cancellations/:id/approve',
  'POST   /api/admin/cancellations/:id/reject',
];

const TABS = [
  { id: 'requests', label: 'Requests', icon: 'ban' },
  { id: 'rules', label: 'Eligibility rules', icon: 'sliders' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const FILTERS = ['requested', 'approved', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<CancellationStatus, string> = {
  requested: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  approved: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  auto_approved: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  rejected: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  withdrawn: 'border-slate-200 bg-slate-100 text-slate-500',
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

export default function CancellationsPage() {
  const [tab, setTab] = useState<Tab>('requests');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: summary, reload: reloadSummary } = useApiData<CancellationSummary>('/api/admin/cancellations/summary');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Cancellations</h1>
        <p className="text-sm text-slate-500">
          What can still be called off depends on how far the order has travelled. The rules decide the ordinary case;
          the queue is what they could not.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting on a decision"
            value={String(summary.requested)}
            icon="ban"
            tone={summary.requested > 0 ? 'pending' : 'neutral'}
            hint={`${summary.ineligiblePending} outside the rules`}
          />
          <StatCard
            label="Approved this month"
            value={String(summary.approvedThisMonth)}
            icon="undo"
            tone="processing"
            hint={`${summary.rejectedThisMonth} rejected`}
          />
          <StatCard label="Refunded" value={rupees(summary.refundedCents)} icon="refund" tone="gold" />
          <StatCard
            label="Fees retained"
            value={rupees(summary.feeCents)}
            icon="percent"
            tone="neutral"
            hint="Deducted per the stage rules"
          />
        </div>
      )}

      <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(23,43,34,0.04)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setActionError(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
              tab === t.id ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
            }`}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && <RequestsPanel onError={setActionError} onChanged={reloadSummary} />}
      {tab === 'rules' && <RulesPanel onError={setActionError} />}
    </div>
  );
}

/* ---------------------------------------------------------------- requests */

function RequestsPanel({
  onError,
  onChanged,
}: {
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('requested');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);
  const [deciding, setDeciding] = useState<AdminCancellation | null>(null);

  const query = [
    filter === 'all' ? '' : `status=${filter}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminCancellation>>(
    `/api/admin/cancellations?${query}`,
    [filter, page, debounced],
  );

  if (error) {
    return isMissingEndpoint(error) ? (
      <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 10 cancellations" />
    ) : (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
        {error}
      </div>
    );
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-3">
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
            placeholder="Order, customer or reference…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(c) => c.id}
            emptyMessage={
              filter === 'requested' ? 'No cancellation is waiting on a decision.' : 'Nothing matches this filter.'
            }
            columns={[
              {
                header: 'Request',
                render: (c) => (
                  <span>
                    <span className="block font-mono text-xs font-semibold text-ink">{c.reference}</span>
                    <span className="block text-[11px] text-slate-400">{c.orderReference}</span>
                  </span>
                ),
              },
              {
                header: 'Asked by',
                render: (c) => (
                  <span>
                    <span className="block text-sm font-medium text-ink capitalize">{c.requestedBy}</span>
                    <span className="block text-[11px] text-slate-400">
                      {c.requestedByName ?? c.customerName} · {formatWhen(c.requestedAt)}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Stage',
                render: (c) => (
                  <span className="flex flex-col gap-1">
                    <StatusBadge status={c.orderStatusAtRequest} />
                    {/* The order can travel while the request waits. Cancelling
                        something already out for delivery is a different job. */}
                    {c.currentOrderStatus !== c.orderStatusAtRequest && (
                      <span className="text-[10px] font-semibold text-amber-600">
                        now {label(c.currentOrderStatus)}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Reason',
                render: (c) => (
                  <span>
                    <span className="block text-xs font-semibold text-slate-600">{c.reason}</span>
                    {c.reasonNote && <span className="block text-[11px] text-slate-400">{c.reasonNote}</span>}
                  </span>
                ),
              },
              {
                header: 'Order value',
                className: 'text-right tabular-nums',
                render: (c) => rupees(c.orderTotalCents),
              },
              {
                header: 'Refund',
                className: 'text-right tabular-nums',
                render: (c) => (
                  <span>
                    <span className="block font-semibold text-ink">{rupees(c.refundCents)}</span>
                    {c.feeCents > 0 && (
                      <span className="block text-[11px] text-slate-400">less {rupees(c.feeCents)} fee</span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Status',
                render: (c) => (
                  <span className="flex flex-col gap-1">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[c.status]}`}
                    >
                      {label(c.status)}
                    </span>
                    {c.status === 'requested' && !c.eligible && (
                      <span className="text-[10px] font-bold text-rose-600">OUTSIDE THE RULES</span>
                    )}
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (c) =>
                  c.status === 'requested' ? (
                    <button
                      onClick={() => {
                        setDeciding(c);
                        onError(null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                    >
                      Decide
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      {c.decidedByName ?? (c.status === 'auto_approved' ? 'Automatic' : '—')}
                    </span>
                  ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {deciding && (
        <DecisionModal
          request={deciding}
          onClose={() => setDeciding(null)}
          onError={onError}
          onDone={() => {
            setDeciding(null);
            reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function DecisionModal({
  request,
  onClose,
  onError,
  onDone,
}: {
  request: AdminCancellation;
  onClose: () => void;
  onError: (message: string | null) => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [fee, setFee] = useState((request.feeCents / 100).toFixed(2));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const feeCents = Math.round(Number(fee) * 100);
  const refund = Number.isFinite(feeCents) ? request.orderTotalCents - Math.max(0, feeCents) : request.refundCents;
  const moved = request.currentOrderStatus !== request.orderStatusAtRequest;

  async function submit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    if (mode === 'reject' && !note.trim()) {
      onError('Give a reason the customer can read.');
      return;
    }
    if (mode === 'approve' && (!Number.isFinite(feeCents) || feeCents < 0 || feeCents > request.orderTotalCents)) {
      onError('The fee must be between zero and the order value.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'approve') {
        await api.post(`/api/admin/cancellations/${request.id}/approve`, {
          feeCents,
          note: note.trim() || null,
        });
      } else {
        await api.post(`/api/admin/cancellations/${request.id}/reject`, { reason: note.trim() });
      }
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not record the decision.');
      setBusy(false);
    }
  }

  return (
    <Modal title={`Cancellation ${request.reference}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
          <Field label="Order" value={request.orderReference} />
          <Field label="Customer" value={request.customerName} />
          <Field label="Vendor" value={request.vendorName} />
          <Field label="Asked at stage" value={label(request.orderStatusAtRequest)} />
          <Field label="Reason" value={request.reason} />
          <Field label="Payment" value={request.paymentStatus ?? '—'} />
        </dl>

        {!request.eligible && (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
            The rules do not allow a cancellation at this stage. Approving it is a deliberate override.
          </p>
        )}

        {moved && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            The order has moved to <span className="font-semibold">{label(request.currentOrderStatus)}</span> since the
            request. Check it can actually be stopped before you approve.
          </p>
        )}

        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(['approve', 'reject'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-all duration-200 ${
                mode === m
                  ? m === 'approve'
                    ? 'bg-emerald text-white'
                    : 'bg-rose-600 text-white'
                  : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'approve' ? (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Cancellation fee (₹)
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className={inputClass}
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Set by the rule for this stage. Zero it to waive.
              </span>
            </label>
            <div className="flex items-baseline justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
              <span className="text-sm text-slate-600">Refund to customer</span>
              <span className="text-base font-extrabold text-ink tabular-nums">{rupees(Math.max(0, refund))}</span>
            </div>
          </>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            {mode === 'approve' ? 'Note (optional)' : 'Why is it rejected?'}
          </span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              mode === 'approve' ? 'bg-emerald hover:bg-emerald-deep' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {busy ? 'Saving…' : mode === 'approve' ? 'Approve and refund' : 'Reject request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------- rules */

function RulesPanel({ onError }: { onError: (message: string | null) => void }) {
  const { data, loading, error, reload } = useApiData<CancellationRules>('/api/admin/cancellations/rules');

  const [draft, setDraft] = useState<CancellationRule[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(data ? structuredClone(data.rules) : null);
  }, [data]);

  const dirty = useMemo(
    () => !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.rules),
    [draft, data],
  );

  function patch(orderStatus: string, changes: Partial<CancellationRule>) {
    setDraft((d) => (d ? d.map((r) => (r.orderStatus === orderStatus ? { ...r, ...changes } : r)) : d));
  }

  async function save() {
    if (!draft) return;
    onError(null);
    setSaving(true);
    try {
      await api.put('/api/admin/cancellations/rules', { rules: draft });
      reload();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the rules.');
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return isMissingEndpoint(error) ? (
      <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 10 cancellations" />
    ) : (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
        {error}
      </div>
    );
  }
  if (loading || !draft) {
    return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
          <h2 className="text-sm font-bold text-ink">One rule per order stage</h2>
          <p className="text-xs text-slate-500">
            Rules apply to new requests only. Anything already in the queue keeps the terms it was raised under.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                {['Stage', 'Customer', 'Vendor', 'Auto-approve', 'Fee', 'Restock'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap text-slate-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draft.map((rule) => {
                const nobody = !rule.customerAllowed && !rule.vendorAllowed;
                return (
                  <tr key={rule.orderStatus} className={nobody ? 'bg-slate-50/60' : ''}>
                    <td className="px-4 py-3">
                      <StatusBadge status={rule.orderStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={rule.customerAllowed}
                        onChange={(v) => patch(rule.orderStatus, { customerAllowed: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={rule.vendorAllowed}
                        onChange={(v) => patch(rule.orderStatus, { vendorAllowed: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={rule.autoApprove}
                        disabled={nobody}
                        onChange={(v) => patch(rule.orderStatus, { autoApprove: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.feePercent}
                          disabled={nobody}
                          onChange={(e) =>
                            patch(rule.orderStatus, {
                              feePercent: Math.max(0, Math.min(100, Number(e.target.value))),
                            })
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums disabled:opacity-40"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={rule.restock}
                        disabled={nobody}
                        onChange={(v) => patch(rule.orderStatus, { restock: v })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          A stage nobody may cancel at is greyed out — its fee and restock settings never come into play.
          {data?.updatedAt && ` Last changed ${formatWhen(data.updatedAt)}.`}
        </p>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
        >
          {saving ? 'Saving…' : 'Save rules'}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 accent-emerald disabled:opacity-40"
    />
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="truncate font-medium text-ink capitalize">{value}</dd>
    </div>
  );
}
