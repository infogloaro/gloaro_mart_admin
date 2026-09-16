import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type {
  AdminCreditNote,
  AdminInvoice,
  CreditNoteDetail,
  CreditNoteReason,
  CreditNoteSummary,
  InvoiceDetail,
  Paged,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/credit-notes',
  'GET    /api/admin/credit-notes/summary',
  'GET    /api/admin/credit-notes/:id',
  'POST   /api/admin/credit-notes',
  'POST   /api/admin/credit-notes/:id/cancel',
];

const REASONS: { value: CreditNoteReason; label: string }[] = [
  { value: 'return', label: 'Goods returned' },
  { value: 'cancellation', label: 'Order cancelled' },
  { value: 'price_adjustment', label: 'Price adjustment' },
  { value: 'deficiency', label: 'Deficiency in service' },
  { value: 'other', label: 'Other' },
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function reasonLabel(reason: CreditNoteReason): string {
  return REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** The last 12 months, newest first — credit notes are filed by month too. */
function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    });
  }
  return out;
}

export default function CreditNotesPage() {
  const can = useCan('credit_notes');
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].value);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [openId, setOpenId] = useState<number | null>(null);
  const [raising, setRaising] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [`month=${month}`, `page=${page}`, debounced ? `q=${encodeURIComponent(debounced)}` : '']
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminCreditNote>>(`/api/admin/credit-notes?${query}`, [
    month,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<CreditNoteSummary>(
    `/api/admin/credit-notes/summary?month=${month}`,
    [month],
  );

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Credit Notes</h1>
          <p className="text-sm text-slate-500">
            The only lawful way to reverse an issued invoice. A credit note has its own number series, reverses the tax
            on the return, and cannot be edited once raised.
          </p>
        </div>
        {can.edit && (
          <button
            onClick={() => {
              setRaising(true);
              setActionError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-deep"
          >
            <Icon name="note" className="h-4 w-4" />
            Raise a credit note
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 9 credit notes" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Credit notes raised" value={String(summary.count)} icon="note" tone="accent" />
          <StatCard label="Value credited" value={rupees(summary.totalCents)} icon="undo" tone="gold" />
          <StatCard
            label="Tax reversed"
            value={rupees(summary.taxCents)}
            icon="percent"
            tone="processing"
            hint="Reduces the GST payable"
          />
          <StatCard
            label="Awaiting refund"
            value={String(summary.awaitingRefund)}
            icon="clock"
            tone={summary.awaitingRefund > 0 ? 'pending' : 'neutral'}
            hint="Credited, money not yet returned"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="relative w-60">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Credit note, invoice or buyer…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(c) => c.id}
            emptyMessage={debounced ? 'No credit note matches that search.' : 'No credit note was raised this month.'}
            columns={[
              {
                header: 'Credit note',
                render: (c) => (
                  <span>
                    <span
                      className={`block font-mono text-xs font-semibold ${
                        c.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-ink'
                      }`}
                    >
                      {c.creditNoteNumber}
                    </span>
                    <span className="block text-[11px] text-slate-400">{formatDate(c.creditNoteDate)}</span>
                  </span>
                ),
              },
              {
                header: 'Against invoice',
                render: (c) => (
                  <span>
                    <span className="block font-mono text-xs text-ink">{c.invoiceNumber}</span>
                    <span className="block text-[11px] text-slate-400">{c.orderReference}</span>
                  </span>
                ),
              },
              {
                header: 'Buyer',
                render: (c) => (
                  <span>
                    <span className="block font-medium text-ink">{c.buyerName}</span>
                    <span className="block text-[11px] text-slate-400">{c.buyerGstin ?? 'B2C'}</span>
                  </span>
                ),
              },
              { header: 'Vendor', render: (c) => <span className="text-ink">{c.vendorName}</span> },
              {
                header: 'Reason',
                render: (c) => (
                  <span>
                    <span className="block text-xs font-semibold text-slate-600">{reasonLabel(c.reason)}</span>
                    {c.reasonNote && <span className="block text-[11px] text-slate-400">{c.reasonNote}</span>}
                  </span>
                ),
              },
              { header: 'Taxable', className: 'text-right tabular-nums', render: (c) => rupees(c.taxableCents) },
              {
                header: 'Tax',
                className: 'text-right tabular-nums',
                render: (c) => (
                  <span>
                    <span className="block">{rupees(c.cgstCents + c.sgstCents + c.igstCents)}</span>
                    <span className="block text-[10px] text-slate-400">
                      {c.supplyType === 'inter_state' ? 'IGST' : 'CGST+SGST'}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Credited',
                className: 'text-right tabular-nums',
                render: (c) => <span className="font-bold text-ink">{rupees(c.totalCents)}</span>,
              },
              {
                header: 'Refund',
                render: (c) =>
                  c.refundId == null ? (
                    <span className="text-xs font-semibold text-amber-600">Not raised</span>
                  ) : (
                    <span className="text-xs text-slate-600 capitalize">{c.refundStatus ?? 'linked'}</span>
                  ),
              },
              {
                header: '',
                className: 'text-right',
                render: (c) => (
                  <button
                    onClick={() => {
                      setOpenId(c.id);
                      setActionError(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    View
                  </button>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {openId != null && (
        <CreditNoteModal
          id={openId}
          onClose={() => setOpenId(null)}
          onError={setActionError}
          onChanged={refresh}
        />
      )}

      {raising && (
        <RaiseCreditNote
          onClose={() => setRaising(false)}
          onError={setActionError}
          onDone={() => {
            setRaising(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function CreditNoteModal({
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
  const can = useCan('credit_notes');
  const { data, loading, error, reload } = useApiData<CreditNoteDetail>(`/api/admin/credit-notes/${id}`, [id]);
  const [busy, setBusy] = useState(false);
  const interState = data?.supplyType === 'inter_state';

  async function cancel() {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/credit-notes/${id}/cancel`);
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not cancel the credit note.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={data ? `Credit note ${data.creditNoteNumber}` : 'Credit note'} onClose={onClose} wide>
      {loading && <div className="py-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.status === 'cancelled' && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              This credit note was cancelled. The original invoice stands in full.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Date" value={formatDate(data.creditNoteDate)} />
            <Field label="Against invoice" value={data.invoiceNumber} mono />
            <Field label="Order" value={data.orderReference} />
            <Field label="Buyer" value={data.buyerName} />
            <Field label="Buyer GSTIN" value={data.buyerGstin ?? 'Unregistered (B2C)'} mono />
            <Field label="Vendor" value={data.vendorName} />
            <Field label="Reason" value={reasonLabel(data.reason)} />
            <Field label="Raised by" value={data.createdByName ?? '—'} />
            <Field
              label="Refund"
              value={data.refundId == null ? 'Not raised' : (data.refundStatus ?? 'Linked')}
            />
          </dl>

          {data.reasonNote && (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">
              {data.reasonNote}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                  <th className="px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">Item</th>
                  <th className="px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">HSN</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">
                    Taxable
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">
                    {interState ? 'IGST' : 'CGST'}
                  </th>
                  {!interState && (
                    <th className="px-3 py-2 text-right text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">
                      SGST
                    </th>
                  )}
                  <th className="px-3 py-2 text-right text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">
                    Credited
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 font-medium text-ink">{l.description}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{l.hsnCode ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rupees(l.taxableCents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {rupees(interState ? l.igstCents : l.cgstCents)}
                    </td>
                    {!interState && <td className="px-3 py-2 text-right tabular-nums">{rupees(l.sgstCents)}</td>}
                    <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">{rupees(l.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Taxable credited</span>
              <span className="tabular-nums">{rupees(data.taxableCents)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax reversed</span>
              <span className="tabular-nums">{rupees(data.cgstCents + data.sgstCents + data.igstCents)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-ink">
              <span>Total credited</span>
              <span className="tabular-nums">{rupees(data.totalCents)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3">
            {data.pdfUrl && (
              <a
                href={data.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="mr-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-deep hover:underline"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                Open the issued PDF
              </a>
            )}
            {data.status === 'issued' ? (
              can.edit ? (
                <>
                  <span className="text-[11px] text-slate-400">
                    Cancelling puts the full invoice back on the return.
                  </span>
                  <button
                    onClick={cancel}
                    disabled={busy}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                  >
                    {busy ? 'Cancelling…' : 'Cancel credit note'}
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-400">View only</span>
              )
            ) : (
              <span className="text-[11px] text-slate-400">Cancelled — nothing further to do.</span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------- raise */

function RaiseCreditNote({
  onClose,
  onError,
  onDone,
}: {
  onClose: () => void;
  onError: (message: string | null) => void;
  onDone: () => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);

  const [reason, setReason] = useState<CreditNoteReason>('return');
  const [note, setNote] = useState('');
  /** Quantity to credit per invoice line. Absent means the line is untouched. */
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  // Only issued invoices can be credited, so the picker never offers the rest.
  const { data: results } = useApiData<Paged<AdminInvoice>>(
    debounced ? `/api/admin/invoices?type=all&q=${encodeURIComponent(debounced)}` : '',
    [debounced],
  );
  const { data: invoice, loading: loadingInvoice } = useApiData<InvoiceDetail>(
    invoiceId ? `/api/admin/invoices/${invoiceId}` : '',
    [invoiceId],
  );

  const candidates = (results?.items ?? []).filter((i) => i.status === 'issued');

  const totals = useMemo(() => {
    if (!invoice) return { taxable: 0, tax: 0, total: 0 };
    return invoice.lines.reduce(
      (acc, l) => {
        const qty = quantities[l.id] ?? 0;
        if (qty <= 0 || l.quantity === 0) return acc;
        // Credit pro rata on the invoiced line, so a partial return carries its
        // own share of tax rather than a recomputed rate.
        const share = qty / l.quantity;
        const taxable = Math.round(l.taxableCents * share);
        const tax = Math.round((l.cgstCents + l.sgstCents + l.igstCents) * share);
        return { taxable: acc.taxable + taxable, tax: acc.tax + tax, total: acc.total + taxable + tax };
      },
      { taxable: 0, tax: 0, total: 0 },
    );
  }, [invoice, quantities]);

  const creditedLines = invoice ? invoice.lines.filter((l) => (quantities[l.id] ?? 0) > 0) : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    if (creditedLines.length === 0) {
      onError('Credit at least one line.');
      return;
    }
    onError(null);
    setBusy(true);
    try {
      await api.post('/api/admin/credit-notes', {
        invoiceId: invoice.id,
        reason,
        note: note.trim() || null,
        lines: creditedLines.map((l) => ({ invoiceLineId: l.id, quantity: quantities[l.id] })),
      });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not raise the credit note.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Raise a credit note" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {!invoiceId && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Find the invoice
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Invoice number, order reference or buyer"
                className={inputClass}
                autoFocus
              />
            </label>
            {debounced && (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {candidates.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">
                    No issued invoice matches. A cancelled invoice cannot be credited.
                  </p>
                )}
                {candidates.map((i) => (
                  <button
                    type="button"
                    key={i.id}
                    onClick={() => setInvoiceId(i.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-left hover:border-emerald hover:bg-mint-mist"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs font-semibold text-ink">{i.invoiceNumber}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {i.buyerName} · {i.orderReference} · {formatDate(i.invoiceDate)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink tabular-nums">{rupees(i.totalCents)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {invoiceId && loadingInvoice && (
          <div className="py-8 text-center text-sm font-medium text-slate-400">Loading invoice…</div>
        )}

        {invoice && (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs font-semibold text-ink">{invoice.invoiceNumber}</span>
                <span className="block truncate text-xs text-slate-500">
                  {invoice.buyerName} · {invoice.vendorName} · {formatDate(invoice.invoiceDate)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setInvoiceId(null);
                  setQuantities({});
                }}
                className="shrink-0 text-xs font-semibold text-slate-500 hover:text-ink"
              >
                Change
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">What to credit</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantities(Object.fromEntries(invoice.lines.map((l) => [l.id, l.quantity])))
                  }
                  className="text-xs font-semibold text-emerald-deep hover:underline"
                >
                  Credit the whole invoice
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {invoice.lines.map((l) => {
                  const qty = quantities[l.id] ?? 0;
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                        qty > 0 ? 'border-emerald/30 bg-mint-mist' : 'border-slate-200'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{l.description}</span>
                        <span className="block text-[11px] text-slate-400">
                          {l.quantity} invoiced · {rupees(l.taxableCents)} taxable · {l.gstRatePercent}%
                        </span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={l.quantity}
                        value={qty}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            // Never credit more than was invoiced — the tax
                            // reversal would exceed the tax charged.
                            [l.id]: Math.max(0, Math.min(l.quantity, Number(e.target.value))),
                          }))
                        }
                        className="w-16 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Reason
                </span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as CreditNoteReason)}
                  className={inputClass}
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Note
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Shown on the credit note"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Taxable to credit</span>
                <span className="tabular-nums">{rupees(totals.taxable)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax to reverse</span>
                <span className="tabular-nums">{rupees(totals.tax)}</span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-ink">
                <span>Total credit</span>
                <span className="tabular-nums">{rupees(totals.total)}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                An estimate from the invoice. The server issues the number and the final amounts.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || creditedLines.length === 0}
                className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
              >
                {busy ? 'Raising…' : 'Raise credit note'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className={`truncate font-medium text-ink ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
