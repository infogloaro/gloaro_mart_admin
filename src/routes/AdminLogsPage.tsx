import { useState } from 'react';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type { AuditLogEntry, Paged } from '../lib/types';

const MODULES = [
  'catalogue',
  'orders',
  'vendors',
  'finance',
  'customers',
  'marketing',
  'system',
] as const;

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 'staff.role_assigned' → 'role assigned' — the module prefix is already its own column. */
function actionLabel(action: string, module: string): string {
  const short = action.startsWith(`${module}.`) ? action.slice(module.length + 1) : action;
  return short.replace(/_/g, ' ');
}

export default function AdminLogsPage() {
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<AuditLogEntry | null>(null);

  const qs = new URLSearchParams({
    ...(module ? { module } : {}),
    ...(action.trim() ? { action: action.trim() } : {}),
    page: String(page),
  }).toString();

  const { data, loading, error } = useApiData<Paged<AuditLogEntry>>(`/api/admin/audit-logs?${qs}`, [
    module,
    action,
    page,
  ]);

  const inputClass = 'rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Admin Logs</h1>
        <p className="text-sm text-slate-500">
          Who changed what, in which module, with the value before and after. Every write an admin makes through this
          panel is recorded here — it cannot be turned off or edited after the fact.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 card p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Module</label>
          <select
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Every module</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Action</label>
          <input
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. role_assigned, price_changed"
            className={`w-full ${inputClass}`}
          />
        </div>
        {data && (
          <div className="ml-auto text-sm text-slate-500">
            {data.total} entr{data.total === 1 ? 'y' : 'ies'}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && data && (
        <div className="card overflow-hidden">
          <DataTable
            rows={data.items}
            keyFor={(l) => l.id}
            emptyMessage="No activity matches this filter."
            columns={[
              {
                header: 'When',
                render: (l) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatWhen(l.created_at)}</span>,
              },
              {
                header: 'Who',
                render: (l) =>
                  l.actor_name ? (
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{l.actor_name}</div>
                      <div className="text-[11px] text-slate-400">{l.actor_email}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">System</span>
                  ),
              },
              {
                header: 'Module',
                render: (l) => (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 capitalize">
                    {l.module}
                  </span>
                ),
              },
              {
                header: 'Action',
                render: (l) => <span className="text-[13px] font-medium text-ink capitalize">{actionLabel(l.action, l.module)}</span>,
              },
              {
                header: 'Entity',
                render: (l) =>
                  l.entity_type ? (
                    <span className="font-mono text-xs text-slate-500">
                      {l.entity_type}
                      {l.entity_id ? ` #${l.entity_id}` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  ),
              },
              {
                header: '',
                className: 'text-right',
                render: (l) =>
                  l.previous_value || l.new_value ? (
                    <button
                      onClick={() => setViewing(l)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
                    >
                      View change
                    </button>
                  ) : null,
              },
            ]}
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {viewing && (
        <Modal title={`${actionLabel(viewing.action, viewing.module)} · ${formatWhen(viewing.created_at)}`} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-500">
              {viewing.actor_name ?? 'System'} · {viewing.module}
              {viewing.entity_type && ` · ${viewing.entity_type}${viewing.entity_id ? ` #${viewing.entity_id}` : ''}`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  <Icon name="undo" className="h-3 w-3" />
                  Before
                </div>
                <pre className="max-h-64 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  {viewing.previous_value ? JSON.stringify(viewing.previous_value, null, 2) : '—'}
                </pre>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  <Icon name="shield" className="h-3 w-3" />
                  After
                </div>
                <pre className="max-h-64 overflow-auto rounded-xl bg-mint-mist p-3 text-xs text-emerald-deep">
                  {viewing.new_value ? JSON.stringify(viewing.new_value, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
