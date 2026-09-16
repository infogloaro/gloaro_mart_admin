import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useCan } from '../lib/staffContext';
import type { FeatureFlag } from '../lib/types';

const KEY_PATTERN = /^[a-z][a-z0-9_.-]{1,99}$/;

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeatureFlagsPage() {
  const can = useCan('feature_flags');
  const { data: flags, loading, error, reload } = useApiData<FeatureFlag[]>('/api/admin/feature-flags');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggle(flag: FeatureFlag) {
    setActionError(null);
    try {
      await api.patch(`/api/admin/feature-flags/${flag.id}`, { enabled: !flag.enabled });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not change the flag.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/feature-flags/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the flag.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Feature Flags</h1>
          <p className="text-sm text-slate-500">
            Toggle marketplace features without shipping a new build. A flag with nothing checking it yet does
            nothing — it exists here only once the app or API actually reads it.
          </p>
        </div>
        {can.edit && (
          <button onClick={() => setCreating(true)} className="btn-primary px-4 py-2.5 text-sm">
            Add flag
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && flags && (
        <div className="card overflow-hidden">
          <DataTable
            rows={flags}
            keyFor={(f) => f.id}
            emptyMessage="No feature flags yet."
            columns={[
              {
                header: 'Key',
                render: (f) => (
                  <div>
                    <div className="font-mono text-[13px] font-semibold text-ink">{f.flag_key}</div>
                    {f.description && <div className="text-xs text-slate-500">{f.description}</div>}
                  </div>
                ),
              },
              {
                header: 'Status',
                render: (f) =>
                  can.edit ? (
                    <button
                      onClick={() => toggle(f)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                        f.enabled
                          ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                          : 'border-slate-200 bg-slate-100 text-slate-500'
                      }`}
                    >
                      {f.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  ) : (
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                        f.enabled
                          ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                          : 'border-slate-200 bg-slate-100 text-slate-500'
                      }`}
                    >
                      {f.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  ),
              },
              {
                header: 'Last changed',
                render: (f) => <span className="text-xs text-slate-400">{formatWhen(f.updated_at)}</span>,
              },
              {
                header: '',
                className: 'text-right',
                render: (f) => (
                  <div className="flex justify-end gap-2">
                    {can.edit && (
                      <button
                        onClick={() => setEditing(f)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
                      >
                        Edit
                      </button>
                    )}
                    {can.delete && (
                      <button
                        onClick={() => setDeleting(f)}
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
      )}

      {creating && (
        <FlagDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}

      {editing && (
        <FlagDialog
          flag={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete feature flag"
          message={`Delete '${deleting.flag_key}'? Anything still checking this key will fall back to its default — off.`}
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

function FlagDialog({
  flag,
  onClose,
  onSaved,
}: {
  flag?: FeatureFlag;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = flag != null;
  const [key, setKey] = useState(flag?.flag_key ?? '');
  const [description, setDescription] = useState(flag?.description ?? '');
  const [enabled, setEnabled] = useState(flag?.enabled ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEdit && !KEY_PATTERN.test(key.trim())) {
      setError('Key must be lowercase letters, numbers, dots, hyphens or underscores, starting with a letter.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/api/admin/feature-flags/${flag.id}`, { enabled, description: description.trim() });
      } else {
        await api.post('/api/admin/feature-flags', { key: key.trim(), description: description.trim() || undefined, enabled });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the flag.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${flag.flag_key}` : 'Add flag'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className={labelClass}>Key</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={isEdit}
            placeholder="e.g. checkout.express_lane"
            className={`${inputClass} font-mono disabled:bg-slate-100 disabled:text-slate-400`}
          />
          {isEdit && (
            <span className="mt-1 block text-[11px] text-slate-400">
              Not editable — whatever reads this key would silently stop matching.
            </span>
          )}
        </label>

        <label className="block">
          <span className={labelClass}>Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this turns on or off"
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>

        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2.5 text-sm">
            {submitting ? 'Saving…' : isEdit ? 'Save' : 'Create flag'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
