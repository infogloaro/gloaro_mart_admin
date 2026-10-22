import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useStaffMe } from '../lib/staffContext';
import { Modal } from '../components/ui/Modal';
import type { ApprovalRequest, ApprovalRule, ApprovalStatus } from '../lib/types';

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

const FILTERS: { value: ApprovalStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: '', label: 'All' },
];

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Sensitive changes held for a super admin. Super admins see every request,
 * decide them and set which actions need approval; everyone else sees their
 * own requests and can withdraw them.
 */
export default function ApprovalsPage() {
  const me = useStaffMe();
  const isSuperAdmin = me?.isSuperAdmin === true;
  const [filter, setFilter] = useState<ApprovalStatus | ''>('pending');
  const requests = useApiData<ApprovalRequest[]>(`/api/admin/approvals${filter ? `?status=${filter}` : ''}`, [filter]);
  const [deciding, setDeciding] = useState<{ request: ApprovalRequest; decision: 'approve' | 'reject' } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function cancel(r: ApprovalRequest) {
    setNotice(null);
    try {
      await api.post(`/api/admin/approvals/${r.id}/cancel`);
      setNotice({ tone: 'ok', text: 'Request withdrawn.' });
      requests.reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not cancel the request.' });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Approvals</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          {isSuperAdmin
            ? 'Sensitive changes from your team wait here until you approve them. Approving applies the change exactly as requested, checked again against how things are now.'
            : 'Changes you made that need a super admin’s approval. They take effect only once approved.'}
        </p>
      </div>

      {isSuperAdmin && <RulesCard onChanged={requests.reload} />}

      {notice && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
            notice.tone === 'ok'
              ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
              filter === f.value ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {requests.loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {requests.error && <p className="text-sm font-medium text-rose-600">{requests.error}</p>}
      {!requests.loading && requests.data?.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-500">
          {filter === 'pending' ? 'Nothing is waiting for approval.' : 'No requests yet.'}
        </div>
      )}

      <div className="space-y-3">
        {requests.data?.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[r.status]}`}>
                    {r.status === 'pending' ? 'Waiting' : r.status}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{r.action_label}</span>
                </div>
                <div className="mt-1.5 font-bold text-ink">{r.summary}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Asked by {r.requested_by_name ?? r.requested_by_email ?? 'a removed user'} · {formatWhen(r.created_at)}
                </div>
                <Details details={r.details} />
                {r.decided_at && (
                  <div className="mt-2 text-xs text-slate-500">
                    {r.status === 'cancelled' ? 'Withdrawn' : `${r.status === 'failed' ? 'Approved but not applied' : r.status === 'approved' ? 'Approved' : 'Rejected'} by ${r.decided_by_name ?? 'a super admin'}`}{' '}
                    · {formatWhen(r.decided_at)}
                    {r.decision_note && <span className="text-slate-600"> — “{r.decision_note}”</span>}
                    {r.status === 'failed' && r.result_message && <div className="font-medium text-rose-600">{r.result_message}</div>}
                  </div>
                )}
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  {isSuperAdmin && (
                    <>
                      <button
                        onClick={() => setDeciding({ request: r, decision: 'reject' })}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                      >
                        Reject
                      </button>
                      <button onClick={() => setDeciding({ request: r, decision: 'approve' })} className="btn-primary px-3 py-1.5 text-xs">
                        Approve
                      </button>
                    </>
                  )}
                  {r.requested_by_user_id === me?.userId && (
                    <button
                      onClick={() => cancel(r)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {deciding && (
        <DecisionDialog
          request={deciding.request}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={(text, tone) => {
            setDeciding(null);
            setNotice({ tone, text });
            requests.reload();
          }}
        />
      )}
    </div>
  );
}

/** What the request changes, from its visible copy (secret values are never sent). */
function Details({ details }: { details: Record<string, unknown> }) {
  const rows = Object.entries(details).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0));
  if (rows.length === 0) return null;
  const show = (v: unknown) =>
    Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.entries(v as object).map(([k, x]) => `${k}: ${String(x)}`).join(' · ') : String(v);
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs sm:grid-cols-[max-content_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-slate-500">{k === 'secretsChanged' ? 'Secrets changed' : k}</dt>
          <dd className="break-all text-slate-700">{show(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DecisionDialog({
  request,
  decision,
  onClose,
  onDone,
}: {
  request: ApprovalRequest;
  decision: 'approve' | 'reject';
  onClose: () => void;
  onDone: (text: string, tone: 'ok' | 'error') => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/approvals/${request.id}/${decision}`, { note: note.trim() || undefined });
      onDone(decision === 'approve' ? 'Approved and applied.' : 'Rejected. Nothing was changed.', 'ok');
    } catch (err) {
      // A 409 on approve means it was checked again and no longer applies.
      if (err instanceof ApiError && err.status === 409) onDone(err.message, 'error');
      else setError(err instanceof ApiError ? err.message : 'Could not record the decision.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={decision === 'approve' ? 'Approve this change?' : 'Reject this change?'} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-700">{request.summary}</p>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={decision === 'approve' ? 'e.g. Checked with finance' : 'Why it was rejected'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
        </label>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={
              decision === 'approve'
                ? 'btn-primary px-4 py-2.5 text-sm disabled:opacity-60'
                : 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60'
            }
          >
            {busy ? 'Saving…' : decision === 'approve' ? 'Approve and apply' : 'Reject'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RulesCard({ onChanged }: { onChanged: () => void }) {
  const rules = useApiData<ApprovalRule[]>('/api/admin/approval-rules');
  const [error, setError] = useState<string | null>(null);

  async function toggle(rule: ApprovalRule) {
    setError(null);
    try {
      await api.patch(`/api/admin/approval-rules/${rule.action}`, { requiresApproval: !rule.requires_approval });
      rules.reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the rule.');
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-ink">What needs approval</h2>
        <p className="text-xs text-slate-500">
          Applies to staff who are not super admins. Super admins’ own changes always take effect at once.
        </p>
      </div>
      {error && <p className="px-4 pt-3 text-sm font-medium text-rose-600">{error}</p>}
      <div className="divide-y divide-slate-100">
        {rules.data?.map((rule) => (
          <div key={rule.action} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{rule.label}</div>
              {rule.description && <div className="text-xs text-slate-500">{rule.description}</div>}
            </div>
            {rule.pending_count > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">{rule.pending_count} waiting</span>
            )}
            <button
              onClick={() => toggle(rule)}
              role="switch"
              aria-checked={rule.requires_approval}
              aria-label={rule.label}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${rule.requires_approval ? 'bg-brand-navy' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${rule.requires_approval ? 'left-5.5' : 'left-0.5'}`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
