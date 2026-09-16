import { Navigate } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { Icon } from '../components/ui/Icon';
import { canView, firstPermittedPath, useStaffMe } from '../lib/staffContext';

/**
 * What '/' means depends on the role that opened it.
 *
 * The dashboard reads platform reports, so an admin without 'reports.view'
 * cannot have it — and landing them there anyway meant the first thing they
 * saw after signing in was a refusal. They are sent to the first module their
 * role does cover instead.
 */
export default function HomeRoute() {
  const me = useStaffMe();

  // Still loading. Rendering the dashboard now would fire a request that may
  // turn out to be forbidden, and redirecting now would guess wrong.
  if (!me) return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>;

  if (canView(me, 'reports.view')) return <DashboardPage />;

  const fallback = firstPermittedPath(me);
  if (fallback) return <Navigate to={fallback} replace />;

  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <Icon name="lock" className="h-6 w-6 text-slate-400" />
      </div>
      <h1 className="text-base font-bold text-ink">No modules yet</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        You are signed in as <span className="font-semibold text-ink">{me.email}</span>
        {me.role ? (
          <>
            {' '}
            with the <span className="font-semibold text-ink">{me.role.name}</span> role, but it does not include any
            modules yet.
          </>
        ) : (
          <> , but no staff role has been assigned to your account yet.</>
        )}{' '}
        Ask a super admin to grant the permissions you need.
      </p>
    </div>
  );
}
