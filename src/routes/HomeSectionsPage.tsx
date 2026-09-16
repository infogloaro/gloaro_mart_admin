import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type { HomeAudience, HomeCandidate, HomeLayout, HomeSection, HomeSectionType } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/home-sections',
  'POST   /api/admin/home-sections',
  'PATCH  /api/admin/home-sections/:id',
  'DELETE /api/admin/home-sections/:id',
  'PUT    /api/admin/home-sections/order',
  'GET    /api/admin/home-sections/:id/candidates',
];

const TYPES: { value: HomeSectionType; label: string; icon: 'layers' | 'store' | 'percent' | 'briefcase' | 'box' | 'image' }[] = [
  { value: 'featured_categories', label: 'Featured categories', icon: 'layers' },
  { value: 'featured_vendors', label: 'Featured shops', icon: 'store' },
  { value: 'local_deals', label: 'Local deals', icon: 'percent' },
  { value: 'b2b_promotions', label: 'B2B promotions', icon: 'briefcase' },
  { value: 'product_carousel', label: 'Product carousel', icon: 'box' },
  { value: 'banner_strip', label: 'Banner strip', icon: 'image' },
];

const AUDIENCES: { value: HomeAudience; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'b2c', label: 'Shoppers' },
  { value: 'b2b', label: 'Businesses' },
];

