import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type {
  AdminProduct,
  Category,
  Paged,
  ProductAttribute,
  ProductMedia,
  ProductVariant,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/products/:id/variants',
  'POST   /api/admin/products/:id/variants',
  'PATCH  /api/admin/products/:id/variants/:variantId',
  'DELETE /api/admin/products/:id/variants/:variantId',
  'GET    /api/admin/attributes',
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

function rupees(cents: number | null): string {
  if (cents == null) return '—';
  return `₹${(cents / 100).toFixed(2)}`;
}

/** Rupees in the field, integer cents on the wire — the API stores cents. */
function toCents(rupeeText: string): number {
  return Math.round(Number(rupeeText || '0') * 100);
}

export default function VariantsPage() {
  const can = useCan('products');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [product, setProduct] = useState<AdminProduct | null>(null);

  const { data: products, loading: productsLoading } = useApiData<Paged<AdminProduct>>(
    `/api/admin/products?pageSize=20${debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ''}`,
    [debouncedSearch],
  );

  const {
    data: variants,
    loading,
    error,
    reload,
  } = useApiData<ProductVariant[]>(product ? `/api/admin/products/${product.id}/variants` : '', [product?.id]);

  const { data: categories } = useApiData<Category[]>('/api/admin/categories');

  // Attributes are scoped to the product's category; the server also returns
  // the ones that apply everywhere, so a Fashion product still offers Material.
  const categoryId = useMemo(
    () => categories?.find((c) => c.name === product?.category)?.id ?? null,
    [categories, product?.category],
  );
  const { data: attributes } = useApiData<ProductAttribute[]>(
    product ? `/api/admin/attributes${categoryId ? `?categoryId=${categoryId}` : ''}` : '',
    [product?.id, categoryId],
  );

  const { data: media, reload: reloadMedia } = useApiData<ProductMedia[]>(
    product ? `/api/admin/products/${product.id}/media` : '',
    [product?.id],
  );

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [deleting, setDeleting] = useState<ProductVariant | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Variant form
  const [chosenValues, setChosenValues] = useState<Record<number, number>>({});
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [qty, setQty] = useState('0');
  const [threshold, setThreshold] = useState('5');
  const [isActive, setIsActive] = useState(true);

  // Media form
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaVariantId, setMediaVariantId] = useState('');

  const variantDefining = useMemo(
    () => (attributes ?? []).filter((a) => a.is_variant_defining && a.values.length > 0),
    [attributes],
  );

  function resetForm() {
    setChosenValues({});
    setSku('');
    setPrice(product ? (product.price_cents / 100).toFixed(2) : '');
    setMrp('');
    setQty('0');
    setThreshold('5');
    setIsActive(true);
    setActionError(null);
  }

  async function createVariant(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setActionError(null);

    const valueIds = Object.values(chosenValues).filter(Boolean);
    if (valueIds.length === 0) {
      setActionError('Pick at least one attribute value — a variant is what its attributes say it is.');
      return;
    }
    const priceCents = toCents(price);
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      setActionError('Enter a valid price.');
      return;
    }

    setBusy(true);
    try {
      await api.post(`/api/admin/products/${product.id}/variants`, {
        sku: sku.trim() || undefined,
        priceCents,
        mrpCents: mrp.trim() ? toCents(mrp) : undefined,
        attributeValueIds: valueIds,
        availableQty: Number(qty || '0'),
        lowStockThreshold: Number(threshold || '0'),
      });
      setCreating(false);
      resetForm();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not create the variant.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!product || !editing) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/products/${product.id}/variants/${editing.id}`, {
        sku: sku.trim() || null,
        priceCents: toCents(price),
        mrpCents: mrp.trim() ? toCents(mrp) : null,
        isActive,
      });
      setEditing(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save the variant.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!product || !deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/products/${product.id}/variants/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (err) {
      // A 409 here means stock is held for an open order — a real reason, not a
      // transient failure, so it stays on screen rather than being retried.
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the variant.');
    } finally {
      setBusy(false);
    }
  }

  async function addMedia(e: FormEvent) {
    e.preventDefault();
    if (!product || !mediaUrl.trim()) return;
    setActionError(null);
    try {
      await api.post(`/api/admin/products/${product.id}/media`, {
        url: mediaUrl.trim(),
        mediaType: 'image',
        variantId: mediaVariantId ? Number(mediaVariantId) : undefined,
      });
      setMediaUrl('');
      setMediaVariantId('');
      reloadMedia();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not add the image.');
    }
  }

  async function removeMedia(id: number) {
    if (!product) return;
    try {
      await api.delete(`/api/admin/products/${product.id}/media/${id}`);
      reloadMedia();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not remove the image.');
    }
  }

  async function makePrimary(id: number) {
    try {
      await api.patch(`/api/admin/media/${id}/primary`);
      reloadMedia();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not set the primary image.');
    }
  }

  function openEdit(v: ProductVariant) {
    setEditing(v);
    setSku(v.sku ?? '');
    setPrice((v.priceCents / 100).toFixed(2));
    setMrp(v.mrpCents == null ? '' : (v.mrpCents / 100).toFixed(2));
    setIsActive(v.isActive);
    setActionError(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Product Variants</h1>
        <p className="text-sm text-slate-500">
          Per-variant SKU, price, MRP, stock and images. A product's own price and primary image follow its variants,
          so editing here is what customers see.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink">Select product</h2>
            <p className="text-xs text-slate-400">
              {productsLoading ? 'Loading…' : `${products?.items.length ?? 0} shown`}
            </p>
          </div>
          <div className="relative w-64">
            <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {(products?.items ?? []).map((p) => {
            const selected = product?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setProduct(selected ? null : p);
                  setActionError(null);
                }}
                className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                  selected
                    ? 'border-emerald bg-mint-mist shadow-[0_10px_26px_-16px_rgba(31,111,91,0.8)]'
                    : 'border-slate-200 hover:-translate-y-0.5 hover:border-mint-soft'
                }`}
              >
                <div className="truncate text-[13px] font-bold text-ink">{p.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-slate-500">
                  {[p.category, rupees(p.price_cents)].filter(Boolean).join(' · ')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {!product && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="grid" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">Select a product above to manage its variants.</p>
        </div>
      )}

      {product && (
        <>
          {error &&
            (isMissingEndpoint(error) ? (
              <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Sprint 4 catalogue" />
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                {error}
              </div>
            ))}

          {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

          {!loading && !error && variants && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-ink">
                  {variants.length} variant{variants.length === 1 ? '' : 's'} of {product.name}
                </h2>
                {can.edit && (
                  <button
                    onClick={() => {
                      resetForm();
                      setCreating(true);
                    }}
                    disabled={variantDefining.length === 0}
                    className="btn-primary px-4 py-2.5 text-sm disabled:opacity-40"
                  >
                    Add variant
                  </button>
                )}
              </div>

              {/* Without a variant-defining attribute there is nothing to tell
                  two variants apart, so say why the button is dead rather than
                  leaving the operator to guess. */}
              {variantDefining.length === 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    No variant-defining attributes exist for{' '}
                    <span className="font-semibold">{product.category ?? 'this category'}</span> yet. A variant is
                    identified by its attribute values, so one has to be defined before variants can be added.
                  </span>
                </div>
              )}

              <div className="card overflow-hidden">
                <DataTable
                  rows={variants}
                  keyFor={(v) => v.id}
                  emptyMessage="No variants — this product sells as a single item."
                  columns={[
                    {
                      header: 'Variant',
                      render: (v) => (
                        <div>
                          <div className="text-[13px] font-semibold text-ink">
                            {v.label || v.attributes.map((a) => a.value).join(' / ') || `#${v.id}`}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {v.attributes.map((a) => `${a.name}: ${a.value}`).join(' · ')}
                          </div>
                        </div>
                      ),
                    },
                    {
                      header: 'SKU',
                      render: (v) =>
                        v.sku ? (
                          <span className="font-mono text-xs">{v.sku}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        ),
                    },
                    {
                      header: 'Price',
                      className: 'text-right tabular-nums',
                      render: (v) => <span className="font-semibold text-ink">{rupees(v.priceCents)}</span>,
                    },
                    {
                      header: 'MRP',
                      className: 'text-right tabular-nums',
                      render: (v) => <span className="text-slate-500">{rupees(v.mrpCents)}</span>,
                    },
                    {
                      header: 'Stock',
                      className: 'text-right tabular-nums',
                      render: (v) =>
                        v.availableQty == null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={v.availableQty === 0 ? 'font-semibold text-state-error' : ''}>
                            {v.availableQty}
                          </span>
                        ),
                    },
                    {
                      header: 'Status',
                      render: (v) => (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                            v.isActive
                              ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                              : 'border-slate-200 bg-slate-100 text-slate-500'
                          }`}
                        >
                          {v.isActive ? 'Active' : 'Hidden'}
                        </span>
                      ),
                    },
                    {
                      header: '',
                      className: 'text-right',
                      render: (v) => (
                        <div className="flex justify-end gap-2">
                          {can.edit && (
                            <button
                              onClick={() => openEdit(v)}
                              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
                            >
                              Edit
                            </button>
                          )}
                          {can.delete && (
                            <button
                              onClick={() => setDeleting(v)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          )}
                          {!can.edit && !can.delete && <span className="text-xs text-slate-400">View only</span>}
                        </div>
                      ),
                    },
                  ]}
                />
              </div>

              <div className="card p-4">
                <h2 className="mb-1 text-sm font-bold text-ink">Images</h2>
                <p className="mb-3 text-xs text-slate-400">
                  Attach an image to the product, or to one variant so the gallery changes when a customer picks it.
                </p>

                {can.edit && (
                  <form onSubmit={addMedia} className="mb-3 flex flex-wrap items-end gap-3">
                    <label className="block min-w-56 flex-1">
                      <span className={labelClass}>Image URL</span>
                      <input
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://…"
                        className={inputClass}
                      />
                    </label>
                    <label className="block w-52">
                      <span className={labelClass}>Applies to</span>
                      <select
                        value={mediaVariantId}
                        onChange={(e) => setMediaVariantId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Whole product</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label || `#${v.id}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="btn-primary px-4 py-2.5 text-sm">
                      Add image
                    </button>
                  </form>
                )}

                {(media ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">No images yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {(media ?? []).map((m) => (
                      <div key={m.id} className="overflow-hidden rounded-xl border border-slate-200">
                        <img src={m.url} alt={m.alt_text ?? ''} className="h-24 w-full object-cover" />
                        <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                          <span className="truncate text-[10px] font-semibold text-slate-500">
                            {m.is_primary ? 'Primary' : m.variant_id ? 'Variant' : 'Product'}
                          </span>
                          <div className="flex gap-1">
                            {can.edit && !m.is_primary && (
                              <button
                                onClick={() => makePrimary(m.id)}
                                title="Make primary"
                                className="rounded p-0.5 text-slate-400 hover:text-emerald"
                              >
                                <Icon name="star" className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {can.delete && (
                              <button
                                onClick={() => removeMedia(m.id)}
                                title="Remove"
                                className="rounded p-0.5 text-slate-400 hover:text-rose-600"
                              >
                                <Icon name="x" className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {creating && product && (
        <Modal title={`Add variant to ${product.name}`} onClose={() => setCreating(false)}>
          <form onSubmit={createVariant} className="space-y-3">
            {variantDefining.map((attr) => (
              <label key={attr.id} className="block">
                <span className={labelClass}>{attr.name}</span>
                <select
                  value={chosenValues[attr.id] ?? ''}
                  onChange={(e) =>
                    setChosenValues((prev) => {
                      const next = { ...prev };
                      if (e.target.value) next[attr.id] = Number(e.target.value);
                      else delete next[attr.id];
                      return next;
                    })
                  }
                  className={inputClass}
                >
                  <option value="">Not set</option>
                  {attr.values.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.value}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <div className="flex gap-3">
              <label className="block flex-1">
                <span className={labelClass}>Price (₹)</span>
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <label className="block flex-1">
                <span className={labelClass}>MRP (₹)</span>
                <input value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" className={inputClass} placeholder="Optional" />
              </label>
            </div>

            <div className="flex gap-3">
              <label className="block flex-1">
                <span className={labelClass}>Opening stock</span>
                <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={inputClass} />
              </label>
              <label className="block flex-1">
                <span className={labelClass}>Low stock alert at</span>
                <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" className={inputClass} />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>SKU</span>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} placeholder="Optional" />
            </label>

            {actionError && <p className="text-sm font-medium text-rose-700">{actionError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
                {busy ? 'Saving…' : 'Create variant'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.label || `variant #${editing.id}`}`} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            {/* Attribute values are fixed after creation: changing them turns
                the variant into a different one, and orders already reference it. */}
            <p className="text-sm text-slate-500">
              {editing.attributes.map((a) => `${a.name}: ${a.value}`).join(' · ') || 'No attributes recorded.'}
            </p>

            <div className="flex gap-3">
              <label className="block flex-1">
                <span className={labelClass}>Price (₹)</span>
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <label className="block flex-1">
                <span className={labelClass}>MRP (₹)</span>
                <input value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" className={inputClass} />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>SKU</span>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Available to customers
            </label>

            <p className="text-xs text-slate-400">
              Stock is adjusted under Inventory, where every change is recorded with a reason.
            </p>

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
          title="Delete variant"
          message={`Remove ${deleting.label || `variant #${deleting.id}`}? This is refused if its stock is currently held for an open order.`}
          confirmLabel="Delete"
          busy={busy}
          error={actionError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
