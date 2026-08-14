import { Icon, type IconName } from './Icon';

type Tone = 'accent' | 'gold' | 'positive' | 'warning' | 'critical' | 'neutral' | 'processing' | 'pending';

/** Soft tinted tile + matching glyph. One tone per metric, never mixed inside a card. */
const TONES: Record<Tone, string> = {
  accent: 'bg-navy-2/10 text-navy-2',
  // Money only: revenue, wallets, settlements, premium.
  gold: 'bg-gold-soft text-gold-deep',
  positive: 'bg-state-success/12 text-state-success',
  warning: 'bg-state-shipped/14 text-state-shipped',
  critical: 'bg-state-error/12 text-state-error',
  neutral: 'bg-slate-100 text-slate-500',
  processing: 'bg-state-processing/12 text-state-processing',
  pending: 'bg-state-pending/12 text-state-pending',
};

export interface StatDelta {
  /** Signed percentage, e.g. -5.4 renders as “▼ 5.4%”. */
  percent: number;
  /** What the change is measured against, e.g. “vs prev 15 days”. */
  since: string;
}

interface StatCardProps {
  label: string;
  value: string;
  /** Glyph shown in the tinted tile. */
  icon?: IconName;
  tone?: Tone;
  /** Small caption under the value — used when there is no comparable history. */
  hint?: string;
  /** Period-over-period movement. Only pass this when it is a real measurement. */
  delta?: StatDelta;
}

export function StatCard({ label, value, icon, tone = 'accent', hint, delta }: StatCardProps) {
  const up = (delta?.percent ?? 0) >= 0;

  return (
    <div className="card card-interactive p-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
            <Icon name={icon} className="h-[22px] w-[22px]" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {/* Wraps rather than truncates: at the 2-up mobile grid "Total Customers" would clip. */}
          <div className="text-[11px] leading-tight font-semibold tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 truncate text-[22px] leading-tight font-extrabold tracking-tight text-ink tabular-nums">
            {value}
          </div>
        </div>
      </div>

      {(delta || hint) && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] leading-none">
          {delta && (
            <span
              className={`inline-flex items-center gap-1 font-bold tabular-nums ${
                up ? 'text-state-success' : 'text-state-error'
              }`}
            >
              <Icon name={up ? 'trendup' : 'trenddown'} className="h-3 w-3" strokeWidth={2.4} />
              {Math.abs(delta.percent).toFixed(1)}%
            </span>
          )}
          <span className="truncate font-medium text-slate-400">{delta ? delta.since : hint}</span>
        </div>
      )}
    </div>
  );
}
