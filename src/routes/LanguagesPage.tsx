import { useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useCan } from '../lib/staffContext';

/** One language the app can offer (GET /api/admin/languages, LG1). */
interface AppLanguage {
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
  isDefault: boolean;
}

/** One string on the app's screens, with its text per language. */
interface AppString {
  key: string;
  texts: Record<string, string | undefined>;
  updatedAt: string;
}

const PAGE = 60;
const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-sm';

/**
 * App Languages: which languages the customer app offers (English is always
 * on), which one a new shopper starts in, and the wording of every string on
 * its screens. The app downloads changes on its next start — no new release.
 * A Tamil or Hindi text left blank shows the app's built-in translation.
 */
export default function LanguagesPage() {
  const can = useCan('settings');
  const { data, loading, error, reload } = useApiData<{ languages: AppLanguage[]; strings: AppString[] }>('/api/admin/languages');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('all');
  const [missing, setMissing] = useState('');
  const [shown, setShown] = useState(PAGE);
  // Edits not yet saved, by "key|lang".
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const others = (data?.languages ?? []).filter((l) => l.code !== 'en');
  const areas = useMemo(
    () => [...new Set((data?.strings ?? []).map((s) => s.key.split('.')[0]))].sort(),
    [data],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.strings ?? []).filter((s) => {
      if (area !== 'all' && !s.key.startsWith(`${area}.`)) return false;
      if (missing && s.texts[missing]) return false;
      if (!q) return true;
      return s.key.toLowerCase().includes(q) || Object.values(s.texts).some((t) => t?.toLowerCase().includes(q));
    });
  }, [data, query, area, missing]);

  async function updateLanguage(lang: AppLanguage, body: { enabled?: boolean; isDefault?: boolean }) {
    setActionError(null);
    setBusy(lang.code);
    try {
      await api.patch(`/api/admin/languages/${lang.code}`, body);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to change the language.');
    } finally {
      setBusy(null);
    }
  }

  async function saveString(s: AppString, lang: string) {
    const id = `${s.key}|${lang}`;
    setActionError(null);
    setBusy(id);
    try {
      await api.put(`/api/admin/languages/strings/${encodeURIComponent(s.key)}`, { lang, text: drafts[id] ?? '' });
      setDrafts(({ [id]: _, ...rest }) => rest);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? `${s.key}: ${e.message}` : 'Failed to save the text.');
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>;
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>;
  if (!data) return null;

  const cell = (s: AppString, lang: string) => {
    const id = `${s.key}|${lang}`;
    const saved = s.texts[lang] ?? '';
    const value = drafts[id] ?? saved;
    const changed = drafts[id] !== undefined && drafts[id] !== saved;
    return (
      <td key={lang} className="px-3 py-2 align-top">
        {can.edit ? (
          <div className="space-y-1">
            <textarea
              value={value}
              // Tamil runs long; show the whole text without scrolling the box.
              rows={Math.min(5, Math.max(1, Math.ceil(value.length / 32)))}
              onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
              placeholder={lang === 'en' ? '' : 'Blank: the app’s built-in text'}
              className={`${inputClass} ${changed ? 'border-amber-300 bg-amber-50/60' : ''}`}
            />
            {changed && (
              <div className="flex gap-2">
                <button
                  onClick={() => saveString(s, lang)}
                  disabled={busy === id}
                  className="btn-primary px-2.5 py-1 text-xs disabled:opacity-50"
                >
                  {busy === id ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setDrafts(({ [id]: _, ...rest }) => rest)}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm">{saved || <span className="text-slate-400">—</span>}</span>
        )}
      </td>
    );
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">App Languages</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          The languages shoppers can pick on the app's Home and Profile, and the words on its screens. Changes reach the app
          the next time it opens — no new release needed.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>
      )}

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">Languages</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {data.languages.map((l) => (
            <div key={l.code} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-base font-bold text-ink">{l.nativeName}</div>
                <div className="text-xs text-slate-400">{l.name} · {l.code}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={l.enabled}
                    disabled={!can.edit || l.code === 'en' || l.isDefault || busy === l.code}
                    onChange={(e) => updateLanguage(l, { enabled: e.target.checked })}
                  />
                  {l.enabled ? 'On' : 'Off'}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="default-language"
                    checked={l.isDefault}
                    disabled={!can.edit || !l.enabled || busy === l.code}
                    onChange={() => updateLanguage(l, { isDefault: true })}
                  />
                  Default for new shoppers
                </label>
              </div>
              {l.code === 'en' && <p className="mt-2 text-xs text-slate-400">English is always on.</p>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          When only English is on, the app hides the language switch. A shopper who picked a language that is later
          turned off goes back to the default.
        </p>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
              placeholder="Text in any language, or a key"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Screen</label>
            <select value={area} onChange={(e) => { setArea(e.target.value); setShown(PAGE); }} className={inputClass}>
              <option value="all">All screens</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Show</label>
            <select value={missing} onChange={(e) => { setMissing(e.target.value); setShown(PAGE); }} className={inputClass}>
              <option value="">All strings</option>
              {others.map((l) => <option key={l.code} value={l.code}>Missing {l.name}</option>)}
            </select>
          </div>
          <div className="text-xs text-slate-500">{filtered.length} of {data.strings.length} strings</div>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Words in braces like <code>{'{name}'}</code> are filled in by the app — keep them, exactly as in English.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-44 px-3 py-2">Key</th>
                {data.languages.map((l) => <th key={l.code} className="px-3 py-2">{l.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, shown).map((s) => (
                <tr key={s.key} className="border-b border-slate-100">
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-500 break-all">{s.key}</td>
                  {data.languages.map((l) => cell(s, l.code))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No strings match.</div>}
        {filtered.length > shown && (
          <div className="mt-3 text-center">
            <button
              onClick={() => setShown((n) => n + PAGE)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Show more ({filtered.length - shown} left)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
