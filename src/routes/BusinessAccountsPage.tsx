import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type {
  AdminBusinessAccount,
  BusinessAccountDetail,
  BusinessAccountSummary,
  Paged,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/business-accounts',
  'GET    /api/admin/business-accounts/summary',
  'GET    /api/admin/business-accounts/:id',
  'POST   /api/admin/business-accounts/:id/verify',
  'POST   /api/admin/business-accounts/:id/reject',
  'POST   /api/admin/business-accounts/:id/suspend',
  'PATCH  /api/admin/business-accounts/:id/credit',
];

const FILTERS = ['pending', 'verified', 'suspended', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const ROLE_TONE: Record<string, string> = {
  owner: 'bg-navy-2/10 text-navy-2',
  approver: 'bg-state-processing/12 text-state-processing',
  buyer: 'bg-slate-100 text-slate-500',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactRupees(cents: number): string {
  const rupeesValue = cents / 100;
  if (rupeesValue >= 10000000) return `₹${(rupeesValue / 10000000).toFixed(2)} Cr`;
  if (rupeesValue >= 100000) return `₹${(rupeesValue / 100000).toFixed(2)} L`;
  return rupees(cents);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Credit drawn as a share of the limit. Null when the account is prepaid. */
function utilisation(used: number, limit: number): number | null {
  if (limit <= 0) return null;
  return Math.min(1, used / limit);
}

export default function BusinessAccountsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [openId, setOpenId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    filter === 'all' ? '' : `status=${filter}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminBusinessAccount>>(
    `/api/admin/business-accounts?${query}`,
    [filter, page, debounced],
  );
  const { data: summary, reload: reloadSummary } = useApiData<BusinessAccountSummary>(
    '/api/admin/business-accounts/summary',
  );

  function refresh() {
    reload();
    reloadSummary();
  }

  const rows = data?.items ?? [];
  const exposure = summary ? utilisation(summary.creditExposureCents, summary.creditLimitCents) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Business Accounts</h1>
        <p className="text-sm text-slate-500">
          A buying organisation, not a person. Several people order under one GSTIN, against one credit limit, to
          addresses the business owns.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 11 B2B accounts" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting on verification"
            value={String(summary.pending)}
            icon="idcard"
            tone={summary.pending > 0 ? 'pending' : 'neutral'}
            hint="Cannot order until verified"
          />
          <StatCard
            label="Verified accounts"
            value={String(summary.verified)}
            icon="briefcase"
            tone="positive"
            hint={`${summary.suspended} suspended`}
          />
          <StatCard
            label="Credit drawn"
            value={compactRupees(summary.creditExposureCents)}
            icon="wallet"
            tone={exposure != null && exposure > 0.8 ? 'critical' : 'processing'}
            hint={
              exposure == null
                ? 'No credit extended'
                : `${Math.round(exposure * 100)}% of ${compactRupees(summary.creditLimitCents)} extended`
            }
          />
          <StatCard
            label="Lifetime B2B value"
            value={compactRupees(summary.lifetimeValueCents)}
            icon="coins"
            tone="gold"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-all duration-200 ${
                filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Business name, GSTIN or contact…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(b) => b.id}
            emptyMessage={
              filter === 'pending' ? 'No account is waiting on verification.' : 'Nothing matches this filter.'
            }
            columns={[
              {
                header: 'Business',
                render: (b) => (
                  <span>
                    <span className="block font-semibold text-ink">{b.tradeName ?? b.legalName}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{b.gstin}</span>
                  </span>
                ),
              },
              {
                header: 'Contact',
                render: (b) => (
                  <span>
                    <span className="block text-ink">{b.primaryContactName}</span>
                    <span className="block text-[11px] text-slate-400">{b.primaryContactEmail}</span>
                  </span>
                ),
              },
              {
                header: 'Location',
                render: (b) => (
                  <span className="text-slate-600">{[b.city, b.state].filter(Boolean).join(', ') || '—'}</span>
                ),
              },
              {
                header: 'People',
                className: 'text-right tabular-nums',
                render: (b) => (
                  <span>
                    <span className="block">{b.memberCount}</span>
                    <span className="block text-[11px] text-slate-400">
                      {b.addressCount} address{b.addressCount === 1 ? '' : 'es'}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Credit',
                className: 'text-right tabular-nums',
                render: (b) => {
                  const used = utilisation(b.creditUsedCents, b.creditLimitCents);
                  if (used == null) return <span className="text-xs text-slate-400">Prepaid</span>;
                  return (
                    <span>
                      <span className={`block font-semibold ${used > 0.8 ? 'text-state-error' : 'text-ink'}`}>
                        {rupees(b.creditUsedCents)}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        of {rupees(b.creditLimitCents)} · {b.paymentTermsDays}d
                      </span>
                    </span>
                  );
                },
              },
              {
                header: 'Activity',
                className: 'text-right tabular-nums',
                render: (b) => (
                  <span>
                    <span className="block font-semibold text-ink">{compactRupees(b.lifetimeValueCents)}</span>
                    <span className="block text-[11px] text-slate-400">
                      {b.ordersCount} orders · {b.rfqCount} RFQ
                    </span>
                  </span>
                ),
              },
              { header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
              {
                header: '',
                className: 'text-right',
                render: (b) => (
                  <button
                    onClick={() => {
                      setOpenId(b.id);
                      setActionError(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    Open
                  </button>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {openId != null && (
        <AccountModal id={openId} onClose={() => setOpenId(null)} onError={setActionError} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

type Pending = 'reject' | 'suspend' | 'credit' | null;

function AccountModal({
  id,
  onClose,
  onError,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useApiData<BusinessAccountDetail>(`/api/admin/business-accounts/${id}`, [
    id,
  ]);

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');
  const [limit, setLimit] = useState('');
  const [terms, setTerms] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(method: 'post' | 'patch', path: string, body?: unknown, message?: string) {
    onError(null);
    setBusy(true);
    try {
      await api[method](`/api/admin/business-accounts/${id}/${path}`, body);
      setPending(null);
      setReason('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : (message ?? 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitReason(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      onError('Give a reason — the business is told what it says.');
      return;
    }
    run('post', pending === 'reject' ? 'reject' : 'suspend', { reason: reason.trim() });
  }

  function submitCredit(e: FormEvent) {
    e.preventDefault();
    const limitCents = Math.round(Number(limit) * 100);
    const days = Number(terms);
    if (!Number.isFinite(limitCents) || limitCents < 0) {
      onError('Enter a credit limit of zero or more.');
      return;
    }
    if (!Number.isInteger(days) || days < 0) {
      onError('Payment terms must be a whole number of days.');
      return;
    }
    // Cutting the limit below what is already drawn leaves the account instantly
    // over its cap, which is a collections problem, not a settings change.
    if (data && limitCents < data.creditUsedCents) {
      onError(`Already ${rupees(data.creditUsedCents)} drawn. Collect first, then lower the limit.`);
      return;
    }
    run('patch', 'credit', { creditLimitCents: limitCents, paymentTermsDays: days }, 'Could not update the credit.');
  }

  function startCredit() {
    if (!data) return;
    setPending('credit');
    setLimit((data.creditLimitCents / 100).toFixed(2));
    setTerms(String(data.paymentTermsDays));
  }

  const used = data ? utilisation(data.creditUsedCents, data.creditLimitCents) : null;

  return (
    <Modal title={data ? (data.tradeName ?? data.legalName) : 'Business account'} onClose={onClose} wide>
      {loading && <div className="py-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <span className="font-mono text-xs text-slate-500">{data.gstin}</span>
            {data.verifiedAt && (
              <span className="text-[11px] text-slate-400">
                verified {formatDate(data.verifiedAt)} by {data.verifiedByName ?? 'an admin'}
              </span>
            )}
          </div>

          {data.statusReason && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{data.statusReason}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Legal name" value={data.legalName} />
            <Field label="PAN" value={data.pan ?? '—'} mono />
            <Field label="Registered since" value={formatDate(data.createdAt)} />
            <Field label="Primary contact" value={data.primaryContactName} />
            <Field label="Email" value={data.primaryContactEmail} />
            <Field label="Phone" value={data.primaryContactPhone ?? '—'} />
          </dl>

          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Credit</span>
              <button
                onClick={startCredit}
                className="text-xs font-semibold text-emerald-deep hover:underline"
              >
                Change limit
              </button>
            </div>
            {used == null ? (
              <p className="mt-1 text-sm text-slate-500">
                Prepaid only — no credit extended. Every order must be paid up front.
              </p>
            ) : (
              <>
                <div className="mt-1 flex items-baseline justify-between text-sm">
                  <span className="font-bold text-ink tabular-nums">{rupees(data.creditUsedCents)} drawn</span>
                  <span className="text-slate-500 tabular-nums">
                    of {rupees(data.creditLimitCents)} · {data.paymentTermsDays} day terms
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${used > 0.8 ? 'bg-state-error' : 'bg-emerald'}`}
                    style={{ width: `${Math.max(2, used * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                People ({data.members.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {data.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{m.email}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${ROLE_TONE[m.role]}`}
                      >
                        {m.role}
                      </span>
                      {m.orderLimitCents != null && (
                        <span className="mt-0.5 block text-[10px] text-slate-400 tabular-nums">
                          ≤ {rupees(m.orderLimitCents)}/order
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                {data.members.length === 0 && (
                  <p className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                    Nobody can order for this business yet.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Addresses ({data.addresses.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {data.addresses.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{a.label}</span>
                      {a.isDefault && (
                        <span className="shrink-0 rounded bg-mint-mist px-1.5 py-px text-[10px] font-bold text-emerald-deep">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                    </p>
                    {/* A branch in another state files under its own GSTIN, and
                        that decides the tax on anything shipped there. */}
                    {a.gstin && a.gstin !== data.gstin && (
                      <p className="mt-0.5 font-mono text-[10px] text-amber-600">branch GSTIN {a.gstin}</p>
                    )}
                  </div>
                ))}
                {data.addresses.length === 0 && (
                  <p className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                    No delivery address on file.
                  </p>
                )}
              </div>
            </div>
          </div>

          {data.documents.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Documents</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.documents.map((d) => (
                  <a
                    key={d.id}
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    <Icon name="filetext" className="h-3.5 w-3.5" />
                    {d.type.toUpperCase()}
                    <span className="text-[10px] text-slate-400 uppercase">{d.status}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {(pending === 'reject' || pending === 'suspend') && (
            <form onSubmit={submitReason} className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  {pending === 'reject' ? 'Why is verification refused?' : 'Why is the account suspended?'}
                </span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
                <span className="mt-1 block text-[11px] text-slate-500">
                  {pending === 'suspend'
                    ? 'Suspending stops new orders. Open orders and outstanding credit are unaffected.'
                    : 'The business sees this and can re-submit.'}
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : pending === 'reject' ? 'Refuse verification' : 'Suspend account'}
                </button>
              </div>
            </form>
          )}

          {pending === 'credit' && (
            <form onSubmit={submitCredit} className="space-y-2.5 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                    Credit limit (₹)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">Zero makes the account prepaid.</span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                    Payment terms (days)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPending(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save credit terms'}
                </button>
              </div>
            </form>
          )}

          {pending === null && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <span className="mr-auto text-[11px] text-slate-400">
                {data.ordersCount} orders · {data.rfqCount} RFQs · last order {formatDate(data.lastOrderAt)}
              </span>
              {data.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      setPending('reject');
                      setReason('');
                    }}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    Refuse
                  </button>
                  <button
                    onClick={() => run('post', 'verify', undefined, 'Could not verify the account.')}
                    disabled={busy}
                    className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                  >
                    Verify GSTIN and approve
                  </button>
                </>
              )}
              {data.status === 'verified' && (
                <button
                  onClick={() => {
                    setPending('suspend');
                    setReason('');
                  }}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Suspend
                </button>
              )}
              {(data.status === 'suspended' || data.status === 'rejected') && (
                <button
                  onClick={() => run('post', 'verify', undefined, 'Could not reinstate the account.')}
                  disabled={busy}
                  className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  Reinstate
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className={`truncate font-medium text-ink ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
