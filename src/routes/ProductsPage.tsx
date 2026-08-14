import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';
import type { AdminProduct, AdminProductDetail, AdminVendor, Brand, Category, Paged, PriceTier } from '../lib/types';

function money(cents: number) {
  return `₹${(cents / 100).toFixed(2)}`;
}

function rupeesToCents(rupees: string): number | null {
  const value = Number(rupees);
  if (!rupees.trim() || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function centsToRupees(cents: number): string {
  return (cents / 100).toString();
}

type StatusFilter = 'all' | 'active' | 'inactive';

export default function ProductsPage() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q);
  const [vendorId, setVendorId] = useState('');
  const [category, setCategory] = useState('');
  // '' = all, 'none' = products with no brand set, otherwise a brand id.
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const qs = new URLSearchParams({
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(category ? { category } : {}),
    ...(brandId ? { brandId } : {}),
    ...(status === 'all' ? {} : { status }),
    page: String(page),
  }).toString();

  const { data, loading, error, reload } = useApiData<Paged<AdminProduct>>(`/api/admin/products?${qs}`, [
    debouncedQ,
    vendorId,
    category,
    brandId,
    status,
    page,
  ]);
  const { data: vendors } = useApiData<AdminVendor[]>('/api/admin/vendors');
  const { data: categories } = useApiData<Category[]>('/api/admin/categories');
  const { data: brands } = useApiData<Brand[]>('/api/admin/brands');

  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [formFor, setFormFor] = useState<{ mode: 'create' } | { mode: 'edit'; product: AdminProduct } | null>(null);
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Any filter change invalidates the current page number.
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function toggleActive(product: AdminProduct) {
    setActionError(null);
    setNotice(null);
    setPendingId(product.id);
    try {
      await api.patch(`/api/admin/products/${product.id}`, { isActive: !product.is_active });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update product.');
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    setNotice(null);
    setDeleteError(null);
    setPendingId(deleting.id);
    try {
      const result = await api.delete<{ deleted: boolean; message: string }>(`/api/admin/products/${deleting.id}`);
      setNotice(result?.message ?? 'Product deleted.');
      setDeleting(null);
      // Removing the only row on a trailing page would otherwise strand the admin
      // on an empty page; stepping back re-fetches on its own.
      if (data && data.items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        reload();
      }
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : 'Failed to delete product.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Products</h1>
        <button
          onClick={() => setFormFor({ mode: 'create' })}
          className="btn-primary px-4 py-2 text-sm"
        >
          + Add Product
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => changeFilter(() => setQ(e.target.value))}
          placeholder="Search by name…"
          className="w-64 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        />
        <select
          value={vendorId}
          onChange={(e) => changeFilter(() => setVendorId(e.target.value))}
          className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        >
          <option value="">All vendors</option>
          {(vendors ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.business_name}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => changeFilter(() => setCategory(e.target.value))}
          className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={brandId}
          onChange={(e) => changeFilter(() => setBrandId(e.target.value))}
          className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        >
          <option value="">All brands</option>
          <option value="none">No brand</option>
          {(brands ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => changeFilter(() => setStatus(e.target.value as StatusFilter))}
          className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {notice && <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>}
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && !Array.isArray(data.items) && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The server returned products in an unexpected format (no <code>items</code> list), so this table cannot be
          shown. The deployed API is likely older than this admin build.
        </div>
      )}
      {!loading && !error && data && Array.isArray(data.items) && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Product',
                render: (p) => (
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded-md border border-dashed border-slate-200" />
                    )}
                    <span className="font-medium">{p.name}</span>
                  </div>
                ),
              },
              { header: 'Vendor', render: (p) => p.vendor_name },
              { header: 'Category', render: (p) => p.category ?? '—' },
              {
                header: 'Brand',
                render: (p) => p.brand_name ?? <span className="text-slate-400">—</span>,
              },
              { header: 'Price', render: (p) => money(p.price_cents) },
              { header: 'Stock', render: (p) => p.stock_quantity },
              {
                header: 'Status',
                render: (p) => (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                ),
              },
              {
                header: 'Actions',
                render: (p) => (
                  <div className="flex gap-2">
                    <button
                      disabled={pendingId === p.id}
                      onClick={() => setFormFor({ mode: 'edit', product: p })}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      disabled={pendingId === p.id}
                      onClick={() => toggleActive(p)}
                      className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                        p.is_active
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      disabled={pendingId === p.id}
                      onClick={() => setDeleting(p)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={data.items}
            keyFor={(p) => p.id}
            emptyMessage="No products found."
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {formFor && (
        <ProductFormModal
          product={formFor.mode === 'edit' ? formFor.product : null}
          vendors={vendors ?? []}
          categories={categories ?? []}
          brands={brands ?? []}
          onClose={() => setFormFor(null)}
          onSaved={(message) => {
            setFormFor(null);
            setActionError(null);
            setNotice(message);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete product"
          message={`Delete "${deleting.name}" from ${deleting.vendor_name}? If it appears in past orders it will be deactivated instead, so order history stays intact. Otherwise this cannot be undone.`}
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

interface TierDraft {
  minQuantity: string;
  maxQuantity: string;
  unitPriceRupees: string;
}

interface TierPayload {
  minQuantity: number;
  maxQuantity: number | null;
  unitPriceCents: number;
}

function ProductFormModal({
  product,
  vendors,
  categories,
  brands,
  onClose,
  onSaved,
}: {
  product: AdminProduct | null;
  vendors: AdminVendor[];
  categories: Category[];
  brands: Brand[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = product !== null;
  const [vendorId, setVendorId] = useState(product ? String(product.vendor_id) : '');
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceRupees, setPriceRupees] = useState(product ? centsToRupees(product.price_cents) : '');
  const [stockQuantity, setStockQuantity] = useState(product ? String(product.stock_quantity) : '0');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [brandId, setBrandId] = useState(product?.brand_id ? String(product.brand_id) : '');
  const [gstRatePercent, setGstRatePercent] = useState(product ? String(product.gst_rate_percent) : '0');
  const [moq, setMoq] = useState(product ? String(product.moq) : '1');
  const [isActive, setIsActive] = useState(product ? product.is_active : true);
  const [tiers, setTiers] = useState<TierDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Existing tiers only exist for a product that has already been saved. Saving
  // PUTs the whole tier list, so until this load lands the draft is an empty
  // array that would wipe the product's real tiers — submit stays blocked below.
  const {
    data: detail,
    error: detailError,
    reload: reloadDetail,
  } = useApiData<AdminProductDetail | null>(isEdit ? `/api/admin/products/${product.id}` : '', [product?.id]);
  const tiersReady = !isEdit || detail !== null;
  useEffect(() => {
    if (!detail) return;
    setTiers(
      (detail.tiers ?? []).map((t: PriceTier) => ({
        minQuantity: String(t.min_quantity),
        maxQuantity: t.max_quantity == null ? '' : String(t.max_quantity),
        unitPriceRupees: centsToRupees(t.unit_price_cents),
      }))
    );
  }, [detail]);

  function updateTier(index: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function buildTierPayload(): { error: string | null; payload: TierPayload[] } {
    const payload: TierPayload[] = [];
    for (const t of tiers) {
      const minQuantity = Number(t.minQuantity);
      const unitPriceCents = rupeesToCents(t.unitPriceRupees);
      if (!t.minQuantity.trim() || !Number.isInteger(minQuantity) || minQuantity < 1) {
        return { error: 'Each tier needs a minimum quantity of at least 1.', payload };
      }
      if (unitPriceCents === null) {
        return { error: 'Each tier needs a valid unit price.', payload };
      }
      let maxQuantity: number | null = null;
      if (t.maxQuantity.trim()) {
        maxQuantity = Number(t.maxQuantity);
        if (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity) {
          return { error: 'A tier maximum must be a whole number no smaller than its minimum.', payload };
        }
      }
      payload.push({ minQuantity, maxQuantity, unitPriceCents });
    }

    // The backend stores tiers without checking they form a sane ladder, and the
    // app picks a tier by matching quantity — overlaps make that pick arbitrary.
    const ordered = [...payload].sort((a, b) => a.minQuantity - b.minQuantity);
    for (let i = 0; i < ordered.length; i += 1) {
      const tier = ordered[i];
      const next = ordered[i + 1];
      if (tier.maxQuantity === null && next) {
        return { error: 'Only the highest tier can have a blank maximum.', payload };
      }
      if (next && tier.maxQuantity !== null && next.minQuantity <= tier.maxQuantity) {
        return {
          error: `Tiers overlap: ${tier.minQuantity}–${tier.maxQuantity} and ${next.minQuantity}–${next.maxQuantity ?? '∞'}.`,
          payload,
        };
      }
    }

    return { error: null, payload };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!tiersReady) {
      return setError("Still loading this product's price tiers — wait a moment so saving doesn't clear them.");
    }
    if (!isEdit && !vendorId) return setError('Choose a vendor.');
    if (!name.trim()) return setError('Enter a product name.');

    const priceCents = rupeesToCents(priceRupees);
    if (priceCents === null) return setError('Enter a valid price.');

    const stock = Number(stockQuantity);
    if (!Number.isInteger(stock) || stock < 0) return setError('Stock must be a whole number of 0 or more.');

    const gst = Number(gstRatePercent);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) return setError('GST must be between 0 and 100.');

    const minOrderQty = Number(moq);
    if (!Number.isInteger(minOrderQty) || minOrderQty < 1) return setError('MOQ must be a whole number of 1 or more.');

    const tierResult = buildTierPayload();
    if (tierResult.error) return setError(tierResult.error);

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      priceCents,
      stockQuantity: stock,
      imageUrl: imageUrl.trim() || null,
      category: category || null,
      brandId: brandId ? Number(brandId) : null,
      gstRatePercent: gst,
      moq: minOrderQty,
      isActive,
    };

    setSubmitting(true);
    try {
      // A create that got as far as the product row but failed on tiers must not
      // create a second product when the admin hits Save again.
      const existingId = product?.id ?? createdId;
      const saved = existingId
        ? await api.patch<AdminProduct>(`/api/admin/products/${existingId}`, body)
        : await api.post<AdminProduct>('/api/admin/products', { ...body, vendorId: Number(vendorId) });
      setCreatedId(saved.id);
      await api.put(`/api/admin/products/${saved.id}/tiers`, { tiers: tierResult.payload });
      onSaved(isEdit ? `"${saved.name}" updated.` : `"${saved.name}" created.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

  return (
    <Modal title={isEdit ? 'Edit Product' : 'Add Product'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
            {isEdit ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{product.vendor_name}</div>
            ) : (
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputClass}>
                <option value="">Select a vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.business_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Brand</label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputClass}>
            <option value="">No brand</option>
            {/*
              Deactivated brands are hidden, except the one this product already
              uses — dropping it from the list would silently clear the brand on
              the next save.
            */}
            {brands
              .filter((b) => b.is_active || String(b.id) === brandId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_active ? '' : ' (inactive)'}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Price (₹)</label>
            <input
              value={priceRupees}
              onChange={(e) => setPriceRupees(e.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Stock</label>
            <input
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">GST %</label>
            <input
              value={gstRatePercent}
              onChange={(e) => setGstRatePercent(e.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">MOQ</label>
            <input value={moq} onChange={(e) => setMoq(e.target.value)} inputMode="numeric" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Image URL</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Visible in the app
        </label>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Bulk price tiers</div>
              <div className="text-xs text-slate-500">Leave the maximum blank for an open-ended top tier.</div>
            </div>
            <button
              type="button"
              disabled={!tiersReady}
              onClick={() => setTiers((prev) => [...prev, { minQuantity: '', maxQuantity: '', unitPriceRupees: '' }])}
              className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              + Add tier
            </button>
          </div>
          {isEdit && detailError && (
            <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              <span>Could not load existing tiers, so saving is blocked to avoid clearing them.</span>
              <button type="button" onClick={reloadDetail} className="font-semibold underline">
                Retry
              </button>
            </div>
          )}
          {isEdit && !tiersReady && !detailError && <p className="text-xs text-slate-500">Loading existing tiers…</p>}
          {tiersReady && tiers.length === 0 && (
            <p className="text-xs text-slate-500">No tiers — the base price applies to any quantity.</p>
          )}
          {tiers.map((tier, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              <input
                value={tier.minQuantity}
                onChange={(e) => updateTier(i, { minQuantity: e.target.value })}
                placeholder="Min qty"
                inputMode="numeric"
                className={inputClass}
              />
              <input
                value={tier.maxQuantity}
                onChange={(e) => updateTier(i, { maxQuantity: e.target.value })}
                placeholder="Max qty"
                inputMode="numeric"
                className={inputClass}
              />
              <input
                value={tier.unitPriceRupees}
                onChange={(e) => updateTier(i, { unitPriceRupees: e.target.value })}
                placeholder="Unit ₹"
                inputMode="decimal"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

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
            disabled={submitting || !tiersReady}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
