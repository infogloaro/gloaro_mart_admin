import { Fragment, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type { StaffAction, StaffMe, StaffMember, StaffPermission, StaffRole } from '../lib/types';

const ACTION_COLUMNS: { action: StaffAction; label: string }[] = [
  { action: 'view', label: 'View' },
  { action: 'edit', label: 'Edit' },
  { action: 'delete', label: 'Delete' },
];

/** 'products.view' + 'products.edit' → one chip reading `products view/edit`. */
function summarise(keys: string[]) {
  const byModule = new Map<string, string[]>();
  for (const key of [...keys].sort()) {
    const [module, action] = key.split('.');
    if (!byModule.has(module)) byModule.set(module, []);
    byModule.get(module)!.push(action);
  }
  return [...byModule.entries()].map(([module, actions]) => ({ module, actions }));
}

/** One menu's row in the role grid. */
interface ModuleRow {
  module: string;
  label: string;
  pending?: boolean;
  covers?: string[];
  actions: Partial<Record<StaffAction, StaffPermission>>;
}

const ENDPOINTS = [
  'GET    /api/admin/staff',
  'POST   /api/admin/staff',
  'PATCH  /api/admin/staff/:id',
  'DELETE /api/admin/staff/:id',
  'GET    /api/admin/roles',
  'POST   /api/admin/roles',
  'PATCH  /api/admin/roles/:id',
  'DELETE /api/admin/roles/:id',
];

const TABS = ['people', 'roles'] as const;
type Tab = (typeof TABS)[number];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

export default function StaffPage() {
  const [tab, setTab] = useState<Tab>('people');

  const { data: me } = useApiData<StaffMe>('/api/admin/me');
  const { data: staff, loading, error, reload } = useApiData<StaffMember[]>('/api/admin/staff');
  const { data: roles, reload: reloadRoles } = useApiData<StaffRole[]>('/api/admin/roles');
  const { data: permissions } = useApiData<StaffPermission[]>('/api/admin/permissions');

  const [addingStaff, setAddingStaff] = useState(false);
  const [editingRole, setEditingRole] = useState<StaffRole | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [revoking, setRevoking] = useState<StaffMember | null>(null);
  const [deletingRole, setDeletingRole] = useState<StaffRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sidebar section → the menus in it → that menu's view/edit/delete keys.
  // The dialog renders this as one row per menu with three checkboxes, which
  // is the only shape that stays readable at forty-odd menus.
  const byGroup = useMemo(() => {
    const groups = new Map<string, Map<string, ModuleRow>>();
    for (const p of permissions ?? []) {
      if (!groups.has(p.group)) groups.set(p.group, new Map());
      const modules = groups.get(p.group)!;
      if (!modules.has(p.module)) {
        modules.set(p.module, { module: p.module, label: p.moduleLabel, pending: p.pending, covers: p.covers, actions: {} });
      }
      modules.get(p.module)!.actions[p.action] = p;
    }
    return [...groups.entries()].map(([group, modules]) => [group, [...modules.values()]] as const);
  }, [permissions]);

  async function changeRole(member: StaffMember, roleId: string) {
    setActionError(null);
    try {
      await api.patch(`/api/admin/staff/${member.id}`, { roleId: roleId || null });
      reload();
      reloadRoles();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not change the role.');
    }
  }

  async function confirmRevoke() {
    if (!revoking) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/staff/${revoking.id}`);
      setRevoking(null);
      reload();
      reloadRoles();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not revoke access.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteRole() {
    if (!deletingRole) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/api/admin/roles/${deletingRole.id}`);
      setDeletingRole(null);
      reloadRoles();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the role.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Admin Staff &amp; RBAC</h1>
          <p className="text-sm text-slate-500">
            Who can reach the panel, and what each of them may do once inside. Permissions are checked on the server —
            hiding a menu is a convenience, not the control.
          </p>
        </div>
        <button
          onClick={() => {
            setActionError(null);
            if (tab === 'people') setAddingStaff(true);
            else setCreatingRole(true);
          }}
          className="btn-primary px-4 py-2.5 text-sm"
        >
          {tab === 'people' ? 'Add staff' : 'Add role'}
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 15 RBAC" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {me && (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
          <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            You are signed in as <span className="font-semibold text-ink">{me.email}</span> with the{' '}
            <span className="font-semibold text-ink">{me.role?.name ?? 'no'}</span> role
            {me.isSuperAdmin && ' — full access to every module'}.
          </span>
        </div>
      )}

      <FilterTabs options={TABS} value={tab} onChange={setTab} />

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {tab === 'people' && !loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={staff ?? []}
            keyFor={(s) => s.id}
            emptyMessage="No admin accounts."
            columns={[
              {
                header: 'Person',
                render: (s) => (
                  <div>
                    <div className="text-[13px] font-semibold text-ink">
                      {s.full_name}
                      {me?.userId === s.id && <span className="ml-1.5 text-[11px] text-slate-400">(you)</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">{s.email}</div>
                  </div>
                ),
              },
              {
                header: 'Role',
                render: (s) => (
                  <select
                    value={s.role_id ?? ''}
                    onChange={(e) => changeRole(s, e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold"
                  >
                    <option value="">No role — cannot do anything</option>
                    {(roles ?? []).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (s) =>
                  me?.userId === s.id ? (
                    // The server refuses this anyway; not offering it avoids
                    // teaching the operator that it might work.
                    <span className="text-xs text-slate-400">—</span>
                  ) : (
                    <button
                      onClick={() => setRevoking(s)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      Revoke access
                    </button>
                  ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-3">
          {(roles ?? []).map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-ink">{r.name}</h2>
                    {r.is_system && (
                      <span className="rounded-full border border-emerald/25 bg-mint-mist px-2 py-0.5 text-[10px] font-bold text-emerald-deep">
                        BUILT IN
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {r.member_count} {r.member_count === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  {r.description && <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingRole(r);
                      setActionError(null);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep"
                  >
                    Edit
                  </button>
                  {!r.is_system && (
                    <button
                      onClick={() => setDeletingRole(r)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.is_system ? (
                  <span className="text-xs text-slate-500">Every permission, always. This cannot be narrowed.</span>
                ) : r.permissions.length === 0 ? (
                  <span className="text-xs text-slate-400">No permissions — this role can sign in and see nothing.</span>
                ) : (
                  // One chip per menu rather than per key: at three actions
                  // across forty-odd menus the raw list is a wall of text.
                  summarise(r.permissions).map(({ module, actions }) => (
                    <span
                      key={module}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                    >
                      <span className="font-mono">{module}</span>
                      <span className="ml-1 font-semibold text-slate-400">{actions.join('/')}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addingStaff && (
        <AddStaffDialog
          roles={roles ?? []}
          onClose={() => setAddingStaff(false)}
          onSaved={() => {
            setAddingStaff(false);
            reload();
            reloadRoles();
          }}
        />
      )}

      {(creatingRole || editingRole) && (
        <RoleDialog
          role={editingRole}
          groups={byGroup}
          onClose={() => {
            setCreatingRole(false);
            setEditingRole(null);
          }}
          onSaved={() => {
            setCreatingRole(false);
            setEditingRole(null);
            reloadRoles();
          }}
        />
      )}

      {revoking && (
        <ConfirmDialog
          title="Revoke admin access"
          message={`${revoking.full_name} will lose access to the panel. Their account stays, as a customer.`}
          confirmLabel="Revoke"
          busy={busy}
          error={actionError}
          onConfirm={confirmRevoke}
          onCancel={() => setRevoking(null)}
        />
      )}

      {deletingRole && (
        <ConfirmDialog
          title="Delete role"
          message={`Delete ${deletingRole.name}? This is refused while anyone still holds it.`}
          confirmLabel="Delete"
          busy={busy}
          error={actionError}
          onConfirm={confirmDeleteRole}
          onCancel={() => setDeletingRole(null)}
        />
      )}
    </div>
  );
}

/** Promotes an existing account, or creates one. The server decides which. */
function AddStaffDialog({
  roles,
  onClose,
  onSaved,
}: {
  roles: StaffRole[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/admin/staff', {
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        password: password || undefined,
        roleId: roleId || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the staff member.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add staff" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-slate-500">
          If the email already belongs to someone, they are promoted and their password is left alone. Otherwise a new
          account is created.
        </p>

        <label className="block">
          <span className={labelClass}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} />
        </label>

        <label className="block">
          <span className={labelClass}>Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            placeholder="Required for a new account"
          />
        </label>

        <label className="block">
          <span className={labelClass}>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className={inputClass}
            placeholder="At least 8 characters, new accounts only"
          />
        </label>

        <label className="block">
          <span className={labelClass}>Role</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputClass}>
            <option value="">No role — they will see nothing</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
            {busy ? 'Saving…' : 'Add staff'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RoleDialog({
  role,
  groups,
  onClose,
  onSaved,
}: {
  role: StaffRole | null;
  groups: readonly (readonly [string, readonly ModuleRow[]])[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role?.permissions ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = role?.is_system ?? false;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Ticking edit or delete without view would save a role that cannot open the menu. */
  function isOn(row: ModuleRow, action: StaffAction) {
    const key = row.actions[action]?.key;
    if (!key) return false;
    if (selected.has(key)) return true;
    if (action !== 'view') return false;
    return ACTION_COLUMNS.some(
      ({ action: a }) => a !== 'view' && row.actions[a] && selected.has(row.actions[a]!.key)
    );
  }

  /** Every action on one menu, on or off together. */
  function toggleRow(row: ModuleRow) {
    const keys = ACTION_COLUMNS.map(({ action }) => row.actions[action]?.key).filter(Boolean) as string[];
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  /** Every menu in one sidebar section, on or off together. */
  function toggleGroup(rows: readonly ModuleRow[]) {
    const keys = rows.flatMap((r) =>
      ACTION_COLUMNS.map(({ action }) => r.actions[action]?.key).filter(Boolean)
    ) as string[];
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        ...(locked ? {} : { permissions: [...selected] }),
      };
      if (role) await api.patch(`/api/admin/roles/${role.id}`, body);
      else await api.post('/api/admin/roles', body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the role.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={role ? `Edit ${role.name}` : 'Add role'} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>

        <label className="block">
          <span className={labelClass}>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>

        {locked ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            The super admin role always holds every permission, including any added in future. That is what makes it
            safe to keep as the last resort, so it cannot be narrowed here.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              One row per menu in the sidebar. <span className="font-semibold text-slate-600">View</span> shows the menu
              and opens it, <span className="font-semibold text-slate-600">Edit</span> allows creating and changing, and{' '}
              <span className="font-semibold text-slate-600">Delete</span> allows removing. Edit and delete include view.
            </p>

            {groups.map(([group, rows]) => (
              <div key={group} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{group}</h3>
                  <button
                    type="button"
                    onClick={() => toggleGroup(rows)}
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-white hover:text-emerald-deep"
                  >
                    Toggle all
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                  <div className="px-3 py-1.5 text-[10px] font-bold tracking-wide text-slate-400 uppercase">Menu</div>
                  <div className="flex gap-3 px-3 py-1.5">
                    {ACTION_COLUMNS.map(({ action, label }) => (
                      <span
                        key={action}
                        className="w-12 text-center text-[10px] font-bold tracking-wide text-slate-400 uppercase"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  {rows.map((row) => (
                    <Fragment key={row.module}>
                      <div className="border-t border-slate-100 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleRow(row)}
                          className="text-left text-[13px] font-medium text-slate-700 hover:text-emerald-deep"
                        >
                          {row.label}
                        </button>
                        {row.covers && (
                          <div className="text-[10px] text-slate-400">Covers {row.covers.join(', ')}</div>
                        )}
                        {row.pending && (
                          <div className="text-[10px] text-gold-ink">Menu only — its API has not shipped yet</div>
                        )}
                      </div>
                      <div className="flex gap-3 border-t border-slate-100 px-3 py-2">
                        {ACTION_COLUMNS.map(({ action }) => {
                          const permission = row.actions[action];
                          return (
                            <span key={action} className="flex w-12 justify-center">
                              {permission ? (
                                <input
                                  type="checkbox"
                                  title={permission.key}
                                  checked={isOn(row, action)}
                                  onChange={() => toggle(permission.key)}
                                />
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
            {busy ? 'Saving…' : 'Save role'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
