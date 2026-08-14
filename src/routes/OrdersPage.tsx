import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Pagination } from '../components/ui/Pagination';
import { Modal } from '../components/ui/Modal';
import type { AdminOrderDetail, AdminOrderListRow, Paged } from '../lib/types';

const FILTERS = ['all', 'pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'packed',
  packed: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

function money(cents: number) {
  return `₹${(cents / 100).toFixed(2)}`;
}

/// Orders placed in one checkout split into one order per shop. Without a
/// checkout id on the row, siblings are matched by customer and placement time.
function siblingKey(order: AdminOrderListRow) {
  return `${order.user_id}|${Math.floor(new Date(order.created_at).getTime() / 5000)}`;
}

export default function OrdersPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const debouncedSearch = useDebounced(search);

  const qs = new URLSearchParams({
    ...(filter === 'all' ? {} : { status: filter }),
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page: String(page),
  }).toString();

  const { data, loading, error, reload } = useApiData<Paged<AdminOrderListRow>>(`/api/admin/orders?${qs}`, [
    filter,
    page,
    debouncedSearch,
    from,
    to,
  ]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<AdminOrderListRow | null>(null);
  const [dispatching, setDispatching] = useState<AdminOrderListRow | null>(null);

  // Orders sharing a checkout, so ops can see this is one customer's basket
  // split across shops rather than several unrelated orders.
  const siblingCounts = new Map<string, number>();
  for (const order of data?.items ?? []) {
    const key = siblingKey(order);
    siblingCounts.set(key, (siblingCounts.get(key) ?? 0) + 1);
  }

  async function setStatus(order: AdminOrderListRow, status: string, extra?: Record<string, unknown>) {
    setActionError(null);
    setPendingId(order.id);
    try {
      await api.patch(`/api/admin/orders/${order.id}/status`, { status, ...extra });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update order.');
    } finally {
      setPendingId(null);
    }
  }

  function advance(order: AdminOrderListRow, next: string) {
    // Dispatch is where the courier is decided, so ask for it then rather than
    // letting an order go out with no one named on it.
    if (next === 'out_for_delivery') {
      setDispatching(order);
      return;
    }
    setStatus(order, next);
  }

  const hasFilters = Boolean(debouncedSearch.trim() || from || to || filter !== 'all');

  function clearFilters() {
    setSearch('');
    setFrom('');
    setTo('');
    setFilter('all');
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">All Orders</h1>
      <FilterTabs
        options={FILTERS}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setPage(1);
        }}
      />
      <div className="flex flex-wrap items-end gap-3 card p-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Order number, customer or shop"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Clear
          </button>
        )}
        {data && (
          <div className="ml-auto text-sm text-slate-500">
            {data.total} order{data.total === 1 ? '' : 's'}
          </div>
        )}
      </div>
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Order #',
                render: (o) => {
                  const siblings = siblingCounts.get(siblingKey(o)) ?? 1;
                  return (
                    <div>
                      <button onClick={() => setViewing(o)} className="font-medium text-brand-navy hover:underline">
                        #{o.id}
                      </button>
                      {siblings > 1 && (
                        <div
                          title="One checkout split across several shops — each ships and invoices separately."
                          className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                        >
                          1 of {siblings} in checkout
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                header: 'Vendor',
                render: (o) => (
                  <div>
                    <div>{o.vendor_name}</div>
                    {o.vendor_city && <div className="text-xs text-slate-500">{o.vendor_city}</div>}
                  </div>
                ),
              },
              {
                header: 'Customer',
                render: (o) => (
                  <div>
                    <div>{o.customer_name || '—'}</div>
                    <div className="text-xs text-slate-500">{o.customer_email}</div>
                  </div>
                ),
              },
              { header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
              { header: 'Total', render: (o) => money(o.total_cents) },
              { header: 'Placed', render: (o) => new Date(o.created_at).toLocaleDateString() },
              {
                header: 'Actions',
                render: (o) => {
                  const next = NEXT_STATUS[o.status];
                  const canCancel = o.status !== 'delivered' && o.status !== 'cancelled';
                  return (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewing(o)}
                        className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        View
                      </button>
                      {next && (
                        <button
                          disabled={pendingId === o.id}
                          onClick={() => advance(o, next)}
                          className="btn-primary px-3 py-1 text-xs"
                        >
                          {next === 'out_for_delivery' ? 'Dispatch' : `Mark ${next.replace('_', ' ')}`}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          disabled={pendingId === o.id}
                          onClick={() => setStatus(o, 'cancelled')}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  );
                },
              },
            ]}
            rows={data.items}
            keyFor={(o) => o.id}
            emptyMessage="No orders found."
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {viewing && <OrderDetailModal orderId={viewing.id} onClose={() => setViewing(null)} />}

      {dispatching && (
        <DispatchModal
          order={dispatching}
          submitting={pendingId === dispatching.id}
          onClose={() => setDispatching(null)}
          onConfirm={async (partner) => {
            await setStatus(dispatching, 'out_for_delivery', partner);
            setDispatching(null);
          }}
        />
      )}
    </div>
  );
}

/// Names the courier as the order goes out, so the customer's tracking screen
/// has someone to show and a number to call.
function DispatchModal({
  order,
  submitting,
  onClose,
  onConfirm,
}: {
  order: AdminOrderListRow;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (partner: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(order.delivery_partner_name ?? '');
  const [phone, setPhone] = useState(order.delivery_partner_phone ?? '');
  const [eta, setEta] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter who is delivering this order.');
      return;
    }
    onConfirm({
      deliveryPartnerName: name.trim(),
      deliveryPartnerPhone: phone.trim() || null,
      estimatedDeliveryAt: eta ? new Date(eta).toISOString() : null,
    });
  }

  return (
    <Modal title={`Dispatch order #${order.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <p className="text-slate-500">
          {order.vendor_name} → {order.customer_name || order.customer_email}
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Delivery partner</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rider or courier name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Estimated delivery</label>
            <input
              type="datetime-local"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Dispatching…' : 'Dispatch'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OrderDetailModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { data: order, loading, error } = useApiData<AdminOrderDetail>(`/api/admin/orders/${orderId}`, [orderId]);

  return (
    <Modal title={`Order #${orderId}`} onClose={onClose} wide>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {order && (
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            <span className="text-slate-500">Placed {new Date(order.created_at).toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Customer</div>
              <div className="font-medium">{order.customer_name || '—'}</div>
              <div className="text-slate-600">{order.customer_email}</div>
              {order.customer_phone && <div className="text-slate-600">{order.customer_phone}</div>}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Vendor</div>
              <div className="font-medium">{order.vendor_name}</div>
              {order.vendor_city && <div className="text-slate-600">{order.vendor_city}</div>}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Delivery</div>
            <div className="whitespace-pre-wrap text-slate-700">{order.delivery_address}</div>
            {order.delivery_partner_name && (
              <div className="mt-2 text-slate-600">
                Partner: {order.delivery_partner_name}
                {order.delivery_partner_phone ? ` · ${order.delivery_partner_phone}` : ''}
              </div>
            )}
            {order.estimated_delivery_at && (
              <div className="text-slate-600">ETA: {new Date(order.estimated_delivery_at).toLocaleString()}</div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">GST %</th>
                  <th className="px-3 py-2 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.product_name_snapshot}</td>
                    <td className="px-3 py-2">{money(item.unit_price_cents)}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{item.gst_rate_percent_snapshot}</td>
                    <td className="px-3 py-2 text-right">{money(item.unit_price_cents * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-64 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span>{money(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">GST</span>
              <span>{money(order.gst_cents)}</span>
            </div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount{order.coupon_code_snapshot ? ` (${order.coupon_code_snapshot})` : ''}</span>
                <span>−{money(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
              <span>Total</span>
              <span>{money(order.total_cents)}</span>
            </div>
            <div className="pt-1 text-xs text-slate-500">Payment: {order.payment_method.toUpperCase()}</div>
          </div>
        </div>
      )}
    </Modal>
  );
}
