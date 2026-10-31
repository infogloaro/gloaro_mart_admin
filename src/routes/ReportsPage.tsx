import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../lib/useApiData';
import { Icon } from '../components/ui/Icon';
import { getFavourites, getRecent, toggleFavourite, type ReportCatalogue, type ReportDef } from '../lib/reports';

/**
 * Overview → Reports (RP): every report in one place. Search finds a report by
 * its name, description or keywords; starred and recently opened reports sit
 * on top. Groups not built yet are listed as coming next.
 */
export default function ReportsPage() {
  const { data, loading, error } = useApiData<ReportCatalogue>('/api/admin/report-center');
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState(getFavourites);
  const recent = useMemo(getRecent, []);

  const all = useMemo(() => data?.groups.flatMap((g) => g.reports) ?? [], [data]);
  const byKey = useMemo(() => new Map(all.map((r) => [r.key, r])), [all]);
  const term = q.trim().toLowerCase();
  const matches = (r: ReportDef) =>
    !term ||
    [r.title, r.description, ...r.keywords, data?.groups.find((g) => g.key === r.group)?.label ?? '']
      .join(' ')
      .toLowerCase()
      .includes(term);

  const star = (key: string) => setFavs(toggleFavourite(key));
  const pinned = (keys: string[]) => keys.map((k) => byKey.get(k)).filter((r): r is ReportDef => !!r && matches(r));
  const favList = pinned(favs);
  const recentList = pinned(recent).filter((r) => !favs.includes(r.key));
  const found = data?.groups.map((g) => ({ ...g, reports: g.reports.filter(matches) })) ?? [];
  const anyFound = found.some((g) => g.reports.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Reports</h1>
          <p className="text-sm text-slate-500">
            Every report in one place. Pick a date range and filters, then print or save as PDF, or download CSV.
          </p>
        </div>
        <label className="relative w-full sm:w-80">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reports (e.g. GST, top products)"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm focus:border-navy-2 focus:outline-none"
            aria-label="Search reports"
          />
        </label>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}

      {data && (
        <>
          {favList.length > 0 && <Section title="Starred" reports={favList} favs={favs} onStar={star} />}
          {recentList.length > 0 && <Section title="Recently opened" reports={recentList} favs={favs} onStar={star} />}

          {term && !anyFound && (
            <div className="card p-8 text-center text-sm text-slate-500">No report matches “{q}”.</div>
          )}

          {found.map((g) =>
            g.reports.length > 0 ? (
              <Section key={g.key} title={g.label} reports={g.reports} favs={favs} onStar={star} />
            ) : term ? null : (
              <div key={g.key}>
                <h2 className="mb-2 text-xs font-bold tracking-[0.08em] text-slate-500 uppercase">{g.label}</h2>
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-400">
                  Coming next
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  reports,
  favs,
  onStar,
}: {
  title: string;
  reports: ReportDef[];
  favs: string[];
  onStar: (key: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-bold tracking-[0.08em] text-slate-500 uppercase">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <div key={r.key} className="card card-interactive relative flex gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-2/10 text-navy-2">
              <Icon name="filetext" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Link to={`/reports/${r.key}`} className="font-bold text-ink after:absolute after:inset-0 hover:underline">
                {r.title}
              </Link>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">{r.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onStar(r.key)}
              className={`relative z-10 self-start rounded-lg p-1 ${favs.includes(r.key) ? 'text-gold-deep' : 'text-slate-300 hover:text-slate-500'}`}
              aria-label={favs.includes(r.key) ? `Unstar ${r.title}` : `Star ${r.title}`}
              title={favs.includes(r.key) ? 'Starred' : 'Star this report'}
            >
              <Icon name="star" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
