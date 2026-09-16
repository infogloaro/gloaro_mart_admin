import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Pagination } from '../components/ui/Pagination';
import { Modal } from '../components/ui/Modal';
import { Icon } from '../components/ui/Icon';
import { useCan } from '../lib/staffContext';
import type { AdminPayment, AdminPaymentDetail, Paged } from '../lib/types';

const FILTERS = ['all', 'pending', 'successful', 'partially_refunded', 'refunded', 'failed', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

function money(cents: number) {
  return `₹${(cents / 100).toFixed(2)}`;
}

export default function PaymentsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [viewing, setViewing] = useState<AdminPayment | null>(null);

  const qs = new URLSearchParams({
    ...(filter === 'all' ? {} : { status: filter }),
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    page: String(page),
  }).toString();

  const { data, loading, error, reload } = useApiData<Paged<AdminPayment>>(`/api/admin/payments?${qs}`, [
    filter,
    page,
    debouncedSearch,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Payments</h1>
        <p className="text-xs text-slate-400">
          One payment per purchase. COD settles when every shop in the purchase has delivered.
        </p>
      </div>

      <FilterTabs
        options={FILTERS}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setPage(1);
        }}
      />

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Group reference, customer or gateway id"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
        </div>
        {data && (
          <div className="ml-auto text-sm text-slate-500">
            {data.total} payment{data.total === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="card overflow-hidden">
          <DataTable
            rows={data.items}
            keyFor={(p) => p.id}
            emptyMessage="No payments match these filters."
            columns={[
              {
                header: 'Payment',
                render: (p) => (
                  <button onClick={() => setViewing(p)} className="font-medium text-navy-2 hover:underline">
                    #{p.id}
                  </button>
                ),
              },
              {
                header: 'Purchase',
                render: (p) => (
                  <div>
                    <div className="font-mono text-[11px] font-semibold text-slate-700">{p.group_reference}</div>
                    {p.order_count > 1 && (
                      <div className="text-[11px] text-slate-500">{p.order_count} shops</div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Customer',
                render: (p) => (
                  <div>
                    <div>{p.customer_name || '—'}</div>
                    <div className="text-xs text-slate-500">{p.customer_email}</div>
                  </div>
                ),
              },
              {
                header: 'Method',
                render: (p) => (
                  <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{p.method}</span>
                ),
              },
              { header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
              { header: 'Amount', render: (p) => money(p.amount_cents) },
              {
                header: 'Captured',
                render: (p) => (
                  <span className={p.amount_captured_cents > 0 ? 'font-semibold text-ink' : 'text-slate-400'}>
                    {money(p.amount_captured_cents)}
                  </span>
                ),
              },
              {
                header: 'Refunded',
                render: (p) =>
                  p.amount_refunded_cents > 0 ? (
                    <span className="font-semibold text-state-error-ink">−{money(p.amount_refunded_cents)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  ),
              },
              { header: 'Placed', render: (p) => new Date(p.created_at).toLocaleDateString() },
            ]}
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {viewing && (
        <PaymentDetailModal
          paymentId={viewing.id}
          onClose={() => setViewing(null)}
          onRefunded={() => {
            reload();
          }}
        />
      )}
    </div>
  );
}

function PaymentDetailModal({
  paymentId,
  onClose,
  onRefunded,
}: {
  paymentId: number;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const can = useCan('payments');
  const { data: payment, loading, error, reload } = useApiData<AdminPaymentDetail>(
    `/api/admin/payments/${paymentId}`,
    [paymentId]
  );
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refundable = payment ? payment.amountCapturedCents - payment.amountRefundedCents : 0;

  async function submitRefund(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    const cents = Math.round(rupees * 100);
    // The server enforces this too — this check is only to save a round trip.
    if (cents > refundable) {
      setFormError(`At most ${money(refundable)} can still be refunded.`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/admin/payments/${paymentId}/refunds`, { amountCents: cents, reason: reason || undefined });
      setAmount('');
      setReason('');
      reload();
      onRefunded();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not raise the refund.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Payment #${paymentId}`} onClose={onClose} wide>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}
      {payment && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={payment.status} />
            <span className="font-mono text-[11px] font-semibold text-slate-600">{payment.groupReference}</span>
            <span className="text-xs tracking-wide text-slate-500 uppercase">
              {payment.method} · {payment.provider}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Amount', value: money(payment.amountCents), tone: 'text-ink' },
              { label: 'Captured', value: money(payment.amountCapturedCents), tone: 'text-state-success-ink' },
              { label: 'Refunded', value: money(payment.amountRefundedCents), tone: 'text-state-error-ink' },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-slate-200 p-3">
                <div className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{m.label}</div>
                <div className={`mt-0.5 text-base font-extrabold tabular-nums ${m.tone}`}>{m.value}</div>
              </div>
            ))}
          </div>

          {payment.failureReason && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {payment.failureReason}
            </div>
          )}

          {payment.attempts.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-500 uppercase">Attempts</div>
              <div className="space-y-1.5">
                {payment.attempts.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{a.method}</span>
                    <StatusBadge status={a.status} />
                    <span className="ml-auto text-[11px] text-slate-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500 uppercase">Ledger</div>
            <ol className="space-y-2.5">
              {payment.ledger.map((entry, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-navy-2" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-ink">{entry.event}</span>
                      {entry.amountCents > 0 && (
                        <span className="text-[11px] font-semibold tabular-nums text-slate-600">
                          {money(entry.amountCents)}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-1.5 py-px text-[9px] font-bold text-slate-500 uppercase">
                        {entry.actorRole}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.actorName ? ` · ${entry.actorName}` : ''}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
              <Icon name="refund" className="h-3.5 w-3.5" />
              Refunds
            </div>
            {payment.refunds.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {payment.refunds.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-[13px]">
                    <span className="font-semibold tabular-nums">{money(r.amountCents)}</span>
                    <StatusBadge status={r.status} />
                    {r.orderId && <span className="text-[11px] text-slate-500">order #{r.orderId}</span>}
                    <span className="ml-auto truncate text-[11px] text-slate-400">{r.reason ?? ''}</span>
                  </div>
                ))}
              </div>
            )}

            {refundable > 0 ? (
              can.edit ? (
                <form onSubmit={submitRefund} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Amount (₹) — up to {money(refundable)}
                    </label>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-32 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="min-w-[180px] flex-1">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Reason</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why is this being refunded?"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm"
                    />
                  </div>
                  <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
                    {submitting ? 'Raising…' : 'Raise refund'}
                  </button>
                </form>
              ) : (
                <p className="text-xs font-medium text-slate-400">View only — your role cannot raise refunds.</p>
              )
            ) : (
              <p className="text-xs font-medium text-slate-400">
                {payment.amountCapturedCents === 0
                  ? 'Nothing has been captured on this payment yet.'
                  : 'The full captured amount has been refunded.'}
              </p>
            )}
            {formError && <p className="mt-2 text-xs font-medium text-rose-600">{formError}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
