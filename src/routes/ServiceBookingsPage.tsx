import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { useCan } from '../lib/staffContext';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import type { AdminServiceBooking, AdminServiceBookingDetail, AdminServiceCommissions, Paged, ServiceBookingSummary } from '../lib/types';

/**
 * Near Me services → Service bookings (SV10): every booking with its payment
 * and commission, one in full, cancel on Gloaro's behalf, retry a refund,
 * the service payouts by month, and complaints (support tickets about
 * bookings).
 */

const TABS = ['bookings', 'payouts', 'complaints'] as const;
type Tab = (typeof TABS)[number];
const STATUS = ['all', 'active', 'pending', 'completed', 'cancelled', 'rejected'] as const;
type Status = (typeof STATUS)[number];

const rupees = (c: number | null | undefined) => (c == null ? '—' : `₹${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
const words = (s: string) => s.replace(/_/g, ' ');
const inputClass = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm';
const errorBox = 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700';

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-blue-50 text-blue-700',
  on_the_way: 'bg-blue-50 text-blue-700',
  arrived: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
  rejected: 'bg-rose-50 text-rose-700',
};

function StatusPill({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status] ?? 'bg-slate-100 text-slate-600'}`}>{words(status).toUpperCase()}</span>;
}

/** How a booking is (or was) paid, in one phrase. */
function payText(b: AdminServiceBooking): string {
  const p = b.payment;
  if (!p) return b.payOnline ? 'Online · not paid yet' : 'To the shop after the work';
  switch (p.status) {
    case 'successful':
      return `Paid online ${rupees(p.amountCents)}${p.instrument ? ` · ${p.instrument.toUpperCase()}` : ''}`;
    case 'refund_pending':
      return `Refund of ${rupees(p.amountCents)} on its way`;
    case 'refunded':
      return `Refunded ${rupees(p.amountCents)}`;
    case 'refund_failed':
      return `Refund FAILED (${p.failureReason ?? 'gateway'})`;
    default:
      return 'Online · not paid yet';
  }
}

export default function ServiceBookingsPage() {
  const [tab, setTab] = useState<Tab>('bookings');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Service bookings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Near Me services booked in the app: each booking's status, how it was paid, Gloaro Mart's commission and the payout it goes into.
          Services and their categories are under Service categories.
        </p>
      </div>
      <FilterTabs options={TABS} value={tab} onChange={setTab} />
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'payouts' && <PayoutsTab />}
      {tab === 'complaints' && <ComplaintsTab />}
    </div>
  );
}

function BookingsTab() {
  const can = useCan('categories');
  const [status, setStatus] = useState<Status>('active');
  const [paid, setPaid] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const [openId, setOpenId] = useState<number | null>(null);
  const query = [status === 'all' ? '' : `status=${status}`, paid ? `paid=${paid}` : '', `page=${page}`, q ? `q=${encodeURIComponent(q)}` : ''].filter(Boolean).join('&');
  const { data, loading, error, reload } = useApiData<Paged<AdminServiceBooking>>(`/api/admin/service-bookings?${query}`, [status, paid, page, q]);
  const { data: summary, reload: reloadSummary } = useApiData<ServiceBookingSummary>('/api/admin/service-bookings/summary');

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Waiting for a shop" value={String(summary.pending)} icon="clock" tone="warning" />
          <StatCard label="Today" value={String(summary.today)} icon="calendar" />
          <StatCard label="Done this week" value={String(summary.completedWeek)} icon="clipboard" tone="positive" />
          <StatCard label="Pay-now, unpaid" value={String(summary.unpaid)} icon="wallet" tone="warning" hint="Released after 15 min" />
          <StatCard label="Refunds failed" value={String(summary.refundFailed)} icon="alert" tone={summary.refundFailed ? 'critical' : 'neutral'} />
          <StatCard label="Commission · 30 days" value={rupees(summary.commissionCents30d)} icon="percent" hint={`${rupees(summary.onlineCents30d)} paid online`} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterTabs options={STATUS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
        <select value={paid} onChange={(e) => { setPaid(e.target.value); setPage(1); }} className={inputClass}>
          <option value="">Any payment</option>
          <option value="online">Paid online</option>
          <option value="pending">Pay-now, not paid</option>
          <option value="refund_failed">Refund failed</option>
          <option value="shop">Paid to the shop</option>
        </select>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Booking, service, shop, customer, phone" className={`${inputClass} min-w-64 flex-1`} />
      </div>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className={errorBox}>{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Booking',
                render: (b) => (
                  <button type="button" onClick={() => setOpenId(b.id)} className="text-left">
                    <div className="font-semibold text-ink">{b.serviceTitle}</div>
                    <div className="font-mono text-[11px] text-slate-400">{b.reference}</div>
                  </button>
                ),
              },
              { header: 'When', render: (b) => <span>{when(b.startsAt)}<div className="text-xs text-slate-500">{b.atHome ? 'at home' : 'at the shop'}</div></span> },
              { header: 'Shop', render: (b) => <span>{b.shop.name}<div className="text-xs text-slate-500">{b.shop.city ?? ''}</div></span> },
              { header: 'Customer', render: (b) => <span>{b.customer.name}<div className="text-xs text-slate-500">{b.customer.phone ?? ''}</div></span> },
              {
                header: 'Amount',
                render: (b) => (
                  <span>
                    {b.price.totalCents != null ? rupees(b.price.totalCents) : b.price.cents != null ? `${rupees(b.price.cents)} (${words(b.price.type)})` : 'On request'}
                    {b.coupon && <div className="text-xs text-slate-500">coupon {b.coupon.code} −{rupees(b.coupon.discountCents)}</div>}
                  </span>
                ),
              },
              {
                header: 'Payment',
                render: (b) => <span className={b.payment?.status === 'refund_failed' ? 'font-semibold text-rose-700' : ''}>{payText(b)}</span>,
              },
              { header: 'Commission', render: (b) => (b.commission ? `${rupees(b.commission.cents)} (${b.commission.percent}%)` : '—') },
              {
                header: 'Status',
                render: (b) => (
                  <span>
                    <StatusPill status={b.status} />
                    {b.cancelledBy && <div className="mt-1 text-xs text-slate-500">by {b.cancelledBy}</div>}
                    {b.ticketCount > 0 && <div className="mt-1 text-xs font-semibold text-amber-700">{b.ticketCount} complaint{b.ticketCount > 1 ? 's' : ''}</div>}
                  </span>
                ),
              },
            ]}
            rows={data.items}
            keyFor={(b) => b.id}
            emptyMessage="No bookings match."
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}
      {openId != null && (
        <BookingModal
          id={openId}
          canEdit={can.edit}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            reload();
            reloadSummary();
          }}
        />
      )}
    </div>
  );
}

