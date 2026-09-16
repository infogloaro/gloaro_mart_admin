import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useApiData } from '../lib/useApiData';
import { useDashboardExtras, type OrderStatus } from '../lib/useDashboard';
import { StatCard, type StatDelta } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Icon, type IconName } from '../components/ui/Icon';
import { findNavItem } from '../lib/navigation';
import { getValidAdminPayload } from '../lib/auth';
import type { AdminOrderListRow, DailyRevenuePoint, PlatformSummary, TopProduct } from '../lib/types';

/*
 * Chart colours are literal hex rather than var() so they survive being written
 * into SVG presentation attributes. They mirror the --color-state-* tokens and
 * must be changed together with them.
 */
const C = {
  gold: '#F2B233',
  goldDeep: '#D99212',
  delivered: '#1F9D68',
  processing: '#2563EB',
  shipped: '#F59E0B',
  pending: '#7C3AED',
  cancelled: '#E5484D',
  grid: '#E5EAF2',
  axis: '#98A4B8',
};

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const INR_COMPACT = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const COUNT = new Intl.NumberFormat('en-IN');

function money(cents: number) {
  return INR.format(cents / 100);
}

function units(n: number) {
  return `${COUNT.format(n)} ${n === 1 ? 'unit' : 'units'}`;
}

/** 'YYYY-MM-DD' at UTC noon — parsing it as local time shifts the label a day. */
function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

const DAY_FMT = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const MONTH_FMT = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const DATETIME_FMT = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Revenue series ──

type Bucket = 'daily' | 'weekly' | 'monthly';

interface SeriesPoint {
  label: string;
  revenueCents: number;
}

/**
 * The API returns one row per day. Weekly folds those into consecutive 7-day
 * blocks anchored at the newest day; monthly folds them by calendar month —
 * over a 30-day window that is one or two points, which is the honest picture
 * rather than a padded one.
 */
function bucketise(points: DailyRevenuePoint[], bucket: Bucket): SeriesPoint[] {
  if (bucket === 'daily') {
    return points.map((p) => ({ label: DAY_FMT.format(parseDay(p.date)), revenueCents: p.revenueCents }));
  }

  if (bucket === 'weekly') {
    const out: SeriesPoint[] = [];
    for (let end = points.length; end > 0; end -= 7) {
      const chunk = points.slice(Math.max(0, end - 7), end);
      out.unshift({
        label: `${DAY_FMT.format(parseDay(chunk[0].date))} – ${DAY_FMT.format(parseDay(chunk[chunk.length - 1].date))}`,
        revenueCents: chunk.reduce((s, p) => s + p.revenueCents, 0),
      });
    }
    return out;
  }

  const byMonth = new Map<string, number>();
  for (const p of points) {
    const key = p.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.revenueCents);
  }
  return [...byMonth.entries()].map(([key, revenueCents]) => ({
    label: MONTH_FMT.format(parseDay(`${key}-01`)),
    revenueCents,
  }));
}

/**
 * Split the window in half and compare the halves. The API exposes no earlier
 * period, so this is the only period-over-period move that can be measured —
 * and with no baseline revenue there is no percentage to state at all.
 */
function revenueDelta(points: DailyRevenuePoint[]): StatDelta | undefined {
  if (points.length < 4) return undefined;
  const half = Math.floor(points.length / 2);
  const sum = (arr: DailyRevenuePoint[]) => arr.reduce((s, p) => s + p.revenueCents, 0);
  const previous = sum(points.slice(0, half));
  const current = sum(points.slice(points.length - half));
  if (previous <= 0) return undefined;
  return { percent: ((current - previous) / previous) * 100, since: `vs prev ${half} days` };
}

// ── Order status ──

interface StatusBucket {
  label: string;
  color: string;
  from: OrderStatus[];
}

/**
 * The console's five order states, folded from the six the backend stores.
 *
 * Colours match the status pills used everywhere else in the panel — a
 * delivered order is green in the donut, in the table and on the order screen.
 * Cancelled is carried through instead of dropped: leaving it out would make
 * every percentage in this card wrong.
 */
const STATUS_BUCKETS: StatusBucket[] = [
  { label: 'Delivered', color: C.delivered, from: ['delivered'] },
  { label: 'Processing', color: C.processing, from: ['confirmed', 'packed'] },
  { label: 'Shipped', color: C.shipped, from: ['out_for_delivery'] },
  { label: 'Pending', color: C.pending, from: ['pending'] },
  { label: 'Cancelled', color: C.cancelled, from: ['cancelled'] },
];

// ── Small parts ──

