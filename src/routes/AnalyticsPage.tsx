import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type { AnalyticsResponse } from '../lib/types';

const ENDPOINTS = ['GET    /api/admin/analytics'];

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
] as const;

/*
 * Chart colours are literal hex, like the dashboard's, so they survive being
 * written into SVG presentation attributes.
 *
 * The three channel hues are a fixed categorical order — Shop, B2B, Near Me —
 * assigned to the entity, never to its rank, so filtering never repaints a
 * series. Validated against the light chart surface: lightness band, chroma,
 * CVD separation (worst adjacent ΔE 26.4 deutan) and the normal-vision floor
 * all pass. Gold sits under 3:1 against the surface, which is why every series
 * is direct-labelled and a table view is one click away.
 */
const C = {
  shop: '#1F9D68',
  b2b: '#2563EB',
  nearMe: '#D99212',
  gmv: '#1F9D68',
  bar: '#2563EB',
  grid: '#E5EAF2',
  axis: '#98A4B8',
};

const CHANNELS = [
  { key: 'shopCents', label: 'Shop', color: C.shop },
  { key: 'b2bCents', label: 'B2B', color: C.b2b },
  { key: 'nearMeCents', label: 'Near Me', color: C.nearMe },
] as const;

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const COUNT = new Intl.NumberFormat('en-IN');

function money(cents: number): string {
  return INR.format(cents / 100);
}

function compact(cents: number): string {
  const value = cents / 100;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
  return `₹${Math.round(value)}`;
}

function percent(rate: number | null): string {
  return rate == null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

/** 'YYYY-MM-DD' at UTC noon — parsed as local time it would shift a day. */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)),
  );
}

function CardHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

interface TooltipPayload {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; dataKey?: string | number; value?: number; color?: string }[];
}

