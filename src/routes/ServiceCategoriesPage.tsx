import { useState, type FormEvent } from 'react';
import { api, ApiError, assetUrl } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ImageUpload } from '../components/ui/ImageUpload';
import { useCan } from '../lib/staffContext';
import type { AdminService, ServiceCategory } from '../lib/types';

// Near Me → Services (NS4). The app groups the tiles by these, in this order.
const GROUPS: { key: string; label: string }[] = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'home', label: 'Home repair & care' },
  { key: 'gadgets', label: 'Gadgets' },
  { key: 'personal', label: 'Personal care' },
  { key: 'daily', label: 'Daily help' },
  { key: 'learning', label: 'Learning' },
  { key: 'events', label: 'Events' },
  { key: 'health', label: 'Health' },
  { key: 'other', label: 'More services' },
];
const groupLabel = (key: string) => GROUPS.find((g) => g.key === key)?.label ?? key;

// The icon keys the app knows (shown when there is no picture at all).
const ICON_OPTIONS = [
  'car', 'bike', 'car_wash', 'ac', 'electrician', 'plumber', 'carpenter', 'painter', 'water', 'appliance',
  'pest', 'cleaning', 'mobile', 'laptop', 'salon', 'beauty', 'tailor', 'laundry', 'tuition', 'camera',
  'health', 'pet', 'other',
];

const PRICE = (s: AdminService) => {
  const r = (c: number) => `₹${(c / 100).toLocaleString('en-IN')}`;
  if (s.price_type === 'on_request' || s.price_cents == null) return 'On request';
  if (s.price_type === 'range' && s.price_max_cents != null) return `${r(s.price_cents)} – ${r(s.price_max_cents)}`;
  if (s.price_type === 'from') return `From ${r(s.price_cents)}`;
  if (s.price_type === 'per_hour') return `${r(s.price_cents)} / hour`;
  return r(s.price_cents);
};

const smallButton =
  'rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep disabled:opacity-50';
const errorBox = 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700';

export default function ServiceCategoriesPage() {
  const [tab, setTab] = useState<'categories' | 'services'>('categories');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Service categories</h1>
        <p className="mt-1 text-sm text-slate-500">
          The kinds of local service on the app's Near Me → Services tab. Shops add their own services under one of
          these; a category with no shop says "Coming soon" in the app.
        </p>
      </div>
      <div className="flex gap-2">
        {(['categories', 'services'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === t ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t === 'categories' ? 'Categories' : 'Services from shops'}
          </button>
        ))}
      </div>
      {tab === 'categories' ? <CategoriesTab /> : <ServicesTab />}
    </div>
  );
}

