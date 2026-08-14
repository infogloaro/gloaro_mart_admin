import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { VendorPicker } from '../components/ui/VendorPicker';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { AdminVendor, VendorServiceArea } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/vendors/:id/service-areas',
  'POST   /api/admin/vendors/:id/service-areas',
  'DELETE /api/admin/vendors/:id/service-areas/:areaId',
];

export default function ServiceAreasPage() {
  const [vendor, setVendor] = useState<AdminVendor | null>(null);
  const [areaType, setAreaType] = useState<'radius' | 'pincode'>('radius');
  const [radiusKm, setRadiusKm] = useState('5');
  const [pincode, setPincode] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<VendorServiceArea | null>(null);

  const {
    data: areas,
    loading,
    error,
    reload,
  } = useApiData<VendorServiceArea[]>(vendor ? `/api/admin/vendors/${vendor.id}/service-areas` : '', [vendor?.id]);

  // A radius rule is measured from the shop's map pin — without one it can never match.
  const missingPin = vendor != null && (vendor.latitude == null || vendor.longitude == null);

  async function addArea(e: FormEvent) {
    e.preventDefault();
    if (!vendor) return;
    setActionError(null);

    if (areaType === 'radius') {
      const km = Number(radiusKm);
      if (!Number.isFinite(km) || km <= 0) {
        setActionError('Enter a service radius greater than zero.');
        return;
      }
    } else if (!/^\d{6}$/.test(pincode.trim())) {
      setActionError('Enter a valid 6-digit pincode.');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/admin/vendors/${vendor.id}/service-areas`, {
        areaType,
        radiusKm: areaType === 'radius' ? Number(radiusKm) : undefined,
        pincode: areaType === 'pincode' ? pincode.trim() : undefined,
      });
      setPincode('');
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to add service area.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!vendor || !deleting) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/vendors/${vendor.id}/service-areas/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to remove service area.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Service Areas</h1>
        <p className="text-sm text-slate-500">
          Where each vendor can deliver. Checkout runs these rules against the customer's address before an order is
          allowed.
        </p>
      </div>

      <VendorPicker value={vendor} onChange={setVendor} />

      {!vendor && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="map" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">Select a vendor above to configure its service areas.</p>
        </div>
      )}

      {vendor && (
        <>
          {missingPin && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{vendor.business_name} has no map pin.</span> Radius rules are measured
                from the shop's coordinates, so they will never match. Add coordinates under Vendors → Edit, or use
                pincode rules instead.
              </span>
            </div>
          )}

          {actionError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              {actionError}
            </div>
          )}

          <form onSubmit={addArea} className="card p-4">
            <h2 className="mb-3 text-sm font-bold text-ink">Add a rule</h2>
            <div className="mb-3 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {(['radius', 'pincode'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAreaType(t)}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                    areaType === t
                      ? 'bg-gradient-to-r from-emerald to-mint text-white'
                      : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                  }`}
                >
                  {t === 'radius' ? 'Delivery radius' : 'Pincode'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {areaType === 'radius' ? (
                <label className="block w-48">
                  <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                    Radius (km)
                  </span>
                  <input
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(e.target.value)}
                    inputMode="decimal"
                    className={inputClass}
                  />
                </label>
              ) : (
                <label className="block w-48">
                  <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                    Pincode
                  </span>
                  <input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="625020"
                    className={inputClass}
                  />
                </label>
              )}
              <button type="submit" disabled={saving} className="btn-primary px-4 py-2.5 text-sm">
                {saving ? 'Saving…' : 'Add rule'}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              A vendor serves an address if <span className="font-semibold text-slate-500">any</span> rule matches.
              Radius needs the customer's coordinates; pincode works without them.
            </p>
          </form>

          {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

          {error &&
            (isMissingEndpoint(error) ? (
              <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Sprint 1 service-area" />
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                {error}
              </div>
            ))}

          {!loading && !error && areas && (
            <div className="card overflow-hidden">
              <DataTable
                rows={areas}
                keyFor={(a) => a.id}
                emptyMessage="No service areas yet — this vendor cannot deliver anywhere."
                columns={[
                  {
                    header: 'Type',
                    render: (a) => (
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        <Icon
                          name={a.area_type === 'radius' ? 'map' : 'mappin'}
                          className="h-4 w-4 text-emerald"
                        />
                        {a.area_type === 'radius' ? 'Radius' : 'Pincode'}
                      </span>
                    ),
                  },
                  {
                    header: 'Covers',
                    render: (a) =>
                      a.area_type === 'radius' ? (
                        <span className="tabular-nums">{Number(a.radius_km ?? 0).toFixed(1)} km from the shop</span>
                      ) : (
                        <span className="font-mono tabular-nums">{a.pincode}</span>
                      ),
                  },
                  {
                    header: '',
                    className: 'text-right',
                    render: (a) => (
                      <button
                        onClick={() => setDeleting(a)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title="Remove service area"
          message={
            deleting.area_type === 'radius'
              ? `Remove the ${Number(deleting.radius_km ?? 0).toFixed(1)} km radius rule? Customers outside any remaining rule will no longer be able to order from this vendor.`
              : `Remove pincode ${deleting.pincode}? Customers there will no longer be able to order from this vendor.`
          }
          confirmLabel="Remove"
          busy={saving}
          error={actionError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
