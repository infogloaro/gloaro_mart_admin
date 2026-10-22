import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Modal } from '../components/ui/Modal';
import { useCan } from '../lib/staffContext';

/** One customer report of wrong shop details (GET /api/admin/vendors/reports, SB7). */
interface ShopReport {
  id: number;
  reason: string;
  reasonLabel: string;
  note: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  resolutionNote: string | null;
  resolvedBy: { id: number; name: string | null } | null;
  resolvedAt: string | null;
  createdAt: string;
  shop: { id: number; name: string; status: string; city: string | null; openReports: number };
  reporter: { id: number; name: string | null; email: string | null } | null;
}

interface ReportList {
  items: ShopReport[];
  total: number;
  counts: { open: number; resolved: number; dismissed: number };
  reasons: { code: string; label: string }[];
}

const FILTERS = ['open', 'resolved', 'dismissed', 'all'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Vendors → Shop reports: customers' reports of wrong shop details (closed,
 * wrong hours, address, phone, map location, category, not a real shop…).
 * Fix the details in Vendors (Edit / Shop page / Trust & hours), then mark the
 * report fixed — or dismiss it when the details were right. The reporter is
 * told the outcome in the app; your note stays internal.
 */
export default function ShopReportsPage() {
  const can = useCan('vendors');
  const [filter, setFilter] = useState<Filter>('open');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<{ report: ShopReport; status: 'resolved' | 'dismissed' } | null>(null);
  const qs = new URLSearchParams({ status: filter, page: String(page), ...(reason ? { reason } : {}) }).toString();
  const { data, loading, error, reload } = useApiData<ReportList>(`/api/admin/vendors/reports?${qs}`, [filter, reason, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Shop reports</h1>
        <p className="text-sm text-slate-500">
          Customers' reports of wrong shop details. Fix the shop under Vendors, then mark the report fixed; the customer is
          told the outcome (never your note).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs options={FILTERS} value={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
        {data && (
          <span className="text-xs text-slate-500">
            {data.counts.open} open · {data.counts.resolved} fixed · {data.counts.dismissed} dismissed
          </span>
        )}
        <select
          value={reason}
          onChange={(e) => { setReason(e.target.value); setPage(1); }}
          className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
          aria-label="Reason"
        >
          <option value="">Every reason</option>
          {data?.reasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </div>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Shop',
                render: (r) => (
                  <div>
                    <div className="font-medium">{r.shop.name}</div>
                    <div className="text-xs text-slate-400">
                      {[r.shop.city, r.shop.status !== 'approved' ? r.shop.status : null].filter(Boolean).join(' · ')}
                      {r.shop.openReports > 1 && <span className="ml-1 font-semibold text-amber-700">{r.shop.openReports} open reports</span>}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Report',
                render: (r) => (
                  <div className="max-w-sm">
                    <div className="font-medium text-slate-800">{r.reasonLabel}</div>
                    {r.note && <div className="text-xs whitespace-pre-wrap text-slate-600">“{r.note}”</div>}
                  </div>
                ),
              },
              {
                header: 'From',
                render: (r) => (r.reporter ? <span className="text-xs">{r.reporter.name ?? '—'}<br />{r.reporter.email}</span> : '—'),
              },
              { header: 'Sent', render: (r) => new Date(r.createdAt).toLocaleString() },
              {
                header: 'Status',
                render: (r) =>
                  r.status === 'open' ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Open</span>
                  ) : (
                    <div className="text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${r.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {r.status === 'resolved' ? 'Fixed' : 'Dismissed'}
                      </span>
                      <div className="mt-1 text-slate-500">
                        {r.resolvedBy?.name ?? ''} {r.resolvedAt ? `· ${new Date(r.resolvedAt).toLocaleDateString()}` : ''}
                      </div>
                      {r.resolutionNote && <div className="text-slate-500">Note: {r.resolutionNote}</div>}
                    </div>
                  ),
              },
              {
                header: 'Actions',
                render: (r) =>
                  r.status === 'open' && can.edit ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setClosing({ report: r, status: 'resolved' })}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Mark fixed
                      </button>
                      <button
                        onClick={() => setClosing({ report: r, status: 'dismissed' })}
                        className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null,
              },
            ]}
            rows={data.items}
            keyFor={(r) => r.id}
            emptyMessage={filter === 'open' ? 'No open reports.' : 'No reports here.'}
          />
        </div>
      )}
      {data && pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md bg-slate-100 px-3 py-1 disabled:opacity-40">Previous</button>
          <span className="text-slate-500">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md bg-slate-100 px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      )}
      {closing && (
        <CloseReportModal
          report={closing.report}
          status={closing.status}
          onClose={() => setClosing(null)}
          onDone={() => { setClosing(null); reload(); }}
        />
      )}
    </div>
  );
}

function CloseReportModal({
  report,
  status,
  onClose,
  onDone,
}: {
  report: ShopReport;
  status: 'resolved' | 'dismissed';
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [alsoSimilar, setAlsoSimilar] = useState(report.shop.openReports > 1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fixed = status === 'resolved';

  async function submit() {
    setError(null);
    if (!fixed && !note.trim()) {
      setError('Say why the details are right (kept internal).');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/admin/vendors/reports/${report.id}`, { status, note: note.trim() || undefined, alsoSimilar });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to close the report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={fixed ? `Mark fixed — ${report.shop.name}` : `Dismiss — ${report.shop.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <div className="font-medium">{report.reasonLabel}</div>
          {report.note && <div className="text-slate-600">“{report.note}”</div>}
        </div>
        <p className="text-xs text-slate-500">
          {fixed
            ? 'Fix the details under Vendors first. The customer gets "Thanks, we\'ve fixed …".'
            : 'The customer gets "We checked … the details look right".'}{' '}
          Your note is internal.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={fixed ? 'What was changed (optional)' : 'Why the details are right (required)'}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={alsoSimilar} onChange={(e) => setAlsoSimilar(e.target.checked)} />
          Also close this shop's other open reports with the same reason
        </label>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md bg-slate-100 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? 'Saving…' : fixed ? 'Mark fixed' : 'Dismiss report'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