function BookingModal({ id, canEdit, onClose, onChanged }: { id: number; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const { data, loading, error, reload } = useApiData<AdminServiceBookingDetail>(`/api/admin/service-bookings/${id}`, [id]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(path: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/api/admin/service-bookings/${id}/${path}`, body);
      reload();
      onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Could not do that.');
    } finally {
      setBusy(false);
    }
  }

  const active = data ? ['pending', 'accepted', 'on_the_way', 'arrived', 'in_progress'].includes(data.status) : false;
  return (
    <Modal title={data ? `${data.reference} · ${data.serviceTitle}` : 'Booking'} onClose={onClose} wide>
      {loading && <div className="p-6 text-center text-sm text-slate-400">Loading…</div>}
      {error && <div className={errorBox}>{error}</div>}
      {data && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={data.status} />
            <span className="text-slate-500">{when(data.startsAt)} – {new Date(data.endsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
            {data.statusNote && <span className="text-slate-500">· “{data.statusNote}”</span>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:grid-cols-3">
            <Field label="Shop" value={`${data.shop.name}${data.shop.city ? ` · ${data.shop.city}` : ''}`} />
            <Field label="Customer" value={`${data.customer.name}${data.customer.phone ? ` · ${data.customer.phone}` : ''}`} />
            <Field label="Where" value={data.atHome ? data.visitAddress ?? 'At home' : 'At the shop'} />
            <Field label="Price" value={data.price.totalCents != null ? rupees(data.price.totalCents) : `${rupees(data.price.cents)} (${words(data.price.type)})`} />
            <Field label="Payment" value={payText(data)} />
            <Field label="Commission" value={data.commission ? `${rupees(data.commission.cents)} (${data.commission.percent}%) · shop ${data.commission.shopCents >= 0 ? 'gets' : 'owes'} ${rupees(Math.abs(data.commission.shopCents))}` : 'Set when completed'} />
          </dl>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 font-semibold text-ink">What was booked</div>
              <ul className="space-y-1 text-slate-600">
                <li>{data.package ? `Package ${data.package.name} · ${rupees(data.package.cents)}` : `${data.serviceTitle} · ${rupees(data.price.cents)}`}{data.listPriceCents ? ` (list ${rupees(data.listPriceCents)})` : ''}</li>
                {data.addons.map((a) => <li key={a.name}>+ {a.name} · {rupees(a.cents)}</li>)}
                {data.price.visitFeeCents ? <li>Visit fee · {rupees(data.price.visitFeeCents)}</li> : null}
                {data.coupon && <li>Coupon {data.coupon.code} · −{rupees(data.coupon.discountCents)}</li>}
                {data.note && <li className="italic">“{data.note}”</li>}
              </ul>
            </div>
            <div>
              <div className="mb-1 font-semibold text-ink">History</div>
              <ul className="space-y-1 text-slate-600">
                {data.events.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-[11px] text-slate-400">{when(e.at)}</span> {words(e.status)} · {e.by}
                    {e.note && <span className="text-slate-500"> — {e.note}</span>}
                  </li>
                ))}
                {data.paymentEvents.map((e, i) => (
                  <li key={`p${i}`}>
                    <span className="font-mono text-[11px] text-slate-400">{when(e.at)}</span> payment: {words(e.event)} {e.amountCents ? rupees(e.amountCents) : ''}
                    {e.note && <span className="text-slate-500"> — {e.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {data.tickets.length > 0 && (
            <div>
              <div className="mb-1 font-semibold text-ink">Complaints</div>
              <ul className="space-y-1">
                {data.tickets.map((t) => (
                  <li key={t.id}>
                    <Link to="/support" className="font-mono text-xs text-blue-700 hover:underline">{t.reference}</Link> · {t.subject} · <span className="text-slate-500">{words(t.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {actionError && <div className={errorBox}>{actionError}</div>}
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              {active && (
                <>
                  <label className="block min-w-64 flex-1">
                    <span className="text-xs font-semibold text-slate-600">Cancel on Gloaro Mart's behalf — reason (both sides see it)</span>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} mt-1 w-full`} placeholder="e.g. The shop is closed for the week" />
                  </label>
                  <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => run('cancel', { reason: reason.trim() })} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                    Cancel booking{data.payment?.status === 'successful' ? ' & refund' : ''}
                  </button>
                </>
              )}
              {data.payment?.status === 'refund_failed' && (
                <button type="button" disabled={busy} onClick={() => run('refund')} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                  Retry refund {rupees(data.payment.amountCents)}
                </button>
              )}
              {!active && data.payment?.status !== 'refund_failed' && <span className="text-xs text-slate-400">Nothing to do on this booking.</span>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function PayoutsTab() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [settled, setSettled] = useState('');
  const { data, loading, error } = useApiData<AdminServiceCommissions>(`/api/admin/service-commissions?month=${month}${settled ? `&settled=${settled}` : ''}`, [month, settled]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
        <select value={settled} onChange={(e) => setSettled(e.target.value)} className={inputClass}>
          <option value="">All</option>
          <option value="no">Not in a payout yet</option>
          <option value="yes">In a payout</option>
        </select>
        <span className="text-xs text-slate-500">
          A booking paid online credits the shop its value less commission; one paid to the shop charges the commission. Both land in the shop's weekly{' '}
          <Link to="/settlements" className="text-blue-700 hover:underline">settlement</Link>.
        </span>
      </div>
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Completed bookings" value={String(data.totals.bookings)} icon="clipboard" />
          <StatCard label="Booking value" value={rupees(data.totals.grossCents)} icon="wallet" />
          <StatCard label="Commission" value={rupees(data.totals.commissionCents)} icon="percent" tone="positive" />
          <StatCard label="Paid online" value={rupees(data.totals.onlineCents)} icon="card" />
          <StatCard label="Owed to shops" value={rupees(data.totals.owedToShopsCents)} icon="store" hint={`${rupees(data.totals.owedByShopsCents)} owed by shops`} />
          <StatCard label="Not settled yet" value={rupees(data.totals.unsettledCents)} icon="clock" tone="warning" />
        </div>
      )}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className={errorBox}>{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Booking', render: (c) => <span>{c.serviceTitle}<div className="font-mono text-[11px] text-slate-400">{c.reference}</div></span> },
              { header: 'Completed', render: (c) => when(c.completedAt) },
              { header: 'Shop', render: (c) => c.shop.name },
              { header: 'Paid', render: (c) => (c.paidOnline ? 'Online' : 'To the shop') },
              { header: 'Value', render: (c) => rupees(c.grossCents) },
              { header: 'Commission', render: (c) => `${rupees(c.commissionCents)} (${c.commissionPercent}%)` },
              { header: 'Shop', render: (c) => <span className={c.shopCents >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{c.shopCents >= 0 ? `gets ${rupees(c.shopCents)}` : `owes ${rupees(-c.shopCents)}`}</span> },
              { header: 'Payout', render: (c) => (c.settlement ? <Link to="/settlements" className="font-mono text-xs text-blue-700 hover:underline">{c.settlement.reference} · {c.settlement.status}</Link> : <span className="text-slate-400">next cycle</span>) },
            ]}
            rows={data.items}
            keyFor={(c) => c.id}
            emptyMessage="No completed bookings this month."
          />
        </div>
      )}
    </div>
  );
}

function ComplaintsTab() {
  const { data, loading, error } = useApiData<Paged<{ id: number; reference: string; subject: string; status: string; requesterName: string; vendorName: string | null; bookingReference: string | null; bookingService: string | null; createdAt: string }>>(
    '/api/admin/support/tickets?category=service&filter=all'
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Tickets opened with “Report a problem” on a booking. Reply and resolve them on the <Link to="/support" className="text-blue-700 hover:underline">Support</Link> page.
      </p>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className={errorBox}>{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Ticket', render: (t) => <span>{t.subject}<div className="font-mono text-[11px] text-slate-400">{t.reference}</div></span> },
              { header: 'Booking', render: (t) => (t.bookingReference ? <span>{t.bookingReference}<div className="text-xs text-slate-500">{t.bookingService ?? ''}</div></span> : '—') },
              { header: 'From', render: (t) => t.requesterName },
              { header: 'Shop', render: (t) => t.vendorName ?? '—' },
              { header: 'Opened', render: (t) => when(t.createdAt) },
              { header: 'Status', render: (t) => words(t.status) },
            ]}
            rows={data.items}
            keyFor={(t) => t.id}
            emptyMessage="No complaints about bookings."
          />
        </div>
      )}
    </div>
  );
}