const LAYOUTS = ['grid', 'carousel', 'list'] as const;

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function typeMeta(type: HomeSectionType) {
  return TYPES.find((t) => t.value === type) ?? TYPES[0];
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Being switched on is not the same as being on screen: a scheduled window can
 * put a live section in the past or the future.
 */
function liveState(section: HomeSection): { live: boolean; note: string | null } {
  if (!section.isActive) return { live: false, note: 'switched off' };
  const now = Date.now();
  if (section.startsAt && new Date(section.startsAt).getTime() > now) {
    return { live: false, note: `starts ${formatDate(section.startsAt)}` };
  }
  if (section.endsAt && new Date(section.endsAt).getTime() < now) {
    return { live: false, note: `ended ${formatDate(section.endsAt)}` };
  }
  if (section.itemCount === 0) return { live: false, note: 'nothing in it' };
  return { live: true, note: section.endsAt ? `until ${formatDate(section.endsAt)}` : null };
}

export default function HomeSectionsPage() {
  const { data, loading, error, reload } = useApiData<HomeLayout>('/api/admin/home-sections');

  const [editing, setEditing] = useState<HomeSection | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<HomeSection | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const sections = data?.sections ?? [];

  async function patch(section: HomeSection, changes: Record<string, unknown>, fallback: string) {
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/home-sections/${section.id}`, changes);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  /** Reorder by swapping with the neighbour, then sending the whole order. */
  async function move(index: number, direction: -1 | 1) {
    const next = [...sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setActionError(null);
    setBusy(true);
    try {
      await api.put('/api/admin/home-sections/order', { ids: next.map((s) => s.id) });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reorder the sections.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(section: HomeSection) {
    setActionError(null);
    try {
      await api.delete(`/api/admin/home-sections/${section.id}`);
      setRemoving(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the section.');
    }
  }

  const liveCount = sections.filter((s) => liveState(s).live).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Home Sections</h1>
          <p className="text-sm text-slate-500">
            The app's home screen is this list, in this order. {liveCount} of {sections.length} sections are on screen
            right now.
          </p>
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setActionError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-deep"
        >
          <Icon name="sections" className="h-4 w-4" />
          Add a section
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 22 home sections" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && sections.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="sections" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">
            The home screen is empty. Add a section to put something on it.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {sections.map((section, index) => {
          const meta = typeMeta(section.type);
          const state = liveState(section);
          return (
            <div key={section.id} className={`card overflow-hidden ${state.live ? '' : 'opacity-75'}`}>
              <div className="flex items-start gap-3 p-4">
                {/* Order is the whole point of this screen, so the position and
                    its controls sit first, before anything descriptive. */}
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={busy || index === 0}
                    aria-label="Move up"
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-emerald hover:text-emerald-deep disabled:opacity-30"
                  >
                    <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" strokeWidth={2.2} />
                  </button>
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums">{index + 1}</span>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={busy || index === sections.length - 1}
                    aria-label="Move down"
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-emerald hover:text-emerald-deep disabled:opacity-30"
                  >
                    <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" strokeWidth={2.2} />
                  </button>
                </div>

                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-mist text-emerald">
                  <Icon name={meta.icon} className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-ink">{section.title}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        state.live
                          ? 'bg-state-success/12 text-state-success-ink'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {state.live ? 'on screen' : (state.note ?? 'hidden')}
                    </span>
                    {section.audience !== 'all' && (
                      <span className="rounded bg-navy-2/10 px-1.5 py-0.5 text-[10px] font-bold text-navy-2 uppercase">
                        {section.audience === 'b2b' ? 'businesses only' : 'shoppers only'}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-slate-400">
                    {meta.label} · {section.layout} · up to {section.maxItems}
                    {section.source === 'automatic'
                      ? ` · automatic${section.rule ? `: ${section.rule}` : ''}`
                      : ` · ${section.itemCount} picked by hand`}
                    {state.live && state.note && ` · ${state.note}`}
                  </p>

                  {section.items.length > 0 && (
                    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                      {section.items.slice(0, 8).map((item) => (
                        <span
                          key={item.id}
                          title={item.title}
                          className="flex w-16 shrink-0 flex-col items-center gap-1"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-12 w-16 rounded-lg border border-slate-200 object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
                              <Icon name={meta.icon} className="h-4 w-4" />
                            </span>
                          )}
                          <span className="w-full truncate text-center text-[10px] text-slate-500">{item.title}</span>
                        </span>
                      ))}
                      {section.itemCount > 8 && (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                          +{section.itemCount - 8}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={section.isActive}
                      disabled={busy}
                      onChange={(e) =>
                        patch(section, { isActive: e.target.checked }, 'Could not switch the section.')
                      }
                      className="h-4 w-4 accent-emerald"
                    />
                    Live
                  </label>
                  <button
                    onClick={() => {
                      setEditing(section);
                      setActionError(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setRemoving(section)}
                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data?.updatedAt && (
        <p className="text-xs text-slate-400">Last changed {formatDate(data.updatedAt)}.</p>
      )}

      {editing && (
        <SectionModal
          section={editing}
          onClose={() => setEditing(null)}
          onError={setActionError}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onError={setActionError}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Delete “${removing.title}”?`}
          message="The section disappears from the home screen. The categories, shops and products in it are untouched."
          confirmLabel="Delete section"
          onCancel={() => setRemoving(null)}
          onConfirm={() => remove(removing)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- edit */

function SectionModal({
  section,
  onClose,
  onError,
  onSaved,
}: {
  section: HomeSection;
  onClose: () => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle ?? '');
  const [audience, setAudience] = useState<HomeAudience>(section.audience);
  const [layout, setLayout] = useState(section.layout);
  const [maxItems, setMaxItems] = useState(String(section.maxItems));
  const [startsAt, setStartsAt] = useState(section.startsAt?.slice(0, 10) ?? '');
  const [endsAt, setEndsAt] = useState(section.endsAt?.slice(0, 10) ?? '');
  const [items, setItems] = useState(section.items);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);
  const { data: candidates } = useApiData<HomeCandidate[]>(
    section.source === 'manual' && debounced
      ? `/api/admin/home-sections/${section.id}/candidates?q=${encodeURIComponent(debounced)}`
      : '',
    [section.id, debounced],
  );

  const full = items.length >= Number(maxItems);

  function add(candidate: HomeCandidate) {
    if (items.some((i) => i.refId === candidate.refId) || full) return;
    setItems((prev) => [
      ...prev,
      {
        id: -candidate.refId,
        refId: candidate.refId,
        title: candidate.title,
        subtitle: candidate.subtitle,
        imageUrl: candidate.imageUrl,
        sortOrder: prev.length,
      },
    ]);
    setSearch('');
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      onError('A section needs a title — it is the heading on the phone.');
      return;
    }
    if (startsAt && endsAt && startsAt > endsAt) {
      onError('The window ends before it starts.');
      return;
    }
    onError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/home-sections/${section.id}`, {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        audience,
        layout,
        maxItems: Math.max(1, Number(maxItems)),
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        itemRefIds: section.source === 'manual' ? items.map((i) => i.refId) : undefined,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the section.');
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit ${typeMeta(section.type).label.toLowerCase()}`} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Heading on the phone
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Subtitle
            </span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Shown to</span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as HomeAudience)}
              className={inputClass}
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Layout</span>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as HomeSection['layout'])}
              className={`${inputClass} capitalize`}
            >
              {LAYOUTS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Show at most
            </span>
            <input
              type="number"
              min={1}
              value={maxItems}
              onChange={(e) => setMaxItems(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Starts (optional)
            </span>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Ends (optional)
            </span>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </label>
        </div>

        {section.source === 'automatic' ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-600">
            This section fills itself{section.rule ? `: ${section.rule}` : ''}. Its contents change on their own — only
            the heading, audience and layout are set here.
          </p>
        ) : (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                What is in it ({items.length})
              </span>
              {full && <span className="text-[11px] font-semibold text-amber-600">At the limit of {maxItems}</span>}
            </div>

            <div className="mt-2 space-y-1.5">
              {items.map((item, index) => (
                <div key={item.refId} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2">
                  <span className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                      className="text-slate-400 hover:text-emerald-deep disabled:opacity-25"
                    >
                      <Icon name="chevron" className="h-3 w-3 -rotate-90" strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label="Move down"
                      className="text-slate-400 hover:text-emerald-deep disabled:opacity-25"
                    >
                      <Icon name="chevron" className="h-3 w-3 rotate-90" strokeWidth={2.4} />
                    </button>
                  </span>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                    {item.subtitle && (
                      <span className="block truncate text-[11px] text-slate-400">{item.subtitle}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((i) => i.refId !== item.refId))}
                    aria-label="Remove"
                    className="shrink-0 text-slate-400 hover:text-rose-600"
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                  Empty — an empty section is not drawn on the phone at all.
                </p>
              )}
            </div>

            <div className="relative mt-2">
              <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={full ? `Remove one first — the limit is ${maxItems}` : 'Search something to add…'}
                disabled={full}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs disabled:opacity-50"
              />
            </div>

            {debounced && !full && (
              <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                {(candidates ?? [])
                  .filter((c) => !items.some((i) => i.refId === c.refId))
                  .map((c) => (
                    <button
                      type="button"
                      key={c.refId}
                      onClick={() => add(c)}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-1.5 text-left hover:border-emerald hover:bg-mint-mist"
                    >
                      {c.imageUrl && <img src={c.imageUrl} alt="" className="h-7 w-7 rounded object-cover" />}
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{c.title}</span>
                    </button>
                  ))}
                {(candidates ?? []).length === 0 && (
                  <p className="px-1 py-2 text-xs text-slate-400">Nothing matches.</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save section'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ create */

function CreateModal({
  onClose,
  onError,
  onCreated,
}: {
  onClose: () => void;
  onError: (message: string | null) => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<HomeSectionType>('featured_categories');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<HomeAudience>('all');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      onError('Give the section a heading.');
      return;
    }
    onError(null);
    setBusy(true);
    try {
      await api.post('/api/admin/home-sections', { type, title: title.trim(), audience });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not create the section.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a home section" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            What kind of section?
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => {
                  setType(t.value);
                  // B2B promotions on a shoppers-only home make no sense, so
                  // the audience follows the type unless it is changed after.
                  if (t.value === 'b2b_promotions') setAudience('b2b');
                }}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left ${
                  type === t.value ? 'border-emerald bg-mint-mist' : 'border-slate-200 hover:border-mint-soft'
                }`}
              >
                <Icon name={t.icon} className="h-4 w-4 shrink-0 text-emerald" />
                <span className="text-sm font-semibold text-ink">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            Heading on the phone
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Shops near you"
            className={inputClass}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Shown to</span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as HomeAudience)}
            className={inputClass}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-slate-400">
          It is added switched off, at the bottom. Fill it, then switch it on.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add section'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
