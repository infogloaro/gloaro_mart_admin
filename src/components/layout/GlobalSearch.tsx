import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { NAV_GROUPS } from '../../lib/navigation';

interface Hit {
  to: string;
  label: string;
  group: string;
  icon: Parameters<typeof Icon>[0]['name'];
  soon: boolean;
}

const ALL_HITS: Hit[] = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ to: i.to, label: i.label, group: g.label, icon: i.icon, soon: i.status === 'soon' }))
);

/** Header search. Ctrl/⌘-K focuses it; ↑ ↓ and Enter move through the results. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_HITS.filter((h) => h.label.toLowerCase().includes(q) || h.group.toLowerCase().includes(q)).slice(0, 7);
  }, [query]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  function go(hit: Hit) {
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    navigate(hit.to);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[cursor]);
    }
  }

  const showList = open && query.trim() !== '';

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <Icon name="search" className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKey}
        placeholder="Search anything…"
        aria-label="Search modules"
        className="w-full rounded-[10px] border border-slate-200 bg-slate-50 py-2 pr-16 pl-9 text-[13px] font-medium text-ink placeholder:text-slate-400"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
        Ctrl K
      </kbd>

      {showList && (
        <div className="card absolute top-full left-0 z-50 mt-2 w-full overflow-hidden p-1.5 shadow-[0_20px_44px_-20px_rgba(15,35,60,0.35)]">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs font-medium text-slate-400">No module matches “{query}”.</p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.to}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(hit)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                  i === cursor ? 'bg-slate-100' : ''
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-2/8 text-navy-2">
                  <Icon name={hit.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{hit.label}</span>
                  <span className="block truncate text-[10px] font-medium text-slate-400">{hit.group}</span>
                </span>
                {hit.soon && (
                  <span className="shrink-0 rounded-full border border-gold/50 bg-gold-soft px-1.5 py-px text-[9px] font-bold text-gold-ink uppercase">
                    Soon
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
