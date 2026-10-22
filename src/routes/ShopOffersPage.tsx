import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Modal } from '../components/ui/Modal';
import { useCan } from '../lib/staffContext';

/** A shop's public coupon (GET /api/admin/coupons/shop, SB6b). */
interface ShopCoupon {
  id: number;
  code: string;
  title: string | null;
  discountType: 'percentage' | 'flat' | 'free_delivery';
  discountValue: number;
  minOrderCents: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  maxUses: number | null;
  used: number;
  newCustomersOnly: boolean;
  hidden: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  hiddenBy: string | null;
  shop: { id: number; name: string; city: string | null; status: string };
}

interface CouponList {
  items: ShopCoupon[];
  total: number;
  pageSize: number;
  counts: { listed: number; hidden: number };
}

const FILTERS = ['listed', 'hidden', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
function offer(c: ShopCoupon) {
  if (c.discountType === 'free_delivery') return 'Free delivery';
  // Shops' flat coupon values are stored in rupees.
  return c.discountType === 'percentage' ? `${c.discountValue}% off` : `₹${c.discountValue} off`;
}

/**
 * Offers & Coupons → Shop offers: the coupons shops list in the app's offers
 * hub. Hide a misleading or wrong one with a reason (the shop is notified and
 * can't list it again until you show it); its code keeps working for anyone
 * who has it, like a private coupon.
 */
export default function ShopOffersPage() {
  const can = useCan('offers');
  const [filter, setFilter] = useState<Filter>('listed');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hiding, setHiding] = useState<ShopCoupon | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const qs = new URLSearchParams({ status: filter, page: String(page), ...(search ? { q: search } : {}) }).toString();
  const { data, loading, error, reload } = useApiData<CouponList>(`/api/admin/coupons/shop?${qs}`, [filter, search, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function show(c: ShopCoupon) {
    setActionError(null);
    setBusy(c.id);
    try {
      await api.patch(`/api/admin/coupons/shop/${c.id}`, { hidden: false });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to show the coupon.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Shop offers</h1>
        <p className="text-sm text-slate-500">
          Coupons shops list in the app's offers hub. Hidden ones leave the hub and follower alerts; the shop sees why.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs options={FILTERS} value={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
        {data && <span className="text-xs text-slate-500">{data.counts.listed} listed · {data.counts.hidden} hidden</span>}
        <form
          className="ml-auto"
          onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, title or shop"
            className="w-60 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          />
        </form>
      </div>
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Coupon',
                render: (c) => (
                  <div>
                    <div className="font-mono font-semibold">{c.code}</div>
                    {c.title && <div className="text-xs text-slate-500">{c.title}</div>}
                  </div>
                ),
              },
              { header: 'Shop', render: (c) => <span>{c.shop.name}<br /><span className="text-xs text-slate-400">{c.shop.city ?? ''}</span></span> },
              {
                header: 'Offer',
                render: (c) => (
                  <div className="text-xs">
                    <div className="text-sm font-semibold text-slate-800">{offer(c)}</div>
                    {c.minOrderCents ? <div>on orders of {rupees(c.minOrderCents)}+</div> : null}
                    {c.newCustomersOnly && <div>first order only</div>}
                  </div>
                ),
              },
              { header: 'Used', render: (c) => (c.maxUses != null ? `${c.used} of ${c.maxUses}` : c.used) },
              {
                header: 'Runs',
                render: (c) => (
                  <span className="text-xs">
                    {c.startsAt ? `from ${new Date(c.startsAt).toLocaleDateString()} ` : ''}
                    {c.expiresAt ? `until ${new Date(c.expiresAt).toLocaleString()}` : 'no end date'}
                    {!c.isActive && <span className="ml-1 font-semibold text-slate-500">(switched off by the shop)</span>}
                  </span>
                ),
              },
              {
                header: 'Status',
                render: (c) =>
                  c.hidden ? (
                    <div className="max-w-xs text-xs">
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">Hidden</span>
                      <div className="mt-1 text-slate-600">{c.hiddenReason}</div>
                      <div className="text-slate-400">{c.hiddenBy ?? ''}{c.hiddenAt ? ` · ${new Date(c.hiddenAt).toLocaleDateString()}` : ''}</div>
                    </div>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Listed</span>
                  ),
              },
              {
                header: 'Actions',
                render: (c) =>
                  can.edit ? (
                    c.hidden ? (
                      <button
                        disabled={busy === c.id}
                        onClick={() => show(c)}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Show again
                      </button>
                    ) : (
                      <button
                        onClick={() => setHiding(c)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                      >
                        Hide
                      </button>
                    )
                  ) : null,
              },
            ]}
            rows={data.items}
            keyFor={(c) => c.id}
            emptyMessage={filter === 'hidden' ? 'No hidden shop coupons.' : 'No shop coupons listed.'}
          />
        </div>
      )}
      {data && pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md bg-slate-100 px-3 py-1 disabled:opacity-40">Previous</button>
          <span className="text-slate-500">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md bg-slate-100 px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      )}
      {hiding && <HideModal coupon={hiding} onClose={() => setHiding(null)} onDone={() => { setHiding(null); reload(); }} />}
    </div>
  );
}

function HideModal({ coupon, onClose, onDone }: { coupon: ShopCoupon; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    if (!reason.trim()) {
      setError('Say why it is hidden; the shop sees this.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/admin/coupons/shop/${coupon.id}`, { hidden: true, reason: reason.trim() });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to hide the coupon.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Hide ${coupon.code} — ${coupon.shop.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          It leaves the offers hub and follower alerts, and the shop is notified with your reason. The code keeps working
          for customers who already have it.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Reason (shown to the shop)"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        />
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md bg-slate-100 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? 'Hiding…' : 'Hide coupon'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
