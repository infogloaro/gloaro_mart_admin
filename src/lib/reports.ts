/**
 * Admin → Reports (RP): types for GET /api/admin/report-center, value
 * formatting, the From → To presets, and the CSV / PDF exports every report
 * shares.
 */

export type ColumnType = 'text' | 'int' | 'number' | 'money' | 'percent' | 'date' | 'datetime' | 'status';
export type FilterType = 'select' | 'shop' | 'brand' | 'category' | 'city' | 'text' | 'number';

export interface ReportFilter {
  key: string;
  label: string;
  type: FilterType;
  options?: { value: string; label: string }[];
  default?: string;
  money: boolean;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
  sortable: boolean;
  search: boolean;
}

export interface ReportDef {
  key: string;
  group: string;
  title: string;
  description: string;
  keywords: string[];
  noDates: boolean;
  filters: ReportFilter[];
  columns: ReportColumn[];
  defaultSort: { key: string; dir: 'asc' | 'desc' };
  summary: { key: string; label: string; type: ColumnType }[];
  notes: string | null;
}

export interface ReportCatalogue {
  groups: { key: string; label: string; reports: ReportDef[] }[];
  options: {
    shops: { id: number; name: string; city: string | null }[];
    categories: string[];
    cities: string[];
    brands: { id: number; name: string }[];
  };
  pageSizes: number[];
  exportLimit: number;
  maxRangeDays: number;
}

export type Cell = string | number | null;

export interface ReportResult {
  report: string;
  range: { from: string; to: string; days: number } | null;
  q: string;
  sort: { key: string; dir: 'asc' | 'desc' };
  page: number;
  pageSize: number;
  total: number;
  truncated: boolean;
  summary: { key: string; label: string; type: ColumnType; value: Cell }[];
  rows: Record<string, Cell>[];
}

// ----- formatting -----

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN');

/** "out_for_delivery" → "Out for delivery". */
export const humanize = (s: string) => {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function formatCell(value: Cell, type: ColumnType): string {
  if (value == null || value === '') return '—';
  switch (type) {
    case 'money':
      return inr.format(Number(value) / 100);
    case 'int':
    case 'number':
      return num.format(Number(value));
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'date':
      return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    case 'datetime':
      return new Date(String(value)).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    case 'status':
      return humanize(String(value));
    default:
      return String(value);
  }
}

/** Number-like columns line up on the right. */
export const isNumeric = (type: ColumnType) => ['int', 'number', 'money', 'percent'].includes(type);

// ----- dates (the admin's local day; the panel is used in India) -----

export const dayString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: 'year', label: 'This year' },
] as const;

