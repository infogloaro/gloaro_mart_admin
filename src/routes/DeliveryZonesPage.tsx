import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Icon } from '../components/ui/Icon';
import { VendorPicker } from '../components/ui/VendorPicker';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type { AdminVendor, VendorDeliveryRules } from '../lib/types';

const ENDPOINTS = [
  'GET /api/admin/vendors/:id/delivery-settings',
  'PUT /api/admin/vendors/:id/delivery-settings',
];

/** Money crosses the wire as integer paise; the form works in rupees. */
function toRupees(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

function toCents(rupees: string): number | null {
  const trimmed = rupees.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** 'HH:MM:SS' from Postgres TIME, but <input type="time"> only accepts 'HH:MM'. */
function toTimeInput(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 5);
}

interface FormState {
  supportsDelivery: boolean;
  supportsPickup: boolean;
  deliveryCharge: string;
  freeDeliveryAbove: string;
  minOrder: string;
  preparationMinutes: string;
  opensAt: string;
  closesAt: string;
}

const BLANK: FormState = {
  supportsDelivery: true,
  supportsPickup: false,
  deliveryCharge: '0.00',
  freeDeliveryAbove: '',
  minOrder: '0.00',
  preparationMinutes: '30',
  opensAt: '',
  closesAt: '',
};

export default function DeliveryZonesPage() {
  const can = useCan('vendors');
  const [vendor, setVendor] = useState<AdminVendor | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, loading, error, reload } = useApiData<VendorDeliveryRules>(
    vendor ? `/api/admin/vendors/${vendor.id}/delivery-settings` : '',
    [vendor?.id],
  );

  // Seed the form once the vendor's saved rules arrive, and reset it between vendors
  // so one shop's settings can never be saved onto another.
  useEffect(() => {
    if (!vendor) {
      setForm(BLANK);
      return;
    }
    if (!data) return;
    setForm({
      supportsDelivery: data.supports_delivery,
      supportsPickup: data.supports_pickup,
      deliveryCharge: toRupees(data.delivery_charge_cents),
      freeDeliveryAbove: toRupees(data.free_delivery_above_cents),
      minOrder: toRupees(data.min_order_cents),
      preparationMinutes: String(data.preparation_minutes ?? 30),
      opensAt: toTimeInput(data.opens_at),
      closesAt: toTimeInput(data.closes_at),
    });
  }, [data, vendor]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!vendor) return;
    setActionError(null);

    const deliveryChargeCents = toCents(form.deliveryCharge);
    const minOrderCents = toCents(form.minOrder);
    const freeDeliveryAboveCents = toCents(form.freeDeliveryAbove);
    const preparationMinutes = Number(form.preparationMinutes);

    if (deliveryChargeCents === null) return setActionError('Enter a valid delivery charge.');
    if (minOrderCents === null) return setActionError('Enter a valid minimum order value.');
    if (!Number.isFinite(preparationMinutes) || preparationMinutes < 0) {
      return setActionError('Enter a valid preparation time in minutes.');
    }
    if (!form.supportsDelivery && !form.supportsPickup) {
      return setActionError('A vendor must support delivery, pickup, or both — otherwise it can take no orders.');
    }
    if (Boolean(form.opensAt) !== Boolean(form.closesAt)) {
      return setActionError('Set both opening and closing time, or leave both blank for always open.');
    }

    setSaving(true);
    try {
      await api.put(`/api/admin/vendors/${vendor.id}/delivery-settings`, {
        supportsDelivery: form.supportsDelivery,
        supportsPickup: form.supportsPickup,
        deliveryChargeCents,
        freeDeliveryAboveCents,
        minOrderCents,
        preparationMinutes,
        opensAt: form.opensAt || null,
        closesAt: form.closesAt || null,
      });
      setSaved(true);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to save delivery settings.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
  const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Delivery Zones &amp; Rules</h1>
        <p className="text-sm text-slate-500">
          Charges, thresholds and store hours per vendor. Checkout calculates the delivery fee from these values instead
          of hardcoding it.
        </p>
      </div>

      <VendorPicker value={vendor} onChange={setVendor} />

      {!vendor && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="truck" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">Select a vendor above to configure its delivery rules.</p>
        </div>
      )}

      {vendor && loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {vendor &&
        error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Sprint 1 delivery-settings" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {vendor && !loading && !error && (
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={!can.edit} className="space-y-4">
          {!can.edit && (
            <p className="text-xs text-slate-400">View only — your role cannot change delivery settings.</p>
          )}
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                <Icon name="truck" className="h-3.5 w-3.5" />
              </span>
              Fulfilment methods
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { key: 'supportsDelivery', label: 'Delivery', hint: 'Vendor delivers to the customer', icon: 'bike' },
                  { key: 'supportsPickup', label: 'Store pickup', hint: 'Customer collects from the shop', icon: 'store' },
                ] as const
              ).map((opt) => {
                const on = form[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => set(opt.key, !on)}
                    className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                      on
                        ? 'border-emerald bg-mint-mist'
                        : 'border-slate-200 hover:-translate-y-0.5 hover:border-mint-soft'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        on ? 'bg-emerald text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Icon name={opt.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-ink">{opt.label}</span>
                      <span className="text-[11px] text-slate-500">{opt.hint}</span>
                    </span>
                    <span
                      className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
                        on ? 'bg-emerald' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                          on ? 'translate-x-4' : ''
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                <Icon name="coins" className="h-3.5 w-3.5" />
              </span>
              Charges &amp; thresholds
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Delivery charge (₹)</span>
                <input
                  value={form.deliveryCharge}
                  onChange={(e) => set('deliveryCharge', e.target.value)}
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Free delivery above (₹)</span>
                <input
                  value={form.freeDeliveryAbove}
                  onChange={(e) => set('freeDeliveryAbove', e.target.value)}
                  inputMode="decimal"
                  placeholder="No free delivery"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Minimum order (₹)</span>
                <input
                  value={form.minOrder}
                  onChange={(e) => set('minOrder', e.target.value)}
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Leave <span className="font-semibold text-slate-500">Free delivery above</span> blank to always charge.
              Orders below the minimum are rejected at checkout with{' '}
              <span className="font-mono text-slate-500">BELOW_MIN_ORDER</span>.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                <Icon name="clock" className="h-3.5 w-3.5" />
              </span>
              Timing
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Preparation time (min)</span>
                <input
                  value={form.preparationMinutes}
                  onChange={(e) => set('preparationMinutes', e.target.value)}
                  inputMode="numeric"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Opens at</span>
                <input
                  type="time"
                  value={form.opensAt}
                  onChange={(e) => set('opensAt', e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Closes at</span>
                <input
                  type="time"
                  value={form.closesAt}
                  onChange={(e) => set('closesAt', e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Preparation time feeds the delivery ETA. Leave both hours blank if the shop has no fixed timings.
            </p>
          </section>

          {actionError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              {actionError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2.5 text-sm">
              {saving ? 'Saving…' : 'Save delivery settings'}
            </button>
            {saved && !saving && (
              <span className="animate-fade-in inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <Icon name="shield" className="h-4 w-4" />
                Saved for {vendor.business_name}
              </span>
            )}
          </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