function CardHead({ title, subtitle, to, children }: { title: string; subtitle?: string; to?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {to && (
          <Link
            to={to}
            className="text-[11px] font-bold text-navy-2 transition-colors duration-200 hover:text-gold-ink"
          >
            View all
          </Link>
        )}
      </div>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 shadow-[0_12px_32px_-12px_rgba(15,35,60,0.32)]">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="text-sm font-bold text-gold-ink tabular-nums">{money(Number(payload[0].value))}</div>
    </div>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="card px-3 py-2 shadow-[0_12px_32px_-12px_rgba(15,35,60,0.32)]">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{slice.label}</div>
      <div className="text-sm font-bold text-ink tabular-nums">
        {COUNT.format(slice.value)} order{slice.value === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function TopProductList({ items, byRevenue }: { items: TopProduct[]; byRevenue: boolean }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No delivered orders yet.</p>;
  }
  const values = items.map((p) => (byRevenue ? (p.revenueCents ?? 0) : (p.quantity ?? 0)));
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0) || 1;

  return (
    <ul className="space-y-3.5">
      {items.map((p, i) => {
        const raw = byRevenue ? (p.revenueCents ?? 0) : (p.quantity ?? 0);
        // The other measure, when this endpoint happens to carry it. Each list
        // is ranked on one field and the sibling field is often absent, so the
        // sub-line is dropped rather than printed as a zero.
        const secondary = byRevenue
          ? p.quantity != null
            ? units(p.quantity)
            : null
          : p.revenueCents != null
            ? money(p.revenueCents)
            : null;
        // The same product can rank twice — once per vendor selling it — so the
        // id alone is not unique. Rank is, within one ordered list.
        return (
          <li key={`${p.productId}-${i}`}>
            <div className="flex items-center gap-3">
              {/* No product image on this endpoint — the rank tile stands in for it. */}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                  i === 0 ? 'bg-gold text-navy shadow-[0_6px_14px_-8px_rgba(242,178,51,0.9)]' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
                {secondary && <span className="block text-[11px] font-medium text-slate-400">{secondary}</span>}
              </span>
              <span className="shrink-0 text-[13px] font-bold text-ink tabular-nums">
                {byRevenue ? money(raw) : units(raw)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-gold-deep to-gold transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ width: `${Math.max(4, (raw / max) * 100)}%` }}
                />
              </span>
              {/* Share of this top-five list, not growth: the API carries no prior period per product. */}
              <span className="shrink-0 text-[11px] font-bold text-slate-500 tabular-nums">
                {((raw / total) * 100).toFixed(1)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RecentOrders({ orders }: { orders: AdminOrderListRow[] | null }) {
  if (!orders) {
    return <p className="py-8 text-center text-sm text-slate-400">Recent orders are unavailable right now.</p>;
  }
  if (orders.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No orders yet.</p>;
  }
  return (
    <ul className="-mx-1.5">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            to="/orders"
            className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors duration-200 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Icon name="receipt" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink">#{o.id}</span>
              <span className="block truncate text-[11px] font-medium text-slate-400">{o.customer_name}</span>
            </span>
            <span className="hidden shrink-0 text-[11px] font-medium text-slate-400 sm:block">
              {DATETIME_FMT.format(new Date(o.created_at))}
            </span>
            <span className="shrink-0 text-[13px] font-bold text-ink tabular-nums">{money(o.total_cents)}</span>
            <span className="shrink-0">
              <StatusBadge status={o.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Eight shortcuts, each resolved against the nav config so the SOON badges stay true. */
const QUICK_ACCESS: { to: string; label: string; icon: IconName; tone: string }[] = [
  { to: '/analytics', label: 'Analytics', icon: 'chart', tone: 'bg-state-processing/12 text-state-processing' },
  { to: '/products', label: 'Products', icon: 'box', tone: 'bg-gold-soft text-gold-deep' },
  { to: '/orders', label: 'Orders', icon: 'cart', tone: 'bg-state-success/12 text-state-success' },
  { to: '/users', label: 'Customers', icon: 'users', tone: 'bg-navy-2/10 text-navy-2' },
  { to: '/vendors', label: 'Vendors', icon: 'store', tone: 'bg-state-pending/12 text-state-pending' },
  { to: '/inventory', label: 'Inventory', icon: 'package', tone: 'bg-state-shipped/14 text-state-shipped' },
  { to: '/wallets', label: 'Wallets', icon: 'wallet', tone: 'bg-gold-soft text-gold-deep' },
  { to: '/settings', label: 'Settings', icon: 'settings', tone: 'bg-slate-100 text-slate-500' },
];

function QuickAccess() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {QUICK_ACCESS.map((m) => {
        const soon = findNavItem(m.to)?.status === 'soon';
        return (
          <Link
            key={m.to}
            to={m.to}
            className="card card-interactive group relative flex flex-col items-center gap-2.5 px-3 py-4 text-center"
          >
            {soon && (
              <span className="absolute top-2 right-2 rounded-full border border-gold/50 bg-gold-soft px-1.5 py-px text-[8px] font-bold tracking-wide text-gold-ink uppercase">
                Soon
              </span>
            )}
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${m.tone}`}
            >
              <Icon name={m.icon} className="h-5 w-5" />
            </span>
            <span className="text-[12px] font-bold text-ink">{m.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[104px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="skeleton h-80 rounded-2xl lg:col-span-3" />
        <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
      </div>
      <div className="skeleton h-56 rounded-2xl" />
    </div>
  );
}

// ── Page ──

const RANGES = [7, 14, 30] as const;

export default function DashboardPage() {
  const { data: summary, loading, error } = useApiData<PlatformSummary>('/api/admin/reports/summary');
  const { extras } = useDashboardExtras();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [bucket, setBucket] = useState<Bucket>('daily');
  const payload = getValidAdminPayload();

  // Memoised so the empty fallback is not a fresh array on every render.
  const daily = useMemo(() => summary?.dailyRevenue ?? [], [summary]);
  const windowed = useMemo(() => daily.slice(-rangeDays), [daily, rangeDays]);
  const series = useMemo(() => bucketise(windowed, bucket), [windowed, bucket]);
  const delta = useMemo(() => revenueDelta(daily), [daily]);

  const statusSlices = useMemo(() => {
    if (!extras.ordersByStatus) return null;
    const counts = extras.ordersByStatus;
    return STATUS_BUCKETS.map((b) => ({
      label: b.label,
      color: b.color,
      value: b.from.reduce((s, k) => s + (counts[k] ?? 0), 0),
    })).filter((s) => s.value > 0);
  }, [extras.ordersByStatus]);

  const statusTotal = statusSlices?.reduce((s, x) => s + x.value, 0) ?? 0;

  const rangeLabel =
    windowed.length > 0
      ? `${DAY_FMT.format(parseDay(windowed[0].date))} – ${DAY_FMT.format(parseDay(windowed[windowed.length - 1].date))}`
      : 'No revenue days yet';

  function exportCsv() {
    if (!summary) return;
    const rows: (string | number)[][] = [
      ['Metric', 'Value'],
      ['Total revenue (INR)', (summary.totalRevenueCents / 100).toFixed(2)],
      ['Delivered orders', summary.deliveredOrderCount],
      ['Orders last 30 days', summary.ordersLast30Days],
      ['Orders all time', summary.totalOrdersAllTime],
      ['Customers', summary.userCounts.customers],
      ['Vendors', summary.userCounts.vendors],
      ['Vendors approved', summary.vendorCounts.approved],
      ['Vendors pending', summary.vendorCounts.pending],
      ['Products', extras.productTotal ?? ''],
      ['Wallet balances held (INR)', extras.pendingPayoutCents != null ? (extras.pendingPayoutCents / 100).toFixed(2) : ''],
      [],
      ['Date', 'Revenue (INR)'],
      ...daily.map((p) => [p.date, (p.revenueCents / 100).toFixed(2)]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gloaro-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <SkeletonDashboard />;
  if (error) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
        <Icon name="alert" className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }
  if (!summary) return null;

  const selectClass =
    'appearance-none rounded-[10px] border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-semibold text-ink';

  return (
    <div className="space-y-5">
      {/* Page head — title on the left, reporting window and export on the right. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Welcome back, {payload?.email?.split('@')[0] ?? 'Super Admin'} 👋
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Icon
              name="calendar"
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            />
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              aria-label="Revenue reporting window"
              className={`${selectClass} pl-8`}
            >
              {RANGES.map((r) => (
                <option key={r} value={r}>
                  Last {r} days
                </option>
              ))}
            </select>
            <Icon
              name="chevron"
              className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 rotate-90 text-slate-400"
              strokeWidth={2.4}
            />
          </div>
          <span className="hidden rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 sm:block">
            {rangeLabel}
          </span>
          <button
            onClick={exportCsv}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-xs"
            title="Download the summary and daily revenue as CSV"
          >
            <Icon name="download" className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/*
        Platform totals. Only revenue has a measurable prior period in the API,
        so it is the only card carrying a percentage — the rest state what they
        actually count instead of an invented movement.
      */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Revenue"
          value={money(summary.totalRevenueCents)}
          icon="wallet"
          tone="gold"
          delta={delta}
          hint="Delivered orders, all time"
        />
        <StatCard
          label="Total Orders"
          value={COUNT.format(summary.totalOrdersAllTime)}
          icon="cart"
          tone="processing"
          hint={`${COUNT.format(summary.ordersLast30Days)} in last 30 days`}
        />
        <StatCard
          label="Total Customers"
          value={COUNT.format(summary.userCounts.customers)}
          icon="users"
          tone="accent"
          hint="Registered accounts"
        />
        <StatCard
          label="Total Products"
          value={extras.productTotal != null ? COUNT.format(extras.productTotal) : '—'}
          icon="box"
          tone="pending"
          // The list endpoint counts every product, active or not.
          hint="In the catalogue"
        />
        <StatCard
          label="Active Vendors"
          value={COUNT.format(summary.vendorCounts.approved)}
          icon="store"
          tone="positive"
          hint={`${COUNT.format(summary.vendorCounts.pending)} awaiting approval`}
        />
        <StatCard
          label="Wallet Balances"
          value={extras.pendingPayoutCents != null ? money(extras.pendingPayoutCents) : '—'}
          icon="coins"
          tone="warning"
          hint={
            extras.payoutVendorCount != null
              ? `Held across ${extras.payoutVendorCount} vendor${extras.payoutVendorCount === 1 ? '' : 's'}`
              : 'Owed to vendors'
          }
        />
      </div>

      {/* Analytics — 60 / 40. */}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <CardHead title="Revenue Overview" subtitle={rangeLabel}>
            <span className="mr-1 hidden items-center gap-1.5 text-[11px] font-semibold text-slate-500 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-gold" />
              Revenue (₹)
            </span>
            <div className="relative">
              <select
                value={bucket}
                onChange={(e) => setBucket(e.target.value as Bucket)}
                aria-label="Revenue grouping"
                className={selectClass}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <Icon
                name="chevron"
                className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 rotate-90 text-slate-400"
                strokeWidth={2.4}
              />
            </div>
          </CardHead>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={series} margin={{ top: 4, right: 4, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.gold} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={C.gold} stopOpacity={0.02} />
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
                tickFormatter={(c: number) => INR_COMPACT.format(c / 100)}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke={C.axis}
                width={64}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ stroke: C.goldDeep, strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="revenueCents"
                stroke={C.gold}
                strokeWidth={2.5}
                fill="url(#revenueFill)"
                dot={false}
                activeDot={{ r: 5, fill: C.gold, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="card p-5 lg:col-span-2">
          <CardHead title="Order Status" subtitle="Every order on the platform" to="/orders" />
          {!statusSlices ? (
            <p className="py-12 text-center text-sm text-slate-400">Order status counts are unavailable right now.</p>
          ) : statusTotal === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No orders yet.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="w-full max-w-[190px] shrink-0">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={statusSlices}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="62%"
                      outerRadius="100%"
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {statusSlices.map((s) => (
                        <Cell key={s.label} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="min-w-0 flex-1">
                <ul className="space-y-2">
                  {statusSlices.map((s) => (
                    <li key={s.label} className="flex items-center gap-2 text-[13px]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-600">{s.label}</span>
                      <span className="shrink-0 font-bold text-ink tabular-nums">{COUNT.format(s.value)}</span>
                      <span className="w-12 shrink-0 text-right text-[11px] font-semibold text-slate-400 tabular-nums">
                        {((s.value / statusTotal) * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <div className="text-[11px] font-semibold text-slate-500">Total Orders</div>
                  <div className="text-2xl font-extrabold tracking-tight text-ink tabular-nums">
                    {COUNT.format(statusTotal)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Product performance and the latest orders. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <section className="card p-5 xl:col-span-2">
          <CardHead title="Top Products by Revenue" subtitle="Delivered orders" to="/products" />
          <TopProductList items={summary.topProductsByRevenue} byRevenue />
        </section>
        <section className="card p-5 xl:col-span-2">
          <CardHead title="Top Products by Quantity" subtitle="Delivered orders" to="/products" />
          <TopProductList items={summary.topProductsByQuantity} byRevenue={false} />
        </section>
        <section className="card p-5 md:col-span-2 xl:col-span-3">
          <CardHead title="Recent Orders" subtitle="Newest first" to="/orders" />
          <div className="-mt-1 overflow-x-auto">
            <div className="min-w-[320px]">
              <RecentOrders orders={extras.recentOrders} />
            </div>
          </div>
        </section>
      </div>

      <section className="card p-5">
        <CardHead title="Quick Access Modules" subtitle="Jump straight into the consoles you use most" />
        <QuickAccess />
      </section>
    </div>
  );
}
