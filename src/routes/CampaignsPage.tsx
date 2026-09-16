import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type {
  AdminCampaign,
  CampaignDetail,
  CampaignDiscountType,
  CampaignFunding,
  CampaignScope,
  CampaignStatus,
  CampaignSummary,
  Paged,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/campaigns',
  'GET    /api/admin/campaigns/summary',
  'GET    /api/admin/campaigns/:id',
  'POST   /api/admin/campaigns',
  'PATCH  /api/admin/campaigns/:id',
  'POST   /api/admin/campaigns/:id/pause',
  'POST   /api/admin/campaigns/:id/resume',
  'POST   /api/admin/campaigns/:id/end',
];

const FILTERS = ['running', 'scheduled', 'paused', 'ended', 'draft', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<CampaignStatus, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  scheduled: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  running: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  paused: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  ended: 'border-slate-200 bg-slate-100 text-slate-500',
};

const SCOPES: { value: CampaignScope; label: string }[] = [
  { value: 'platform', label: 'Whole marketplace' },
  { value: 'category', label: 'Selected categories' },
  { value: 'vendor', label: 'Selected shops' },
];

const DISCOUNTS: { value: CampaignDiscountType; label: string }[] = [
  { value: 'percentage', label: 'Percentage off' },
  { value: 'flat', label: 'Flat amount off' },
  { value: 'free_delivery', label: 'Free delivery' },
];

