import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FilterTabs } from '../components/ui/FilterTabs';
import type { AdminVendor } from '../lib/types';

const FILTERS = ['pending', 'approved', 'rejected', 'suspended', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const hasPin = (v: AdminVendor) => v.latitude != null && v.longitude != null;

export default function VendorsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminVendor | null>(null);

  const qs = filter === 'all' ? '' : `?status=${filter}`;
  const { data: vendors, loading, error, reload } = useApiData<AdminVendor[]>(`/api/admin/vendors${qs}`, [filter]);

  async function updateStatus(vendor: AdminVendor, status: 'approved' | 'rejected' | 'suspended') {
    setActionError(null);
    // Approving a vendor with no map pin does nothing useful: nearby search
    // filters on latitude, so the shop stays invisible to every customer.
    if (status === 'approved' && !hasPin(vendor)) {
      setActionError(
        `${vendor.business_name} has no map pin. Add its coordinates under Edit before approving, ` +
          'or customers will never see it.',
      );
      return;
    }
    setPendingId(vendor.id);
    try {
      await api.patch(`/api/admin/vendors/${vendor.id}/status`, { status });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update vendor.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Vendor Approval</h1>
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && vendors && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Business', render: (v) => <span className="font-medium">{v.business_name}</span> },
              { header: 'Owner', render: (v) => `${v.full_name} · ${v.email}` },
              {
                header: 'Location',
                render: (v) => (
                  <div className="space-y-1">
                    <div>{[v.city, v.state].filter(Boolean).join(', ') || '—'}</div>
                    {hasPin(v) ? (
                      <div className="text-xs text-slate-400">
                        {Number(v.latitude).toFixed(4)}, {Number(v.longitude).toFixed(4)}
                      </div>
                    ) : (
                      <span
                        title="Nearby search skips vendors without coordinates — this shop is invisible to customers."
                        className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800"
                      >
                        No map pin
                      </span>
                    )}
                  </div>
                ),
              },
              { header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
              { header: 'Submitted', render: (v) => new Date(v.created_at).toLocaleDateString() },
              {
                header: 'Actions',
                render: (v) => (
                  <div className="flex flex-wrap gap-2">
                    {v.status === 'pending' && (
                      <>
                        <button
                          disabled={pendingId === v.id}
                          onClick={() => updateStatus(v, 'approved')}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={pendingId === v.id}
                          onClick={() => updateStatus(v, 'rejected')}
                          className="rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-[0_6px_16px_-8px_rgba(225,29,72,0.9)] hover:brightness-105 disabled:opacity-50 disabled:shadow-none"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {v.status === 'approved' && (
                      <button
                        disabled={pendingId === v.id}
                        onClick={() => updateStatus(v, 'suspended')}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    )}
                    {v.status === 'suspended' && (
                      <button
                        disabled={pendingId === v.id}
                        onClick={() => updateStatus(v, 'approved')}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Reinstate
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(v)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                  </div>
                ),
              },
            ]}
            rows={vendors}
            keyFor={(v) => v.id}
            emptyMessage="No vendors in this status."
          />
        </div>
      )}

      {editing && (
        <EditVendorModal vendor={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
    </div>
  );
}

function EditVendorModal({
  vendor,
  onClose,
  onSaved,
}: {
  vendor: AdminVendor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessName, setBusinessName] = useState(vendor.business_name);
  const [businessType, setBusinessType] = useState(vendor.business_type);
  const [gstNumber, setGstNumber] = useState(vendor.gst_number ?? '');
  const [addressLine, setAddressLine] = useState(vendor.address_line ?? '');
  const [city, setCity] = useState(vendor.city ?? '');
  const [state, setState] = useState(vendor.state ?? '');
  const [pincode, setPincode] = useState(vendor.pincode ?? '');
  const [latitude, setLatitude] = useState(vendor.latitude != null ? String(vendor.latitude) : '');
  const [longitude, setLongitude] = useState(vendor.longitude != null ? String(vendor.longitude) : '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) {
      setError('Business name is required.');
      return;
    }

    const lat = latitude.trim() === '' ? null : Number(latitude);
    const lng = longitude.trim() === '' ? null : Number(longitude);
    if ((lat === null) !== (lng === null)) {
      setError('Enter both latitude and longitude, or leave both empty.');
      return;
    }
    if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
      setError('Latitude must be a number between -90 and 90.');
      return;
    }
    if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
      setError('Longitude must be a number between -180 and 180.');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/api/admin/vendors/${vendor.id}`, {
        businessName: businessName.trim(),
        businessType,
        gstNumber: gstNumber.trim() || null,
        addressLine: addressLine.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        pincode: pincode.trim() || null,
        latitude: lat,
        longitude: lng,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save vendor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Edit Vendor</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Business Name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as 'b2b' | 'b2c' | 'both')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              >
                <option value="b2c">B2C</option>
                <option value="b2b">B2B</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">GST Number</label>
              <input
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
            <input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">State</label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pincode</label>
              <input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 text-sm font-medium text-slate-700">Map pin</div>
            <p className="mb-2 text-xs text-slate-500">
              Customers only see shops within range of their location. Without coordinates this shop appears in no
              catalogue, no search and no Near Me result.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Latitude</label>
                <input
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  inputMode="decimal"
                  placeholder="9.9252"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Longitude</label>
                <input
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  inputMode="decimal"
                  placeholder="78.1198"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
            {latitude.trim() !== '' && longitude.trim() !== '' && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${latitude.trim()},${longitude.trim()}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-brand-navy hover:underline"
              >
                Check this pin on the map →
              </a>
            )}
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
              disabled={submitting}
              className="btn-primary px-4 py-2 text-sm"
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
