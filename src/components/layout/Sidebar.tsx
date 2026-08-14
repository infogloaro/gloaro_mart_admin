import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clearToken } from '../../lib/auth';
import { NAV_GROUPS, type NavGroup, type NavItem } from '../../lib/navigation';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';

function ComingSoonPill() {
  return (
    <span className="ml-auto shrink-0 rounded-full border border-gold/45 bg-black/25 px-1.5 py-px text-[9px] font-bold tracking-[0.06em] text-gold/85 uppercase">
      Soon
    </span>
  );
}

function NavRow({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const isSoon = item.status === 'soon';
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={isSoon ? `${item.label} — coming soon` : item.label}
      className={({ isActive }) =>
        [
          'group relative flex items-center rounded-[10px] py-2 text-[13px] font-semibold transition-all duration-200',
          collapsed ? 'justify-center px-0' : 'gap-2.5 pr-2 pl-3',
          isActive
            ? 'gradient-gold-active text-navy shadow-[0_10px_22px_-12px_rgba(242,178,51,0.85)]'
            : isSoon
              ? 'text-white/45 hover:bg-white/8 hover:text-white/75'
              : 'text-white/80 hover:bg-white/8 hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {/* Thin gold rail marking the active route. */}
          <span
            className={`absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold transition-opacity duration-200 ${
              collapsed ? '-left-2' : '-left-3'
            } ${isActive ? 'opacity-100' : 'opacity-0'}`}
          />
          <Icon
            name={item.icon}
            className={`h-[17px] w-[17px] shrink-0 transition-transform duration-200 ${
              isActive ? '' : 'group-hover:scale-110'
            }`}
          />
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              {isSoon && <ComingSoonPill />}
            </>
          )}
          {/* Collapsed rail keeps the soon state legible as a corner dot. */}
          {collapsed && isSoon && (
            <span className="absolute top-1.5 right-2.5 h-1.5 w-1.5 rounded-full bg-gold/70" />
          )}
        </>
      )}
    </NavLink>
  );
}

function NavGroupBlock({
  group,
  forceOpen,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  forceOpen: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(true);
  const expanded = forceOpen || open;
  const soonCount = group.items.filter((i) => i.status === 'soon').length;

  // Collapsed to an icon rail there is no room for a heading — a hairline keeps
  // the grouping visible without one.
  if (collapsed) {
    return (
      <div className="mb-2 border-t border-white/8 pt-2 first:border-t-0 first:pt-0">
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavRow key={item.to} item={item} collapsed onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-extrabold tracking-[0.14em] text-white/40 uppercase hover:text-gold/80"
      >
        <Icon
          name="chevron"
          className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          strokeWidth={2.4}
        />
        <span>{group.label}</span>
        {soonCount > 0 && (
          <span className="ml-auto rounded-full bg-white/8 px-1.5 text-[9px] font-bold text-white/45">{soonCount}</span>
        )}
      </button>
      <div
        className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 space-y-0.5 pl-3">
            {group.items.map((item) => (
              <NavRow key={item.to} item={item} collapsed={false} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  /** Icon-only rail on desktop. Ignored while the mobile drawer is open. */
  collapsed: boolean;
  /** Drawer state below `lg`. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');

  // The drawer sits over the page, so Escape has to be able to dismiss it.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_GROUPS;
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const liveCount = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.status === 'live').length;
  const totalCount = NAV_GROUPS.flatMap((g) => g.items).length;
  const livePercent = Math.round((liveCount / totalCount) * 100);

  function handleLogout() {
    clearToken();
    window.location.assign('/login');
  }

  // The drawer always shows the full rail: an icon-only drawer helps nobody.
  const isRail = collapsed && !mobileOpen;

  return (
    <>
      {/* Scrim — only ever painted while the drawer is open. */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-navy/55 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={[
          'gradient-shell fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-navy-line/60 text-white',
          'transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          // Drops out of the fixed drawer back into the flow as a sticky rail.
          'lg:sticky lg:inset-auto lg:top-0 lg:translate-x-0',
          mobileOpen ? 'translate-x-0 shadow-[0_0_60px_rgba(7,26,51,0.5)]' : '-translate-x-full',
          isRail ? 'w-[268px] lg:w-[76px]' : 'w-[268px]',
        ].join(' ')}
      >
        <div className={`flex items-center gap-2.5 pt-5 pb-4 ${isRail ? 'justify-center px-3' : 'px-5'}`}>
          {/* Light tile: the mark is navy and gold and disappears on the shell. */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.5)]">
            <Logo className="h-7 w-7" />
          </div>
          {!isRail && (
            <div className="leading-tight">
              <div className="text-[13px] font-extrabold tracking-[0.08em] text-white">GLOARO MART</div>
              <div className="text-[10px] font-semibold tracking-wide text-gold/70">Admin Console</div>
            </div>
          )}
          <button
            onClick={onCloseMobile}
            className="ml-auto rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <Icon name="x" className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        {!isRail && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules…"
                className="w-full rounded-[10px] border border-white/10 bg-white/6 py-2 pr-2 pl-8 text-xs font-medium text-white caret-gold placeholder:text-white/35 focus-visible:border-gold/60 focus-visible:bg-white/10"
              />
            </div>
          </div>
        )}

        <nav className={`scrollbar-shell flex-1 overflow-y-auto pb-3 ${isRail ? 'px-3 pt-1' : 'px-4'}`}>
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs font-medium text-white/60">No module matches “{query}”.</p>
          ) : (
            groups.map((group) => (
              <NavGroupBlock
                key={group.id}
                group={group}
                collapsed={isRail}
                onNavigate={onCloseMobile}
                // A filtered result set is useless collapsed, and the group holding
                // the current route should never be able to hide it.
                forceOpen={query.trim() !== '' || group.items.some((i) => i.to === pathname)}
              />
            ))
          )}
        </nav>

        <div className={`border-t border-navy-line/60 py-3 ${isRail ? 'px-3' : 'px-4'}`}>
          {isRail ? (
            <div
              title={`${liveCount} of ${totalCount} modules live`}
              className="mx-auto mb-2.5 h-1 w-8 overflow-hidden rounded-full bg-white/12"
            >
              <div className="h-full rounded-full bg-gold" style={{ width: `${livePercent}%` }} />
            </div>
          ) : (
            <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-white/8 bg-white/6 px-2.5 py-2">
              <Icon name="sparkle" className="h-3.5 w-3.5 shrink-0 text-gold/70" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-white/75">
                  {liveCount} of {totalCount} modules live
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gold transition-[width] duration-700"
                    style={{ width: `${livePercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Log out"
            className={`flex w-full items-center rounded-[10px] py-2 text-[13px] font-semibold text-white/70 hover:bg-white/8 hover:text-white ${
              isRail ? 'justify-center px-0' : 'gap-2.5 px-3'
            }`}
          >
            <Icon name="logout" className="h-[17px] w-[17px] shrink-0" />
            {!isRail && 'Log out'}
          </button>
        </div>
      </aside>
    </>
  );
}
