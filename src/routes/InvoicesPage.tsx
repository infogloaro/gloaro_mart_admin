import { useMemo, useState } from 'react';
import { API_URL, isMissingEndpoint } from '../lib/api';
import { getToken } from '../lib/auth';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type { AdminInvoice, InvoiceDetail, InvoiceSummary, Paged } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/invoices',
  'GET    /api/admin/invoices/summary',
  'GET    /api/admin/invoices/:id',
  'GET    /api/admin/invoices/export',
];

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
type TypeFilter = (typeof TYPES)[number]['value'];

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The last 12 months, newest first — a return is always filed by month. */
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

export default function InvoicesPage() {
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].value);
  const [type, setType] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    `month=${month}`,
    type === 'all' ? '' : `type=${type}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error } = useApiData<Paged<AdminInvoice>>(`/api/admin/invoices?${query}`, [
    month,
    type,
    page,
    debounced,
  ]);
  const { data: summary } = useApiData<InvoiceSummary>(`/api/admin/invoices/summary?month=${month}`, [month]);

  /**
   * Same reason as the catalogue export: the endpoint is behind the bearer
   * token, and an <a href> would save the 401 page under a .csv name.
   */
  async function exportReturn() {
    setActionError(null);
    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/invoices/export?month=${month}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gloaro-gst-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not export.');
    } finally {
      setExporting(false);
    }
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Invoices &amp; GST</h1>
          <p className="text-sm text-slate-500">
            Tax documents, not order views. An issued invoice never changes — a mistake is cancelled or credit-noted,
            and the numbers here are the snapshot taken at issue.
          </p>
        </div>
        <button
          onClick={exportReturn}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-50"
        >
          <Icon name="download" className="h-4 w-4" />
          {exporting ? 'Preparing…' : 'Export for filing'}
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 9 invoicing" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Invoices issued"
              value={String(summary.count)}
              icon="receipt"
              tone="accent"
              hint={`${summary.b2bCount} B2B · ${summary.count - summary.b2bCount} B2C`}
            />
            <StatCard label="Taxable value" value={rupees(summary.taxableCents)} icon="coins" tone="gold" />
            <StatCard
              label="GST collected"
              value={rupees(summary.cgstCents + summary.sgstCents + summary.igstCents)}
              icon="percent"
              tone="positive"
              hint="CGST + SGST + IGST"
            />
            <StatCard
              label="Cancelled / credit-noted"
              value={String(summary.cancelledCount + summary.creditNotedCount)}
              icon="ban"
              tone={summary.cancelledCount + summary.creditNotedCount > 0 ? 'critical' : 'neutral'}
              hint="Excluded from the totals above"
            />
          </div>

          {/* The split matters at filing time: intra-state and inter-state tax
              go into different tables on the return. */}
          <div className="card flex flex-wrap gap-x-8 gap-y-3 px-5 py-3.5">
            <TaxTotal label="CGST" value={summary.cgstCents} />
            <TaxTotal label="SGST" value={summary.sgstCents} />
            <TaxTotal label="IGST" value={summary.igstCents} />
            <div className="ml-auto text-right">
              <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Invoice value</div>
              <div className="text-sm font-extrabold text-ink tabular-nums">{rupees(summary.totalCents)}</div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setType(t.value);
                  setPage(1);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                  type === t.value
                    ? 'bg-emerald text-white'
                    : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-60">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Invoice no, order or GSTIN…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(i) => i.id}
            emptyMessage={debounced ? 'No invoice matches that search.' : 'No invoice was issued in this month.'}
            columns={[
              {
                header: 'Invoice',
                render: (i) => (
                  <span>
                    <span
                      className={`block font-mono text-xs font-semibold ${
                        i.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-ink'
                      }`}
                    >
                      {i.invoiceNumber}
                    </span>
                    <span className="block text-[11px] text-slate-400">{formatDate(i.invoiceDate)}</span>
                  </span>
                ),
              },
              {
                header: 'Buyer',
                render: (i) => (
                  <span>
                    <span className="block font-medium text-ink">{i.buyerName}</span>
                    {i.buyerGstin ? (
                      <span className="block font-mono text-[11px] text-slate-400">{i.buyerGstin}</span>
                    ) : (
                      <span className="block text-[11px] text-slate-400">B2C</span>
                    )}
                  </span>
                ),
              },
              { header: 'Vendor', render: (i) => <span className="text-ink">{i.vendorName}</span> },
              {
                header: 'Place of supply',
                render: (i) => (
                  <span>
                    <span className="block text-ink">{i.placeOfSupply}</span>
                    <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                      {i.supplyType === 'inter_state' ? 'inter-state' : 'intra-state'}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Taxable',
                className: 'text-right tabular-nums',
                render: (i) => rupees(i.taxableCents),
              },
              {
                header: 'Tax',
                className: 'text-right tabular-nums',
                render: (i) => (
                  <span>
                    <span className="block">{rupees(i.cgstCents + i.sgstCents + i.igstCents)}</span>
                    <span className="block text-[10px] text-slate-400">
                      {i.supplyType === 'inter_state' ? 'IGST' : 'CGST+SGST'}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Total',
                className: 'text-right tabular-nums',
                render: (i) => <span className="font-bold text-ink">{rupees(i.totalCents)}</span>,
              },
              {
                header: 'Status',
                render: (i) =>
                  i.status === 'cancelled' ? (
                    <span className="inline-block rounded-full border border-state-error/25 bg-state-error/10 px-2.5 py-0.5 text-[10px] font-bold text-state-error-ink uppercase">
                      cancelled
                    </span>
                  ) : i.creditNoteNumber ? (
                    <span className="inline-block rounded-full border border-state-shipped/30 bg-state-shipped/12 px-2.5 py-0.5 text-[10px] font-bold text-state-shipped-ink uppercase">
                      credit-noted
                    </span>
                  ) : (
                    <span className="inline-block rounded-full border border-state-success/25 bg-state-success/10 px-2.5 py-0.5 text-[10px] font-bold text-state-success-ink uppercase">
                      issued
                    </span>
                  ),
              },
              {
                header: '',
                className: 'text-right',
                render: (i) => (
                  <button
                    onClick={() => setOpenId(i.id)}
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

      {openId != null && <InvoiceModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function TaxTotal({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${value > 0 ? 'text-ink' : 'text-slate-300'}`}>
        {rupees(value)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function InvoiceModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, loading, error } = useApiData<InvoiceDetail>(`/api/admin/invoices/${id}`, [id]);
  const interState = data?.supplyType === 'inter_state';

  return (
    <Modal title={data ? `Invoice ${data.invoiceNumber}` : 'Invoice'} onClose={onClose} wide>
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
              Cancelled {formatDate(data.cancelledAt)}
              {data.cancelReason && ` — ${data.cancelReason}`}
            </p>
          )}
          {data.creditNoteNumber && (
            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              Credit note <span className="font-mono font-semibold">{data.creditNoteNumber}</span> was raised against
              this invoice. The original stays on the return; the credit note reverses it.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Invoice date" value={formatDate(data.invoiceDate)} />
            <Field label="Order" value={data.orderReference} />
            <Field label="Place of supply" value={data.placeOfSupply} />
            <Field label="Supplier" value={data.vendorName} />
            <Field label="Supplier GSTIN" value={data.vendorGstin ?? '—'} mono />
            <Field label="Buyer GSTIN" value={data.buyerGstin ?? 'Unregistered (B2C)'} mono />
          </dl>

          {(data.billingAddress || data.shippingAddress) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.billingAddress && <Address label="Billed to" value={data.billingAddress} />}
              {data.shippingAddress && <Address label="Shipped to" value={data.shippingAddress} />}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                  {['Item', 'HSN', 'Qty', 'Taxable', 'Rate', interState ? 'IGST' : 'CGST', interState ? '' : 'SGST', 'Total']
                    .filter((h) => h !== '')
                    .map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap text-slate-500 uppercase ${
                          ['Qty', 'Taxable', 'Rate', 'CGST', 'SGST', 'IGST', 'Total'].includes(h) ? 'text-right' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-ink">{l.description}</span>
                      {l.discountCents > 0 && (
                        <span className="block text-[11px] text-slate-400">less {rupees(l.discountCents)} discount</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{l.hsnCode ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rupees(l.taxableCents)}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500 tabular-nums">{l.gstRatePercent}%</td>
                    {interState ? (
                      <td className="px-3 py-2 text-right tabular-nums">{rupees(l.igstCents)}</td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{rupees(l.cgstCents)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{rupees(l.sgstCents)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">{rupees(l.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <Total label="Taxable value" value={rupees(data.taxableCents)} />
            {interState ? (
              <Total label="IGST" value={rupees(data.igstCents)} />
            ) : (
              <>
                <Total label="CGST" value={rupees(data.cgstCents)} />
                <Total label="SGST" value={rupees(data.sgstCents)} />
              </>
            )}
            {data.cessCents > 0 && <Total label="Cess" value={rupees(data.cessCents)} />}
            {data.roundOffCents !== 0 && <Total label="Round off" value={rupees(data.roundOffCents)} />}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{rupees(data.totalCents)}</span>
            </div>
          </div>

          {data.pdfUrl && (
            <a
              href={data.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-deep hover:underline"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              Open the issued PDF
            </a>
          )}
        </div>
      )}
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

function Address({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
      <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{value}</p>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
