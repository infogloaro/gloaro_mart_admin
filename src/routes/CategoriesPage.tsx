import { useState, type FormEvent } from 'react';
import { api, ApiError, assetUrl } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ImageUpload } from '../components/ui/ImageUpload';
import { useCan } from '../lib/staffContext';
import type { Category, CategorySubcategory } from '../lib/types';

// The keys the app knows. Each picks the icon and the built-in photo the app
// shows when the category has no image of its own.
const ICON_OPTIONS = [
  'grocery', 'fruits', 'food', 'fashion', 'beauty', 'home', 'devices', 'electronics',
  'electrical', 'appliances', 'pharmacy', 'books', 'stationery', 'toys', 'baby',
  'sports', 'hardware', 'pets', 'other',
];

export default function CategoriesPage() {
  const can = useCan('categories');
  const { data: categories, loading, error, reload } = useApiData<Category[]>('/api/admin/categories');
  const [formFor, setFormFor] = useState<{ mode: 'create' } | { mode: 'edit'; category: Category } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [subsFor, setSubsFor] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function toggleActive(category: Category) {
    setActionError(null);
    setPendingId(category.id);
    try {
      await api.patch(`/api/admin/categories/${category.id}`, { isActive: !category.is_active });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update category.');
    } finally {
      setPendingId(null);
    }
  }

  // Seeded categories can share a sort_order, so swapping two values is not enough —
  // move the row then renumber the whole list from its new position.
  async function move(category: Category, direction: -1 | 1) {
    const ordered = [...(categories ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const index = ordered.findIndex((c) => c.id === category.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;

    ordered.splice(target, 0, ...ordered.splice(index, 1));

    setActionError(null);
    setPendingId(category.id);
    try {
      const changed = ordered
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => c.sort_order !== i);
      for (const { c, i } of changed) {
        await api.patch(`/api/admin/categories/${c.id}`, { sortOrder: i });
      }
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to reorder categories.');
      reload();
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    setPendingId(deleting.id);
    try {
      await api.delete(`/api/admin/categories/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete category.');
      setDeleting(null);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Categories</h1>
        {can.edit && (
          <button
            onClick={() => setFormFor({ mode: 'create' })}
            className="btn-primary px-4 py-2 text-sm"
          >
            + New Category
          </button>
        )}
      </div>

      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && categories && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Image',
                render: (c) =>
                  c.image_url ? (
                    <img src={assetUrl(c.image_url)} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">Built-in</span>
                  ),
              },
              {
                header: 'Name',
                render: (c) => (
                  <div>
                    <span className="font-medium">{c.name}</span>
                    {c.product_count != null && <div className="text-xs text-slate-400">{c.product_count} products</div>}
                  </div>
                ),
              },
              {
                header: 'Sub-categories',
                render: (c) => {
                  const subs = c.subcategories ?? [];
                  const hidden = subs.filter((s) => s.is_active === false).length;
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {subs.length === 0 ? 'None' : subs.length}
                        {hidden > 0 && <span className="text-xs text-slate-400"> ({hidden} hidden)</span>}
                      </span>
                      <button
                        onClick={() => setSubsFor(c)}
                        className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        {can.edit ? 'Manage' : 'View'}
                      </button>
                    </div>
                  );
                },
              },
              { header: 'Icon', render: (c) => c.icon_key },
              {
                header: 'Order',
                render: (c) => (
                  <div className="flex items-center gap-1">
                    <span className="w-6">{c.sort_order}</span>
                    {can.edit && (
                      <>
                        <button
                          disabled={pendingId === c.id}
                          onClick={() => move(c, -1)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep disabled:opacity-50"
                          aria-label={`Move ${c.name} up`}
                        >
                          ↑
                        </button>
                        <button
                          disabled={pendingId === c.id}
                          onClick={() => move(c, 1)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep disabled:opacity-50"
                          aria-label={`Move ${c.name} down`}
                        >
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
                    {c.is_active ? 'ACTIVE' : 'INACTIVE'}
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
                          onClick={() => toggleActive(c)}
                          className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                            c.is_active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                    {can.delete && (
                      <button
                        disabled={pendingId === c.id}
                        onClick={() => setDeleting(c)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
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
            emptyMessage="No categories yet."
          />
        </div>
      )}

      {formFor && (
        <CategoryFormModal
          category={formFor.mode === 'edit' ? formFor.category : null}
          nextSortOrder={categories?.length ?? 0}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            reload();
          }}
        />
      )}

      {subsFor && (
        <SubcategoriesModal
          // The list reloads after each change; follow the fresh copy of this category.
          category={categories?.find((c) => c.id === subsFor.id) ?? subsFor}
          canEdit={can.edit}
          onChanged={reload}
          onClose={() => setSubsFor(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete "${deleting.name}"? This is blocked while products still use it — deactivate it instead to hide it from the app.`}
          busy={pendingId === deleting.id}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CategoryFormModal({
  category,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  category: Category | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = category !== null;
  const [name, setName] = useState(category?.name ?? '');
  const [iconKey, setIconKey] = useState(category?.icon_key ?? 'other');
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? nextSortOrder));
  const [isActive, setIsActive] = useState(category ? category.is_active : true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter a category name.');

    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 0) return setError('Sort order must be a whole number of 0 or more.');

    const body = { name: name.trim(), iconKey, imageUrl: imageUrl.trim() || null, sortOrder: order, isActive };
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/api/admin/categories/${category.id}`, body);
      } else {
        await api.post('/api/admin/categories', body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

  return (
    <Modal title={isEdit ? 'Edit Category' : 'New Category'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sports" className={inputClass} />
          {isEdit && (
            <p className="mt-1 text-xs text-slate-500">Renaming also moves every product currently in this category.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Icon</label>
            <select value={iconKey} onChange={(e) => setIconKey(e.target.value)} className={inputClass}>
              {ICON_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sort order</label>
            <input
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <ImageUpload label="Image" area="categories" value={imageUrl} onChange={setImageUrl} small />
          <p className="mt-1 text-xs text-slate-500">
            Shown on the app's category tiles. A square photo works best. Leave empty to use the app's built-in photo for the
            icon above.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Visible in the app
        </label>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * CT4: the admin's sub-category list for one category — add, rename (moves
 * the products that use the old name), hide / show, reorder, delete (refused
 * while products still use it). Products keep the name in products.subcategory.
 */
function SubcategoriesModal({
  category,
  canEdit,
  onChanged,
  onClose,
}: {
  category: Category;
  canEdit: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const subs = [...(category.subcategories ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/admin/categories/${category.id}/subcategories`;

  async function run(id: number | 'new', action: () => Promise<unknown>, failure: string) {
    setError(null);
    setBusyId(id);
    try {
      await action();
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : failure);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return setError('Enter a sub-category name.');
    if (await run('new', () => api.post(base, { name }), 'Failed to add the sub-category.')) setNewName('');
  }

  async function rename(sub: CategorySubcategory) {
    const name = editing?.name.trim() ?? '';
    if (!name) return setError('A sub-category needs a name.');
    if (name === sub.name) return setEditing(null);
    if (await run(sub.id, () => api.patch(`${base}/${sub.id}`, { name }), 'Failed to rename the sub-category.')) setEditing(null);
  }

  // Same approach as the category list: move the row, then renumber in steps of 10.
  async function move(sub: CategorySubcategory, direction: -1 | 1) {
    const ordered = [...subs];
    const index = ordered.findIndex((s) => s.id === sub.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;
    ordered.splice(target, 0, ...ordered.splice(index, 1));
    await run(
      sub.id,
      async () => {
        for (const [i, s] of ordered.entries()) {
          if (s.sort_order !== (i + 1) * 10) await api.patch(`${base}/${s.id}`, { sortOrder: (i + 1) * 10 });
        }
      },
      'Failed to reorder.'
    );
  }

  const small =
    'rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep disabled:opacity-50';

  return (
    <Modal title={`Sub-categories · ${category.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Shops pick one of these for each product, and the app shows them as chips inside {category.name}. Renaming one also
          renames it on every product that uses it. Hide one to stop new products using it without touching existing ones.
        </p>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        {subs.length === 0 && <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">No sub-categories yet.</div>}
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {subs.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2">
              {editing?.id === s.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename(s);
                  }}
                >
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ id: s.id, name: e.target.value })}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-sm"
                    aria-label={`New name for ${s.name}`}
                  />
                  <button type="submit" disabled={busyId === s.id} className="btn-primary px-3 py-1 text-xs">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${s.is_active === false ? 'text-slate-400 line-through' : 'text-ink'}`}>{s.name}</span>
                  {s.is_active === false && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">HIDDEN</span>}
                  {canEdit && (
                    <>
                      <button disabled={busyId !== null || i === 0} onClick={() => move(s, -1)} className={small} aria-label={`Move ${s.name} up`}>
                        ↑
                      </button>
                      <button disabled={busyId !== null || i === subs.length - 1} onClick={() => move(s, 1)} className={small} aria-label={`Move ${s.name} down`}>
                        ↓
                      </button>
                      <button disabled={busyId !== null} onClick={() => setEditing({ id: s.id, name: s.name })} className={small}>
                        Rename
                      </button>
                      <button
                        disabled={busyId !== null}
                        onClick={() => run(s.id, () => api.patch(`${base}/${s.id}`, { isActive: s.is_active === false }), 'Failed to update.')}
                        className={small}
                      >
                        {s.is_active === false ? 'Show' : 'Hide'}
                      </button>
                      <button
                        disabled={busyId !== null}
                        onClick={() => {
                          if (window.confirm(`Delete "${s.name}"? Refused while products still use it.`)) {
                            run(s.id, () => api.delete(`${base}/${s.id}`), 'Failed to delete.');
                          }
                        }}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form onSubmit={add} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New sub-category, e.g. Kurtis"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm"
            />
            <button type="submit" disabled={busyId === 'new'} className="btn-primary px-4 py-2 text-sm">
              {busyId === 'new' ? 'Adding…' : 'Add'}
            </button>
          </form>
        )}
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
