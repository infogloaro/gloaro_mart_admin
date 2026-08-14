import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Pagination } from '../components/ui/Pagination';
import type { AdminRefund, Paged } from '../lib/types';

const FILTERS = ['all', 'pending', 'processing', 'completed', 'failed', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

function money(cents: number) {
  return `₹${(cents / 100).toFixed(2)}`;
}

export default function RefundsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  const qs = new URLSearchParams({
    ...(filter === 'all' ? {} : { status: filter }),
    page: String(page),
  }).toString();

  const { data, loading, error } = useApiData<Paged<AdminRefund>>(`/api/admin/refunds?${qs}`, [filter, page]);

  const outstanding = (data?.items ?? []).filter((r) => r.status === 'pending' || r.status === 'processing');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Refunds</h1>
        <p className="text-xs text-slate-400">
          Raised against a captured payment, from the Payments screen. A COD refund is settled by hand, so it stays
          pending until someone moves the money.
        </p>
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
        <Link to="/payments" className="text-[11px] font-bold text-navy-2 hover:text-gold-ink">
          Go to Payments →
        </Link>
        {outstanding.length > 0 && (
          <span className="ml-auto rounded-full border border-gold/50 bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-gold-ink">
            {outstanding.length} awaiting settlement on this page
          </span>
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
            keyFor={(r) => r.id}
            emptyMessage="No refunds match these filters."
            columns={[
              { header: 'Refund', render: (r) => <span className="font-medium text-ink">#{r.id}</span> },
              {
                header: 'Purchase',
                render: (r) => (
                  <div>
                    <div className="font-mono text-[11px] font-semibold text-slate-700">{r.group_reference}</div>
                    <div className="text-[11px] text-slate-500">
                      payment #{r.payment_id}
                      {r.order_id ? ` · order #${r.order_id}` : ' · whole purchase'}
                    </div>
                  </div>
                ),
              },
              { header: 'Customer', render: (r) => r.customer_name || '—' },
              {
                header: 'Method',
                render: (r) => (
                  <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{r.method}</span>
                ),
              },
              {
                header: 'Amount',
                render: (r) => <span className="font-semibold tabular-nums">{money(r.amount_cents)}</span>,
              },
              { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              {
                header: 'Reason',
                render: (r) => (
                  <span className="text-xs text-slate-500">{r.reason || <span className="text-slate-400">—</span>}</span>
                ),
              },
              { header: 'Raised', render: (r) => new Date(r.created_at).toLocaleDateString() },
            ]}
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
