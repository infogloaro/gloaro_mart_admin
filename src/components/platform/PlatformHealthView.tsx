import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiData } from '../../lib/useApiData';
import type { PlatformHealth, PlatformHealthLevel, PlatformHealthRow } from '../../lib/types';

/** Worst first, so problems are what the eye lands on. */
const LEVELS: { level: PlatformHealthLevel; label: string; dot: string; chip: string; hint: string }[] = [
  { level: 'down', label: 'Down', dot: 'bg-rose-500', chip: 'border-rose-200 bg-rose-50 text-rose-700', hint: 'The last connection test failed.' },
  { level: 'degraded', label: 'Degraded', dot: 'bg-amber-500', chip: 'border-amber-200 bg-amber-50 text-amber-800', hint: 'Connected, but errors or rejected webhooks in the last 24 hours.' },
  { level: 'unknown', label: 'Not tested', dot: 'bg-slate-400', chip: 'border-slate-200 bg-slate-100 text-slate-600', hint: 'Has a connector but no test has passed or failed yet.' },
  { level: 'healthy', label: 'Healthy', dot: 'bg-emerald-500', chip: 'border-state-success/25 bg-state-success/10 text-state-success-ink', hint: 'Connected, nothing wrong in the last 24 hours.' },
  { level: 'manual', label: 'Manual', dot: 'bg-sky-400', chip: 'border-sky-200 bg-sky-50 text-sky-700', hint: 'No connector: tracked here, nothing to monitor.' },
  { level: 'off', label: 'Disabled', dot: 'bg-slate-300', chip: 'border-slate-200 bg-white text-slate-500', hint: 'Turned off in the registry.' },
];
const RANK = Object.fromEntries(LEVELS.map((l, i) => [l.level, i])) as Record<PlatformHealthLevel, number>;
const meta = (level: PlatformHealthLevel) => LEVELS[RANK[level]];

function ago(value: string | null): string {
  if (!value) return 'never';
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * Health of every platform the admin can see, worst first. The verdict comes
 * from the server; "Test again" re-runs the connection test of the
 * environment the platform uses.
 */
export function PlatformHealthView({ canEdit, onChanged }: { canEdit: (categorySlug: string) => boolean; onChanged: () => void }) {
  const { data, loading, error, reload } = useApiData<PlatformHealth>('/api/admin/platform-health');
  const [testing, setTesting] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function retest(p: PlatformHealthRow) {
    setTesting(p.id);
    setNotice(null);
    try {
      const r = await api.post<{ message: string | null }>(`/api/admin/platforms/${p.id}/connections/${p.environment}/test`);
      setNotice({ tone: 'ok', text: `${p.name}: ${r.message ?? 'connection works.'}` });
    } catch (err) {
      setNotice({ tone: 'error', text: `${p.name}: ${err instanceof ApiError ? err.message : 'the test failed.'}` });
    } finally {
      setTesting(null);
      reload();
      onChanged();
    }
  }

  if (loading && !data) return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>;
  if (error) return <p className="text-sm font-medium text-rose-600">{error}</p>;
  if (!data) return null;

  const rows = [...data.platforms].sort((a, b) => RANK[a.health] - RANK[b.health] || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {LEVELS.filter((l) => data.summary[l.level]).map((l) => (
          <span key={l.level} title={l.hint} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${l.chip}`}>
            <span className={`h-2 w-2 rounded-full ${l.dot}`} />
            {data.summary[l.level]} {l.label}
          </span>
        ))}
        <button onClick={reload} className="ml-auto rounded-lg px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50">
          Refresh
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
            notice.tone === 'ok' ? 'border-state-success/25 bg-state-success/10 text-state-success-ink' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {rows.length === 0 && <div className="card p-10 text-center text-sm text-slate-500">No platforms to monitor yet.</div>}

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {rows.map((p) => {
          const m = meta(p.health);
          const problem = p.health === 'down' ? p.last_error : p.recent_problems[0]?.message;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} title={m.hint} />
              <div className="min-w-48 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{p.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${m.chip}`}>{m.label}</span>
                  {p.connector_key && (
                    <span className={`text-[11px] font-semibold ${p.environment === 'live' ? 'text-rose-600' : 'text-sky-700'}`}>
                      {p.environment === 'live' ? 'Live' : 'Test'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">{p.category_name}</div>
                {problem && p.health !== 'healthy' && (
                  <div className="mt-0.5 text-xs font-medium text-rose-600">
                    {problem}
                    {p.health !== 'down' && p.recent_problems[0] && <span className="text-slate-400"> · {ago(p.recent_problems[0].created_at)}</span>}
                  </div>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-x-5 text-xs sm:grid-cols-4">
                <Stat label="Last test" value={p.connector_key ? ago(p.last_tested_at) : '—'} />
                <Stat label="Webhooks 24h" value={p.connector_key ? String(p.webhooks_24h) : '—'} />
                <Stat label="Problems 24h" value={p.connector_key ? String(p.errors_24h + p.rejected_24h) : '—'} warn={p.errors_24h + p.rejected_24h > 0} />
                {p.orders_7d !== null && <Stat label="Orders 7d" value={String(p.orders_7d)} />}
              </dl>
              {p.connector_key && p.status === 'active' && canEdit(p.category_slug) && (
                <button
                  onClick={() => retest(p)}
                  disabled={testing === p.id}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {testing === p.id ? 'Testing…' : 'Test again'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className={`font-semibold ${warn ? 'text-rose-600' : 'text-slate-700'}`}>{value}</dd>
    </div>
  );
}
