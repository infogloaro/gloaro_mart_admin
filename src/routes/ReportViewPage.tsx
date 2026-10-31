import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { useBrand } from '../lib/brand';
import { useStaffMe } from '../lib/staffContext';
import { Icon } from '../components/ui/Icon';
import { StatCard } from '../components/ui/StatCard';
import {
  PRESETS,
  describeFilters,
  downloadCsv,
  formatCell,
  isNumeric,
  markOpened,
  presetFor,
  presetRange,
  printReport,
  type ReportCatalogue,
  type ReportColumn,
  type ReportDef,
  type ReportFilter,
  type ReportResult,
} from '../lib/reports';

const CONTROL = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-navy-2 focus:outline-none';

/**
 * One report (RP): From → To with presets, the report's own filters, search,
 * sortable columns, totals over every filtered row, server-side pages, and
 * PDF / CSV of every row. All of it lives in the URL, so a report can be
 * bookmarked, shared or reopened with the same filters.
 */
export default function ReportViewPage() {
  const { key = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: cat, error: catError } = useApiData<ReportCatalogue>('/api/admin/report-center');
  const def = useMemo(() => cat?.groups.flatMap((g) => g.reports).find((r) => r.key === key) ?? null, [cat, key]);
  const groupLabel = cat?.groups.find((g) => g.key === def?.group)?.label;

  // A report opens on the last 30 days.
  useEffect(() => {
    if (!params.get('from') || !params.get('to')) {
      const r = presetRange('30d');
      const next = new URLSearchParams(params);
      next.set('from', r.from);
      next.set('to', r.to);
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (def) markOpened(def.key);
  }, [def]);

  const ready = !!def && !!params.get('from');
  const qs = params.toString();
  const { data, loading, error } = useApiData<ReportResult>(ready ? `/api/admin/report-center/${key}?${qs}` : '', [key, qs, ready]);

  /** Changes some params; anything but paging goes back to page 1. */
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  if (catError) return <Banner tone="error">{catError}</Banner>;
  if (!cat) return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>;
  if (!def) {
    return (
      <div className="space-y-3">
        <Banner tone="error">There is no report called “{key}”.</Banner>
        <Link to="/reports" className="text-sm font-semibold text-navy-2 hover:underline">← All reports</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/reports" className="text-xs font-semibold text-slate-500 hover:text-navy-2">
          ← Reports{groupLabel ? ` · ${groupLabel}` : ''}
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">{def.title}</h1>
            <p className="text-sm text-slate-500">{def.description}</p>
          </div>
          <Exports def={def} cat={cat} params={params} disabled={!data || loading} />
        </div>
      </div>

      <FilterBar def={def} cat={cat} params={params} update={update} />

      {error && <Banner tone="error">{error}</Banner>}

      {data && (
        <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 ${loading ? 'opacity-60' : ''}`}>
          {data.summary.map((s) => (
            <StatCard key={s.key} label={s.label} value={formatCell(s.value, s.type)} tone={s.type === 'money' ? 'gold' : 'accent'} />
          ))}
        </div>
      )}

      <div className="overflow-hidden card">
        <TableToolbar def={def} params={params} update={update} total={data?.total} />
        {!data && loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
        {data && (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <ReportTable def={def} result={data} update={update} />
            <Pager result={data} sizes={cat.pageSizes} update={update} />
          </div>
        )}
      </div>

      {def.notes && <p className="text-xs text-slate-500">{def.notes}</p>}
    </div>
  );
}

function Banner({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  const cls = tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800';
  return <div className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${cls}`}>{children}</div>;
}

// ----- filters -----

function FilterBar({
  def,
  cat,
  params,
  update,
}: {
  def: ReportDef;
  cat: ReportCatalogue;
  params: URLSearchParams;
  update: (c: Record<string, string | null>) => void;
}) {
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const preset = from && to ? presetFor(from, to) : '30d';
  const used = def.filters.filter((f) => params.get(f.key));

  const reset = () => {
    const changes: Record<string, string | null> = { q: null };
    for (const f of def.filters) changes[f.key] = null;
    update(changes);
  };

  return (
    <div className="card space-y-3 p-4">
      {!def.noDates && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Date range">
            <select
              className={CONTROL}
              value={preset}
              onChange={(e) => e.target.value !== 'custom' && update(presetRange(e.target.value))}
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </Field>
          <Field label="From">
            <input type="date" className={CONTROL} value={from} max={to || undefined} onChange={(e) => e.target.value && update({ from: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" className={CONTROL} value={to} min={from || undefined} onChange={(e) => e.target.value && update({ to: e.target.value })} />
          </Field>
        </div>
      )}
      {def.filters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
          {def.filters.map((f) => (
            <Field key={f.key} label={f.label}>
              <FilterControl filter={f} cat={cat} value={params.get(f.key) ?? ''} onChange={(v) => update({ [f.key]: v })} />
            </Field>
          ))}
          {(used.length > 0 || params.get('q')) && (
            <button type="button" onClick={reset} className="mb-0.5 text-sm font-semibold text-navy-2 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function FilterControl({
  filter: f,
  cat,
  value,
  onChange,
}: {
  filter: ReportFilter;
  cat: ReportCatalogue;
  value: string;
  onChange: (v: string) => void;
}) {
  const allLabel = f.default ? null : 'All';
  switch (f.type) {
    case 'select':
      return (
        <select className={CONTROL} value={value || f.default || ''} onChange={(e) => onChange(e.target.value === f.default ? '' : e.target.value)}>
          {allLabel && <option value="">{allLabel}</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'shop':
      return (
        <select className={`${CONTROL} max-w-56`} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All shops</option>
          {cat.options.shops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ''}</option>
          ))}
        </select>
      );
    case 'brand':
      return (
        <select className={`${CONTROL} max-w-48`} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All brands</option>
          {cat.options.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      );
    case 'category':
      return (
        <select className={`${CONTROL} max-w-48`} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All categories</option>
          {cat.options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    case 'city':
      return (
        <select className={`${CONTROL} max-w-44`} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All cities</option>
          {cat.options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    default:
      return <TypedInput number={f.type === 'number'} value={value} onChange={onChange} />;
  }
}

/** A text or number box that applies after typing stops, not on every key. */
function TypedInput({ number, value, onChange }: { number: boolean; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const debounced = useDebounced(text, 500);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (debounced !== value) onChange(debounced.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return (
    <input
      type={number ? 'number' : 'text'}
      min={number ? 0 : undefined}
      inputMode={number ? 'decimal' : undefined}
      className={`${CONTROL} w-32`}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}

// ----- table -----

function TableToolbar({
  def,
  params,
  update,
  total,
}: {
  def: ReportDef;
  params: URLSearchParams;
  update: (c: Record<string, string | null>) => void;
  total: number | undefined;
}) {
  const searchable = def.columns.filter((c) => c.search);
  const [q, setQ] = useState(params.get('q') ?? '');
  const debounced = useDebounced(q, 400);
  const current = params.get('q') ?? '';
  useEffect(() => setQ(current), [current]);
  useEffect(() => {
    if (debounced.trim() !== current) update({ q: debounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <span className="text-sm font-semibold text-slate-600 tabular-nums">
        {total == null ? '' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'row' : 'rows'}`}
      </span>
      {searchable.length > 0 && (
        <label className="relative w-full sm:w-72">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${searchable.map((c) => c.label.toLowerCase()).slice(0, 3).join(', ')}…`}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-9 text-sm focus:border-navy-2 focus:outline-none"
            aria-label="Search in this report"
          />
        </label>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-emerald-100 text-emerald-800',
  collected: 'bg-emerald-100 text-emerald-800',
  new: 'bg-sky-100 text-sky-800',
  cancelled: 'bg-rose-100 text-rose-700',
  'not paid': 'bg-rose-100 text-rose-700',
  pending: 'bg-amber-100 text-amber-800',
};

function CellView({ col, value }: { col: ReportColumn; value: ReportResult['rows'][number][string] }) {
  if (col.type === 'status' && value != null && value !== '—') {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_TONE[String(value)] ?? 'bg-slate-100 text-slate-600'}`}>
        {formatCell(value, col.type)}
      </span>
    );
  }
  return <>{formatCell(value, col.type)}</>;
}

function ReportTable({
  def,
  result,
  update,
}: {
  def: ReportDef;
  result: ReportResult;
  update: (c: Record<string, string | null>) => void;
}) {
  if (result.rows.length === 0) {
    return <div className="px-6 py-14 text-center text-sm font-medium text-slate-500">No rows for this date range and these filters.</div>;
  }
  const sortBy = (c: ReportColumn) => {
    if (!c.sortable) return;
    const dir = result.sort.key === c.key ? (result.sort.dir === 'asc' ? 'desc' : 'asc') : isNumeric(c.type) ? 'desc' : 'asc';
    update({ sort: c.key, dir });
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
            {def.columns.map((c) => {
              const active = result.sort.key === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (result.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`px-4 py-2.5 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap uppercase ${active ? 'text-navy-2' : 'text-slate-500'} ${isNumeric(c.type) ? 'text-right' : ''}`}
                >
                  <button type="button" onClick={() => sortBy(c)} className="inline-flex items-center gap-1 uppercase hover:text-navy-2" disabled={!c.sortable}>
                    {c.label}
                    <span className={active ? '' : 'opacity-0'}>{result.sort.dir === 'asc' ? '▲' : '▼'}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {result.rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {def.columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 ${isNumeric(c.type) ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>
                  <CellView col={c} value={row[c.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Page numbers with gaps: 1 … 4 5 [6] 7 8 … 20. */
function pageList(page: number, last: number): (number | '…')[] {
  const want = new Set([1, last, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= last));
  const sorted = [...want].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

function Pager({
  result,
  sizes,
  update,
}: {
  result: ReportResult;
  sizes: number[];
  update: (c: Record<string, string | null>) => void;
}) {
  const { page, pageSize, total } = result;
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const go = (p: number) => update({ page: String(p) });
  const shape = 'inline-flex min-w-8 items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-semibold';
  const btn = `${shape} border-slate-200 bg-white text-slate-600 hover:border-navy-2 hover:text-navy-2 disabled:pointer-events-none disabled:opacity-40`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <div className="flex items-center gap-3">
        <span className="font-medium tabular-nums">
          Showing <span className="font-bold text-ink">{first.toLocaleString('en-IN')}–{end.toLocaleString('en-IN')}</span> of{' '}
          <span className="font-bold text-ink">{total.toLocaleString('en-IN')}</span>
        </span>
        <label className="flex items-center gap-1.5">
          Rows per page
          <select
            className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs"
            value={pageSize}
            onChange={(e) => update({ pageSize: e.target.value })}
          >
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button className={btn} disabled={page <= 1} onClick={() => go(1)} aria-label="First page">«</button>
        <button className={btn} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">‹</button>
        {pageList(page, last).map((p, i) =>
          p === '…' ? (
            <span key={`gap${i}`} className="px-1">…</span>
          ) : (
            <button
              key={p}
              className={p === page ? `${shape} border-navy-2 bg-navy-2 text-white` : btn}
              onClick={() => go(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button className={btn} disabled={page >= last} onClick={() => go(page + 1)} aria-label="Next page">›</button>
        <button className={btn} disabled={page >= last} onClick={() => go(last)} aria-label="Last page">»</button>
      </div>
    </div>
  );
}

// ----- exports -----

function Exports({ def, cat, params, disabled }: { def: ReportDef; cat: ReportCatalogue; params: URLSearchParams; disabled: boolean }) {
  const brand = useBrand();
  const me = useStaffMe();
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = () => {
    const p = new URLSearchParams(params);
    p.delete('page');
    p.delete('pageSize');
    p.set('all', '1');
    return api.get<ReportResult>(`/api/admin/report-center/${def.key}?${p.toString()}`);
  };

  const run = async (kind: 'pdf' | 'csv') => {
    setError(null);
    // The print window opens on the click itself, or a popup blocker stops it.
    const win = kind === 'pdf' ? window.open('', '_blank') : null;
    if (kind === 'pdf' && !win) {
      setError('The browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    win?.document.write('<p style="font:14px system-ui;padding:24px;color:#475569">Preparing the report…</p>');
    setBusy(kind);
    try {
      const all = await fetchAll();
      const filters = describeFilters(def, params, cat);
      if (kind === 'pdf' && win) {
        printReport(win, { def, result: all, filters, brand: brand.name ?? 'Gloaro Mart', by: me?.email ?? '' });
      } else {
        const range = all.range ? [`From ${all.range.from} to ${all.range.to}`] : [];
        downloadCsv(def, all, [def.title, ...range, ...filters]);
      }
      if (all.truncated) setError(`Only the first ${all.rows.length.toLocaleString('en-IN')} of ${all.total.toLocaleString('en-IN')} rows were exported. Narrow the filters for the rest.`);
    } catch (e) {
      win?.close();
      setError(e instanceof ApiError ? e.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  const cls =
    'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold disabled:pointer-events-none disabled:opacity-50';
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !!busy} onClick={() => run('pdf')} className={`${cls} bg-gold text-navy hover:bg-gold-deep`}>
          <Icon name="filetext" className="h-4 w-4" />
          {busy === 'pdf' ? 'Preparing…' : 'Print / PDF'}
        </button>
        <button type="button" disabled={disabled || !!busy} onClick={() => run('csv')} className={`${cls} border border-slate-200 bg-white text-slate-700 hover:border-navy-2`}>
          <Icon name="download" className="h-4 w-4" />
          {busy === 'csv' ? 'Preparing…' : 'CSV'}
        </button>
      </div>
      {error && <span className="max-w-xs text-right text-xs font-medium text-rose-600">{error}</span>}
    </div>
  );
}
