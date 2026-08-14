import { Icon } from './Icon';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const buttonClass =
    'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <span className="font-medium tabular-nums">
        Showing <span className="font-bold text-ink">{first}–{last}</span> of{' '}
        <span className="font-bold text-ink">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={buttonClass}>
          <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" strokeWidth={2.2} />
          Previous
        </button>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-600 tabular-nums">
          {page} / {lastPage}
        </span>
        <button disabled={page >= lastPage} onClick={() => onPageChange(page + 1)} className={buttonClass}>
          Next
          <Icon name="chevron" className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
