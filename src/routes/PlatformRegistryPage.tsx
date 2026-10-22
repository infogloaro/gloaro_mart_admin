import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, assetUrl, isPendingApproval } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ImageUpload } from '../components/ui/ImageUpload';
import { PlatformConfigModal } from '../components/platform/PlatformConfigModal';
import { PlatformHealthView } from '../components/platform/PlatformHealthView';
import { canView, useStaffMe } from '../lib/staffContext';
import type { Platform, PlatformCategory, PlatformConnectorInfo, PlatformMethod, PlatformStatus } from '../lib/types';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

const METHODS: { value: PlatformMethod; label: string; hint: string }[] = [
  { value: 'manual', label: 'Manual', hint: 'Managed by your team; nothing is synced automatically.' },
  { value: 'api', label: 'API', hint: 'Talks to the provider’s API once a connector is built.' },
  { value: 'webhook', label: 'Webhook', hint: 'The provider pushes events to us once a connector is built.' },
  { value: 'connector', label: 'Connector', hint: 'Uses a packaged connector on the server.' },
];

const STATUS_STYLE: Record<PlatformStatus, string> = {
  active: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  inactive: 'border-slate-200 bg-slate-100 text-slate-500',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
};

/**
 * The catalogue of e-commerce capabilities. "Active" means the business uses
 * it; the connection badge comes from the server and stays "Not connected"
 * until real connector code backs the entry.
 *
 * Super admins see and manage everything. Other roles see only the categories
 * granted to them (platform_<slug>.view / .edit / .delete), and only a super
 * admin can add or change categories.
 */