function CategoriesTab() {
  const can = useCan('categories');
  const { data: categories, loading, error, reload } = useApiData<ServiceCategory[]>('/api/admin/service-categories');
  const [formFor, setFormFor] = useState<{ mode: 'create' } | { mode: 'edit'; category: ServiceCategory } | null>(null);
  const [deleting, setDeleting] = useState<ServiceCategory | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function patch(c: ServiceCategory, body: object, failure: string) {
    setActionError(null);
    setPendingId(c.id);
    try {
      await api.patch(`/api/admin/service-categories/${c.id}`, body);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : failure);
    } finally {
      setPendingId(null);
    }
  }

  // Renumber the whole list (in steps of 10) after moving one row.
  async function move(c: ServiceCategory, direction: -1 | 1) {
    const ordered = [...(categories ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const index = ordered.findIndex((x) => x.id === c.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;
    ordered.splice(target, 0, ...ordered.splice(index, 1));
    setActionError(null);
    setPendingId(c.id);
    try {
      for (const [i, x] of ordered.entries()) {
        if (x.sort_order !== (i + 1) * 10) await api.patch(`/api/admin/service-categories/${x.id}`, { sortOrder: (i + 1) * 10 });
      }
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to reorder.');
    } finally {
      setPendingId(null);
      reload();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    setPendingId(deleting.id);
    try {
      await api.delete(`/api/admin/service-categories/${deleting.id}`);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete.');
    } finally {
      setDeleting(null);
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {can.edit && (
        <div className="flex justify-end">
          <button onClick={() => setFormFor({ mode: 'create' })} className="btn-primary px-4 py-2 text-sm">
            + New service category
          </button>
        </div>
      )}
      {actionError && <div className={errorBox}>{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className={errorBox}>{error}</div>}
      {!loading && !error && categories && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Picture',
                render: (c) =>
                  c.image_url ? (
                    <img src={assetUrl(c.image_url)} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">Built-in</span>
                  ),
              },
              {
                header: 'Name (English / தமிழ் / हिन्दी)',
                render: (c) => (
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.name_ta ?? <em className="text-amber-600">no Tamil</em>} · {c.name_hi ?? <em className="text-amber-600">no Hindi</em>}
                    </div>
                  </div>
                ),
              },
              { header: 'Group', render: (c) => groupLabel(c.group_key) },
              {
                header: 'Shops',
                render: (c) => (
                  <span title={`${c.service_count} service(s) in total`}>
                    {c.provider_count > 0 ? c.provider_count : <span className="text-slate-400">Coming soon</span>}
                  </span>
                ),
              },
              {
                header: 'Order',
                render: (c) => (
                  <div className="flex items-center gap-1">
                    <span className="w-8">{c.sort_order}</span>
                    {can.edit && (
                      <>
                        <button disabled={pendingId === c.id} onClick={() => move(c, -1)} className={smallButton} aria-label={`Move ${c.name} up`}>
                          ↑
                        </button>
                        <button disabled={pendingId === c.id} onClick={() => move(c, 1)} className={smallButton} aria-label={`Move ${c.name} down`}>
                          ↓
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
              {
                header: 'Status',
                render: (c) => (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.is_active ? 'ACTIVE' : 'HIDDEN'}
                  </span>
                ),
              },
              {
                header: 'Actions',
                render: (c) => (
                  <div className="flex gap-2">
                    {can.edit && (
                      <>
                        <button
                          onClick={() => setFormFor({ mode: 'edit', category: c })}
                          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          disabled={pendingId === c.id}
                          onClick={() => patch(c, { isActive: !c.is_active }, 'Failed to update.')}
                          className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                            c.is_active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {c.is_active ? 'Hide' : 'Show'}
                        </button>
                      </>
                    )}
                    {can.delete && (
                      <button
                        disabled={pendingId === c.id}
                        onClick={() => setDeleting(c)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                    {!can.edit && !can.delete && <span className="text-xs text-slate-400">View only</span>}
                  </div>
                ),
              },
            ]}
            rows={categories}
            keyFor={(c) => c.id}
            emptyMessage="No service categories yet."
          />
        </div>
      )}

      {formFor && (
        <ServiceCategoryForm
          category={formFor.mode === 'edit' ? formFor.category : null}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete service category"
          message={`Delete "${deleting.name}"? This is blocked while shops have services in it — hide it instead.`}
          busy={pendingId === deleting.id}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function ServiceCategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: ServiceCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = category !== null;
  const [name, setName] = useState(category?.name ?? '');
  const [nameTa, setNameTa] = useState(category?.name_ta ?? '');
  const [nameHi, setNameHi] = useState(category?.name_hi ?? '');
  const [groupKey, setGroupKey] = useState(category?.group_key ?? 'home');
  const [iconKey, setIconKey] = useState(category?.icon_key ?? 'other');
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? '');
  const [isActive, setIsActive] = useState(category ? category.is_active : true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter the English name.');
    const body = {
      name: name.trim(),
      nameTa: nameTa.trim() || null,
      nameHi: nameHi.trim() || null,
      groupKey,
      iconKey,
      imageUrl: imageUrl.trim() || null,
      isActive,
    };
    setSubmitting(true);
    try {
      if (isEdit) await api.patch(`/api/admin/service-categories/${category.id}`, body);
      else await api.post('/api/admin/service-categories', body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
  const label = 'mb-1 block text-sm font-medium text-slate-700';

  return (
    <Modal title={isEdit ? 'Edit service category' : 'New service category'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={label}>Name (English)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="AC service & repair" className={inputClass} />
          {isEdit && <p className="mt-1 text-xs text-slate-500">Its link name stays "{category.slug}".</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Tamil</label>
            <input value={nameTa} onChange={(e) => setNameTa(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={label}>Hindi</label>
            <input value={nameHi} onChange={(e) => setNameHi(e.target.value)} className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-slate-500">Left empty, the app shows the English name in that language.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Group in the app</label>
            <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className={inputClass}>
              {GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Icon</label>
            <select value={iconKey} onChange={(e) => setIconKey(e.target.value)} className={inputClass}>
              {ICON_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <ImageUpload label="Picture" area="service-categories" value={imageUrl} onChange={setImageUrl} small />
          <p className="mt-1 text-xs text-slate-500">
            A square photo works best. Leave empty to keep the app's built-in photo (or the icon for a new category).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Visible in the app
        </label>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ServicesTab() {
  const can = useCan('categories');
  const [status, setStatus] = useState('');
  const { data: services, loading, error, reload } = useApiData<AdminService[]>(
    `/api/admin/services${status ? `?status=${status}` : ''}`
  );
  const [hiding, setHiding] = useState<AdminService | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function show(s: AdminService) {
    setActionError(null);
    setPendingId(s.id);
    try {
      await api.patch(`/api/admin/services/${s.id}`, { status: 'active' });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Show</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
          <option value="">All</option>
          <option value="active">Live</option>
          <option value="paused">Paused by the shop</option>
          <option value="hidden">Hidden by Gloaro</option>
        </select>
      </div>
      {actionError && <div className={errorBox}>{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className={errorBox}>{error}</div>}
      {!loading && !error && services && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Service',
                render: (s) => (
                  <div>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-slate-500">{s.category_name}</div>
                  </div>
                ),
              },
              {
                header: 'Shop',
                render: (s) => (
                  <div>
                    <div>{s.vendor_name}</div>
                    <div className="text-xs text-slate-500">{s.vendor_city ?? ''}</div>
                  </div>
                ),
              },
              { header: 'Price', render: PRICE },
              { header: 'Where', render: (s) => [s.at_home && 'At home', s.at_shop && 'At shop'].filter(Boolean).join(', ') },
              {
                header: 'Status',
                render: (s) => (
                  <div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : s.status === 'hidden'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.status === 'active' ? 'LIVE' : s.status === 'hidden' ? 'HIDDEN' : 'PAUSED'}
                    </span>
                    {s.hidden_reason && <div className="mt-1 max-w-xs text-xs text-slate-500">{s.hidden_reason}</div>}
                  </div>
                ),
              },
              {
                header: 'Actions',
                render: (s) =>
                  !can.edit ? (
                    <span className="text-xs text-slate-400">View only</span>
                  ) : s.status === 'hidden' ? (
                    <button disabled={pendingId === s.id} onClick={() => show(s)} className="rounded-md bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                      Show again
                    </button>
                  ) : (
                    <button onClick={() => setHiding(s)} className="rounded-md bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">
                      Hide
                    </button>
                  ),
              },
            ]}
            rows={services}
            keyFor={(s) => s.id}
            emptyMessage="No shop has added a service yet."
          />
        </div>
      )}
      {hiding && (
        <HideServiceModal
          service={hiding}
          onClose={() => setHiding(null)}
          onDone={() => {
            setHiding(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function HideServiceModal({ service, onClose, onDone }: { service: AdminService; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) return setError('Say why it is hidden (at least 5 characters). The shop sees this.');
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/admin/services/${service.id}`, { status: 'hidden', hiddenReason: reason.trim() });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to hide.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Hide "${service.title}"`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="mb-1 block text-sm font-medium text-slate-700">Reason (the shop sees this)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          placeholder="The photos show another shop's work."
        />
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-sm">
            {busy ? 'Hiding…' : 'Hide from the app'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
