import { useState } from 'react';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';

/** One shop message to its followers (GET /api/admin/vendors/broadcasts, VD23). */
interface Broadcast {
  id: number;
  vendorId: number;
  shop: string;
  title: string | null;
  message: string;
  offerKey: string | null;
  offerText: string | null;
  reach: number;
  sentAt: string;
}

interface BroadcastList {
  ready: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalReach: number;
  shops: { id: number; name: string }[];
  rows: Broadcast[];
}

/**
 * Vendors → Shop messages: what shops sent to their followers from the vendor
 * app ("Message your followers"), and how many followers got each one.
 * Read-only — a message can't be recalled once sent.
 */
export default function ShopBroadcastsPage() {
  const [vendorId, setVendorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({
    page: String(page),
    ...(vendorId ? { vendorId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString();
  const { data, loading, error } = useApiData<BroadcastList>(`/api/admin/vendors/broadcasts?${qs}`, [vendorId, from, to, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const input = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Shop messages to followers</h1>
        <p className="text-sm text-slate-500">
          Messages shops sent from the vendor app to followers who asked for offer alerts — at most one per shop a day.
          Reach is how many followers got it in the app.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={vendorId} onChange={(e) => { setVendorId(e.target.value); setPage(1); }} className={input} aria-label="Shop">
          <option value="">Every shop</option>
          {data?.shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          From <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={input} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          To <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={input} />
        </label>
        {(vendorId || from || to) && (
          <button onClick={() => { setVendorId(''); setFrom(''); setTo(''); setPage(1); }} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
            Clear
          </button>
        )}
        {data?.ready && (
          <span className="ml-auto text-xs text-slate-500">
            {data.total} {data.total === 1 ? 'message' : 'messages'} · {data.totalReach} followers reached
          </span>
        )}
      </div>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && !data.ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Not switched on yet (migration pending).</span> Shops can't message followers until the
          shop broadcasts migration runs on this server.
        </div>
      )}
      {!loading && !error && data?.ready && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Shop', render: (r) => <span className="font-medium">{r.shop}</span> },
              {
                header: 'Message',
                render: (r) => (
                  <div className="max-w-md">
                    {r.title && <div className="font-medium text-slate-800">{r.title}</div>}
                    <div className="text-sm whitespace-pre-wrap text-slate-600">{r.message}</div>
                  </div>
                ),
              },
              {
                header: 'Offer',
                render: (r) => (r.offerText ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{r.offerText}</span> : <span className="text-slate-400">—</span>),
              },
              { header: 'Reach', render: (r) => <span className="font-semibold tabular-nums">{r.reach}</span> },
              { header: 'Sent', render: (r) => new Date(r.sentAt).toLocaleString() },
            ]}
            rows={data.rows}
            keyFor={(r) => r.id}
            emptyMessage={vendorId || from || to ? 'No messages match these filters.' : 'No shop has messaged its followers yet.'}
          />
        </div>
      )}
      {data?.ready && pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md bg-slate-100 px-3 py-1 disabled:opacity-40">Previous</button>
          <span className="text-slate-500">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md bg-slate-100 px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
