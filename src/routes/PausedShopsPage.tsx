import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';

/** A shop paused or busy right now (GET /api/admin/vendors/paused, VD2). */
interface PausedShop {
  vendorId: number;
  shop: string;
  status: string;
  city: string | null;
  paused: boolean;
  pausedUntil: string | null;
  note: string | null;
  busyExtraMinutes: number;
  busyUntil: string | null;
}

interface PausedList {
  ready: boolean;
  rows: PausedShop[];
}

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Vendors → Paused & busy: shops that closed themselves from the vendor app
 * (customers see them as closed) or asked for more preparation time (added to
 * the delivery estimate). Shops switch these themselves; this page only shows them.
 */
export default function PausedShopsPage() {
  const { data, loading, error, reload } = useApiData<PausedList>('/api/admin/vendors/paused', []);
  const paused = data?.rows.filter((r) => r.paused).length ?? 0;
  const busy = data?.rows.filter((r) => !r.paused).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Paused &amp; busy shops</h1>
          <p className="text-sm text-slate-500">
            Right now: shops closed from the vendor app (customers see them as closed) and shops asking for extra preparation
            time (added to the delivery estimate).
          </p>
        </div>
        <button onClick={reload} className="ml-auto rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">Refresh</button>
      </div>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && !data.ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Not switched on yet (migration pending).</span> Shops can't pause or ask for more time
          until the shop pause migration runs on this server.
        </div>
      )}
      {!loading && !error && data?.ready && (
        <>
          <div className="text-xs text-slate-500">{paused} paused · {busy} busy</div>
          <div className="overflow-hidden card">
            <DataTable
              columns={[
                {
                  header: 'Shop',
                  render: (r) => (
                    <div>
                      <div className="font-medium">{r.shop}</div>
                      <div className="text-xs text-slate-400">{[r.city, r.status !== 'approved' ? r.status : null].filter(Boolean).join(' · ')}</div>
                    </div>
                  ),
                },
                {
                  header: 'Now',
                  render: (r) =>
                    r.paused ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">Paused — closed to customers</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Busy — +{r.busyExtraMinutes} min prep</span>
                    ),
                },
                {
                  header: 'Until',
                  render: (r) =>
                    r.paused ? (r.pausedUntil ? when(r.pausedUntil) : <span className="text-slate-500">Until the shop reopens</span>) : r.busyUntil ? when(r.busyUntil) : '—',
                },
                {
                  header: 'Also busy',
                  render: (r) => (r.paused && r.busyExtraMinutes > 0 ? `+${r.busyExtraMinutes} min${r.busyUntil ? ` until ${when(r.busyUntil)}` : ''}` : <span className="text-slate-400">—</span>),
                },
                { header: 'Shop note', render: (r) => (r.note ? <span className="text-sm text-slate-700">“{r.note}”</span> : <span className="text-slate-400">—</span>) },
              ]}
              rows={data.rows}
              keyFor={(r) => r.vendorId}
              emptyMessage="Every shop is open as usual."
            />
          </div>
        </>
      )}
    </div>
  );
}
