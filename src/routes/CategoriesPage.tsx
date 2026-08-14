import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { Category } from '../lib/types';

const ICON_OPTIONS = [
  'devices', 'fashion', 'grocery', 'home', 'beauty',
  'electronics', 'sports', 'books', 'toys', 'food', 'health', 'other',
];

export default function CategoriesPage() {
  const { data: categories, loading, error, reload } = useApiData<Category[]>('/api/admin/categories');
  const [formFor, setFormFor] = useState<{ mode: 'create' } | { mode: 'edit'; category: Category } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
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
        <button
          onClick={() => setFormFor({ mode: 'create' })}
          className="btn-primary px-4 py-2 text-sm"
        >
          + New Category
        </button>
      </div>

      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && categories && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
              { header: 'Icon', render: (c) => c.icon_key },
              {
                header: 'Order',
                render: (c) => (
                  <div className="flex items-center gap-1">
                    <span className="w-6">{c.sort_order}</span>
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
                    <button
                      disabled={pendingId === c.id}
                      onClick={() => setDeleting(c)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
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

    const body = { name: name.trim(), iconKey, sortOrder: order, isActive };
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
