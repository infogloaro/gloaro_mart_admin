import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { useCan } from '../lib/staffContext';
import type {
  AdminVendor,
  Paged,
  VendorDocument,
  VendorDocumentType,
  VendorKycSummary,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/vendor-documents',
  'PATCH  /api/admin/vendor-documents/:docId/status',
  'GET    /api/admin/vendors/kyc-summary',
  'POST   /api/admin/vendors/:id/documents',
];

const TABS = ['pending', 'approved', 'rejected', 'all'] as const;
type Tab = (typeof TABS)[number];

const DOC_TYPES: { value: VendorDocumentType; label: string }[] = [
  { value: 'gstin', label: 'GSTIN' },
  { value: 'pan', label: 'PAN' },
  { value: 'bank', label: 'Bank account' },
  { value: 'fssai', label: 'FSSAI licence' },
  { value: 'other', label: 'Other' },
];

const TYPE_LABEL = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label])) as Record<
  VendorDocumentType,
  string
>;

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function VendorKycPage() {
  const can = useCan('vendors');
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);

  const query = tab === 'all' ? `page=${page}` : `status=${tab}&page=${page}`;
  const { data, loading, error, reload } = useApiData<Paged<VendorDocument>>(
    `/api/admin/vendor-documents?${query}`,
    [tab, page],
  );
  const {
    data: summary,
    error: summaryError,
    reload: reloadSummary,
  } = useApiData<VendorKycSummary[]>('/api/admin/vendors/kyc-summary');
  const { data: vendors } = useApiData<AdminVendor[]>('/api/admin/vendors');

  const [rejecting, setRejecting] = useState<VendorDocument | null>(null);
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add-document form
  const [vendorId, setVendorId] = useState('');
  const [docType, setDocType] = useState<VendorDocumentType>('gstin');
  const [docNumber, setDocNumber] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  function refresh() {
    reload();
    reloadSummary();
  }

  async function approve(doc: VendorDocument) {
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/vendor-documents/${doc.id}/status`, { status: 'approved' });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not approve the document.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    if (!reason.trim()) {
      setActionError('Give a reason the vendor can act on.');
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/vendor-documents/${rejecting.id}/status`, {
        status: 'rejected',
        rejectionReason: reason.trim(),
      });
      setRejecting(null);
      setReason('');
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reject the document.');
    } finally {
      setBusy(false);
    }
  }

  async function addDocument(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    if (!vendorId) {
      setActionError('Choose a vendor.');
      return;
    }
    if (!docNumber.trim() && !fileUrl.trim()) {
      setActionError('Enter a document number or a file link — there is nothing to review otherwise.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/admin/vendors/${vendorId}/documents`, {
        docType,
        docNumber: docNumber.trim() || undefined,
        fileUrl: fileUrl.trim() || undefined,
      });
      setAdding(false);
      setDocNumber('');
      setFileUrl('');
      setTab('pending');
      setPage(1);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not record the document.');
    } finally {
      setBusy(false);
    }
  }

  const docs = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">KYC &amp; Documents</h1>
          <p className="text-sm text-slate-500">
            GSTIN, PAN and bank verification. Every submission is kept after review, so a rejection and its corrected
            resubmission both stay on the record.
          </p>
        </div>
        {can.edit && (
          <button onClick={() => { setActionError(null); setAdding(true); }} className="btn-primary px-4 py-2.5 text-sm">
            Record document
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
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 16 vendor KYC" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {!error && summary && !summaryError && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
            <h2 className="text-sm font-bold text-ink">Verification status</h2>
            <p className="text-xs text-slate-400">
              A vendor counts as verified once GSTIN, PAN and bank are all approved.
            </p>
          </div>
          <DataTable
            rows={summary}
            keyFor={(v) => v.vendor_id}
            emptyMessage="No vendors yet."
            columns={[
              {
                header: 'Vendor',
                render: (v) => (
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-ink">{v.business_name}</span>
                    <StatusBadge status={v.vendor_status} />
                  </div>
                ),
              },
              {
                header: 'Verified',
                render: (v) => {
                  const done = v.approved_required_count >= v.required_total;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${
                        done ? 'text-state-success' : 'text-slate-500'
                      }`}
                    >
                      <Icon name={done ? 'shield' : 'clock'} className="h-4 w-4" />
                      {v.approved_required_count}/{v.required_total}
                    </span>
                  );
                },
              },
              {
                header: 'Pending',
                className: 'text-right tabular-nums',
                render: (v) =>
                  v.pending_count > 0 ? (
                    <span className="font-semibold text-state-pending-ink">{v.pending_count}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  ),
              },
              {
                header: 'Rejected',
                className: 'text-right tabular-nums',
                render: (v) =>
                  v.rejected_count > 0 ? (
                    <span className="font-semibold text-state-error">{v.rejected_count}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  ),
              },
              {
                header: 'Last submission',
                className: 'text-right',
                render: (v) => <span className="text-slate-500">{formatDate(v.last_submitted_at)}</span>,
              },
            ]}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          options={TABS}
          value={tab}
          onChange={(t) => {
            setTab(t);
            setPage(1);
          }}
        />
        {data && <span className="text-xs font-medium text-slate-400">{data.total} documents</span>}
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={docs}
            keyFor={(d) => d.id}
            emptyMessage={
              tab === 'pending' ? 'Nothing waiting for review.' : 'No documents match this filter.'
            }
            columns={[
              {
                header: 'Vendor',
                render: (d) => <span className="font-semibold text-ink">{d.business_name}</span>,
              },
              {
                header: 'Document',
                render: (d) => (
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{TYPE_LABEL[d.doc_type]}</div>
                    {d.doc_number && <div className="font-mono text-xs text-slate-500">{d.doc_number}</div>}
                    {d.file_url && (
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald hover:underline"
                      >
                        <Icon name="filetext" className="h-3 w-3" />
                        View file
                      </a>
                    )}
                  </div>
                ),
              },
              {
                header: 'Status',
                render: (d) => (
                  <div>
                    <StatusBadge status={d.status} />
                    {d.status === 'rejected' && d.rejection_reason && (
                      <div className="mt-1 max-w-xs text-xs text-rose-600">{d.rejection_reason}</div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Submitted',
                render: (d) => <span className="text-slate-500">{formatDate(d.submitted_at)}</span>,
              },
              {
                header: 'Reviewed',
                render: (d) =>
                  d.reviewed_at ? (
                    <div className="text-xs text-slate-500">
                      <div>{formatDate(d.reviewed_at)}</div>
                      {d.reviewed_by_name && <div className="text-slate-400">by {d.reviewed_by_name}</div>}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  ),
              },
              {
                header: '',
                className: 'text-right',
                render: (d) =>
                  can.edit ? (
                    <div className="flex justify-end gap-2">
                      {/* Re-reviewing a decided document is allowed — a wrong
                          rejection has to be correctable — so the buttons stay
                          available, minus the one matching the current status. */}
                      {d.status !== 'approved' && (
                        <button
                          onClick={() => approve(d)}
                          disabled={busy}
                          className="rounded-lg border border-state-success/30 bg-state-success/10 px-3 py-1 text-xs font-semibold text-state-success-ink hover:bg-state-success/20 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {d.status !== 'rejected' && (
                        <button
                          onClick={() => {
                            setRejecting(d);
                            setReason('');
                            setActionError(null);
                          }}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">View only</span>
                  ),
              },
            ]}
          />
          {data && (
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          )}
        </div>
      )}

      {rejecting && (
        <Modal title={`Reject ${TYPE_LABEL[rejecting.doc_type]}`} onClose={() => setRejecting(null)}>
          <form onSubmit={confirmReject} className="space-y-3">
            <p className="text-sm text-slate-500">
              {rejecting.business_name}
              {rejecting.doc_number && <span className="font-mono"> · {rejecting.doc_number}</span>}
            </p>
            <label className="block">
              <span className={labelClass}>Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What the vendor needs to fix before resubmitting"
                className={inputClass}
              />
            </label>
            {actionError && <p className="text-sm font-medium text-rose-700">{actionError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setRejecting(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? 'Rejecting…' : 'Reject document'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {adding && (
        <Modal title="Record a document" onClose={() => setAdding(false)}>
          <form onSubmit={addDocument} className="space-y-3">
            <label className="block">
              <span className={labelClass}>Vendor</span>
              {/* Every vendor, not just approved ones: KYC is usually what a
                  pending vendor is waiting on, and filtering to approved would
                  hide exactly the shops that need reviewing. */}
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputClass}>
                <option value="">Choose a vendor…</option>
                {(vendors ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.business_name} — {v.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Type</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as VendorDocumentType)}
                className={inputClass}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Document number</span>
              <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className={inputClass} placeholder="e.g. 33AABCU9603R1ZM" />
            </label>
            <label className="block">
              <span className={labelClass}>File link</span>
              <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className={inputClass} placeholder="https://…" />
            </label>
            <p className="text-xs text-slate-400">
              Either field is enough. Recording a document never approves it — it lands in the pending queue.
            </p>

            {actionError && <p className="text-sm font-medium text-rose-700">{actionError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
                {busy ? 'Saving…' : 'Record document'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
