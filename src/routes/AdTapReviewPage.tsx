import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { useCan } from '../lib/staffContext';

/** A day's repeated taps on one ad from one session or address (GET /api/admin/ads/click-review, SB10). */
interface TapGroup {
  campaignId: number;
  reference: string;
  title: string;
  shop: { id: number; name: string };
  day: string;
  by: 'session' | 'address';
  key: string;
  taps: number;
  invalid: number;
  sessions: number;
  signedIn: number;
  firstAt: string;
  lastAt: string;
  creditedOrders: number;
}

interface TapReview {
  items: TapGroup[];
  thresholds: { session: number; address: number; days: number };
}

const FILTERS = ['open', 'marked', 'all'] as const;
type Filter = (typeof FILTERS)[number];
const DAY_OPTIONS = [7, 30, 90];

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * Ad Promotions → Tap review: an ad tapped many times in a day from one
 * session, or one network address. Mark a group "don't bill": its taps leave
 * the shop's click count, can't credit an order to the ad, and an order they
 * already credited gives the ad commission back to the shop.
 */
export default function AdTapReviewPage() {
  const can = useCan('ad_promotions');
  const [filter, setFilter] = useState<Filter>('open');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { data, loading, error, reload } = useApiData<TapReview>(`/api/admin/ads/click-review?status=${filter}&days=${days}`, [filter, days]);

  const id = (g: TapGroup) => `${g.campaignId}|${g.day}|${g.by}|${g.key}`;

  async function mark(g: TapGroup, invalid: boolean) {
    setMessage(null);
    let note: string | null = null;
    if (invalid) {
      note = window.prompt(`Why don't these ${g.taps} taps count? (internal)`, '');
      if (note === null) return;
    }
    setBusy(id(g));
    try {
      const r = await api.post<{ changed: number; reversedOrders: number; commissionBackCents: number }>(
        '/api/admin/ads/click-review/mark',
        { campaignId: g.campaignId, day: g.day, by: g.by, key: g.key, invalid, note: note?.trim() || undefined },
      );
      setMessage({
        ok: true,
        text: invalid
          ? `${r.changed} tap(s) marked don't bill${r.reversedOrders ? `; ${r.reversedOrders} order(s) un-credited, ₹${(r.commissionBackCents / 100).toFixed(2)} commission back to ${g.shop.name}` : ''}.`
          : `${r.changed} tap(s) count again. Orders already un-credited stay that way.`,
      });
      reload();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : 'Failed to mark the taps.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Ad tap review</h1>
        <p className="text-sm text-slate-500">
          One ad tapped many times in a day from one session
          {data ? ` (${data.thresholds.session}+)` : ''} or one network address{data ? ` (${data.thresholds.address}+)` : ''}.
          Taps are already counted at most once a minute per session.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period"
          className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
          {DAY_OPTIONS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      {message && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${message.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {message.text}
        </div>
      )}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Day', render: (g) => new Date(`${g.day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) },
              {
                header: 'Ad',
                render: (g) => (
                  <div>
                    <div className="font-medium">{g.title}</div>
                    <div className="text-xs text-slate-400">{g.reference} · {g.shop.name}</div>
                  </div>
                ),
              },
              {
                header: 'From',
                render: (g) => (
                  <div className="text-xs">
                    <div className="font-semibold text-slate-700">{g.by === 'session' ? 'One app session' : 'One network address'}</div>
                    <div className="font-mono text-slate-400" title={g.by === 'address' ? 'Hashed; the address itself is not stored' : undefined}>{g.key}</div>
                    {g.by === 'address' && <div className="text-slate-500">{g.sessions} session(s)</div>}
                    {g.signedIn > 0 && <div className="text-slate-500">{g.signedIn} signed-in shopper(s)</div>}
                  </div>
                ),
              },
              {
                header: 'Taps',
                render: (g) => (
                  <div className="text-xs">
                    <div className="text-sm font-semibold text-slate-800">{g.taps}</div>
                    <div className="text-slate-500">{time(g.firstAt)}–{time(g.lastAt)}</div>
                    {g.invalid > 0 && <div className="font-semibold text-rose-700">{g.invalid} don't bill</div>}
                  </div>
                ),
              },
              {
                header: 'Orders credited',
                render: (g) => (g.creditedOrders ? <span className="font-semibold text-amber-700">{g.creditedOrders}</span> : '0'),
              },
              {
                header: 'Actions',
                render: (g) =>
                  can.edit ? (
                    <div className="flex flex-wrap gap-2">
                      {g.invalid < g.taps && (
                        <button
                          disabled={busy === id(g)}
                          onClick={() => mark(g, true)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Don't bill
                        </button>
                      )}
                      {g.invalid > 0 && (
                        <button
                          disabled={busy === id(g)}
                          onClick={() => mark(g, false)}
                          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                        >
                          Count again
                        </button>
                      )}
                    </div>
                  ) : null,
              },
            ]}
            rows={data.items}
            keyFor={id}
            emptyMessage={filter === 'open' ? 'No repeated taps to review.' : 'Nothing here.'}
          />
        </div>
      )}
    </div>
  );
}
