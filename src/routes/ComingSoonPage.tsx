import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { NAV_GROUPS, findNavGroup, findNavItem } from '../lib/navigation';

/**
 * Placeholder for every roadmap module listed in the sidebar. Routing them here
 * rather than disabling the link keeps the full marketplace scope navigable and
 * tells the operator which phase the module belongs to.
 */
export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const group = findNavGroup(pathname);

  // Sibling modules from the same group, so this page doubles as a scope map.
  const siblings = group?.items.filter((i) => i.to !== pathname) ?? [];
  const shipped = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.status === 'live');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="gradient-shell relative overflow-hidden rounded-2xl p-8 text-white">
        <div className="relative">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
              <Icon name={item?.icon ?? 'sparkle'} className="h-6 w-6" strokeWidth={1.6} />
            </div>
            {item?.phase && (
              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-white/60 uppercase">
                {item.phase}
              </span>
            )}
            <span className="animate-pulse-soft flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.1em] uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              In roadmap
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{item?.label ?? 'Module'}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
            {item?.summary ?? 'This module is part of the Gloaro Mart roadmap and has not been built yet.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              to="/"
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-[13px] hover:opacity-95"
            >
              <Icon name="dashboard" className="h-4 w-4" />
              Back to dashboard
            </Link>
            <span className="inline-flex items-center gap-2 rounded-[0.6rem] border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-medium text-white/60">
              <Icon name="clock" className="h-4 w-4" />
              Not yet available
            </span>
          </div>
        </div>
      </div>

      {siblings.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-bold text-ink">Also in {group?.label}</h2>
          <p className="mb-4 text-xs text-slate-500">Related modules and their current build status.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {siblings.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-mint-soft hover:bg-mint-mist/40"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    s.status === 'live'
                      ? 'bg-emerald/10 text-emerald'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon name={s.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{s.label}</span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {s.status === 'live' ? 'Available now' : (s.phase ?? 'Planned')}
                  </span>
                </span>
                <Icon
                  name="chevron"
                  className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-bold text-ink">Available today</h2>
        <p className="mb-4 text-xs text-slate-500">{shipped.length} modules are already live in this console.</p>
        <div className="flex flex-wrap gap-2">
          {shipped.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:border-emerald hover:bg-emerald hover:text-white"
            >
              <Icon name={s.icon} className="h-3.5 w-3.5" />
              {s.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
