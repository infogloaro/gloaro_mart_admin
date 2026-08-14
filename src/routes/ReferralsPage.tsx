import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { StatCard } from '../components/ui/StatCard';
import type { AdminReferral, ReferralSummary } from '../lib/types';

const FILTERS = ['all', 'pending', 'converted', 'declined'] as const;
type Filter = (typeof FILTERS)[number];

function money(cents: number) {
  return `₹${(cents / 100).toFixed(2)}`;
}

const STATUS_STYLES: Record<AdminReferral['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  converted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-slate-100 text-slate-500',
};

export default function ReferralsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const { data: summary } = useApiData<ReferralSummary>('/api/admin/referrals/summary');
  const { data: referrals, loading, error, reload } = useApiData<AdminReferral[]>(
    `/api/admin/referrals${filter === 'all' ? '' : `?status=${filter}`}`,
    [filter]
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function setStatus(referral: AdminReferral, status: AdminReferral['status']) {
    setActionError(null);
    setPendingId(referral.id);
    try {
      await api.patch(`/api/admin/referrals/${referral.id}/status`, { status });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update referral.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Referrals</h1>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={`${summary.total}`} />
          <StatCard label="Pending" value={`${summary.pending}`} />
          <StatCard label="Converted" value={`${summary.converted}`} />
          <StatCard label="Converted value" value={money(summary.converted_value_cents)} />
        </div>
      )}

      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && referrals && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Chapter', render: (r) => r.chapter_name },
              { header: 'From', render: (r) => r.referring_user_name || '—' },
              { header: 'To', render: (r) => r.receiving_user_name || '—' },
              {
                header: 'Note',
                render: (r) => <span className="text-slate-600">{r.note || '—'}</span>,
              },
              { header: 'Est. value', render: (r) => money(r.estimated_value_cents) },
              {
                header: 'Status',
                render: (r) => (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                    {r.status.toUpperCase()}
                  </span>
                ),
              },
              { header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() },
              {
                header: 'Actions',
                render: (r) => (
                  <div className="flex gap-2">
                    {r.status !== 'converted' && (
                      <button
                        disabled={pendingId === r.id}
                        onClick={() => setStatus(r, 'converted')}
                        className="rounded-md bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Converted
                      </button>
                    )}
                    {r.status !== 'declined' && (
                      <button
                        disabled={pendingId === r.id}
                        onClick={() => setStatus(r, 'declined')}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                      >
                        Declined
                      </button>
                    )}
                    {r.status !== 'pending' && (
                      <button
                        disabled={pendingId === r.id}
                        onClick={() => setStatus(r, 'pending')}
                        className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={referrals}
            keyFor={(r) => r.id}
            emptyMessage="No referrals in this status."
          />
        </div>
      )}
    </div>
  );
}
