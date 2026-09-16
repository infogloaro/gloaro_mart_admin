import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useApiData } from './useApiData';
import { NAV_GROUPS } from './navigation';
import type { StaffAction, StaffMe } from './types';

const StaffMeContext = createContext<StaffMe | null>(null);

/**
 * Fetches the signed-in admin's role and permissions once per session and
 * hands them down the tree — the sidebar reads it to decide which menus to
 * show, and anything else that needs to know "can this admin do X" can read
 * it the same way instead of hitting the endpoint again.
 */
export function StaffMeProvider({ children }: { children: ReactNode }) {
  const { data } = useApiData<StaffMe>('/api/admin/me');
  return <StaffMeContext.Provider value={data}>{children}</StaffMeContext.Provider>;
}

/** Null until the request resolves, or if `/api/admin/me` isn't reachable yet. */
export function useStaffMe() {
  return useContext(StaffMeContext);
}

/**
 * Whether the signed-in admin may see a module gated by `permission`. A super
 * admin passes everything; an ungated item (permission is undefined) is open
 * to any signed-in admin; while `/api/admin/me` is still loading, nothing
 * gated is shown rather than flashing the full menu first.
 */
export function canView(me: StaffMe | null, permission: string | undefined): boolean {
  if (!permission) return true;
  if (!me) return false;
  return me.isSuperAdmin || me.permissions.includes(permission);
}

/**
 * What the signed-in admin may do to one module, for hiding the buttons that
 * would only be refused. The server checks the same keys on every request —
 * this decides what is worth offering, not what is allowed.
 *
 *   const can = useCan('categories');
 *   {can.edit && <button>New category</button>}
 *   {can.delete && <button>Delete</button>}
 */
export function useCan(module: string) {
  const me = useStaffMe();
  return useMemo(
    () => ({
      view: canView(me, `${module}.view`),
      edit: canView(me, `${module}.edit`),
      delete: canView(me, `${module}.delete`),
      /** Either write action — for a toolbar shown only to someone who can change something. */
      write: canView(me, `${module}.edit`) || canView(me, `${module}.delete`),
      is: (action: StaffAction) => canView(me, `${module}.${action}`),
    }),
    [me, module]
  );
}

/**
 * Where to send an admin who cannot read the dashboard. Follows the sidebar's
 * own order so they land on the first thing they would have clicked anyway,
 * and returns null for a role that holds nothing at all — the caller says so
 * rather than redirecting into another page that would only refuse them too.
 */
export function firstPermittedPath(me: StaffMe | null): string | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.to !== '/' && item.status === 'live' && canView(me, item.permission)) return item.to;
    }
  }
  return null;
}
