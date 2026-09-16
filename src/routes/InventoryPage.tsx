import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type { AdminVendor, InventoryItem, InventoryMovement, Paged } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/inventory',
  'PATCH  /api/admin/inventory/:id',
  'GET    /api/admin/inventory/:id/movements',
];

const FILTERS = ['all', 'low', 'out'] as const;
type Filter = (typeof FILTERS)[number];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

function label(item: InventoryItem): string {
  return item.variantLabel ? `${item.productName} · ${item.variantLabel}` : item.productName;
}

export default function InventoryPage() {
  const can = useCan('inventory');
  const [filter, setFilter] = useState<Filter>('all');
  const [vendorId, setVendorId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search, 300);

  const query = [
    filter === 'low' ? 'lowStock=true' : filter === 'out' ? 'outOfStock=true' : '',
    vendorId ? `vendorId=${vendorId}` : '',
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
    `page=${page}`,
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<InventoryItem>>(`/api/admin/inventory?${query}`, [
    filter,
    vendorId,
    debounced,
    page,
  ]);
  const { data: vendors } = useApiData<AdminVendor[]>('/api/admin/vendors');

  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [historyOf, setHistoryOf] = useState<InventoryItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Memoised because `data?.items ?? []` is a new array on every render, which
  // would make the totals memo below recompute regardless.
  const items = useMemo(() => data?.items ?? [], [data]);

  // Totals across the page in view, not the whole catalogue — the API pages the
  // rows, so summing every row here would need a second full fetch and would go
  // stale the moment anyone adjusted stock anyway.
  const totals = useMemo(
    () => ({
      out: items.filter((i) => i.availableQty === 0).length,
      low: items.filter((i) => i.availableQty > 0 && i.availableQty <= i.lowStockThreshold).length,
      reserved: items.reduce((sum, i) => sum + i.reservedQty, 0),
    }),
    [items],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Inventory</h1>
        <p className="text-sm text-slate-500">
          Available, reserved and sold stock across every vendor. Counters are never set directly — each change writes
          a movement that explains it, so the log and the totals cannot disagree.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Sprint 4 inventory" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Rows shown" value={String(data?.total ?? 0)} icon="package" tone="accent" />
        <StatCard
          label="Out of stock"
          value={String(totals.out)}
          icon="ban"
          tone={totals.out > 0 ? 'critical' : 'neutral'}
          hint="on this page"
        />
        <StatCard
          label="Running low"
          value={String(totals.low)}
          icon="alert"
          tone={totals.low > 0 ? 'warning' : 'neutral'}
          hint="on this page"
        />
        <StatCard label="Held for orders" value={String(totals.reserved)} icon="clock" tone="processing" hint="on this page" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          options={FILTERS}
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setPage(1);
          }}
        />
        <select
          value={vendorId}
          onChange={(e) => {
            setVendorId(e.target.value);
            setPage(1);
          }}
          className="w-52 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs"
        >
          <option value="">Every vendor</option>
          {(vendors ?? []).map((v) => (
            <option key={v.id} value={v.id}>{v.business_name}</option>
          ))}
        </select>
        <div className="relative w-56">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search product or SKU…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={items}
            keyFor={(i) => i.id}
            emptyMessage={
              filter === 'low'
                ? 'Nothing is running low.'
                : filter === 'out'
                  ? 'Nothing is out of stock.'
                  : 'No tracked stock matches this filter.'
            }
            columns={[
              {
                header: 'Item',
                render: (i) => (
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{label(i)}</div>
                    <div className="text-[11px] text-slate-400">
                      {[i.vendorName, i.sku].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Available',
                className: 'text-right tabular-nums',
                render: (i) => {
                  const out = i.availableQty === 0;
                  const low = !out && i.availableQty <= i.lowStockThreshold;
                  return (
                    <span
                      className={`font-bold ${out ? 'text-state-error' : low ? 'text-state-shipped-ink' : 'text-ink'}`}
                    >
                      {i.availableQty}
                    </span>
                  );
                },
              },
              {
                // Reserved beside available on purpose: a healthy total that is
                // mostly reserved is why customers are told it is sold out.
                header: 'Reserved',
                className: 'text-right tabular-nums',
                render: (i) =>
                  i.reservedQty > 0 ? (
                    <span className="text-state-processing-ink">{i.reservedQty}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  ),
              },
              {
                header: 'Sold',
                className: 'text-right tabular-nums',
                render: (i) => <span className="text-slate-500">{i.soldQty}</span>,
              },
              {
                header: 'Alert at',
                className: 'text-right tabular-nums',
                render: (i) => <span className="text-slate-400">{i.lowStockThreshold}</span>,
              },
              {
                header: '',
                className: 'text-right',
                render: (i) => (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setHistoryOf(i)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
                    >
                      History
                    </button>
                    {can.edit && (
                      <button
                        onClick={() => {
                          setAdjusting(i);
                          setActionError(null);
                        }}
                        className="btn-primary px-3 py-1 text-xs"
                      >
                        Adjust
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {adjusting && (
        <AdjustDialog
          item={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            reload();
          }}
          onError={setActionError}
        />
      )}

      {historyOf && <HistoryDialog item={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}

/**
 * Sets stock to a target. The note is mandatory server-side, and the dialog
 * requires it too rather than letting the request fail — an unexplained change
 * to a stock figure is the thing the movement log exists to prevent.
 */
function AdjustDialog({
  item,
  onClose,
  onSaved,
  onError,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [qty, setQty] = useState(String(item.availableQty));
  const [threshold, setThreshold] = useState(String(item.lowStockThreshold));
  const [reason, setReason] = useState<'restocked' | 'adjusted'>('restocked');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = Number(qty);
  const delta = Number.isFinite(target) ? target - item.availableQty : 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(target) || target < 0) {
      setError('Enter a stock count of zero or more.');
      return;
    }
    const nextThreshold = Number(threshold);
    if (!Number.isInteger(nextThreshold) || nextThreshold < 0) {
      setError('The alert level must be zero or more.');
      return;
    }
    if (delta !== 0 && !note.trim()) {
      setError('Add a note explaining this change.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/admin/inventory/${item.id}`, {
        // Only send a quantity when it actually moved: the server demands a note
        // for any quantity change, and a no-op change should not require one.
        ...(delta !== 0 ? { availableQty: target, reason } : {}),
        ...(nextThreshold !== item.lowStockThreshold ? { lowStockThreshold: nextThreshold } : {}),
        note: note.trim() || 'Threshold updated',
      });
      onError(null);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the change.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Adjust ${label(item)}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-slate-500">
          {item.vendorName} · {item.availableQty} available, {item.reservedQty} reserved
        </p>

        <div className="flex gap-3">
          <label className="block flex-1">
            <span className={labelClass}>Available stock</span>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={inputClass} />
          </label>
          <label className="block flex-1">
            <span className={labelClass}>Alert at</span>
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
          </label>
        </div>

        {delta !== 0 && (
          <p className={`text-xs font-semibold ${delta > 0 ? 'text-state-success' : 'text-state-error'}`}>
            {delta > 0 ? `Adding ${delta}` : `Removing ${Math.abs(delta)}`} — a movement will be recorded.
          </p>
        )}

        <label className="block">
          <span className={labelClass}>Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as 'restocked' | 'adjusted')}
            className={inputClass}
            disabled={delta === 0}
          >
            <option value="restocked">Restocked</option>
            <option value="adjusted">Correction</option>
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. New delivery from supplier"
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
            {busy ? 'Saving…' : 'Save change'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { data, loading, error } = useApiData<Paged<InventoryMovement>>(`/api/admin/inventory/${item.id}/movements`);
  const moves = data?.items ?? [];

  return (
    <Modal title={`${label(item)} — history`} onClose={onClose} wide>
      {loading && <p className="py-6 text-center text-sm text-slate-400">Loading…</p>}
      {error && <p className="py-6 text-center text-sm text-rose-700">{error}</p>}
      {!loading && !error && moves.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">No movements recorded yet.</p>
      )}
      {moves.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          {moves.map((m) => {
            const up = m.deltaAvailable > 0;
            return (
              <div key={m.id} className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-0">
                <span
                  className={`w-14 shrink-0 text-right font-bold tabular-nums ${
                    up ? 'text-state-success' : m.deltaAvailable < 0 ? 'text-state-error' : 'text-slate-400'
                  }`}
                >
                  {m.deltaAvailable > 0 ? `+${m.deltaAvailable}` : m.deltaAvailable}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink">{m.reason.replace(/_/g, ' ')}</div>
                  {m.note && <div className="text-xs text-slate-500">{m.note}</div>}
                  <div className="text-[11px] text-slate-400">
                    {[
                      new Date(m.createdAt).toLocaleString(),
                      m.actorName ? `by ${m.actorName}` : m.actorRole,
                      m.orderId ? `order #${m.orderId}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {/* Reserved and sold move without available changing, so show
                    them or a reservation looks like nothing happened. */}
                {(m.deltaReserved !== 0 || m.deltaSold !== 0) && (
                  <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                    {m.deltaReserved !== 0 && `reserved ${m.deltaReserved > 0 ? '+' : ''}${m.deltaReserved}`}
                    {m.deltaReserved !== 0 && m.deltaSold !== 0 && ' · '}
                    {m.deltaSold !== 0 && `sold ${m.deltaSold > 0 ? '+' : ''}${m.deltaSold}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
