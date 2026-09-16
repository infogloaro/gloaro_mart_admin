import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useCan } from '../lib/staffContext';
import type { Brand } from '../lib/types';

export default function BrandsPage() {
  const can = useCan('brands');
  const { data: brands, loading, error, reload } = useApiData<Brand[]>('/api/admin/brands');
  const [formFor, setFormFor] = useState<{ mode: 'create' } | { mode: 'edit'; brand: Brand } | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const visible = (brands ?? []).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function toggleActive(brand: Brand) {
    setActionError(null);
    setPendingId(brand.id);
    try {
      await api.patch(`/api/admin/brands/${brand.id}`, { isActive: !brand.is_active });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update brand.');
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setPendingId(deleting.id);
    try {
      await api.delete(`/api/admin/brands/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      // A product count that moved since the page loaded comes back as a 409
      // naming the count — keep the dialog open and show it there, since a
      // message behind the backdrop would be invisible.
      setDeleteError(e instanceof ApiError ? e.message : 'Failed to delete brand.');
      reload();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Brands</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            The brand master used by products. Vendors pick from this list — they cannot invent their own.
          </p>
        </div>
        {can.edit && (
          <button onClick={() => setFormFor({ mode: 'create' })} className="btn-primary px-4 py-2 text-sm">
            + New Brand
          </button>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search brands…"
        className="w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
      />

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && brands && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Brand',
                render: (b) => (
                  <div className="flex items-center gap-3">
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt=""
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain"
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mint-mist text-xs font-bold text-emerald-deep">
                        {b.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-slate-400">{b.slug}</div>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Products',
                render: (b) => (
                  <span className={b.product_count > 0 ? 'font-medium' : 'text-slate-400'}>{b.product_count}</span>
                ),
              },
              { header: 'Order', render: (b) => b.sort_order },
              {
                header: 'Status',
                render: (b) => (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                ),
              },
              {
                header: 'Actions',
                render: (b) => (
                  <div className="flex gap-2">
                    {can.edit && (
                      <>
                        <button
                          onClick={() => setFormFor({ mode: 'edit', brand: b })}
                          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          disabled={pendingId === b.id}
                          onClick={() => toggleActive(b)}
                          className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                            b.is_active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {b.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                    {can.delete && (
                      <button
                        disabled={pendingId === b.id || b.product_count > 0}
                        onClick={() => setDeleting(b)}
                        title={
                          b.product_count > 0
                            ? `${b.product_count} product(s) still use this brand — deactivate it instead.`
                            : undefined
                        }
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
            rows={visible}
            keyFor={(b) => b.id}
            emptyMessage={query ? 'No brand matches that search.' : 'No brands yet.'}
          />
        </div>
      )}

      {formFor && (
        <BrandFormModal
          brand={formFor.mode === 'edit' ? formFor.brand : null}
          nextSortOrder={brands?.length ?? 0}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete brand"
          message={`Delete "${deleting.name}"? A brand already used by products cannot be deleted — deactivate it instead.`}
          busy={pendingId === deleting.id}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}

function BrandFormModal({
  brand,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  brand: Brand | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = brand !== null;
  const [name, setName] = useState(brand?.name ?? '');
  // Left blank on create, the server derives it from the name.
  const [slug, setSlug] = useState(brand?.slug ?? '');
  const [logoUrl, setLogoUrl] = useState(brand?.logo_url ?? '');
  const [description, setDescription] = useState(brand?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(brand?.sort_order ?? nextSortOrder));
  const [isActive, setIsActive] = useState(brand ? brand.is_active : true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter a brand name.');

    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 0) return setError('Sort order must be a whole number of 0 or more.');

    const body: Record<string, unknown> = {
      name: name.trim(),
      logoUrl: logoUrl.trim() || null,
      description: description.trim() || null,
      sortOrder: order,
      isActive,
    };
    // Only send the slug when it was actually typed — an empty field on create
    // means "derive it", and on edit means "leave the existing one alone".
    if (slug.trim()) body.slug = slug.trim();

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/api/admin/brands/${brand.id}`, body);
      } else {
        await api.post('/api/admin/brands', body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save brand.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

  return (
    <Modal title={isEdit ? 'Edit Brand' : 'New Brand'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aachi" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={isEdit ? brand.slug : 'auto from name'}
              className={inputClass}
            />
          </div>
        </div>
        <p className="-mt-1 text-xs text-slate-500">
          {isEdit
            ? 'Changing the slug breaks links and saved filters already pointing at the old one.'
            : 'Leave the slug blank to generate it from the name.'}
        </p>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Logo URL</label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Available to pick on products
        </label>
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Brand'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
