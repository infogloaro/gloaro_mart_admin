import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type { AdminReview, Paged, ReviewStatus, ReviewSummary } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/reviews',
  'GET    /api/admin/reviews/summary',
  'PATCH  /api/admin/reviews/:id',
  'POST   /api/admin/reviews/:id/dismiss-reports',
  'DELETE /api/admin/reviews/:id/reply',
];

const TABS = ['pending', 'flagged', 'published', 'rejected', 'all'] as const;
type Tab = (typeof TABS)[number];

const TARGETS = ['all', 'product', 'vendor'] as const;
type TargetFilter = (typeof TARGETS)[number];

const STATUS_TONE: Record<ReviewStatus, string> = {
  pending: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  published: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  rejected: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  flagged: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          className={`h-3.5 w-3.5 ${n <= rating ? 'text-gold' : 'text-slate-200'}`}
          strokeWidth={n <= rating ? 2.2 : 1.6}
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const can = useCan('reviews');
  const [tab, setTab] = useState<Tab>('pending');
  const [target, setTarget] = useState<TargetFilter>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [rejecting, setRejecting] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    tab === 'all' ? '' : `status=${tab}`,
    target === 'all' ? '' : `target=${target}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminReview>>(`/api/admin/reviews?${query}`, [
    tab,
    target,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<ReviewSummary>('/api/admin/reviews/summary');

  function refresh() {
    reload();
    reloadSummary();
  }

  async function setStatus(review: AdminReview, status: ReviewStatus, rejectionReason?: string) {
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/reviews/${review.id}`, { status, reason: rejectionReason ?? null });
      setRejecting(null);
      setReason('');
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update the review.');
    } finally {
      setBusy(false);
    }
  }

  async function dismissReports(review: AdminReview) {
    setActionError(null);
    try {
      await api.post(`/api/admin/reviews/${review.id}/dismiss-reports`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not clear the reports.');
    }
  }

  async function removeReply(review: AdminReview) {
    setActionError(null);
    try {
      await api.delete(`/api/admin/reviews/${review.id}/reply`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not remove the reply.');
    }
  }

  function confirmReject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    if (!reason.trim()) {
      setActionError('Give a reason — the customer is told why.');
      return;
    }
    setStatus(rejecting, 'rejected', reason.trim());
  }

  const items = data?.items ?? [];
  const maxCount = summary
    ? Math.max(1, ...Object.values(summary.ratingCounts))
    : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Reviews &amp; Ratings</h1>
        <p className="text-sm text-slate-500">
          What customers say about the goods and about the shop. A review tied to a delivered order carries weight; an
          unverified one is where fake ratings come from.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 13 reviews" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Waiting for review"
              value={String(summary.pending)}
              icon="clock"
              tone={summary.pending > 0 ? 'pending' : 'neutral'}
            />
            <StatCard
              label="Reported by customers"
              value={String(summary.flagged)}
              icon="alert"
              tone={summary.flagged > 0 ? 'critical' : 'neutral'}
              hint="Live on the app right now"
            />
            <StatCard
              label="Average rating"
              value={summary.averageRating == null ? '—' : summary.averageRating.toFixed(2)}
              icon="star"
              tone="gold"
              hint={`${summary.publishedThisMonth} published this month`}
            />
            <StatCard
              label="Unverified share"
              value={summary.unverifiedShare == null ? '—' : `${Math.round(summary.unverifiedShare * 100)}%`}
              icon="shield"
              tone={summary.unverifiedShare != null && summary.unverifiedShare > 0.25 ? 'critical' : 'neutral'}
              hint="Published with no order behind them"
            />
          </div>

          {/* The shape of the distribution says more than the mean: a 4.6 built
              from 5s and 1s is a different shop from a steady 4.6. */}
          <div className="card px-5 py-4">
            <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Published ratings</div>
            <div className="mt-2 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.ratingCounts[String(star)] ?? 0;
                return (
                  <div key={star} className="flex items-center gap-2.5">
                    <span className="w-3 text-right text-xs font-semibold text-slate-500 tabular-nums">{star}</span>
                    <Icon name="star" className="h-3 w-3 shrink-0 text-gold" strokeWidth={2.2} />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-gold"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </span>
                    <span className="w-10 text-right text-xs text-slate-500 tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setPage(1);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-all duration-200 ${
                  tab === t ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                }`}
              >
                {t}
                {t === 'flagged' && summary && summary.flagged > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] ${
                      tab === t ? 'bg-white/25 text-white' : 'bg-state-error/15 text-state-error-ink'
                    }`}
                  >
                    {summary.flagged}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {TARGETS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTarget(t);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold capitalize transition-all duration-200 ${
                  target === t ? 'bg-navy-2 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-56">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Text, product or author…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="star" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">
            {tab === 'pending' ? 'Nothing waiting for review.' : 'No review matches this filter.'}
          </p>
        </div>
      )}

      {/* Cards, not a table: moderation means reading the words and looking at
          the photos, which a row of columns makes impossible. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((r) => (
          <div key={r.id} className="card overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                      on the {r.target}
                    </span>
                    {r.verifiedPurchase ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-state-success/12 px-1.5 py-px text-[10px] font-bold text-state-success-ink">
                        <Icon name="shield" className="h-2.5 w-2.5" />
                        VERIFIED
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-700">
                        NO PURCHASE
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-ink">
                    {r.target === 'product' ? (r.productName ?? 'Product') : r.vendorName}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {r.authorName} · {formatDate(r.createdAt)}
                    {r.orderReference && ` · ${r.orderReference}`}
                    {r.target === 'product' && ` · ${r.vendorName}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[r.status]}`}
                >
                  {r.status}
                </span>
              </div>

              {r.title && <p className="mt-2 text-sm font-semibold text-ink">{r.title}</p>}
              {r.body && <p className="mt-1 text-sm text-slate-600">{r.body}</p>}

              {r.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}

              {r.reportCount > 0 && (
                <div className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2">
                  <p className="text-[11px] font-bold text-rose-700">
                    Reported {r.reportCount} time{r.reportCount === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {r.reports.slice(0, 3).map((report) => (
                      <li key={report.id} className="text-[11px] text-rose-600">
                        {report.reason}
                        {report.reportedByName && (
                          <span className="text-rose-400"> — {report.reportedByName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.vendorReply && (
                <div className="mt-2 rounded-lg border-l-2 border-emerald bg-mint-mist/60 px-2.5 py-2">
                  <p className="text-[10px] font-bold tracking-wide text-emerald-deep uppercase">
                    {r.vendorName} replied
                  </p>
                  <p className="text-xs text-slate-600">{r.vendorReply}</p>
                  {can.delete && (
                    <button
                      onClick={() => removeReply(r)}
                      className="mt-1 text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      Remove the reply
                    </button>
                  )}
                </div>
              )}

              {r.rejectionReason && (
                <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
                  {r.rejectionReason}
                </p>
              )}

              {r.moderatedAt && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Reviewed {formatDate(r.moderatedAt)}
                  {r.moderatedByName && ` by ${r.moderatedByName}`}
                  {r.helpfulCount > 0 && ` · ${r.helpfulCount} found it helpful`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              {can.edit && r.reportCount > 0 && r.status !== 'rejected' && (
                <button
                  onClick={() => dismissReports(r)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                >
                  Reports are unfounded
                </button>
              )}
              {can.edit && r.status !== 'rejected' && (
                <button
                  onClick={() => {
                    setRejecting(r);
                    setReason('');
                    setActionError(null);
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                >
                  Take down
                </button>
              )}
              {can.edit && r.status !== 'published' && (
                <button
                  onClick={() => setStatus(r, 'published')}
                  disabled={busy}
                  className="rounded-lg border border-state-success/30 bg-state-success/10 px-3 py-1 text-xs font-semibold text-state-success-ink hover:bg-state-success/20 disabled:opacity-50"
                >
                  Publish
                </button>
              )}
              {!can.edit && <span className="text-xs text-slate-400">View only</span>}
            </div>
          </div>
        ))}
      </div>

      {data && data.total > 0 && (
        <div className="card overflow-hidden">
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {rejecting && (
        <Modal title="Take down this review" onClose={() => setRejecting(null)}>
          <form onSubmit={confirmReject} className="space-y-3">
            <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
              <Stars rating={rejecting.rating} />
              {rejecting.title && <p className="mt-1 text-sm font-semibold text-ink">{rejecting.title}</p>}
              {rejecting.body && <p className="text-xs text-slate-500">{rejecting.body}</p>}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why it breaks the rules"
                className={inputClass}
              />
            </label>
            <p className="text-xs text-slate-400">
              The customer is told. A rating taken down stops counting towards the product and vendor averages.
            </p>
            {actionError && <p className="text-sm font-medium text-rose-700">{actionError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? 'Taking down…' : 'Take it down'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
