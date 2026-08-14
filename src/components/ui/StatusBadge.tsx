interface StatusBadgeProps {
  status: string;
}

/**
 * Dot + tinted pill. The dot carries the meaning at a glance in dense tables.
 *
 * One colour per state across the whole console — the same green that fills a
 * delivered slice in the dashboard donut fills its pill here.
 */
const SUCCESS = 'border-state-success/25 bg-state-success/10 text-state-success-ink [--dot:var(--color-state-success)]';
const PROCESSING =
  'border-state-processing/25 bg-state-processing/10 text-state-processing-ink [--dot:var(--color-state-processing)]';
const SHIPPED = 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink [--dot:var(--color-state-shipped)]';
const PENDING = 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink [--dot:var(--color-state-pending)]';
const ERROR = 'border-state-error/25 bg-state-error/10 text-state-error-ink [--dot:var(--color-state-error)]';

const COLORS: Record<string, string> = {
  approved: SUCCESS,
  delivered: SUCCESS,
  converted: SUCCESS,
  active: SUCCESS,
  paid: SUCCESS,
  rejected: ERROR,
  cancelled: ERROR,
  suspended: ERROR,
  failed: ERROR,
  pending: PENDING,
  processing: PROCESSING,
  confirmed: PROCESSING,
  packed: PROCESSING,
  shipped: SHIPPED,
  out_for_delivery: SHIPPED,
};

const FALLBACK = 'border-slate-200 bg-slate-100 text-slate-600 [--dot:var(--color-slate-400)]';

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = COLORS[status] ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${colorClass}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot)]" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
