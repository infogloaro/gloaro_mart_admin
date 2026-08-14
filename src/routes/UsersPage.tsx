import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Modal } from '../components/ui/Modal';
import type { AdminUser, Paged } from '../lib/types';

const ROLES = ['customer', 'vendor', 'admin'] as const;

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const qs = new URLSearchParams({
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
    ...(role ? { role } : {}),
    page: String(page),
  }).toString();

  const { data, loading, error, reload } = useApiData<Paged<AdminUser>>(`/api/admin/users?${qs}`, [
    debouncedSearch,
    role,
    page,
  ]);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  // A filter change invalidates the current page number.
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Users</h1>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          className="w-64 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        />
        <select
          value={role}
          onChange={(e) => changeFilter(() => setRole(e.target.value))}
          className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && data && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Name', render: (u) => u.full_name || '—' },
              { header: 'Email', render: (u) => u.email },
              { header: 'Phone', render: (u) => u.phone_number || '—' },
              {
                header: 'Role',
                render: (u) => (
                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {u.role.toUpperCase()}
                  </span>
                ),
              },
              { header: 'Joined', render: (u) => new Date(u.created_at).toLocaleDateString() },
              {
                header: 'Actions',
                render: (u) => (
                  <button
                    onClick={() => setEditing(u)}
                    className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Change role
                  </button>
                ),
              },
            ]}
            rows={data.items}
            keyFor={(u) => u.id}
            emptyMessage="No users found."
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {editing && (
        <ChangeRoleModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ChangeRoleModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.patch(`/api/admin/users/${user.id}/role`, { role });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to change role.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Change role — ${user.full_name || user.email}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminUser['role'])}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Promoting someone to <strong>vendor</strong> does not create their store — they still submit a vendor profile
          from the app, which you approve on the Vendors page.
        </p>
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
            disabled={submitting || role === user.role}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
