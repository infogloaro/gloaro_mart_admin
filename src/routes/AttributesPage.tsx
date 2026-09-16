import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type { AttributeValueOption, Category, ProductAttribute } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/attributes',
  'POST   /api/admin/attributes',
  'PATCH  /api/admin/attributes/:id',
  'DELETE /api/admin/attributes/:id',
  'POST   /api/admin/attributes/:id/values',
  'PATCH  /api/admin/attributes/:id/values/:valueId',
  'DELETE /api/admin/attributes/:id/values/:valueId',
];

const INPUT_TYPES = ['select', 'text', 'number'] as const;
type InputType = (typeof INPUT_TYPES)[number];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

/** `code` is what variants are keyed on, so it is derived once and never edited. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function AttributesPage() {
  const can = useCan('attributes');
  const { data: attributes, loading, error, reload } = useApiData<ProductAttribute[]>(
    '/api/admin/attributes?includeInactive=true',
  );
  const { data: categories } = useApiData<Category[]>('/api/admin/categories');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductAttribute | null>(null);
  const [deleting, setDeleting] = useState<ProductAttribute | null>(null);
  const [deletingValue, setDeletingValue] = useState<{ attr: ProductAttribute; value: AttributeValueOption } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Attribute form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [inputType, setInputType] = useState<InputType>('select');
  const [isVariantDefining, setIsVariantDefining] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Inline "add value" state, keyed by attribute so two rows do not share a box.
  const [newValues, setNewValues] = useState<Record<number, string>>({});

  function resetForm() {
    setName('');
    setCode('');
    setCategoryId('');
    setInputType('select');
    setIsVariantDefining(true);
    setIsActive(true);
    setActionError(null);
  }

  async function createAttribute(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    const finalCode = (code.trim() || slugify(name)).trim();
    if (!name.trim() || !finalCode) {
      setActionError('A name is required.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/api/admin/attributes', {
        name: name.trim(),
        code: finalCode,
        categoryId: categoryId ? Number(categoryId) : undefined,
        inputType,
        isVariantDefining,
      });
      setCreating(false);
      resetForm();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not create the attribute.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/attributes/${editing.id}`, {
        name: name.trim(),
        categoryId: categoryId ? Number(categoryId) : undefined,
        inputType,
        isVariantDefining,
        isActive,
      });
      setEditing(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save the attribute.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/attributes/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (err) {
      // 409 means variants still reference it — a standing reason, not a blip.
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the attribute.');
    } finally {
      setBusy(false);
    }
  }

  async function addValue(attr: ProductAttribute) {
    const value = (newValues[attr.id] ?? '').trim();
    if (!value) return;
    setActionError(null);
    try {
      await api.post(`/api/admin/attributes/${attr.id}/values`, { value });
      setNewValues((prev) => ({ ...prev, [attr.id]: '' }));
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not add the value.');
    }
  }

  async function confirmDeleteValue() {
    if (!deletingValue) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/attributes/${deletingValue.attr.id}/values/${deletingValue.value.id}`);
      setDeletingValue(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the value.');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(attr: ProductAttribute) {
    setEditing(attr);
    setName(attr.name);
    setCategoryId(attr.category_id == null ? '' : String(attr.category_id));
    setInputType((attr.input_type as InputType) ?? 'select');
    setIsVariantDefining(attr.is_variant_defining);
    setIsActive(attr.is_active);
    setActionError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Attributes</h1>
          <p className="text-sm text-slate-500">
            The vocabulary variants are built from — size, colour, pack size. Platform-owned on purpose: a shop
            inventing its own "Size" would fragment the filters every other shop shares.
          </p>
        </div>
        {can.edit && (
          <button onClick={() => { resetForm(); setCreating(true); }} className="btn-primary px-4 py-2.5 text-sm">
            Add attribute
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Sprint 4 catalogue" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && attributes && attributes.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="sliders" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">
            No attributes yet. Products cannot have variants until one exists.
          </p>
        </div>
      )}

      {!loading && !error && (attributes ?? []).map((attr) => (
        <div key={attr.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-ink">{attr.name}</h2>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  {attr.code}
                </span>
                {attr.is_variant_defining ? (
                  <span className="rounded-full border border-emerald/25 bg-mint-mist px-2 py-0.5 text-[10px] font-bold text-emerald-deep">
                    DEFINES VARIANTS
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    SPEC ONLY
                  </span>
                )}
                {!attr.is_active && (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    INACTIVE
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {attr.category_name ? `${attr.category_name} only` : 'Every category'} · {attr.input_type}
              </p>
            </div>
            <div className="flex gap-2">
              {can.edit && (
                <button
                  onClick={() => openEdit(attr)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
                >
                  Edit
                </button>
              )}
              {can.delete && (
                <button
                  onClick={() => setDeleting(attr)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {attr.values.length === 0 && (
              <span className="text-xs text-slate-400">
                No values yet — a select attribute with no values cannot describe a variant.
              </span>
            )}
            {attr.values.map((v) => (
              <span
                key={v.id}
                className="group inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {v.value}
                {can.delete && (
                  <button
                    onClick={() => setDeletingValue({ attr, value: v })}
                    title="Remove value"
                    className="text-slate-300 hover:text-rose-600"
                  >
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {can.edit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addValue(attr);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={newValues[attr.id] ?? ''}
                onChange={(e) => setNewValues((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                placeholder="Add a value, e.g. 500g"
                className="w-56 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
              >
                Add
              </button>
            </form>
          )}
        </div>
      ))}

      {creating && (
        <Modal title="Add attribute" onClose={() => setCreating(false)}>
          <form onSubmit={createAttribute} className="space-y-3">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Keep the code in step until the operator edits it directly.
                  setCode(slugify(e.target.value));
                }}
                placeholder="e.g. Pack size"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} font-mono`} />
              <span className="mt-1 block text-[11px] text-slate-400">
                Permanent. Variants are keyed on this, so it cannot be renamed later.
              </span>
            </label>

            <label className="block">
              <span className={labelClass}>Applies to</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                <option value="">Every category</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Input type</span>
              <select
                value={inputType}
                onChange={(e) => setInputType(e.target.value as InputType)}
                className={inputClass}
              >
                {INPUT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isVariantDefining}
                onChange={(e) => setIsVariantDefining(e.target.checked)}
                className="mt-1"
              />
              <span>
                Defines variants
                <span className="block text-xs text-slate-400">
                  On: two products differing only in this are separate variants. Off: it is a spec shown on the page.
                </span>
              </span>
            </label>

            {actionError && <p className="text-sm font-medium text-rose-700">{actionError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
                {busy ? 'Saving…' : 'Create attribute'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>

            <div>
              <span className={labelClass}>Code</span>
              <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 font-mono text-sm text-slate-500">{editing.code}</p>
              <span className="mt-1 block text-[11px] text-slate-400">
                Not editable — renaming it would silently re-point every variant using it.
              </span>
            </div>

            <label className="block">
              <span className={labelClass}>Applies to</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                <option value="">Every category</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Input type</span>
              <select
                value={inputType}
                onChange={(e) => setInputType(e.target.value as InputType)}
                className={inputClass}
              >
                {INPUT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isVariantDefining}
                onChange={(e) => setIsVariantDefining(e.target.checked)}
              />
              Defines variants
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>

            {actionError && <p className="text-sm font-medium text-rose-700">{actionError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete attribute"
          message={`Remove ${deleting.name} and its ${deleting.values.length} value${deleting.values.length === 1 ? '' : 's'}? This is refused if any variant is still described by it.`}
          confirmLabel="Delete"
          busy={busy}
          error={actionError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {deletingValue && (
        <ConfirmDialog
          title="Delete value"
          message={`Remove '${deletingValue.value.value}' from ${deletingValue.attr.name}? This is refused if any variant is still sold as it.`}
          confirmLabel="Delete"
          busy={busy}
          error={actionError}
          onConfirm={confirmDeleteValue}
          onCancel={() => setDeletingValue(null)}
        />
      )}
    </div>
  );
}
