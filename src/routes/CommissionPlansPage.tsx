import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type { AdminVendor, Category, CommissionPlan, CommissionScope } from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/commission-plans',
  'POST   /api/admin/commission-plans',
  'PATCH  /api/admin/commission-plans/:id',
  'DELETE /api/admin/commission-plans/:id',
  'GET    /api/admin/commission-plans/resolve',
];

const SCOPE_LABEL: Record<CommissionScope, string> = {
  vendor: 'Vendor',
  category: 'Category',
  global: 'Platform',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

function rupees(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}

export default function CommissionPlansPage() {
  const can = useCan('commission_plans');
  const { data: plans, loading, error, reload } = useApiData<CommissionPlan[]>('/api/admin/commission-plans');
  const { data: categories } = useApiData<Category[]>('/api/admin/categories');
  const { data: vendors } = useApiData<AdminVendor[]>('/api/admin/vendors');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CommissionPlan | null>(null);
  const [deleting, setDeleting] = useState<CommissionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create form
  const [scope, setScope] = useState<CommissionScope>('vendor');
  const [targetId, setTargetId] = useState('');
  const [percent, setPercent] = useState('10');
  const [flatFee, setFlatFee] = useState('0');
  const [notes, setNotes] = useState('');

  // Effective-rate preview
  const [previewVendor, setPreviewVendor] = useState('');
  const [previewCategory, setPreviewCategory] = useState('');
  const [preview, setPreview] = useState<CommissionPlan | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function resetForm() {
    setScope('vendor');
    setTargetId('');
    setPercent('10');
    setFlatFee('0');
    setNotes('');
    setActionError(null);
  }

  async function createPlan(e: FormEvent) {
    e.preventDefault();
    setActionError(null);

    if (scope !== 'global' && !targetId) {
      setActionError(`Choose a ${scope} for this rule.`);
      return;
    }
    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setActionError('Commission must be between 0 and 100 percent.');
      return;
    }
    // Rupees in the field, cents on the wire — the API stores an integer so a
    // fractional rupee cannot round differently on two screens.
    const feeCents = Math.round(Number(flatFee || '0') * 100);
    if (!Number.isFinite(feeCents) || feeCents < 0) {
      setActionError('Flat fee cannot be negative.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/api/admin/commission-plans', {
        scope,
        categoryId: scope === 'category' ? Number(targetId) : undefined,
        vendorId: scope === 'vendor' ? Number(targetId) : undefined,
        commissionPercent: pct,
        flatFeeCents: feeCents,
        notes: notes.trim() || undefined,
      });
      setCreating(false);
      resetForm();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not create the plan.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setActionError(null);

    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setActionError('Commission must be between 0 and 100 percent.');
      return;
    }

    setBusy(true);
    try {
      await api.patch(`/api/admin/commission-plans/${editing.id}`, {
        commissionPercent: pct,
        flatFeeCents: Math.round(Number(flatFee || '0') * 100),
        notes: notes.trim() || undefined,
      });
      setEditing(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save the plan.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(plan: CommissionPlan) {
    setActionError(null);
    try {
      await api.patch(`/api/admin/commission-plans/${plan.id}`, { isActive: !plan.is_active });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not change the plan.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/commission-plans/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the plan.');
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    setPreviewError(null);
    setPreview(null);
    const params = new URLSearchParams();
    if (previewVendor) params.set('vendorId', previewVendor);
    if (previewCategory) params.set('categoryId', previewCategory);
    try {
      setPreview(await api.get<CommissionPlan>(`/api/admin/commission-plans/resolve?${params}`));
    } catch (err) {
      setPreviewError(err instanceof ApiError ? err.message : 'Could not resolve a rate.');
    }
  }

  function openEdit(plan: CommissionPlan) {
    setEditing(plan);
    setPercent(String(plan.commission_percent));
    setFlatFee((plan.flat_fee_cents / 100).toFixed(2));
    setNotes(plan.notes ?? '');
    setActionError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Commission Plans</h1>
          <p className="text-sm text-slate-500">
            What the platform keeps from a sale. The most specific rule wins — a vendor rule beats a category rule,
            which beats the platform rate.
          </p>
        </div>
        {can.edit && (
          <button onClick={() => { resetForm(); setCreating(true); }} className="btn-primary px-4 py-2.5 text-sm">
            Add plan
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
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 9 commission" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && plans && (
        <>
          <div className="card overflow-hidden">
            <DataTable
              rows={plans}
              keyFor={(p) => p.id}
              emptyMessage="No commission plans configured."
              columns={[
                {
                  header: 'Scope',
                  render: (p) => (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <Icon
                        name={p.scope === 'vendor' ? 'store' : p.scope === 'category' ? 'grid' : 'network'}
                        className="h-4 w-4 text-emerald"
                      />
                      {SCOPE_LABEL[p.scope]}
                    </span>
                  ),
                },
                {
                  header: 'Applies to',
                  render: (p) =>
                    p.vendor_name ?? p.category_name ?? <span className="text-slate-500">Every sale</span>,
                },
                {
                  header: 'Commission',
                  className: 'text-right tabular-nums',
                  render: (p) => <span className="font-semibold text-ink">{p.commission_percent}%</span>,
                },
                {
                  header: 'Flat fee',
                  className: 'text-right tabular-nums',
                  render: (p) =>
                    p.flat_fee_cents > 0 ? rupees(p.flat_fee_cents) : <span className="text-slate-400">—</span>,
                },
                {
                  header: 'Status',
                  render: (p) =>
                    can.edit ? (
                      <button
                        onClick={() => toggleActive(p)}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          p.is_active
                            ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.is_active ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          p.is_active
                            ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    ),
                },
                {
                  header: '',
                  className: 'text-right',
                  render: (p) => (
                    <div className="flex justify-end gap-2">
                      {can.edit && (
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
                        >
                          Edit
                        </button>
                      )}
                      {/* The platform rule is the fallback resolution ends at,
                          so the API refuses to delete it — no button for it. */}
                      {can.delete && p.scope !== 'global' && (
                        <button
                          onClick={() => setDeleting(p)}
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
            <h2 className="mb-1 text-sm font-bold text-ink">Effective rate</h2>
            <p className="mb-3 text-xs text-slate-400">
              Check which rule actually applies before trusting the table — precedence is easy to get wrong by eye.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-56">
                <span className={labelClass}>Vendor</span>
                <select value={previewVendor} onChange={(e) => setPreviewVendor(e.target.value)} className={inputClass}>
                  <option value="">Any vendor</option>
                  {(vendors ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.business_name}</option>
                  ))}
                </select>
              </label>
              <label className="block w-56">
                <span className={labelClass}>Category</span>
                <select
                  value={previewCategory}
                  onChange={(e) => setPreviewCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any category</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <button onClick={runPreview} className="btn-primary px-4 py-2.5 text-sm">
                Resolve
              </button>
            </div>

            {previewError && <p className="mt-3 text-sm font-medium text-rose-700">{previewError}</p>}
            {preview && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald/25 bg-mint-mist px-4 py-3 text-sm">
                <span className="text-[22px] leading-none font-extrabold text-ink tabular-nums">
                  {preview.commission_percent}%
                </span>
                {preview.flat_fee_cents > 0 && (
                  <span className="font-semibold text-slate-600">+ {rupees(preview.flat_fee_cents)}</span>
                )}
                <span className="text-slate-500">
                  from the <span className="font-semibold">{SCOPE_LABEL[preview.scope].toLowerCase()}</span> rule
                  {preview.vendor_name || preview.category_name
                    ? ` for ${preview.vendor_name ?? preview.category_name}`
                    : ''}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {creating && (
        <Modal title="Add commission plan" onClose={() => setCreating(false)}>
          <form onSubmit={createPlan} className="space-y-3">
            <label className="block">
              <span className={labelClass}>Scope</span>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as CommissionScope);
                  setTargetId('');
                }}
                className={inputClass}
              >
                <option value="vendor">Vendor — one shop</option>
                <option value="category">Category — all vendors in it</option>
                <option value="global">Platform — the fallback</option>
              </select>
            </label>

            {scope === 'vendor' && (
              <label className="block">
                <span className={labelClass}>Vendor</span>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputClass}>
                  <option value="">Choose a vendor…</option>
                  {(vendors ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.business_name}</option>
                  ))}
                </select>
              </label>
            )}

            {scope === 'category' && (
              <label className="block">
                <span className={labelClass}>Category</span>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputClass}>
                  <option value="">Choose a category…</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex gap-3">
              <label className="block flex-1">
                <span className={labelClass}>Commission %</span>
                <input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <label className="block flex-1">
                <span className={labelClass}>Flat fee (₹)</span>
                <input value={flatFee} onChange={(e) => setFlatFee(e.target.value)} inputMode="decimal" className={inputClass} />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Notes</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
            </label>

            {actionError && <p className="text-sm font-medium text-rose-700">{actionError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
                {busy ? 'Saving…' : 'Create plan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${SCOPE_LABEL[editing.scope].toLowerCase()} plan`} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <p className="text-sm text-slate-500">
              {editing.vendor_name ?? editing.category_name ?? 'Applies to every sale without a more specific rule.'}
            </p>
            <div className="flex gap-3">
              <label className="block flex-1">
                <span className={labelClass}>Commission %</span>
                <input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <label className="block flex-1">
                <span className={labelClass}>Flat fee (₹)</span>
                <input value={flatFee} onChange={(e) => setFlatFee(e.target.value)} inputMode="decimal" className={inputClass} />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Notes</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
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
          title="Delete commission plan"
          message={`Remove the rule for ${deleting.vendor_name ?? deleting.category_name}? Sales that matched it will fall back to the next most specific rule.`}
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
