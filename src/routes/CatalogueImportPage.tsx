import { useRef, useState } from 'react';
import { API_URL, api, ApiError, isMissingEndpoint } from '../lib/api';
import { getToken } from '../lib/auth';
import { Icon } from '../components/ui/Icon';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';

const ENDPOINTS = ['GET    /api/admin/catalogue/export', 'POST   /api/admin/catalogue/import'];

const TYPES = [
  {
    value: 'products',
    label: 'Products',
    blurb: 'Name, SKU, category, price, MRP, stock, MOQ and visibility.',
    note: 'Updates existing products by id. It never creates a listing — a new product needs a vendor and moderation.',
  },
  {
    value: 'variants',
    label: 'Variants',
    blurb: 'Per-variant SKU, price, MRP, order and visibility.',
    note: 'Updates by variant_id. New variants are created under Product Variants, where attributes can be chosen.',
  },
  {
    value: 'inventory',
    label: 'Inventory',
    blurb: 'Available stock and the low-stock alert level.',
    note: 'Sets stock to the figure in the file and records a movement for every change, noted as a bulk import.',
  },
] as const;

type ImportType = (typeof TYPES)[number]['value'];

interface ImportRow {
  line: number;
  status: 'updated' | 'unchanged' | 'error';
  message: string;
}

interface ImportResult {
  type: string;
  dryRun: boolean;
  applied: boolean;
  total: number;
  updated: number;
  unchanged: number;
  errors: number;
  rows: ImportRow[];
}

export default function CatalogueImportPage() {
  const can = useCan('catalogue_import');
  const [type, setType] = useState<ImportType>('products');
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const active = TYPES.find((t) => t.value === type)!;

  /**
   * Export goes through fetch rather than a plain link because the endpoint is
   * behind the bearer token — an <a href> sends no Authorization header and
   * would download a 401 page named like a spreadsheet.
   */
  async function exportCsv() {
    setError(null);
    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/catalogue/export?type=${type}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gloaro-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export.');
    } finally {
      setExporting(false);
    }
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  }

  async function run(dryRun: boolean) {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post<ImportResult>('/api/admin/catalogue/import', { type, csv, dryRun }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The import could not be run.');
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCsv(null);
    setFileName(null);
    setResult(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Bulk Import / Export</h1>
        <p className="text-sm text-slate-500">
          Export a CSV, edit it in a spreadsheet, then bring it back. Every import is checked in full before anything
          is written, and a file with any error is rejected whole rather than half-applied.
        </p>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 17 bulk import" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">What are you working on?</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setType(t.value);
                reset();
              }}
              className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                type === t.value
                  ? 'border-emerald bg-mint-mist shadow-[0_10px_26px_-16px_rgba(31,111,91,0.8)]'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:border-mint-soft'
              }`}
            >
              <div className="text-[13px] font-bold text-ink">{t.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{t.blurb}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-600">
          <Icon name="note" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{active.note}</span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink">1. Export</h2>
          <p className="mt-0.5 mb-3 text-xs text-slate-500">
            Start from an export — it has the exact columns the import expects, including the id it matches rows on.
          </p>
          <button onClick={exportCsv} disabled={exporting} className="btn-primary px-4 py-2.5 text-sm">
            {exporting ? 'Preparing…' : `Download ${active.label.toLowerCase()} CSV`}
          </button>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink">2. Import</h2>
          <p className="mt-0.5 mb-3 text-xs text-slate-500">
            Checked first. Nothing is written until you apply it.
          </p>

          {can.edit ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => pickFile(e.target.files?.[0])}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-mint-mist file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-deep"
              />

              {fileName && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-semibold text-slate-600">{fileName}</span>
                  <button onClick={reset} className="text-xs font-semibold text-slate-400 hover:text-rose-600">
                    Clear
                  </button>
                </div>
              )}

              {csv && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => run(true)}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep disabled:opacity-50"
                  >
                    {busy ? 'Checking…' : 'Check file'}
                  </button>
                  <button
                    onClick={() => run(false)}
                    disabled={busy || !result || result.errors > 0}
                    title={
                      !result
                        ? 'Check the file first'
                        : result.errors > 0
                          ? 'Fix the errors below first'
                          : undefined
                    }
                    className="btn-primary px-4 py-2.5 text-sm disabled:opacity-40"
                  >
                    Apply changes
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">View only — your role cannot import changes.</p>
          )}
        </div>
      </div>

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Rows read" value={String(result.total)} icon="filetext" tone="accent" />
            <StatCard label="Will change" value={String(result.updated)} icon="swap" tone="positive" />
            <StatCard label="Unchanged" value={String(result.unchanged)} icon="clipboard" tone="neutral" />
            <StatCard
              label="Errors"
              value={String(result.errors)}
              icon="alert"
              tone={result.errors > 0 ? 'critical' : 'neutral'}
            />
          </div>

          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              result.applied
                ? 'border-state-success/30 bg-state-success/10 text-state-success-ink'
                : result.errors > 0
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {result.applied
              ? `Applied. ${result.updated} row${result.updated === 1 ? '' : 's'} written.`
              : result.errors > 0
                ? `Nothing was written — ${result.errors} row${result.errors === 1 ? '' : 's'} would fail. The whole file is rejected until they are fixed.`
                : `Checked only. Nothing has been written yet — use Apply changes to commit ${result.updated} row${result.updated === 1 ? '' : 's'}.`}
          </div>

          {result.rows.some((r) => r.status !== 'unchanged') && (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
                <h2 className="text-sm font-bold text-ink">Row by row</h2>
                <p className="text-xs text-slate-400">Line numbers match your spreadsheet — row 1 is the header.</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {result.rows
                  .filter((r) => r.status !== 'unchanged')
                  .map((r) => (
                    <div
                      key={r.line}
                      className="flex items-start gap-3 border-b border-slate-100 px-4 py-2 text-sm last:border-0"
                    >
                      <span className="w-14 shrink-0 font-mono text-xs text-slate-400">line {r.line}</span>
                      <span
                        className={`w-20 shrink-0 text-xs font-bold ${
                          r.status === 'error' ? 'text-state-error' : 'text-state-success'
                        }`}
                      >
                        {r.status === 'error' ? 'ERROR' : 'CHANGE'}
                      </span>
                      <span className={r.status === 'error' ? 'text-rose-700' : 'text-slate-600'}>{r.message}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