const FUNDINGS: { value: CampaignFunding; label: string; note: string }[] = [
  { value: 'platform', label: 'The platform', note: 'Comes out of platform margin.' },
  { value: 'vendor', label: 'The vendors', note: 'Only runs for shops that opt in.' },
  { value: 'shared', label: 'Shared', note: 'Split between platform and vendor.' },
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compact(cents: number): string {
  const value = cents / 100;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return rupees(cents);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function discountText(c: AdminCampaign): string {
  if (c.discountType === 'free_delivery') return 'Free delivery';
  if (c.discountType === 'percentage') {
    return `${c.discountValue}% off${c.maxDiscountCents ? `, up to ${rupees(c.maxDiscountCents)}` : ''}`;
  }
  return `${rupees(c.discountValue)} off`;
}

/** Spent against the cap. Null when the campaign is uncapped. */
function budgetUse(c: AdminCampaign): number | null {
  if (c.budgetCents == null || c.budgetCents <= 0) return null;
  return Math.min(1, c.spentCents / c.budgetCents);
}

/**
 * Revenue earned per rupee of discount given. The one number that says whether
 * a campaign was worth running.
 */
function returnPerRupee(c: AdminCampaign): number | null {
  if (c.discountGivenCents <= 0) return null;
  return c.revenueCents / c.discountGivenCents;
}

export default function CampaignsPage() {
  const [filter, setFilter] = useState<Filter>('running');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    filter === 'all' ? '' : `status=${filter}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminCampaign>>(`/api/admin/campaigns?${query}`, [
    filter,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<CampaignSummary>('/api/admin/campaigns/summary');

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Campaigns</h1>
          <p className="text-sm text-slate-500">
            A discount running across the marketplace for a while. Who funds it decides everything: platform money is
            spent, vendor money has to be agreed to first.
          </p>
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setActionError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-deep"
        >
          <Icon name="megaphone" className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 22 campaigns" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Running now"
            value={String(summary.running)}
            icon="megaphone"
            tone="positive"
            hint={`${summary.scheduled} scheduled`}
          />
          <StatCard
            label="Discount given"
            value={compact(summary.discountThisMonthCents)}
            icon="percent"
            tone="critical"
            hint="This month"
          />
          <StatCard
            label="Revenue on campaign"
            value={compact(summary.revenueThisMonthCents)}
            icon="coins"
            tone="gold"
            hint={
              summary.discountThisMonthCents > 0
                ? `₹${(summary.revenueThisMonthCents / summary.discountThisMonthCents).toFixed(1)} back per ₹1 given`
                : 'This month'
            }
          />
          <StatCard
            label="Stopped by their cap"
            value={String(summary.budgetExhausted)}
            icon="alert"
            tone={summary.budgetExhausted > 0 ? 'critical' : 'neutral'}
            hint="Budget gone before the end date"
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
        <div className="relative w-56">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Campaign name…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="megaphone" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">
            {filter === 'running' ? 'No campaign is running.' : 'Nothing matches this filter.'}
          </p>
        </div>
      )}

      {/* Cards: a campaign is a set of numbers that only make sense together —
          discount, spend against cap, and what came back. */}
      <div className="grid gap-3 xl:grid-cols-2">
        {rows.map((c) => {
          const use = budgetUse(c);
          const roi = returnPerRupee(c);
          const optInShort = c.fundedBy !== 'platform' && c.optedInCount < c.participantCount;
          return (
            <div key={c.id} className="card overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                {c.bannerUrl ? (
                  <img src={c.bannerUrl} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-mint-mist text-emerald">
                    <Icon name="megaphone" className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-ink">{c.name}</h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-emerald-deep">{discountText(c)}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {SCOPES.find((s) => s.value === c.scope)?.label} · funded by {c.fundedBy}
                    {c.fundedBy === 'shared' && c.platformSharePercent != null && ` (${c.platformSharePercent}% us)`}
                    {' · '}
                    {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
                  </p>
                  {optInShort && (
                    // A vendor-funded campaign only runs where shops agreed —
                    // the gap between invited and opted in is the real reach.
                    <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      <Icon name="alert" className="h-2.5 w-2.5" />
                      {c.optedInCount} of {c.participantCount} shops opted in
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setOpenId(c.id);
                    setActionError(null);
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                >
                  Open
                </button>
              </div>

              <div className="grid grid-cols-3 gap-px bg-slate-100">
                <Cell label="Orders" value={String(c.orders)} />
                <Cell label="Revenue" value={compact(c.revenueCents)} />
                <Cell
                  label="Per ₹1 given"
                  value={roi == null ? '—' : `₹${roi.toFixed(1)}`}
                  tone={roi != null && roi < 3 ? 'bad' : 'good'}
                />
              </div>

              <div className="border-t border-slate-100 px-4 py-2.5">
                {use == null ? (
                  <p className="text-[11px] text-slate-400">
                    No budget cap · {rupees(c.discountGivenCents)} given away so far
                  </p>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="text-slate-500">
                        {rupees(c.spentCents)} of {rupees(c.budgetCents ?? 0)}
                      </span>
                      <span className={`font-bold ${use >= 1 ? 'text-state-error' : 'text-slate-500'}`}>
                        {use >= 1 ? 'BUDGET GONE' : `${Math.round(use * 100)}%`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${use >= 1 ? 'bg-state-error' : 'bg-emerald'}`}
                        style={{ width: `${Math.max(2, use * 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {data && data.total > 0 && (
        <div className="card overflow-hidden">
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {openId != null && (
        <CampaignModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onError={setActionError}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-white px-4 py-2.5">
      <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div
        className={`text-sm font-extrabold tabular-nums ${
          tone === 'bad' ? 'text-state-error' : tone === 'good' ? 'text-state-success' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function CampaignModal({
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
  const { data, loading, error, reload } = useApiData<CampaignDetail>(`/api/admin/campaigns/${id}`, [id]);

  const [editing, setEditing] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(path: string, fallback: string) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/campaigns/${id}/${path}`);
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits(e: FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/campaigns/${id}`, {
        endsAt: endsAt || null,
        budgetCents: budget === '' ? null : Math.round(Number(budget) * 100),
      });
      setEditing(false);
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the campaign.');
    } finally {
      setBusy(false);
    }
  }

  const use = data ? budgetUse(data) : null;
  const roi = data ? returnPerRupee(data) : null;

  return (
    <Modal title={data ? data.name : 'Campaign'} onClose={onClose} wide>
      {loading && <div className="py-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[data.status]}`}>
              {data.status}
            </span>
            <span className="text-sm font-semibold text-emerald-deep">{discountText(data)}</span>
            {use != null && use >= 1 && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">BUDGET GONE</span>
            )}
          </div>

          {data.description && (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">
              {data.description}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Scope" value={SCOPES.find((s) => s.value === data.scope)?.label ?? data.scope} />
            <Field
              label="Funded by"
              value={
                data.fundedBy === 'shared' && data.platformSharePercent != null
                  ? `Shared · ${data.platformSharePercent}% platform`
                  : data.fundedBy === 'platform'
                    ? 'The platform'
                    : 'The vendors'
              }
            />
            <Field label="Minimum order" value={data.minOrderCents === 0 ? 'None' : rupees(data.minOrderCents)} />
            <Field label="Runs" value={`${formatDate(data.startsAt)} – ${formatDate(data.endsAt)}`} />
            <Field label="Orders" value={String(data.orders)} />
            <Field label="Revenue" value={rupees(data.revenueCents)} />
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Spend against cap</div>
              {use == null ? (
                <p className="mt-1 text-sm text-slate-500">
                  Uncapped — {rupees(data.discountGivenCents)} given away so far. Only the end date stops it.
                </p>
              ) : (
                <>
                  <div className="mt-1 text-sm font-bold text-ink tabular-nums">
                    {rupees(data.spentCents)} of {rupees(data.budgetCents ?? 0)}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${use >= 1 ? 'bg-state-error' : 'bg-emerald'}`}
                      style={{ width: `${Math.max(2, use * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Return</div>
              <div
                className={`mt-1 text-sm font-bold tabular-nums ${
                  roi != null && roi < 3 ? 'text-state-error' : 'text-ink'
                }`}
              >
                {roi == null ? '—' : `₹${roi.toFixed(1)} revenue per ₹1 of discount`}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {rupees(data.discountGivenCents)} given across {data.orders} orders
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Taking part ({data.participants.length})
              </h3>
              {data.fundedBy !== 'platform' && (
                <span className="text-[11px] text-slate-400">
                  {data.optedInCount} opted in — the rest are not running it
                </span>
              )}
            </div>
            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
              {data.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                    <span className="block text-[11px] text-slate-400 capitalize">
                      {p.type}
                      {p.joinedAt && ` · joined ${formatDate(p.joinedAt)}`}
                    </span>
                  </span>
                  {data.fundedBy !== 'platform' && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        p.optedIn ? 'bg-state-success/12 text-state-success-ink' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {p.optedIn ? 'in' : 'not yet'}
                    </span>
                  )}
                </div>
              ))}
              {data.participants.length === 0 && (
                <p className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                  Nothing is taking part — the campaign will not apply anywhere.
                </p>
              )}
            </div>
          </div>

          {editing ? (
            <form onSubmit={saveEdits} className="space-y-2.5 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                    End date
                  </span>
                  <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                    Budget cap (₹)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="Leave empty for uncapped"
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-500">
                The discount and who funds it are fixed once a campaign starts — changing them mid-run would reprice
                orders already placed.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {data.status !== 'ended' && (
                <button
                  onClick={() => {
                    setEditing(true);
                    setEndsAt(data.endsAt.slice(0, 10));
                    setBudget(data.budgetCents == null ? '' : (data.budgetCents / 100).toFixed(2));
                  }}
                  className="mr-auto text-xs font-semibold text-emerald-deep hover:underline"
                >
                  Change dates or budget
                </button>
              )}
              {data.status === 'running' && (
                <button
                  onClick={() => run('pause', 'Could not pause the campaign.')}
                  disabled={busy}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  Pause
                </button>
              )}
              {(data.status === 'paused' || data.status === 'scheduled' || data.status === 'draft') && (
                <button
                  onClick={() => run('resume', 'Could not start the campaign.')}
                  disabled={busy || data.participants.length === 0}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                >
                  {data.participants.length === 0 ? 'Nothing is taking part' : 'Start it'}
                </button>
              )}
              {data.status !== 'ended' && (
                <button
                  onClick={() => run('end', 'Could not end the campaign.')}
                  disabled={busy}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                >
                  End now
                </button>
              )}
              {data.status === 'ended' && (
                <span className="text-[11px] text-slate-400">Ended {formatDate(data.endsAt)}.</span>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ create */

function CreateModal({
  onClose,
  onError,
  onCreated,
}: {
  onClose: () => void;
  onError: (message: string | null) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CampaignScope>('platform');
  const [discountType, setDiscountType] = useState<CampaignDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [fundedBy, setFundedBy] = useState<CampaignFunding>('platform');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      onError('Give the campaign a name.');
      return;
    }
    if (!startsAt || !endsAt) {
      onError('A campaign needs a start and an end.');
      return;
    }
    if (startsAt > endsAt) {
      onError('It ends before it starts.');
      return;
    }
    const value = Number(discountValue);
    if (discountType === 'percentage' && (value <= 0 || value > 100)) {
      onError('A percentage discount has to be between 1 and 100.');
      return;
    }
    onError(null);
    setBusy(true);
    try {
      await api.post('/api/admin/campaigns', {
        name: name.trim(),
        scope,
        discountType,
        discountValue: discountType === 'flat' ? Math.round(value * 100) : value,
        fundedBy,
        startsAt,
        endsAt,
        budgetCents: budget === '' ? null : Math.round(Number(budget) * 100),
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not create the campaign.');
      setBusy(false);
    }
  }

  const funding = FUNDINGS.find((f) => f.value === fundedBy);

  return (
    <Modal title="New campaign" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Diwali week"
            className={inputClass}
            autoFocus
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Applies to</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as CampaignScope)} className={inputClass}>
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Who pays for it
            </span>
            <select
              value={fundedBy}
              onChange={(e) => setFundedBy(e.target.value as CampaignFunding)}
              className={inputClass}
            >
              {FUNDINGS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {funding && <span className="mt-1 block text-[11px] text-slate-500">{funding.note}</span>}
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Discount</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as CampaignDiscountType)}
              className={inputClass}
            >
              {DISCOUNTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          {discountType !== 'free_delivery' && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                {discountType === 'percentage' ? 'Percent off' : 'Amount off (₹)'}
              </span>
              <input
                type="number"
                min={1}
                step={discountType === 'percentage' ? 1 : 0.01}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className={inputClass}
              />
            </label>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Starts</span>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Ends</span>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Budget cap (₹)
            </span>
            <input
              type="number"
              step="0.01"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </label>
        </div>

        <p className="text-xs text-slate-400">
          It is created as a draft with nothing taking part. Add the shops or categories, then start it.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create campaign'}
          </button>
        </div>
      </form>
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
