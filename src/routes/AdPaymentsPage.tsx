import { useState } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { StatCard } from '../components/ui/StatCard';
import { fmtDate, rupees } from '../lib/ads';
import type { AdPaymentsResponse } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/ads/payments',
  'POST   /api/admin/ads/payments/:paymentId/confirm',
  'POST   /api/admin/ads/refunds/:refundId/complete',
];

const FILTERS = [
  ['', 'All'],
  ['pending', 'Waiting'],
  ['paid', 'Paid'],
  ['cancelled', 'Cancelled'],
] as const;

const METHOD: Record<string, string> = { settlement: 'From payout', offline: 'Bank / UPI', online: 'Online' };

/** Ad money: what came in, what's still owed, and what goes back. */
export default function AdPaymentsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, loading, error, reload } = useApiData<AdPaymentsResponse>(
    `/api/admin/ads/payments?page=${page}${status ? `&status=${status}` : ''}`,
    [status, page],
  );

  async function withReference(key: string, url: string, ask: string, ok: string) {
    const reference = window.prompt(ask);
    if (!reference?.trim()) return;
    setBusyId(key);
    setNotice(null);
    try {
      await api.post(url, { reference: reference.trim() });
      setNotice({ tone: 'ok', text: ok });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'That did not work.' });
    } finally {
      setBusyId(null);
    }
  }

  const t = data?.totals;
  const pendingRefunds = (data?.refunds ?? []).filter((r) => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Ad payments</h1>
        <p className="text-sm text-slate-500">
          Advertising revenue is kept apart from order commission. Payout-paid ads are deducted in the shop’s weekly
          settlement; bank / UPI payments wait for you to confirm them.
        </p>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Ad Promotions" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>
        ))}

      {t && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Ad revenue (net)" value={rupees(t.netRevenueCents)} icon="coins" tone="gold" hint={`${rupees(t.revenueCents)} before ${rupees(t.refundsCents)} refunded`} />
          <StatCard label="GST collected" value={rupees(t.taxCents - t.taxRefundsCents)} icon="receipt" tone="accent" hint="On ad fees, net of refunds" />
          <StatCard label="Waiting to be paid" value={rupees(t.pendingCents)} icon="clock" tone={t.pendingCents ? 'pending' : 'neutral'} hint={`${rupees(t.awaitingPayoutCents)} more due from payouts`} />
          <StatCard label="Refunds to send" value={rupees(t.refundsPendingCents)} icon="refund" tone={t.refundsPendingCents ? 'critical' : 'neutral'} hint="Bank / UPI refunds not yet paid back" />
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
            notice.tone === 'ok' ? 'border-state-success/25 bg-state-success/10 text-state-success-ink' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {pendingRefunds.length > 0 && (
        <section className="card p-4">
          <h2 className="text-sm font-bold text-ink">Refunds to send back</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {pendingRefunds.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-semibold text-state-error tabular-nums">{rupees(r.amountCents)}</span>
                <span className="min-w-0 flex-1 text-slate-600">
                  {r.shopName} · {r.campaignReference} {r.title} — {r.reason}
                </span>
                <button
                  className="rounded-lg bg-emerald px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                  disabled={busyId === `r${r.id}`}
                  onClick={() => withReference(`r${r.id}`, `/api/admin/ads/refunds/${r.id}/complete`, 'Bank / UPI reference of the refund', 'Refund recorded.')}
                >
                  Refund sent
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold ${
              status === value ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      {!loading && data && (
        <div className="card overflow-hidden">
          <DataTable
            rows={data.items}
            keyFor={(p) => p.id}
            emptyMessage="No ad payments yet."
            columns={[
              { header: 'When', className: 'whitespace-nowrap', render: (p) => fmtDate(p.paidAt ?? p.createdAt) },
              {
                header: 'Campaign',
                render: (p) => (
                  <span>
                    <span className="block font-medium text-ink">{p.title}</span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {p.campaignReference}
                      {p.purpose === 'extension' ? ` · extension +${p.extensionHours} h` : ''}
                    </span>
                  </span>
                ),
              },
              { header: 'Shop', render: (p) => p.shopName },
              { header: 'How', render: (p) => <span className="text-[13px]">{METHOD[p.method] ?? p.method}{p.bankReference ? <span className="block text-[11px] text-slate-400">{p.bankReference}</span> : null}</span> },
              { header: 'Invoice', render: (p) => <span className="font-mono text-[11px]">{p.invoiceNumber ?? '—'}</span> },
              {
                header: 'Amount',
                className: 'text-right tabular-nums',
                render: (p) => (
                  <span>
                    <span className="block font-bold text-ink">{rupees(p.amountCents)}</span>
                    <span className="block text-[11px] text-slate-400">incl. GST {rupees(p.taxCents)}</span>
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (p) =>
                  p.status === 'pending' ? (
                    <button
                      className="rounded-lg bg-emerald px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                      disabled={busyId === `p${p.id}`}
                      onClick={() => withReference(`p${p.id}`, `/api/admin/ads/payments/${p.id}/confirm`, `Bank / UPI reference of the ${rupees(p.amountCents)} payment`, 'Payment confirmed.')}
                    >
                      Money received
                    </button>
                  ) : (
                    <span className={`text-[11px] font-bold uppercase ${p.status === 'paid' ? 'text-state-success' : 'text-slate-400'}`}>{p.status}</span>
                  ),
              },
            ]}
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