function ChartTooltip({ active, label, payload, format }: TooltipPayload & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-500">{entry.name}</span>
          <span className="ml-auto font-bold text-ink tabular-nums">{format(entry.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [asTable, setAsTable] = useState(false);

  const { data, loading, error } = useApiData<AnalyticsResponse>(`/api/admin/analytics?days=${days}`, [days]);

  const series = useMemo(
    () => (data?.series ?? []).map((p) => ({ ...p, label: dayLabel(p.date) })),
    [data],
  );
  const channels = useMemo(
    () => (data?.channels ?? []).map((p) => ({ ...p, label: dayLabel(p.date) })),
    [data],
  );

  const channelTotals = useMemo(() => {
    const totals = { shopCents: 0, b2bCents: 0, nearMeCents: 0 };
    for (const p of data?.channels ?? []) {
      totals.shopCents += p.shopCents;
      totals.b2bCents += p.b2bCents;
      totals.nearMeCents += p.nearMeCents;
    }
    return totals;
  }, [data]);

  const summary = data?.summary;
  const rangeLabel = `Last ${days} days`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Analytics</h1>
          <p className="text-sm text-slate-500">
            Every number here is measured over the same window, so they can be read against each other.
          </p>
        </div>
        {/* Filters in one row above the charts, never per-card. */}
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                days === r.value ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 23 analytics" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {summary && (
        <>
          {/* Headline numbers are tiles, not charts — a single value has no
              shape worth plotting. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="GMV"
              value={money(summary.gmvCents)}
              icon="coins"
              tone="gold"
              delta={
                summary.gmvDeltaPercent == null
                  ? undefined
                  : { percent: summary.gmvDeltaPercent, since: `vs prev ${days} days` }
              }
              hint={summary.gmvDeltaPercent == null ? rangeLabel : undefined}
            />
            <StatCard
              label="Orders"
              value={COUNT.format(summary.orders)}
              icon="cart"
              tone="processing"
              delta={
                summary.ordersDeltaPercent == null
                  ? undefined
                  : { percent: summary.ordersDeltaPercent, since: `vs prev ${days} days` }
              }
              hint={summary.ordersDeltaPercent == null ? rangeLabel : undefined}
            />
            <StatCard
              label="Average order"
              value={money(summary.aovCents)}
              icon="box"
              tone="accent"
              hint="GMV over orders"
            />
            <StatCard
              label="Conversion"
              value={percent(summary.conversionRate)}
              icon="trendup"
              tone="positive"
              hint="Orders per session"
            />
            <StatCard
              label="Repeat customers"
              value={percent(summary.repeatRate)}
              icon="users"
              tone="pending"
              hint={`${COUNT.format(summary.returningCustomers)} returning · ${COUNT.format(summary.newCustomers)} new`}
            />
          </div>

          <section className="card p-5">
            <CardHead title="GMV over time" subtitle={rangeLabel}>
              {/* One series, so no legend box — the title names it. */}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ background: C.gmv }} />
                GMV
              </span>
            </CardHead>
            {series.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Nothing was sold in this window.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series} margin={{ top: 4, right: 4, left: -6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.gmv} stopOpacity={0.24} />
                      <stop offset="100%" stopColor={C.gmv} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke={C.axis}
                    minTickGap={16}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(c: number) => compact(c)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke={C.axis}
                    width={58}
                  />
                  <Tooltip
                    content={<ChartTooltip format={money} />}
                    cursor={{ stroke: C.axis, strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area
                    type="monotone"
                    name="GMV"
                    dataKey="gmvCents"
                    stroke={C.gmv}
                    strokeWidth={2}
                    fill="url(#gmvFill)"
                    dot={false}
                    activeDot={{ r: 5, fill: C.gmv, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="card p-5">
            <CardHead title="Where the money came from" subtitle="GMV by channel">
              <button
                onClick={() => setAsTable((v) => !v)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
              >
                {asTable ? 'Show chart' : 'Show numbers'}
              </button>
            </CardHead>

            {/* Legend is always present for more than one series, and each
                carries its total — identity never rests on colour alone. */}
            <div className="mb-3 flex flex-wrap gap-4">
              {CHANNELS.map((ch) => (
                <span key={ch.key} className="inline-flex items-baseline gap-1.5">
                  <span className="h-2 w-2 translate-y-[-1px] rounded-full" style={{ background: ch.color }} />
                  <span className="text-[11px] font-semibold text-slate-500">{ch.label}</span>
                  <span className="text-[13px] font-bold text-ink tabular-nums">{compact(channelTotals[ch.key])}</span>
                </span>
              ))}
            </div>

            {channels.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No channel data for this window.</p>
            ) : asTable ? (
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50/95">
                    <tr className="border-b border-slate-200 text-left">
                      {['Day', 'Shop', 'B2B', 'Near Me'].map((h) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase ${
                            h === 'Day' ? '' : 'text-right'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {channels.map((p) => (
                      <tr key={p.date}>
                        <td className="px-3 py-1.5 text-slate-600">{p.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{money(p.shopCents)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{money(p.b2bCents)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{money(p.nearMeCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={channels} margin={{ top: 4, right: 4, left: -6, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke={C.axis}
                    minTickGap={16}
                    interval="preserveStartEnd"
                  />
                  {/* One axis. Three series of the same measure share it. */}
                  <YAxis
                    tickFormatter={(c: number) => compact(c)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke={C.axis}
                    width={58}
                  />
                  <Tooltip
                    content={<ChartTooltip format={money} />}
                    cursor={{ stroke: C.axis, strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  {CHANNELS.map((ch) => (
                    <Line
                      key={ch.key}
                      type="monotone"
                      name={ch.label}
                      dataKey={ch.key}
                      stroke={ch.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, fill: ch.color, stroke: '#fff', strokeWidth: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <CardHead title="Top shops" subtitle={`By GMV · ${rangeLabel}`} />
              {data.vendors.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">No shop sold anything in this window.</p>
              ) : (
                // Horizontal bars: the labels are names, which never fit under
                // a vertical axis without turning sideways.
                <ResponsiveContainer width="100%" height={Math.max(180, data.vendors.length * 34)}>
                  <BarChart
                    data={data.vendors}
                    layout="vertical"
                    margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
                    barCategoryGap={6}
                  >
                    <CartesianGrid stroke={C.grid} strokeDasharray="3 5" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="vendorName"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      stroke={C.axis}
                      width={124}
                    />
                    <Tooltip
                      content={<ChartTooltip format={money} />}
                      cursor={{ fill: 'rgba(37,99,235,0.06)' }}
                    />
                    <Bar
                      name="GMV"
                      dataKey="gmvCents"
                      fill={C.bar}
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        formatter: (v: unknown) => compact(Number(v ?? 0)),
                        fontSize: 11,
                        fill: '#64748B',
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="card p-5">
              <CardHead title="Where customers are" subtitle={`By GMV · ${rangeLabel}`} />
              {data.locations.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">No location data for this window.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        {['City', 'Orders', 'Customers', 'GMV'].map((h) => (
                          <th
                            key={h}
                            className={`px-2 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase ${
                              h === 'City' ? '' : 'text-right'
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.locations.map((l) => (
                        <tr key={l.city}>
                          <td className="px-2 py-2 font-medium text-ink">{l.city}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{COUNT.format(l.orders)}</td>
                          <td className="px-2 py-2 text-right text-slate-500 tabular-nums">
                            {COUNT.format(l.customers)}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-ink tabular-nums">
                            {money(l.gmvCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="card p-5">
            <CardHead title="From looking to paying" subtitle="Where people drop out" />
            {data.funnel.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No funnel data for this window.</p>
            ) : (
              // A funnel is a set of ratios, and the drop between steps is the
              // point — so each step states its own share of the one before it.
              <div className="space-y-2">
                {data.funnel.map((stage, i) => {
                  const first = data.funnel[0].count;
                  const previous = i === 0 ? null : data.funnel[i - 1].count;
                  const ofFirst = first > 0 ? stage.count / first : 0;
                  const ofPrevious = previous && previous > 0 ? stage.count / previous : null;
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="font-semibold text-slate-600 capitalize">
                          {stage.stage.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          <span className="font-bold text-ink">{COUNT.format(stage.count)}</span>
                          {ofPrevious != null && (
                            <span className={ofPrevious < 0.5 ? ' text-state-error' : ' text-slate-400'}>
                              {' '}
                              · {(ofPrevious * 100).toFixed(0)}% of the step before
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(1, ofFirst * 100)}%`, background: C.bar }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
