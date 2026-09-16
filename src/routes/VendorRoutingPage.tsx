import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type {
  MatchingConfig,
  MatchingLog,
  MatchingSummary,
  MatchingWeight,
  Paged,
  RoutingReassignment,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/matching/summary',
  'GET    /api/admin/matching/config',
  'PUT    /api/admin/matching/config',
  'GET    /api/admin/matching/logs',
  'GET    /api/admin/matching/reassignments',
  'POST   /api/admin/matching/reassignments/:id/approve',
  'POST   /api/admin/matching/reassignments/:id/reject',
];

const TABS = [
  { id: 'weights', label: 'Ranking weights', icon: 'sliders' },
  { id: 'logs', label: 'Match log', icon: 'history' },
  { id: 'reassignments', label: 'Re-routing', icon: 'route' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const REASSIGN_FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;
type ReassignFilter = (typeof REASSIGN_FILTERS)[number];

function rupees(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
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

/** Outcomes are engine states, not order states, so they get their own tinting. */
const OUTCOME_TONE: Record<MatchingLog['outcome'], string> = {
  matched: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  reassigned: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  no_vendor: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  expired: 'border-slate-200 bg-slate-100 text-slate-600',
};

export default function VendorRoutingPage() {
  const [tab, setTab] = useState<Tab>('weights');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: summary } = useApiData<MatchingSummary>('/api/admin/matching/summary');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Vendor Matching &amp; Re-routing</h1>
        <p className="text-sm text-slate-500">
          How an order picks its shop. Weights decide the ranking, the log shows what the engine actually did, and
          re-routing handles the orders a vendor would not take.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Matched today" value={String(summary.matchedToday)} icon="route" tone="accent" />
          <StatCard
            label="Could not be matched"
            value={String(summary.unmatched)}
            icon="alert"
            tone={summary.unmatched > 0 ? 'critical' : 'neutral'}
            hint="No vendor in range could fulfil"
          />
          <StatCard
            label="Awaiting re-route approval"
            value={String(summary.pendingReassignments)}
            icon="swap"
            tone={summary.pendingReassignments > 0 ? 'pending' : 'neutral'}
          />
          <StatCard
            label="Avg candidates per order"
            value={summary.avgCandidates == null ? '—' : summary.avgCandidates.toFixed(1)}
            icon="store"
            tone="neutral"
            hint={
              summary.avgMatchSeconds == null
                ? 'Vendors scored per match'
                : `matched in ~${summary.avgMatchSeconds.toFixed(1)}s`
            }
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
              tab === t.id
                ? 'bg-emerald text-white'
                : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
            }`}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            {t.label}
            {t.id === 'reassignments' && summary && summary.pendingReassignments > 0 && (
              <span
                className={`rounded-full px-1.5 py-px text-[10px] ${
                  tab === t.id ? 'bg-white/25 text-white' : 'bg-state-pending/20 text-state-pending-ink'
                }`}
              >
                {summary.pendingReassignments}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'weights' && <WeightsPanel onError={setActionError} />}
      {tab === 'logs' && <MatchLogPanel />}
      {tab === 'reassignments' && <ReassignmentsPanel onError={setActionError} />}
    </div>
  );
}

/* ------------------------------------------------------------------ weights */

function WeightsPanel({ onError }: { onError: (message: string | null) => void }) {
  const can = useCan('vendor_routing');
  const { data, loading, error, reload } = useApiData<MatchingConfig>('/api/admin/matching/config');

  const [draft, setDraft] = useState<MatchingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // The form is a draft of the server's config, so it has to be re-seeded on
  // every load — including after a save, when the server may have clamped values.
  useEffect(() => {
    setDraft(data ? structuredClone(data) : null);
    setSaved(false);
  }, [data]);

  const enabledTotal = useMemo(
    () => (draft?.weights ?? []).filter((w) => w.enabled).reduce((sum, w) => sum + w.weight, 0),
    [draft],
  );

  const dirty = useMemo(() => !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data), [draft, data]);

  function patchWeight(key: string, changes: Partial<MatchingWeight>) {
    setDraft((d) =>
      d ? { ...d, weights: d.weights.map((w) => (w.key === key ? { ...w, ...changes } : w)) } : d,
    );
    setSaved(false);
  }

  function patchConfig(changes: Partial<MatchingConfig>) {
    setDraft((d) => (d ? { ...d, ...changes } : d));
    setSaved(false);
  }

  async function save() {
    if (!draft) return;
    onError(null);
    setSaving(true);
    try {
      await api.put('/api/admin/matching/config', draft);
      setSaved(true);
      reload();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the matching rules.');
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return isMissingEndpoint(error) ? (
      <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 3 vendor matching" />
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
    <fieldset disabled={!can.edit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {!can.edit && (
        <p className="text-xs text-slate-400 lg:col-span-2">View only — your role cannot change matching rules.</p>
      )}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-ink">Ranking factors</h2>
            <p className="text-xs text-slate-500">
              Weights are relative. Turning a factor off redistributes its share across the rest.
            </p>
          </div>
          {enabledTotal === 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600">
              <Icon name="alert" className="h-3 w-3" />
              Nothing to rank on
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {draft.weights.map((w) => {
            // Shown as a share of the enabled total, because that is the number
            // that actually reaches the engine — the raw weight alone means little.
            const share = w.enabled && enabledTotal > 0 ? (w.weight / enabledTotal) * 100 : 0;
            return (
              <div key={w.key} className={`px-5 py-3.5 ${w.enabled ? '' : 'bg-slate-50/50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex min-w-0 items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={w.enabled}
                      onChange={(e) => patchWeight(w.key, { enabled: e.target.checked })}
                      className="h-4 w-4 shrink-0 accent-emerald"
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${w.enabled ? 'text-ink' : 'text-slate-400'}`}>
                        {w.label}
                      </span>
                      {w.description && <span className="block text-xs text-slate-500">{w.description}</span>}
                    </span>
                  </label>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-extrabold text-ink tabular-nums">
                      {w.enabled ? `${share.toFixed(0)}%` : '—'}
                    </span>
                    <span className="block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {w.higherIsBetter ? 'higher wins' : 'lower wins'}
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={w.weight}
                  disabled={!w.enabled}
                  onChange={(e) => patchWeight(w.key, { weight: Number(e.target.value) })}
                  className="mt-2.5 w-full accent-emerald disabled:opacity-40"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink">Limits</h2>
          <div className="mt-3 space-y-3.5">
            <NumberField
              label="Max radius"
              suffix="km"
              value={draft.maxRadiusKm}
              min={1}
              onChange={(v) => patchConfig({ maxRadiusKm: v })}
              hint="A vendor beyond this is never a candidate."
            />
            <NumberField
              label="Accept window"
              suffix="min"
              value={draft.acceptWindowMinutes}
              min={1}
              onChange={(v) => patchConfig({ acceptWindowMinutes: v })}
              hint="After this the order is re-routed."
            />
            <NumberField
              label="Max re-route attempts"
              value={draft.maxReassignAttempts}
              min={0}
              onChange={(v) => patchConfig({ maxReassignAttempts: v })}
              hint="Then the order lands in the unmatched queue."
            />
            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
              <input
                type="checkbox"
                checked={draft.autoReassign}
                onChange={(e) => patchConfig({ autoReassign: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Re-route automatically</span>
                <span className="block text-xs text-slate-500">
                  Off means every re-route waits for an admin on the Re-routing tab.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="card p-5">
          <button
            onClick={save}
            disabled={!dirty || saving || enabledTotal === 0}
            className="w-full rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
          >
            {saving ? 'Saving…' : 'Save matching rules'}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            {enabledTotal === 0
              ? 'Enable at least one factor before saving.'
              : saved && !dirty
                ? 'Saved. New orders match on these rules.'
                : dirty
                  ? 'Unsaved changes. Orders already placed keep their vendor.'
                  : `Last changed ${formatWhen(draft.updatedAt)}`}
          </p>
        </div>
      </div>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          className="w-full bg-transparent text-sm tabular-nums outline-none"
        />
        {suffix && <span className="shrink-0 text-xs font-semibold text-slate-400">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

/* --------------------------------------------------------------- match log */

function MatchLogPanel() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<MatchingLog | null>(null);
  const { data, loading, error } = useApiData<Paged<MatchingLog>>(`/api/admin/matching/logs?page=${page}`, [page]);

  if (error) {
    return isMissingEndpoint(error) ? (
      <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 3 vendor matching" />
    ) : (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
        {error}
      </div>
    );
  }
  if (loading) return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>;

  const rows = data?.items ?? [];

  return (
    <>
      <div className="card overflow-hidden">
        <DataTable
          rows={rows}
          keyFor={(r) => r.id}
          emptyMessage="No matching runs recorded yet."
          columns={[
            {
              header: 'Order',
              render: (r) => (
                <span className="font-semibold text-ink">
                  {r.orderReference}
                  {r.attempt > 1 && (
                    <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-500">
                      try {r.attempt}
                    </span>
                  )}
                </span>
              ),
            },
            {
              header: 'Outcome',
              render: (r) => (
                <span
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${OUTCOME_TONE[r.outcome]}`}
                >
                  {r.outcome.replace(/_/g, ' ')}
                </span>
              ),
            },
            {
              header: 'Matched to',
              render: (r) =>
                r.chosenVendorName ? (
                  <span className="font-medium text-ink">{r.chosenVendorName}</span>
                ) : (
                  <span className="text-slate-400">{r.reason ?? 'No vendor'}</span>
                ),
            },
            {
              header: 'Score',
              className: 'text-right tabular-nums',
              render: (r) => (r.chosenScore == null ? <span className="text-slate-400">—</span> : r.chosenScore.toFixed(2)),
            },
            {
              header: 'Candidates',
              className: 'text-right tabular-nums',
              render: (r) => r.candidatesConsidered,
            },
            { header: 'When', className: 'whitespace-nowrap', render: (r) => formatWhen(r.createdAt) },
            {
              header: '',
              className: 'text-right',
              render: (r) => (
                <button
                  onClick={() => setOpen(r)}
                  disabled={r.candidates.length === 0}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-40"
                >
                  Why
                </button>
              ),
            },
          ]}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </div>

      {open && (
        <Modal title={`Ranking for ${open.orderReference}`} onClose={() => setOpen(null)} wide>
          <p className="text-sm text-slate-500">
            {open.candidatesConsidered} vendor{open.candidatesConsidered === 1 ? '' : 's'} considered ·{' '}
            {formatWhen(open.createdAt)}
            {open.reason && ` · ${open.reason}`}
          </p>
          <div className="mt-3 space-y-1.5">
            {open.candidates.map((c) => (
              <div
                key={c.vendorId}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                  c.chosen ? 'border-emerald/40 bg-mint-mist' : 'border-slate-200 bg-white'
                }`}
              >
                <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400 tabular-nums">
                  {c.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{c.vendorName}</span>
                  <span className="block text-xs text-slate-500">
                    {c.skippedReason ?? (c.distanceKm == null ? 'Distance unknown' : `${c.distanceKm.toFixed(1)} km away`)}
                  </span>
                </span>
                {c.chosen && (
                  <span className="shrink-0 rounded-full bg-emerald px-2 py-0.5 text-[10px] font-bold text-white">
                    CHOSEN
                  </span>
                )}
                <span
                  className={`w-12 shrink-0 text-right text-sm font-bold tabular-nums ${
                    c.skippedReason ? 'text-slate-300' : 'text-ink'
                  }`}
                >
                  {c.skippedReason ? '—' : c.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Scores are from the weights in force at the time. Changing the weights does not re-score past orders.
          </p>
        </Modal>
      )}
    </>
  );
}

/* ---------------------------------------------------------- re-assignments */

function ReassignmentsPanel({ onError }: { onError: (message: string | null) => void }) {
  const can = useCan('vendor_routing');
  const [filter, setFilter] = useState<ReassignFilter>('pending');
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, loading, error, reload } = useApiData<RoutingReassignment[]>(
    `/api/admin/matching/reassignments${filter === 'all' ? '' : `?status=${filter}`}`,
    [filter],
  );

  async function act(row: RoutingReassignment, decision: 'approve' | 'reject') {
    onError(null);
    setBusyId(row.id);
    try {
      await api.post(`/api/admin/matching/reassignments/${row.id}/${decision}`);
      reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : `Could not ${decision} the re-route for ${row.orderReference}.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return isMissingEndpoint(error) ? (
      <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 3 vendor matching" />
    ) : (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
        {error}
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {REASSIGN_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
              filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && rows.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="route" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">
            {filter === 'pending' ? 'No order is waiting to be re-routed.' : 'Nothing matches this filter.'}
          </p>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((r) => {
          const difference = r.proposedTotalCents - r.originalTotalCents;
          return (
            <div key={r.id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-3 px-4 pt-4">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-ink">{r.orderReference}</h2>
                  <p className="text-xs text-slate-500">Raised {formatWhen(r.createdAt)}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              {/* From → to reads as the move itself; a two-column table of vendor
                  names would make the reader work out which way it goes. */}
              <div className="mt-3 flex items-center gap-2 px-4">
                <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                  <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">From</div>
                  <div className="truncate text-sm font-semibold text-slate-500 line-through">
                    {r.fromVendorName ?? 'Unassigned'}
                  </div>
                </div>
                <Icon name="chevron" className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={2.2} />
                <div className="min-w-0 flex-1 rounded-xl border border-emerald/30 bg-mint-mist px-3 py-2">
                  <div className="text-[10px] font-bold tracking-wide text-emerald-deep uppercase">To</div>
                  <div className="truncate text-sm font-semibold text-ink">
                    {r.toVendorName ?? 'No vendor found'}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 text-xs">
                <span className="font-bold text-ink tabular-nums">{rupees(r.proposedTotalCents)}</span>
                {difference !== 0 && (
                  <span
                    className={`font-semibold tabular-nums ${
                      difference > 0 ? 'text-state-error' : 'text-state-success'
                    }`}
                  >
                    {difference > 0 ? '+' : '−'}
                    {rupees(Math.abs(difference))} vs original
                  </span>
                )}
              </div>

              {r.reason && <p className="mt-2 px-4 text-xs text-slate-500">{r.reason}</p>}

              {r.resolvedAt && (
                <p className="mt-2 px-4 text-[11px] text-slate-400">
                  {r.status === 'auto' ? 'Auto-routed' : `Decided by ${r.resolvedByName ?? 'an admin'}`} ·{' '}
                  {formatWhen(r.resolvedAt)}
                </p>
              )}

              <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
                {r.status === 'pending' ? (
                  can.edit ? (
                    <>
                      <button
                        onClick={() => act(r, 'reject')}
                        disabled={busyId === r.id}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Keep with original
                      </button>
                      <button
                        onClick={() => act(r, 'approve')}
                        disabled={busyId === r.id || r.toVendorId == null}
                        className="rounded-lg border border-state-success/30 bg-state-success/10 px-3 py-1 text-xs font-semibold text-state-success-ink hover:bg-state-success/20 disabled:opacity-50"
                      >
                        {r.toVendorId == null ? 'No vendor to move to' : 'Approve re-route'}
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400">View only</span>
                  )
                ) : (
                  <span className="text-[11px] text-slate-400">Closed — no action left.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
