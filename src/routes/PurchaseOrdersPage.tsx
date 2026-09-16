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
  AdminPurchaseOrder,
  Paged,
  PurchaseOrderDetail,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/purchase-orders',
  'GET    /api/admin/purchase-orders/summary',
  'GET    /api/admin/purchase-orders/:id',
  'POST   /api/admin/purchase-orders/:id/resend',
  'POST   /api/admin/purchase-orders/:id/cancel',
  'POST   /api/admin/purchase-orders/:id/close',
];

const FILTERS = ['issued', 'in_progress', 'delivered', 'closed', 'cancelled', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<PurchaseOrderStatus, string> = {
  issued: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  acknowledged: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  in_progress: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  partially_delivered: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  delivered: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  closed: 'border-slate-200 bg-slate-100 text-slate-600',
  cancelled: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
};

const OPEN_STATUSES: PurchaseOrderStatus[] = [
  'issued',
  'acknowledged',
  'in_progress',
  'partially_delivered',
];

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

/** Late is derived: past the promised date with the PO still open. */
function isOverdue(po: { expectedDeliveryAt: string | null; status: PurchaseOrderStatus }): boolean {
  if (!po.expectedDeliveryAt || !OPEN_STATUSES.includes(po.status)) return false;
  return new Date(po.expectedDeliveryAt).getTime() < Date.now();
}

function isPaymentOverdue(po: { paymentDueAt: string | null; invoicedCents: number; paidCents: number }): boolean {
  if (!po.paymentDueAt || po.paidCents >= po.invoicedCents) return false;
  return new Date(po.paymentDueAt).getTime() < Date.now();
}

function ProgressBar({ ratio, tone = 'emerald' }: { ratio: number; tone?: 'emerald' | 'gold' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${tone === 'gold' ? 'bg-gold' : 'bg-emerald'}`}
        style={{ width: `${Math.max(2, Math.min(1, ratio) * 100)}%` }}
      />
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const [filter, setFilter] = useState<Filter>('issued');
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

  const { data, loading, error, reload } = useApiData<Paged<AdminPurchaseOrder>>(
    `/api/admin/purchase-orders?${query}`,
    [filter, page, debounced],
  );
  const { data: summary, reload: reloadSummary } = useApiData<PurchaseOrderSummary>(
    '/api/admin/purchase-orders/summary',
  );

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Purchase Orders</h1>
        <p className="text-sm text-slate-500">
          What an awarded quotation becomes: a commitment to buy at prices already agreed. A PO is finished only when
          everything has both arrived and been paid for.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 11 purchase orders" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Not acknowledged"
            value={String(summary.awaitingAcknowledgement)}
            icon="clipboard"
            tone={summary.awaitingAcknowledgement > 0 ? 'pending' : 'neutral'}
            hint="Vendor has not confirmed"
          />
          <StatCard
            label="In progress"
            value={String(summary.inProgress)}
            icon="truck"
            tone="processing"
            hint={`${summary.overdue} past their date`}
          />
          <StatCard label="Issued this month" value={rupees(summary.issuedThisMonthCents)} icon="coins" tone="gold" />
          <StatCard
            label="Delivered, unpaid"
            value={rupees(summary.outstandingCents)}
            icon="wallet"
            tone={summary.outstandingCents > 0 ? 'critical' : 'neutral'}
            hint="Invoiced and outstanding"
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
            placeholder="PO number, business or vendor…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(p) => p.id}
            emptyMessage={filter === 'issued' ? 'No purchase order is waiting.' : 'Nothing matches this filter.'}
            columns={[
              {
                header: 'PO',
                render: (p) => (
                  <span>
                    <span className="block font-mono text-xs font-semibold text-ink">{p.poNumber}</span>
                    <span className="block text-[11px] text-slate-400">from {p.quotationReference}</span>
                  </span>
                ),
              },
              {
                header: 'Buyer',
                render: (p) => (
                  <span>
                    <span className="block font-medium text-ink">{p.businessName}</span>
                    <span className="block text-[11px] text-slate-400">{p.buyerName}</span>
                  </span>
                ),
              },
              { header: 'Vendor', render: (p) => <span className="text-ink">{p.vendorName}</span> },
              {
                header: 'Fulfilment',
                render: (p) => (
                  <span className="block w-28">
                    <span className="mb-1 flex items-baseline justify-between text-[11px]">
                      <span className="font-semibold text-ink tabular-nums">
                        {Math.round(p.fulfilledRatio * 100)}%
                      </span>
                      {isOverdue(p) && <span className="font-bold text-state-error">LATE</span>}
                    </span>
                    <ProgressBar ratio={p.fulfilledRatio} />
                  </span>
                ),
              },
              {
                header: 'Value',
                className: 'text-right tabular-nums',
                render: (p) => (
                  <span>
                    <span className="block font-bold text-ink">{rupees(p.totalCents)}</span>
                    {/* Delivered and unpaid is the number that matters after
                        the goods stop being the problem. */}
                    {p.invoicedCents > p.paidCents && (
                      <span
                        className={`block text-[11px] font-semibold ${
                          isPaymentOverdue(p) ? 'text-state-error' : 'text-slate-400'
                        }`}
                      >
                        {rupees(p.invoicedCents - p.paidCents)} unpaid
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Due',
                className: 'whitespace-nowrap',
                render: (p) => (
                  <span className={isOverdue(p) ? 'font-semibold text-state-error' : ''}>
                    {formatDate(p.expectedDeliveryAt)}
                  </span>
                ),
              },
              {
                header: 'Status',
                render: (p) => (
                  <span className="flex flex-col gap-1">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[p.status]}`}
                    >
                      {label(p.status)}
                    </span>
                    {p.status === 'issued' && (
                      <span className="text-[10px] font-semibold text-amber-600">not acknowledged</span>
                    )}
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (p) => (
                  <button
                    onClick={() => {
                      setOpenId(p.id);
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
        <PurchaseOrderModal
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

function PurchaseOrderModal({
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
  const { data, loading, error, reload } = useApiData<PurchaseOrderDetail>(`/api/admin/purchase-orders/${id}`, [id]);

  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: unknown, fallback?: string) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/purchase-orders/${id}/${path}`, body);
      setCancelling(false);
      setReason('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : (fallback ?? 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitCancel(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      onError('Say why — the vendor and the buyer are both told.');
      return;
    }
    run('cancel', { reason: reason.trim() }, 'Could not cancel the purchase order.');
  }

  const open = data != null && OPEN_STATUSES.includes(data.status);
  const delivered = data != null && data.fulfilledRatio >= 1;
  const settled = data != null && data.paidCents >= data.invoicedCents && data.invoicedCents > 0;

  return (
    <Modal title={data ? `Purchase order ${data.poNumber}` : 'Purchase order'} onClose={onClose} wide>
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
            <span className="text-xs text-slate-500">issued {formatDate(data.issuedAt)}</span>
            {isOverdue(data) && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                PAST ITS DELIVERY DATE
              </span>
            )}
          </div>

          {data.cancelReason && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{data.cancelReason}</p>
          )}

          {/* A PO not acknowledged is a PO the vendor may never have read. */}
          {data.status === 'issued' && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              <Icon name="alert" className="h-4 w-4 shrink-0" />
              <span>{data.vendorName} has not acknowledged this PO.</span>
              <button
                onClick={() => run('resend', undefined, 'Could not resend the purchase order.')}
                disabled={busy}
                className="ml-auto shrink-0 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send it again'}
              </button>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Business" value={data.businessName} />
            <Field label="Raised by" value={data.buyerName} />
            <Field label="Vendor" value={data.vendorName} />
            <Field label="From RFQ" value={data.rfqReference} />
            <Field label="Expected" value={formatDate(data.expectedDeliveryAt)} />
            <Field label="Acknowledged" value={formatDate(data.acknowledgedAt)} />
          </dl>

          {data.deliveryAddress && (
            <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
              <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Deliver to</div>
              <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{data.deliveryAddress}</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Delivered</span>
                <span className="text-sm font-bold text-ink tabular-nums">
                  {Math.round(data.fulfilledRatio * 100)}%
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar ratio={data.fulfilledRatio} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Paid</span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    isPaymentOverdue(data) ? 'text-state-error' : 'text-ink'
                  }`}
                >
                  {rupees(data.paidCents)} of {rupees(data.invoicedCents)}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar
                  ratio={data.invoicedCents > 0 ? data.paidCents / data.invoicedCents : 0}
                  tone="gold"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {data.paymentTermsDays} day terms · due {formatDate(data.paymentDueAt)}
                {data.invoiceNumber && ` · ${data.invoiceNumber}`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                  {['Line', 'HSN', 'Ordered', 'Delivered', 'Unit price', 'Total'].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap text-slate-500 uppercase ${
                        ['Ordered', 'Delivered', 'Unit price', 'Total'].includes(h) ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lines.map((l) => {
                  const short = l.deliveredQuantity < l.quantity;
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2 font-medium text-ink">{l.description}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{l.hsnCode ?? '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {l.quantity} {l.unit}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          short ? 'font-semibold text-amber-600' : 'text-state-success'
                        }`}
                      >
                        {l.deliveredQuantity}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{rupees(l.unitPriceCents)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">
                        {rupees(l.lineTotalCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{rupees(data.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span className="tabular-nums">{rupees(data.taxCents)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{rupees(data.totalCents)}</span>
            </div>
          </div>

          {data.deliveries.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Deliveries ({data.deliveries.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {data.deliveries.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2">
                    <Icon name="truck" className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{formatDate(d.deliveredAt)}</span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {[d.trackingNumber, d.note].filter(Boolean).join(' · ') || 'No note'}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                      {rupees(d.valueCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.notes && (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">{data.notes}</p>
          )}

          {cancelling ? (
            <form onSubmit={submitCancel} className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Why is it cancelled?
                </span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
                <span className="mt-1 block text-[11px] text-slate-500">
                  {data.fulfilledRatio > 0
                    ? 'Part of this PO has already been delivered — that stays invoiced and payable.'
                    : 'Nothing has been delivered, so nothing is owed.'}
                </span>
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
                  {busy ? 'Cancelling…' : 'Cancel PO'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {open && (
                <button
                  onClick={() => setCancelling(true)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                >
                  Cancel PO
                </button>
              )}
              {open && (
                <button
                  onClick={() => run('close', undefined, 'Could not close the purchase order.')}
                  disabled={busy || !delivered || !settled}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                >
                  {!delivered
                    ? 'Not fully delivered'
                    : !settled
                      ? `${rupees(data.invoicedCents - data.paidCents)} still unpaid`
                      : 'Close purchase order'}
                </button>
              )}
              {!open && (
                <span className="text-[11px] text-slate-400">
                  {label(data.status)} {formatDate(data.closedAt)} — nothing further to do.
                </span>
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