export function presetRange(key: string): { from: string; to: string } {
  const now = new Date();
  const back = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
  switch (key) {
    case 'today':
      return { from: dayString(now), to: dayString(now) };
    case 'yesterday':
      return { from: dayString(back(1)), to: dayString(back(1)) };
    case '7d':
      return { from: dayString(back(6)), to: dayString(now) };
    case 'month':
      return { from: dayString(new Date(now.getFullYear(), now.getMonth(), 1)), to: dayString(now) };
    case 'lastmonth':
      return {
        from: dayString(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: dayString(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case 'year':
      return { from: dayString(new Date(now.getFullYear(), 0, 1)), to: dayString(now) };
    default:
      return { from: dayString(back(29)), to: dayString(now) };
  }
}

/** Which preset a range is, or 'custom'. */
export function presetFor(from: string, to: string): string {
  return PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.from === from && r.to === to;
  })?.key ?? 'custom';
}

export const prettyDay = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ----- favourites & recently opened (this browser only) -----

const FAV = 'gloaro:reports:favourites';
const RECENT = 'gloaro:reports:recent';
const read = (k: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
export const getFavourites = () => read(FAV);
export function toggleFavourite(key: string): string[] {
  const list = read(FAV);
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  localStorage.setItem(FAV, JSON.stringify(next));
  return next;
}
export const getRecent = () => read(RECENT);
export function markOpened(key: string) {
  localStorage.setItem(RECENT, JSON.stringify([key, ...read(RECENT).filter((k) => k !== key)].slice(0, 6)));
}

// ----- exports -----

/** The filters in use, as "Label: value" lines for the PDF and CSV headers. */
export function describeFilters(def: ReportDef, params: URLSearchParams, cat: ReportCatalogue): string[] {
  const out: string[] = [];
  for (const f of def.filters) {
    const v = params.get(f.key) ?? f.default ?? '';
    if (!v) continue;
    let shown = v;
    if (f.type === 'select') shown = f.options?.find((o) => o.value === v)?.label ?? v;
    else if (f.type === 'shop') shown = cat.options.shops.find((s) => String(s.id) === v)?.name ?? v;
    else if (f.type === 'brand') shown = cat.options.brands.find((b) => String(b.id) === v)?.name ?? v;
    out.push(`${f.label}: ${shown}`);
  }
  const q = params.get('q');
  if (q) out.push(`Search: “${q}”`);
  return out;
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV of every row; money in rupees as plain numbers so a spreadsheet can add them up. */
export function downloadCsv(def: ReportDef, result: ReportResult, header: string[]) {
  const lines = header.map((h) => csvCell(h));
  lines.push('');
  lines.push(def.columns.map((c) => csvCell(c.label + (c.type === 'money' ? ' (₹)' : ''))).join(','));
  for (const row of result.rows) {
    lines.push(
      def.columns
        .map((c) => {
          const v = row[c.key];
          if (v == null) return '';
          if (c.type === 'money') return (Number(v) / 100).toFixed(2);
          if (c.type === 'datetime' || c.type === 'date' || c.type === 'status') return csvCell(formatCell(v, c.type));
          return csvCell(String(v));
        })
        .join(',')
    );
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const range = result.range ? `_${result.range.from}_to_${result.range.to}` : '';
  a.download = `${def.key}${range}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Writes a print-ready page into `win` (opened on the click, so a popup
 * blocker lets it through) and opens the print dialog — "Save as PDF" there
 * gives the PDF. The header repeats the filters; the table header repeats on
 * every page, and pages are numbered "Page n of m".
 */
export function printReport(
  win: Window,
  opts: { def: ReportDef; result: ReportResult; filters: string[]; brand: string; by: string }
) {
  const { def, result, filters, brand, by } = opts;
  const landscape = def.columns.length > 7;
  const range = result.range
    ? result.range.from === result.range.to
      ? prettyDay(result.range.from)
      : `${prettyDay(result.range.from)} – ${prettyDay(result.range.to)}`
    : '';
  const generated = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const cards = result.summary
    .map((s) => `<div class="card"><div class="k">${esc(s.label)}</div><div class="v">${esc(formatCell(s.value, s.type))}</div></div>`)
    .join('');
  const head = def.columns.map((c) => `<th class="${isNumeric(c.type) ? 'r' : ''}">${esc(c.label)}</th>`).join('');
  const body = result.rows.length
    ? result.rows
        .map(
          (row) =>
            `<tr>${def.columns
              .map((c) => `<td class="${isNumeric(c.type) ? 'r' : ''}">${esc(formatCell(row[c.key], c.type))}</td>`)
              .join('')}</tr>`
        )
        .join('')
    : `<tr><td colspan="${def.columns.length}" class="empty">No rows for these filters.</td></tr>`;

  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(def.title)} ${esc(range)}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 14mm 12mm 16mm;
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px system-ui, sans-serif; color: #6b778c; }
    @bottom-left { content: "${esc(brand)} · ${esc(def.title)}"; font: 9px system-ui, sans-serif; color: #6b778c; } }
  * { box-sizing: border-box; }
  body { font: 11px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #17243a; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0d294d; padding-bottom: 8px; }
  .brand { font-weight: 800; font-size: 13px; color: #0d294d; letter-spacing: .04em; text-transform: uppercase; }
  h1 { margin: 2px 0 0; font-size: 18px; }
  .meta { text-align: right; color: #6b778c; font-size: 10px; }
  .range { font-size: 12px; font-weight: 700; color: #17243a; }
  .filters { margin: 8px 0 0; color: #475569; font-size: 10px; }
  .filters span { display: inline-block; background: #f1f5f9; border-radius: 4px; padding: 1px 6px; margin: 0 4px 3px 0; }
  .cards { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .card { border: 1px solid #e2e8f0; border-left: 3px solid #f2b233; border-radius: 6px; padding: 5px 10px; min-width: 110px; }
  .card .k { color: #6b778c; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
  .card .v { font-size: 13px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #0d294d; color: #fff; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; padding: 5px 6px; }
  td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; vertical-align: top; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { text-align: center; color: #94a3b8; padding: 20px; }
  .foot { margin-top: 8px; color: #6b778c; font-size: 9px; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<div class="top">
  <div><div class="brand">${esc(brand)}</div><h1>${esc(def.title)}</h1></div>
  <div class="meta"><div class="range">${esc(range)}</div>Generated ${esc(generated)}${by ? ` by ${esc(by)}` : ''}</div>
</div>
${filters.length ? `<div class="filters">${filters.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
<div class="cards">${cards}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="foot">${result.total.toLocaleString('en-IN')} rows${result.truncated ? ` — only the first ${result.rows.length.toLocaleString('en-IN')} are in this PDF; narrow the filters for the rest` : ''}.${def.notes ? ` ${esc(def.notes)}` : ''}</div>
<script>window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 150); };</script>
</body></html>`);
  win.document.close();
}
