import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { API_URL, isMissingEndpoint } from '../lib/api';
import { getToken } from '../lib/auth';
import { useApiData } from '../lib/useApiData';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { StatCard } from '../components/ui/StatCard';
import { LEVEL_LABEL, STATUS_LABEL, STATUS_TONE, rupees } from '../lib/ads';
import type { AdDashboard, AdLevelKey, AdPlacement, AdRevenueSlice } from '../lib/types';

const ENDPOINTS = ['GET    /api/admin/ads/dashboard', 'GET    /api/admin/ads/export'];

/*
 * Colours follow the Analytics page (already checked for contrast and colour
 * blindness): one hue per measure, never per rank, so a filter never repaints.
 */
const C = { revenue: '#1F9D68', reach: '#2563EB', taps: '#D99212', grid: '#E5EAF2', axis: '#98A4B8' };

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const COUNT = new Intl.NumberFormat('en-IN');
const DURATION_LABEL: Record<string, string> = { hourly: 'Hourly (< 1 day)', daily: 'Daily (1–6 days)', weekly: 'Weekly (1–4 weeks)', monthly: 'Monthly (30 days +)' };

function compact(cents: number): string {
  const v = cents / 100;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${Math.round(v)}`;
}
const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const daysBefore = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; dataKey?: string | number; value?: number; color?: string }[];
}
function ChartTooltip({ active, label, payload, format }: TooltipProps & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      {payload.map((e) => (
        <p key={String(e.dataKey)} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
          <span className="text-slate-500">{e.name}</span>
          <span className="ml-auto font-bold text-ink tabular-nums">{format(e.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

function Card({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Horizontal bars: the labels are names, which don't fit under a vertical axis. */
function RevenueBars({ data, empty }: { data: { label: string; revenueCents: number }[]; empty: string }) {
  const rows = data.filter((d) => d.revenueCents !== 0);
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 5" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke={C.axis} width={130} />
        <Tooltip content={<ChartTooltip format={rupees} />} cursor={{ fill: 'rgba(31,157,104,0.06)' }} />
        <Bar
          name="Revenue"
          dataKey="revenueCents"
          fill={C.revenue}
          radius={[0, 4, 4, 0]}
          label={{ position: 'right', formatter: (v: unknown) => compact(Number(v ?? 0)), fontSize: 11, fill: '#64748B' }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdDashboardPage() {
  const [to, setTo] = useState(istToday);
  const [from, setFrom] = useState(() => daysBefore(istToday(), 29));
  const [asTable, setAsTable] = useState(false);
  const { data, loading, error } = useApiData<AdDashboard>(`/api/admin/ads/dashboard?from=${from}&to=${to}`, [from, to]);
  const { data: placements } = useApiData<AdPlacement[]>('/api/admin/ads/placements');
  const slotName = (k: string) => placements?.find((p) => p.key === k)?.name ?? k;

  const series = useMemo(() => (data?.series ?? []).map((d) => ({ ...d, label: dayLabel(d.date), moneyCents: d.revenueCents + d.commissionCents })), [data]);
  const hasMoney = series.some((d) => d.moneyCents !== 0);
  const hasReach = series.some((d) => d.impressions || d.clicks);
  const k = data?.kpis;
  const rangeLabel = data ? `${dayLabel(data.range.from)} – ${dayLabel(data.range.to)}` : '';

  function preset(days: number) {
    const t = istToday();
    setTo(t);
    setFrom(daysBefore(t, days - 1));
  }

  async function download(type: 'campaigns' | 'ledger') {
    const res = await fetch(`${API_URL}/api/admin/ads/export?type=${type}&from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) return window.alert('The export failed.');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `ads-${type}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const levelSlices = (data?.byLevel ?? []).map((s: AdRevenueSlice) => ({ ...s, label: LEVEL_LABEL[s.key as AdLevelKey] ?? s.key }));
  const durationSlices = (data?.byDuration ?? []).map((s) => ({ ...s, label: DURATION_LABEL[s.key] ?? s.key }));
  const placementSlices = (data?.byPlacement ?? []).map((s) => ({ ...s, label: slotName(s.key) }));
  const regionSlices = (data?.byRegion ?? []).map((s) => ({ ...s, label: `${s.label}${s.level ? ` (${s.level})` : ''}` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Ad Promotions</h1>
          <p className="text-sm text-slate-500">
            What shops pay GLOARO to be promoted, and what the ads do. Ad revenue and ad commission are counted apart from
            order commission.
          </p>
        </div>
        {/* Filters in one row above everything, never per chart. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => preset(p.days)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                  from === daysBefore(to, p.days - 1) && to === istToday() ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs" />
        </div>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Ad Promotions" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>
        ))}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}

      {k && data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Ad revenue" value={rupees(k.revenueCents)} icon="coins" tone="gold" hint={k.refundsCents ? `after ${rupees(k.refundsCents)} refunded` : rangeLabel} />
            <StatCard label="Ad commission" value={rupees(k.commissionCents)} icon="percent" tone="accent" hint={`${COUNT.format(k.orders)} orders from ads`} />
            <StatCard label="Live now" value={COUNT.format(k.campaigns.live)} icon="megaphone" tone="positive" hint={`${k.campaigns.scheduled} scheduled`} />
            <StatCard
              label="Needs approval"
              value={COUNT.format(k.campaigns.pendingApproval)}
              icon="clipboard"
              tone={k.campaigns.pendingApproval ? 'pending' : 'neutral'}
              hint={`${k.campaigns.pendingPayment} waiting for payment`}
            />
            <StatCard label="Click-through" value={pct(k.ctr)} icon="trendup" tone="processing" hint={`${COUNT.format(k.clicks)} taps · ${COUNT.format(k.impressions)} views`} />
            <StatCard label="Shops advertising" value={`${k.shopsAdvertising} of ${k.totalShops}`} icon="store" tone="neutral" hint={rangeLabel} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Mini label="Campaigns, all time" value={`${COUNT.format(k.campaigns.total)} · ${k.campaigns.completed} completed · ${k.campaigns.rejected} rejected`} />
            <Mini label="Waiting to be paid" value={rupees(k.pendingPaymentsCents)} alert={k.pendingPaymentsCents > 0} />
            <Mini label="Refunds to send" value={rupees(k.refundsPendingCents)} alert={k.refundsPendingCents > 0} />
            <Mini
              label="Orders from ads"
              value={`${COUNT.format(k.orders)} · ${rupees(k.orderValueCents)}${k.conversionRate != null ? ` · ${pct(k.conversionRate)} of taps` : ''}${k.redemptions ? ` · ${k.redemptions} offers used` : ''}`}
            />
          </div>

          <Card
            title="Ad money over time"
            subtitle={`Revenue plus ad commission, per day · ${rangeLabel}`}
            action={
              <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald" onClick={() => setAsTable((v) => !v)}>
                {asTable ? 'Show charts' : 'Show numbers'}
              </button>
            }
          >
            {asTable ? (
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50/95">
                    <tr className="border-b border-slate-200 text-left">
                      {['Day', 'Revenue', 'Commission', 'Views', 'Taps'].map((h) => (
                        <th key={h} className={`px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase ${h === 'Day' ? '' : 'text-right'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {series.map((d) => (
                      <tr key={d.date}>
                        <td className="px-3 py-1.5 text-slate-600">{d.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{rupees(d.revenueCents)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{rupees(d.commissionCents)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{COUNT.format(d.impressions)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{COUNT.format(d.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !hasMoney ? (
              <p className="py-12 text-center text-sm text-slate-400">No ad money in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={series} margin={{ top: 4, right: 4, left: -6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.revenue} stopOpacity={0.24} />
                      <stop offset="100%" stopColor={C.revenue} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke={C.axis} minTickGap={16} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(c: number) => compact(c)} tickLine={false} axisLine={false} fontSize={11} stroke={C.axis} width={58} />
                  <Tooltip content={<ChartTooltip format={rupees} />} cursor={{ stroke: C.axis, strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" name="Ad money" dataKey="moneyCents" stroke={C.revenue} strokeWidth={2} fill="url(#adFill)" dot={false}
                    activeDot={{ r: 5, fill: C.revenue, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Views and taps differ by orders of magnitude: two charts, never two axes on one. */}
          {!asTable && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Views" subtitle="Ads shown, once per shopper per hour">
                <ReachLine data={series} dataKey="impressions" name="Views" color={C.reach} empty={!hasReach} />
              </Card>
              <Card title="Taps" subtitle="Taps on an ad’s button">
                <ReachLine data={series} dataKey="clicks" name="Taps" color={C.taps} empty={!hasReach} />
              </Card>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Revenue by placement" subtitle="Each booking shared out by what its slots cost">
              <RevenueBars data={placementSlices} empty="No placement revenue in this period." />
            </Card>
            <Card title="Revenue by reach" subtitle="Local, city, district, state, country, international">
              <RevenueBars data={levelSlices} empty="No revenue in this period." />
            </Card>
            <Card title="Revenue by campaign length">
              <RevenueBars data={durationSlices} empty="No revenue in this period." />
            </Card>
            <Card title="Revenue by region" subtitle="Top 10 · a booking shared equally among its regions">
              <RevenueBars data={regionSlices} empty="No regional revenue in this period." />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Top shops" subtitle={rangeLabel}>
              {data.topShops.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No shop advertised in this period.</p>
              ) : (
                <Table
                  head={['Shop', 'Campaigns', 'Taps', 'Orders', 'Revenue', 'Commission']}
                  rows={data.topShops.map((s) => [s.name, s.campaigns, COUNT.format(s.clicks), s.orders, rupees(s.revenueCents), rupees(s.commissionCents)])}
                />
              )}
            </Card>
            <Card
              title="Top campaigns"
              subtitle={rangeLabel}
              action={
                <span className="flex gap-1.5">
                  <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald" onClick={() => download('campaigns')}>
                    Export campaigns
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald" onClick={() => download('ledger')}>
                    Export ledger
                  </button>
                </span>
              }
            >
              {data.topCampaigns.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No campaign earned or ran in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        {['Campaign', 'Status', 'Views', 'Taps', 'CTR', 'Orders', 'Money'].map((h) => (
                          <th key={h} className={`px-2 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase ${['Campaign', 'Status'].includes(h) ? '' : 'text-right'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topCampaigns.map((c) => (
                        <tr key={c.id}>
                          <td className="px-2 py-2">
                            <span className="block font-medium text-ink">{c.title}</span>
                            <span className="block text-[11px] text-slate-400">
                              {c.reference} · {c.shopName}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{COUNT.format(c.impressions)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{COUNT.format(c.clicks)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{pct(c.ctr)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {c.orders}
                            {c.redemptions ? <span className="block text-[10px] text-slate-400">{c.redemptions} offers</span> : null}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums">{rupees(c.revenueCents + c.commissionCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function ReachLine({ data, dataKey, name, color, empty }: { data: Record<string, unknown>[]; dataKey: string; name: string; color: string; empty: boolean }) {
  if (empty) return <p className="py-10 text-center text-sm text-slate-400">No ad views or taps in this period.</p>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -6, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke={C.axis} minTickGap={16} interval="preserveStartEnd" />
        <YAxis tickFormatter={(v: number) => COUNT.format(v)} tickLine={false} axisLine={false} fontSize={11} stroke={C.axis} width={44} allowDecimals={false} />
        <Tooltip content={<ChartTooltip format={(v) => COUNT.format(v)} />} cursor={{ stroke: C.axis, strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Line type="monotone" name={name} dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Mini({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
      <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`text-sm font-semibold ${alert ? 'text-state-error' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {head.map((h, i) => (
              <th key={h} className={`px-2 py-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase ${i ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={`px-2 py-2 ${j ? 'text-right tabular-nums' : 'font-medium text-ink'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
