import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from './GlobalSearch';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';
import { getValidAdminPayload } from '../../lib/auth';
import { findNavGroup, findNavItem } from '../../lib/navigation';
import { StaffMeProvider, useStaffMe } from '../../lib/staffContext';

function initialsOf(email?: string) {
  if (!email) return 'AD';
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  return ((parts[0]?.[0] ?? 'a') + (parts[1]?.[0] ?? parts[0]?.[1] ?? 'd')).toUpperCase();
}

function HeaderAction({ icon, label, to }: { icon: Parameters<typeof Icon>[0]['name']; label: string; to?: string }) {
  const className =
    'flex h-9 w-9 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-gold/50 hover:bg-gold-soft/60 hover:text-navy-2';
  const glyph = <Icon name={icon} className="h-[18px] w-[18px]" />;
  return to ? (
    <Link to={to} aria-label={label} title={label} className={className}>
      {glyph}
    </Link>
  ) : (
    <button type="button" aria-label={label} title={label} className={className}>
      {glyph}
    </button>
  );
}

export function AdminLayout() {
  return (
    <StaffMeProvider>
      <AdminLayoutContent />
    </StaffMeProvider>
  );
}

function AdminLayoutContent() {
  const payload = getValidAdminPayload();
  const me = useStaffMe();
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const group = findNavGroup(pathname);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // A route change from the drawer closes it; so does growing past the lg breakpoint.
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mq.matches && setMobileOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function toggleNav() {
    if (window.matchMedia('(min-width: 1024px)').matches) setCollapsed((v) => !v);
    else setMobileOpen(true);
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          Solid, not translucent: a backdrop-filtered sticky header left stale
          painted frames over the page content on route changes in Chromium.
        */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-[0_1px_3px_rgba(15,35,60,0.05)] sm:px-6">
          <button
            onClick={toggleNav}
            aria-label="Toggle navigation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-navy-2"
          >
            <Icon name="menu" className="h-5 w-5" strokeWidth={2} />
          </button>

          <div className="hidden min-w-0 flex-1 md:flex">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <HeaderAction icon="bell" label="Notifications" />
              <HeaderAction icon="chat" label="Activity" />
              <HeaderAction icon="settings" label="Settings" to="/settings" />
            </div>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-xs font-semibold text-ink">{payload?.email ?? 'Administrator'}</div>
              <div className="text-[10px] font-medium text-slate-400">
                {me?.isSuperAdmin ? 'Super Admin' : (me?.role?.name ?? 'Administrator')}
              </div>
            </div>
            <div className="gradient-emerald flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-gold/30">
              {initialsOf(payload?.email)}
            </div>
          </div>
        </header>

        {/* Search moves to its own row below the header on small screens. */}
        <div className="border-b border-slate-200 bg-white px-4 pb-2.5 md:hidden">
          <GlobalSearch />
        </div>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {/*
            Breadcrumb only. Every page already renders its own <h1>, so the
            layout stops one line short of it rather than printing the title twice.
          */}
          <nav className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span>{group?.label ?? 'Admin'}</span>
            <Icon name="chevron" className="h-3 w-3" strokeWidth={2.4} />
            <span className="text-navy-2">{item?.label ?? 'Overview'}</span>
            {item?.status === 'soon' && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold-soft px-2 py-0.5 text-[9px] font-bold tracking-wide text-gold-ink uppercase">
                <Icon name="clock" className="h-2.5 w-2.5" strokeWidth={2.4} />
                Coming soon
              </span>
            )}
          </nav>

          {/* Keyed by route so navigating away clears a caught error and replays the entry animation. */}
          <ErrorBoundary key={pathname}>
            <div key={pathname} className="animate-fade-up">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
