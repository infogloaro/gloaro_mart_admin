import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import type { PlatformCoupon } from '../lib/types';

function money(value: string | number) {
  return typeof value === 'string' ? parseFloat(value) : value;
}

export default function OffersPage() {
  const { data: coupons, loading, error, reload } = useApiData<PlatformCoupon[]>('/api/admin/coupons');
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const value = parseFloat(discountValue);
    if (!code.trim() || Number.isNaN(value) || value <= 0) {
      setFormError('Enter a valid code and discount value.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/admin/coupons', {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: value,
        minOrderValueCents: Math.round((parseFloat(minOrderValue) || 0) * 100),
      });
      setCode('');
      setDiscountValue('');
      setMinOrderValue('0');
      setShowForm(false);
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to create offer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(coupon: PlatformCoupon) {
    setActionError(null);
    try {
      await api.patch(`/api/admin/coupons/${coupon.id}`, { isActive: !coupon.is_active });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update offer.');
    }
  }

  async function deleteCoupon(coupon: PlatformCoupon) {
    setActionError(null);
    try {
      await api.delete(`/api/admin/coupons/${coupon.id}`);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete offer.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Platform Offers</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="btn-primary px-4 py-2 text-sm"
        >
          {showForm ? 'Cancel' : '+ New Offer'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Coupon Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="WELCOME10"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'flat')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat Amount</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {discountType === 'percentage' ? 'Discount (%)' : 'Discount (₹)'}
              </label>
              <input
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? '10' : '100'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Min Order Value (₹)</label>
              <input
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{formError}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Creating…' : 'Create Offer'}
          </button>
        </form>
      )}

      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && coupons && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.length === 0 && <p className="text-sm text-slate-500">No platform offers yet.</p>}
          {coupons.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-brand-navy">{c.code}</div>
                  <div className="text-sm text-slate-500">
                    {c.discount_type === 'flat' ? `₹${money(c.discount_value)} off` : `${money(c.discount_value)}% off`}
                  </div>
                  {c.expires_at && (
                    <div className="mt-1 text-xs text-slate-400">
                      Expires {new Date(c.expires_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => toggleActive(c)}
                  className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  {c.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteCoupon(c)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