export default function PlatformRegistryPage() {
  const me = useStaffMe();
  // The server enforces these; this only hides what would be refused.
  const may = (slug: string, action: 'edit' | 'delete') => canView(me, `platform_${slug}.${action}`);
  const isSuperAdmin = me?.isSuperAdmin === true;
  const categories = useApiData<PlatformCategory[]>('/api/admin/platform-categories');
  const platforms = useApiData<Platform[]>('/api/admin/platforms');

  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<'platforms' | 'health'>('platforms');
  const [editing, setEditing] = useState<Platform | 'new' | null>(null);
  const [editingCategory, setEditingCategory] = useState<PlatformCategory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Platform | null>(null);
  const [configuring, setConfiguring] = useState<Platform | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const reloadAll = () => {
    categories.reload();
    platforms.reload();
  };

  async function setStatus(p: Platform, status: PlatformStatus) {
    setActionError(null);
    setActionNotice(null);
    try {
      const r = await api.patch(`/api/admin/platforms/${p.id}`, { status });
      if (isPendingApproval(r)) setActionNotice(`${p.name}: ${r.message}`);
      reloadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not change the status.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/platforms/${deleting.id}`);
      setDeleting(null);
      reloadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the platform.');
    } finally {
      setBusy(false);
    }
  }

  const cats = categories.data ?? [];
  const editableCats = cats.filter((c) => may(c.slug, 'edit'));
  const selectedCategory = cats.find((c) => c.slug === filter) ?? null;
  const visible = (platforms.data ?? []).filter((p) => filter === 'all' || p.category_slug === filter);
  const error = categories.error ?? platforms.error;
  const loading = categories.loading || platforms.loading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Platform Registry</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Every integration, sales channel, campaign tool and service the marketplace uses, in one place. Adding an
            entry records it; it shows as connected only once a working connector backs it.
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => setEditingCategory('new')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add category
            </button>
          )}
          {editableCats.length > 0 && (
            <button onClick={() => setEditing('new')} className="btn-primary px-4 py-2.5 text-sm">
              Add platform
            </button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
          <span>{actionNotice}</span>
          <Link to="/approvals" className="shrink-0 font-semibold underline">
            View approvals
          </Link>
        </div>
      )}
      {(actionError || error) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError ?? error}
        </div>
      )}

      <div className="flex rounded-xl border border-slate-200 bg-white p-1 self-start w-fit">
        {([['platforms', 'Platforms'], ['health', 'Health']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${view === v ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'health' ? (
        <PlatformHealthView canEdit={(slug) => may(slug, 'edit')} onChanged={reloadAll} />
      ) : (
        <>
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          <CategoryTab label="All" count={platforms.data?.length ?? 0} selected={filter === 'all'} onClick={() => setFilter('all')} />
          {cats
            .filter((c) => c.is_active || filter === c.slug)
            .map((c) => (
              <CategoryTab
                key={c.id}
                label={c.name}
                count={c.platform_count}
                selected={filter === c.slug}
                onClick={() => setFilter(c.slug)}
              />
            ))}
        </div>

        {selectedCategory && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold text-ink">
                {selectedCategory.name}
                {!selectedCategory.is_active && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                    Hidden
                  </span>
                )}
              </div>
              {selectedCategory.description && <p className="text-sm text-slate-500">{selectedCategory.description}</p>}
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => setEditingCategory(selectedCategory)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Edit category
              </button>
            )}
          </div>
        )}

        {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

        {!loading && !error && visible.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-sm font-semibold text-slate-600">No platforms here yet.</p>
            <p className="mt-1 text-sm text-slate-400">Add one to start tracking it in the registry.</p>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => (
              <div key={p.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {p.logo_url ? (
                      <img src={assetUrl(p.logo_url)} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">{p.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.category_name}</div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[p.status]}`}>
                    {p.status}
                  </span>
                </div>

                {p.description && <p className="line-clamp-2 text-sm text-slate-600">{p.description}</p>}

                <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                    {METHODS.find((m) => m.value === p.integration_method)?.label ?? p.integration_method}
                  </span>
                  <ConnectionBadge platform={p} />
                  {p.config_schema.length > 0 && (
                    <>
                      <span
                        className={`rounded-md px-2 py-0.5 ${
                          p.environment === 'live' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {p.environment === 'live' ? 'Live' : 'Test'}
                      </span>
                      {!p.setup_complete && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">Setup incomplete</span>}
                    </>
                  )}
                  {p.capabilities.map((c) => (
                    <span key={c} className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-700">
                      {c}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
                  {!may(p.category_slug, 'edit') && !may(p.category_slug, 'delete') && (
                    <span className="py-1.5 text-xs text-slate-400">View only</span>
                  )}
                  {!may(p.category_slug, 'edit') ? null : p.status === 'active' ? (
                    <button
                      onClick={() => setStatus(p, 'inactive')}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(p, 'active')}
                      className="rounded-lg border border-state-success/30 bg-state-success/10 px-3 py-1.5 text-xs font-semibold text-state-success-ink hover:bg-state-success/20"
                    >
                      Enable
                    </button>
                  )}
                  {may(p.category_slug, 'edit') && (
                    <>
                      <button
                        onClick={() => setConfiguring(p)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Configure
                      </button>
                      <button
                        onClick={() => setEditing(p)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </>
                  )}
                  {may(p.category_slug, 'delete') && (
                    <button
                      onClick={() => setDeleting(p)}
                      className="ml-auto rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
      )}

      {editing && (
        <PlatformForm
          platform={editing === 'new' ? null : editing}
          categories={editableCats}
          defaultCategoryId={
            selectedCategory && may(selectedCategory.slug, 'edit') ? selectedCategory.id : editableCats[0]?.id
          }
          onClose={() => setEditing(null)}
          onSaved={(pending) => {
            setEditing(null);
            setActionNotice(pending);
            reloadAll();
          }}
        />
      )}

      {editingCategory && (
        <CategoryForm
          category={editingCategory === 'new' ? null : editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={(slug) => {
            setEditingCategory(null);
            reloadAll();
            if (slug) setFilter(slug);
          }}
        />
      )}

      {configuring && (
        <PlatformConfigModal platform={configuring} onClose={() => setConfiguring(null)} onChanged={reloadAll} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete platform"
          message={`Remove “${deleting.name}” from the registry? This cannot be undone.`}
          busy={busy}
          error={actionError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/** Connected comes only from the server: a built-in connector plus a passed test. */
function ConnectionBadge({ platform: p }: { platform: Platform }) {
  const [text, style] =
    p.integration_method === 'manual' && !p.connector_key
      ? ['Managed manually', 'bg-slate-100 text-slate-500']
      : p.connected
        ? ['Connected', 'bg-state-success/10 text-state-success-ink']
        : p.connector_key && p.connection_status === 'error'
          ? ['Test failed', 'bg-rose-50 text-rose-700']
          : ['Not connected', 'bg-amber-50 text-amber-700'];
  return <span className={`rounded-md px-2 py-0.5 ${style}`}>{text}</span>;
}

function CategoryTab({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
        selected ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
      <span className={`ml-1.5 text-xs ${selected ? 'text-white/70' : 'text-slate-400'}`}>{count}</span>
    </button>
  );
}

function PlatformForm({
  platform,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  platform: Platform | null;
  categories: PlatformCategory[];
  defaultCategoryId: number | undefined;
  onClose: () => void;
  /** pending: the approval message when the change was held instead of applied. */
  onSaved: (pending: string | null) => void;
}) {
  const [name, setName] = useState(platform?.name ?? '');
  const [categoryId, setCategoryId] = useState(String(platform?.category_id ?? defaultCategoryId ?? ''));
  const [description, setDescription] = useState(platform?.description ?? '');
  const [logoUrl, setLogoUrl] = useState(platform?.logo_url ?? '');
  const [method, setMethod] = useState<PlatformMethod>(platform?.integration_method ?? 'manual');
  const [capabilities, setCapabilities] = useState((platform?.capabilities ?? []).join(', '));
  const [connectorKey, setConnectorKey] = useState(platform?.connector_key ?? '');
  const [replaceSettings, setReplaceSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const connectors = useApiData<PlatformConnectorInfo[]>('/api/admin/platform-connectors');
  const connectorChanged = connectorKey !== (platform?.connector_key ?? '');

  /** Picking a connector fills in what it already knows, without overwriting typed values. */
  function chooseConnector(key: string) {
    setConnectorKey(key);
    const c = connectors.data?.find((x) => x.key === key);
    if (!c) {
      if (method === 'connector') setMethod('manual');
      return;
    }
    setMethod('connector');
    if (!name.trim()) setName(c.name);
    if (!description.trim()) setDescription(c.description);
    if (!capabilities.trim()) setCapabilities(c.capabilities.join(', '));
    const home = categories.find((x) => x.slug === c.category);
    if (home && !platform) setCategoryId(String(home.id));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const caps = capabilities
      .split(',')
      .map((c) => c.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))
      .filter(Boolean);
    const body = {
      name: name.trim(),
      categoryId: Number(categoryId),
      description: description.trim(),
      logoUrl: logoUrl.trim(),
      integrationMethod: method,
      capabilities: caps,
      ...(connectorChanged ? { connectorKey: connectorKey || null, applyConnectorSettings: replaceSettings } : {}),
    };
    setSaving(true);
    try {
      const r = platform
        ? await api.patch(`/api/admin/platforms/${platform.id}`, body)
        : await api.post('/api/admin/platforms', body);
      onSaved(isPendingApproval(r) ? r.message : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the platform.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={platform ? `Edit ${platform.name}` : 'Add platform'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className={labelClass}>Connector</span>
          <select value={connectorKey} onChange={(e) => chooseConnector(e.target.value)} className={inputClass}>
            <option value="">None — record it only</option>
            {connectors.data?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-400">
            {connectorKey
              ? 'Built into the server: it can test the connection and receive verified webhooks. Its settings form is added for you.'
              : 'Without a connector the platform is tracked here but never shown as connected.'}
          </span>
          {platform && connectorChanged && connectorKey && platform.config_schema.length > 0 && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={replaceSettings} onChange={(e) => setReplaceSettings(e.target.checked)} />
              Replace its settings form with this connector’s
            </label>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Google Ads" className={inputClass} required />
          </label>
          <label className="block">
            <span className={labelClass}>Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What it is used for"
            className={inputClass}
          />
        </label>

        <ImageUpload label="Logo" area="platforms" value={logoUrl} onChange={setLogoUrl} small />

        <div>
          <span className={labelClass}>Integration method</span>
          <div className="grid gap-2 sm:grid-cols-4">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                disabled={Boolean(connectorKey)}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  method === m.value
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{METHODS.find((m) => m.value === method)?.hint}</p>
        </div>

        <label className="block">
          <span className={labelClass}>Capabilities (optional)</span>
          <input
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            placeholder="orders, products, inventory"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Comma-separated. Later phases use these to show the platform in matching screens.
          </span>
        </label>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-60">
            {saving ? 'Saving…' : platform ? 'Save changes' : 'Add platform'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: PlatformCategory | null;
  onClose: () => void;
  onSaved: (slug: string | null) => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (category) {
        await api.patch(`/api/admin/platform-categories/${category.id}`, {
          name: name.trim(),
          description: description.trim(),
          isActive,
        });
        onSaved(null);
      } else {
        const created = await api.post<PlatformCategory>('/api/admin/platform-categories', {
          name: name.trim(),
          description: description.trim(),
        });
        onSaved(created.slug);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the category.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!category) return;
    setError(null);
    setSaving(true);
    try {
      await api.delete(`/api/admin/platform-categories/${category.id}`);
      onSaved(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={category ? `Edit ${category.name}` : 'Add category'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing Platforms" className={inputClass} required />
        </label>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </label>
        {category && (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Show this category
          </label>
        )}
        {category?.is_system && (
          <p className="text-xs text-slate-400">Built-in category: it can be renamed or hidden, but not deleted.</p>
        )}

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex items-center gap-2">
          {category && !category.is_system && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-100"
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-60">
              {saving ? 'Saving…' : category ? 'Save' : 'Add category'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
