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
import type { ModerationCounts, ModerationProduct, Paged } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/products/moderation',
  'GET    /api/admin/products/moderation-counts',
  'PATCH  /api/admin/products/:id/moderation',
  'DELETE /api/admin/products/:id/moderation',
];

const TABS = ['pending', 'approved', 'rejected', 'all'] as const;
type Tab = (typeof TABS)[number];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function rupees(cents: number | null): string {
  if (cents == null) return '—';
  return `₹${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ModerationPage() {
  const can = useCan('products');
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const query = [
    tab === 'all' ? '' : `status=${tab}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<ModerationProduct>>(
    `/api/admin/products/moderation?${query}`,
    [tab, page, debounced],
  );
  const { data: counts, reload: reloadCounts } = useApiData<ModerationCounts>(
    '/api/admin/products/moderation-counts',
  );

  const [rejecting, setRejecting] = useState<ModerationProduct | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function refresh() {
    reload();
    reloadCounts();
  }

  async function approve(product: ModerationProduct) {
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/products/${product.id}/moderation`, { status: 'approved' });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not approve the product.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    if (!reason.trim()) {
      setActionError('Give a reason the vendor can act on.');
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/products/${rejecting.id}/moderation`, {
        status: 'rejected',
        reason: reason.trim(),
      });
      setRejecting(null);
      setReason('');
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reject the product.');
    } finally {
      setBusy(false);
    }
  }

  async function sendBack(product: ModerationProduct) {
    setActionError(null);
    try {
      await api.delete(`/api/admin/products/${product.id}/moderation`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reopen the review.');
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Product Moderation</h1>
        <p className="text-sm text-slate-500">
          Vendor listings waiting to go live. A customer sees a product only when it is approved here{' '}
          <span className="font-semibold">and</span> switched on by its vendor — the two are separate.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 17 moderation" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {counts && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Waiting for review"
            value={String(counts.pending)}
            icon="clock"
            tone={counts.pending > 0 ? 'pending' : 'neutral'}
          />
          <StatCard label="Approved" value={String(counts.approved)} icon="shield" tone="positive" />
          <StatCard label="Rejected" value={String(counts.rejected)} icon="ban" tone="critical" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                tab === t
                  ? 'bg-gradient-to-r from-emerald to-mint text-white'
                  : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'pending' && counts && counts.pending > 0 && (
                <span className="ml-1.5 rounded-full bg-state-pending/20 px-1.5 py-px text-[10px] text-state-pending-ink">
                  {counts.pending}
                </span>
              )}
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
            placeholder="Search name or SKU…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">
            {tab === 'pending' ? 'Nothing waiting for review.' : 'No products match this filter.'}
          </p>
        </div>
      )}

      {/* Cards rather than a table: a reviewer is judging the listing itself —
          image, price, description — not scanning a column of names. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((p) => (
          <div key={p.id} className="card overflow-hidden">
            <div className="flex gap-3 p-4">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
                  <Icon name="image" className="h-6 w-6" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-sm font-bold text-ink">{p.name}</h2>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      p.moderation_status === 'approved'
                        ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                        : p.moderation_status === 'rejected'
                          ? 'border-state-error/25 bg-state-error/10 text-state-error-ink'
                          : 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink'
                    }`}
                  >
                    {p.moderation_status.toUpperCase()}
                  </span>
                </div>

                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {[p.vendor_name, p.category, p.brand_name].filter(Boolean).join(' · ')}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-bold text-ink tabular-nums">{rupees(p.price_cents)}</span>
                  {p.mrp_cents != null && p.mrp_cents > p.price_cents && (
                    <span className="text-slate-400 line-through tabular-nums">{rupees(p.mrp_cents)}</span>
                  )}
                  <span className="text-slate-500">stock {p.stock_quantity}</span>
                  {p.sku && <span className="font-mono text-slate-400">{p.sku}</span>}
                </div>

                {/* Approving a listing the vendor has switched off does not put
                    it on sale, so say so rather than letting it read as live. */}
                {!p.is_active && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                    <Icon name="alert" className="h-3 w-3" />
                    Switched off by its vendor
                  </p>
                )}

                {p.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{p.description}</p>
                )}

                <p className="mt-1.5 text-[11px] text-slate-400">
                  Submitted {formatDate(p.submitted_at)}
                  {p.moderated_at && ` · reviewed ${formatDate(p.moderated_at)}`}
                  {p.moderated_by_name && ` by ${p.moderated_by_name}`}
                </p>

                {p.moderation_status === 'rejected' && p.moderation_reason && (
                  <p className="mt-1.5 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">
                    {p.moderation_reason}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              {can.delete && p.moderation_status !== 'pending' && (
                <button
                  onClick={() => sendBack(p)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                >
                  Reopen
                </button>
              )}
              {can.edit && p.moderation_status !== 'rejected' && (
                <button
                  onClick={() => {
                    setRejecting(p);
                    setReason('');
                    setActionError(null);
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                >
                  Reject
                </button>
              )}
              {can.edit && p.moderation_status !== 'approved' && (
                <button
                  onClick={() => approve(p)}
                  disabled={busy}
                  className="rounded-lg border border-state-success/30 bg-state-success/10 px-3 py-1 text-xs font-semibold text-state-success-ink hover:bg-state-success/20 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {!can.edit && !can.delete && <span className="text-xs text-slate-400">View only</span>}
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
        <Modal title={`Reject ${rejecting.name}`} onClose={() => setRejecting(null)}>
          <form onSubmit={confirmReject} className="space-y-3">
            <p className="text-sm text-slate-500">
              {rejecting.vendor_name} · {rupees(rejecting.price_cents)}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What the vendor must fix before resubmitting"
                className={inputClass}
              />
            </label>
            <p className="text-xs text-slate-400">
              The listing stays hidden from customers until it is approved.
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
                {busy ? 'Rejecting…' : 'Reject listing'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
