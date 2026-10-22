import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { LEVEL_KEYS, LEVEL_LABEL, MODEL_LABEL, REGION_LEVEL, fmtDate, hoursLabel, rupees, toIso, toLocal } from '../lib/ads';
import type {
  AdCoupon,
  AdLevel,
  AdLevelKey,
  AdModel,
  AdOptions,
  AdPackage,
  AdPlacement,
  AdPricingRule,
  AdQuote,
  AdRegion,
  AdRegionLevel,
  AdRuleKind,
  AdSettings,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/ads/settings',
  'PATCH  /api/admin/ads/settings',
  'GET    /api/admin/ads/levels',
  'PATCH  /api/admin/ads/levels/:key',
  'POST   /api/admin/ads/packs',
  'PATCH  /api/admin/ads/packs/:id',
  'DELETE /api/admin/ads/packs/:id',
  'GET    /api/admin/ads/regions',
  'POST   /api/admin/ads/regions',
  'PATCH  /api/admin/ads/regions/:id',
  'DELETE /api/admin/ads/regions/:id',
  'GET    /api/admin/ads/placements',
  'POST   /api/admin/ads/placements',
  'PATCH  /api/admin/ads/placements/:key',
  'GET    /api/admin/ads/rules',
  'POST   /api/admin/ads/rules',
  'PATCH  /api/admin/ads/rules/:id',
  'DELETE /api/admin/ads/rules/:id',
  'GET    /api/admin/ads/packages',
  'POST   /api/admin/ads/packages',
  'PATCH  /api/admin/ads/packages/:id',
  'GET    /api/admin/ads/coupons',
  'POST   /api/admin/ads/coupons',
  'PATCH  /api/admin/ads/coupons/:id',
  'GET    /api/admin/ads/options',
  'POST   /api/admin/ads/quote',
];

type Tab = 'calculator' | 'rates' | 'regions' | 'placements' | 'rules' | 'packages' | 'coupons' | 'settings';
const TABS: [Tab, string][] = [
  ['calculator', 'Price calculator'],
  ['rates', 'Rate cards'],
  ['regions', 'Regions'],
  ['placements', 'Placements'],
  ['rules', 'Rules'],
  ['packages', 'Packages'],
  ['coupons', 'Coupons'],
  ['settings', 'Settings'],
];

const CHILD_LEVEL: Record<AdRegionLevel, AdRegionLevel | null> = {
  country: 'state', state: 'district', district: 'city', city: 'locality', locality: null,
};
const RULE_LABEL: Record<AdRuleKind, string> = {
  seasonal: 'Festival / season', peak: 'Peak hours', volume: 'Long booking', category: 'Business category', enterprise: 'Negotiated (shop)', multi_region: 'Several regions',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';
const btnPrimary = 'rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45';
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-45';
const btnDanger = 'rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100';

type NoticeState = { tone: 'ok' | 'error'; text: string } | null;
function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
        notice.tone === 'ok'
          ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      {notice.text}
    </div>
  );
}
const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-5.5' : 'left-0.5'}`} />
    </button>
  );
}

/** Rupees in the box, paise in the value. */
function RupeeInput({ cents, onChange, allowEmpty = false }: { cents: number | null; onChange: (c: number | null) => void; allowEmpty?: boolean }) {
  const [text, setText] = useState(cents == null ? '' : String(cents / 100));
  useEffect(() => setText(cents == null ? '' : String(cents / 100)), [cents]);
  return (
    <div className="relative">
      <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">₹</span>
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = e.target.value.trim();
          if (!v && allowEmpty) onChange(null);
          else if (/^\d+(\.\d{0,2})?$/.test(v)) onChange(Math.round(Number(v) * 100));
        }}
        className={`${inputClass} pl-7`}
      />
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'gold' | 'rose' }) {
  const cls = {
    slate: 'border-slate-200 bg-slate-100 text-slate-600',
    green: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
    gold: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-600',
  }[tone];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] uppercase ${cls}`}>{children}</span>;
}

/* ------------------------------------------------------------------- page */

export default function AdPricingPage() {
  const [tab, setTab] = useState<Tab>('calculator');
  const { error } = useApiData<AdSettings>('/api/admin/ads/settings');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Ad pricing</h1>
        <p className="text-sm text-slate-500">
          What shops pay to promote themselves on GLOARO Mart. Every price here is yours to set — the starting values are
          the brief’s samples.
        </p>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Ad Promotions" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>
        ))}

      {!error && (
        <>
          <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {TABS.map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-200 ${
                  tab === t ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'calculator' && <CalculatorTab />}
          {tab === 'rates' && <RatesTab />}
          {tab === 'regions' && <RegionsTab />}
          {tab === 'placements' && <PlacementsTab />}
          {tab === 'rules' && <RulesTab />}
          {tab === 'packages' && <PackagesTab />}
          {tab === 'coupons' && <CouponsTab />}
          {tab === 'settings' && <SettingsTab />}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- calculator */

const DURATION_PRESETS = [1, 6, 12, 24, 168, 720];

function CalculatorTab() {
  const { data: settings } = useApiData<AdSettings>('/api/admin/ads/settings');
  const { data: options } = useApiData<AdOptions>('/api/admin/ads/options');
  const { data: levels } = useApiData<AdLevel[]>('/api/admin/ads/levels');
  const { data: regions } = useApiData<AdRegion[]>('/api/admin/ads/regions');
  const { data: placements } = useApiData<AdPlacement[]>('/api/admin/ads/placements');

  const tomorrow = useMemo(() => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(10, 0, 0, 0);
    return toLocal(d.toISOString());
  }, []);
  const [model, setModel] = useState<AdModel>('fixed');
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [level, setLevel] = useState<AdLevelKey>('city');
  const [packageId, setPackageId] = useState<number | ''>('');
  const [regionIds, setRegionIds] = useState<number[]>([]);
  const [slots, setSlots] = useState<string[]>(['home_banner']);
  const [startsAt, setStartsAt] = useState(tomorrow);
  const [hours, setHours] = useState(24);
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<AdQuote | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pkg = options?.packages.find((p) => p.id === packageId) ?? null;
  const effectiveLevel = model === 'package' && pkg ? pkg.level : level;
  const home = settings?.homeCountry ?? 'IN';
  const regionChoices = (regions ?? []).filter(
    (r) =>
      r.active &&
      r.level === REGION_LEVEL[effectiveLevel] &&
      (effectiveLevel === 'country' ? r.countryCode === home : effectiveLevel === 'international' ? r.countryCode !== home : true),
  );
  const regionName = (id: number | null): string => {
    const r = regions?.find((x) => x.id === id);
    return r ? r.name : '';
  };
  const slotChoices = (placements ?? []).filter(
    (p) => p.active && p.allowedLevels.includes(effectiveLevel) && (model !== 'package' || !pkg || pkg.placements.includes(p.key)),
  );
  const enabledModels = (Object.keys(MODEL_LABEL) as AdModel[]).filter((m) =>
    settings ? { fixed: settings.models.fixed, commission: settings.models.commission, fixed_commission: settings.models.fixedCommission, package: settings.models.package }[m] : m === 'fixed',
  );

  // Choices that no longer fit the level drop out.
  useEffect(() => {
    setRegionIds((ids) => ids.filter((id) => regionChoices.some((r) => r.id === id)));
    setSlots((s) => s.filter((k) => slotChoices.some((p) => p.key === k)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLevel, packageId, model, regions, placements]);

  async function calculate(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const body = {
        model,
        vendorId: vendorId || undefined,
        categoryId: categoryId || undefined,
        level: effectiveLevel,
        packageId: model === 'package' ? packageId || undefined : undefined,
        regionIds,
        placements: slots,
        startsAt: toIso(startsAt),
        hours: model === 'package' ? undefined : hours,
        couponCode: coupon.trim() || undefined,
      };
      setQuote(await api.post<AdQuote>('/api/admin/ads/quote', body));
    } catch (err) {
      setQuote(null);
      setProblem(errText(err, 'Could not price this.'));
    } finally {
      setBusy(false);
    }
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <form onSubmit={calculate} className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pricing model">
            <select value={model} onChange={(e) => setModel(e.target.value as AdModel)} className={inputClass}>
              {enabledModels.map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shop (optional)" hint="For negotiated prices">
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
              <option value="">Any shop</option>
              {options?.shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` — ${s.city}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Business category (optional)">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
              <option value="">—</option>
              {options?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {model === 'package' ? (
          <Field label="Package">
            <select value={packageId} onChange={(e) => setPackageId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
              <option value="">Choose a package</option>
              {options?.packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {rupees(p.priceCents)} · {LEVEL_LABEL[p.level]} · {hoursLabel(p.hours)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div>
            <span className={labelClass}>Reach</span>
            <div className="flex flex-wrap gap-1.5">
              {(levels ?? []).map((l) => (
                <button
                  key={l.key}
                  type="button"
                  disabled={!l.active}
                  onClick={() => setLevel(l.key)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                    level === l.key ? 'border-emerald bg-emerald text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className={labelClass}>
            {REGION_LEVEL[effectiveLevel] === 'locality' ? 'Localities' : `${REGION_LEVEL[effectiveLevel]}s`} to target
          </span>
          {regionChoices.length === 0 ? (
            <p className="text-sm text-slate-400">No {REGION_LEVEL[effectiveLevel]} regions yet — add them in the Regions tab.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {regionChoices.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegionIds((ids) => toggle(ids, r.id))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    regionIds.includes(r.id) ? 'border-emerald bg-emerald/10 text-emerald-deep' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {r.name}
                  {r.parentId && r.level !== 'state' && <span className="font-normal text-slate-400"> · {regionName(r.parentId)}</span>}
                  {r.priceMultiplier !== 1 && <span className="ml-1 text-[10px] text-amber-600">×{r.priceMultiplier}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className={labelClass}>Placements</span>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {slotChoices.map((p) => (
              <label
                key={p.key}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${
                  slots.includes(p.key) ? 'border-emerald bg-emerald/5' : 'border-slate-200'
                }`}
              >
                <input type="checkbox" checked={slots.includes(p.key)} onChange={() => setSlots((s) => toggle(s, p.key))} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{p.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    {p.premiumPercent ? `${p.premiumPercent > 0 ? '+' : ''}${p.premiumPercent}%` : 'no premium'}
                    {p.premiumCents ? ` + ${rupees(p.premiumCents)}` : ''} · {p.formats.join(', ') || 'any size'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </Field>
          {model !== 'package' ? (
            <Field label="Duration (hours)">
              <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass} />
              <span className="mt-1.5 flex flex-wrap gap-1">
                {DURATION_PRESETS.map((h) => (
                  <button key={h} type="button" onClick={() => setHours(h)} className={`${btnGhost} ${hours === h ? 'border-emerald text-emerald-deep' : ''}`}>
                    {hoursLabel(h).replace(/ \(.*\)/, '')}
                  </button>
                ))}
              </span>
            </Field>
          ) : (
            <Field label="Duration">
              <p className="py-2.5 text-sm text-slate-600">{pkg ? hoursLabel(pkg.hours) : 'Set by the package'}</p>
            </Field>
          )}
        </div>
        <Field label="Ad coupon (optional)">
          <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="LAUNCH20" className={`${inputClass} uppercase`} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !regionIds.length || !slots.length} className={btnPrimary}>
            {busy ? 'Pricing…' : 'Calculate price'}
          </button>
        </div>
      </form>

      <div className="card self-start p-5">
        <h2 className="text-sm font-bold text-ink">Price breakdown</h2>
        {!quote && !problem && <p className="mt-2 text-sm text-slate-400">Choose the regions and placements, then calculate.</p>}
        {problem && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{problem}</p>}
        {quote && (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-slate-500">
              {MODEL_LABEL[quote.model]} · {LEVEL_LABEL[quote.level]} · {hoursLabel(quote.hours)}
              <br />
              {fmtDate(quote.startsAt)} → {fmtDate(quote.endsAt)}
            </p>
            {quote.snapshot.duration && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                Duration priced as{' '}
                {quote.snapshot.duration.packs.map((p) => `${p.count} × ${hoursLabel(p.hours)} (${rupees(p.priceCents)})`).join(' + ')}
                {quote.snapshot.duration.coveredHours > quote.hours && ` — covers ${quote.snapshot.duration.coveredHours} h, cheaper than an exact fit`}
              </p>
            )}
            <div className="space-y-1.5">
              {quote.lines.map((l, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <span className={l.kind === 'rule' || l.kind === 'coupon' ? 'text-slate-500' : 'text-slate-700'}>{l.label}</span>
                  <span className={`shrink-0 tabular-nums ${l.amountCents < 0 ? 'text-state-success' : 'text-ink'}`}>
                    {l.amountCents < 0 ? '−' : ''}
                    {rupees(Math.abs(l.amountCents))}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-2 text-sm">
              <Row label="Taxable" value={rupees(quote.taxableCents)} />
              <Row label={`${quote.taxLabel} ${quote.taxPercent}%`} value={rupees(quote.taxCents)} />
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-ink">
                <span>Total payable</span>
                <span className="tabular-nums">{rupees(quote.totalCents)}</span>
              </div>
            </div>
            {quote.commissionPercent > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                Plus {quote.commissionPercent}% of orders this ad brings in within {quote.attributionDays} days, taken from the shop’s
                payouts.
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              {quote.audienceEstimate != null
                ? `Estimated audience: ${quote.audienceEstimate.toLocaleString('en-IN')} (your estimate, set per region).`
                : 'No audience estimate — set one per region to show it here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------- rate cards */

function RatesTab() {
  const { data, loading, error, reload } = useApiData<AdLevel[]>('/api/admin/ads/levels');
  const [notice, setNotice] = useState<NoticeState>(null);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setNotice(null);
    try {
      await fn();
      setNotice({ tone: 'ok', text: ok });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: errText(err, 'That did not save.') });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Each reach level has its own prices for fixed durations. A booking is charged the cheapest mix that covers its hours —
        10 days becomes one week + three days — so a longer booking is never priced worse than a shorter one.
      </p>
      <Notice notice={notice} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      <div className="grid gap-3 xl:grid-cols-2">
        {data?.map((l) => (
          <LevelCard key={l.key} level={l} act={act} />
        ))}
      </div>
    </div>
  );
}

function LevelCard({ level, act }: { level: AdLevel; act: (fn: () => Promise<unknown>, ok: string) => void }) {
  const [minHours, setMinHours] = useState(level.minHours);
  const [newHours, setNewHours] = useState('');
  const [newPrice, setNewPrice] = useState<number | null>(null);
  useEffect(() => setMinHours(level.minHours), [level.minHours]);

  return (
    <section className={`card p-4 ${level.active ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">{level.label}</h3>
          <p className="text-[12px] text-slate-500">{level.description}</p>
        </div>
        <Toggle
          on={level.active}
          label={`${level.label} available`}
          onChange={(v) => act(() => api.patch(`/api/admin/ads/levels/${level.key}`, { active: v }), `${level.label} ${v ? 'offered' : 'no longer offered'}.`)}
        />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <Field label="Shortest booking (hours)">
          <input type="number" min={1} value={minHours} onChange={(e) => setMinHours(Number(e.target.value))} className={`${inputClass} w-32`} />
        </Field>
        {minHours !== level.minHours && (
          <button
            className={btnPrimary}
            onClick={() => act(() => api.patch(`/api/admin/ads/levels/${level.key}`, { minHours }), `${level.label}: shortest booking ${minHours} h.`)}
          >
            Save
          </button>
        )}
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase">
            <th className="py-1.5">Duration</th>
            <th className="py-1.5">Price</th>
            <th className="py-1.5 text-right">Per hour</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {level.packs.map((p) => (
            <PackRow key={p.id} pack={p} act={act} />
          ))}
          <tr>
            <td className="py-1.5 pr-2">
              <input
                type="number"
                min={1}
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                placeholder="Hours"
                className={`${inputClass} py-1.5`}
              />
            </td>
            <td className="py-1.5 pr-2">
              <RupeeInput cents={newPrice} onChange={setNewPrice} allowEmpty />
            </td>
            <td />
            <td className="py-1.5 text-right">
              <button
                className={btnGhost}
                disabled={!newHours || !newPrice}
                onClick={() => {
                  act(
                    () => api.post('/api/admin/ads/packs', { level: level.key, hours: Number(newHours), priceCents: newPrice }),
                    `${level.label}: ${hoursLabel(Number(newHours))} added.`,
                  );
                  setNewHours('');
                  setNewPrice(null);
                }}
              >
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function PackRow({ pack, act }: { pack: { id: number; hours: number; priceCents: number; active: boolean }; act: (fn: () => Promise<unknown>, ok: string) => void }) {
  const [price, setPrice] = useState<number | null>(pack.priceCents);
  useEffect(() => setPrice(pack.priceCents), [pack.priceCents]);
  const changed = price !== pack.priceCents && price != null && price > 0;
  return (
    <tr>
      <td className="py-1.5 font-medium text-ink">{hoursLabel(pack.hours)}</td>
      <td className="w-40 py-1.5 pr-2">
        <RupeeInput cents={price} onChange={setPrice} />
      </td>
      <td className="py-1.5 text-right text-[11px] text-slate-400 tabular-nums">{rupees(Math.round(pack.priceCents / pack.hours))}</td>
      <td className="py-1.5 text-right whitespace-nowrap">
        {changed && (
          <button className={`${btnPrimary} mr-1`} onClick={() => act(() => api.patch(`/api/admin/ads/packs/${pack.id}`, { priceCents: price }), 'Price saved.')}>
            Save
          </button>
        )}
        <button
          className="px-1 text-slate-400 hover:text-rose-600"
          aria-label="Remove"
          onClick={() => {
            if (window.confirm(`Remove the ${hoursLabel(pack.hours)} price?`)) act(() => api.delete(`/api/admin/ads/packs/${pack.id}`), 'Price removed.');
          }}
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------------- regions */

function RegionsTab() {
  const { data, loading, error, reload } = useApiData<AdRegion[]>('/api/admin/ads/regions');
  const [editing, setEditing] = useState<{ region: AdRegion | null; parent: AdRegion | null; level: AdRegionLevel } | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const byParent = useMemo(() => {
    const m = new Map<number | null, AdRegion[]>();
    for (const r of data ?? []) m.set(r.parentId, [...(m.get(r.parentId) ?? []), r]);
    return m;
  }, [data]);

  async function remove(r: AdRegion) {
    if (!window.confirm(`Remove ${r.name}?`)) return;
    setNotice(null);
    try {
      await api.delete(`/api/admin/ads/regions/${r.id}`);
      setNotice({ tone: 'ok', text: `${r.name} removed.` });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: errText(err, 'Could not remove it.') });
    }
  }

  function renderTree(parentId: number | null, depth: number): ReactNode {
    return (byParent.get(parentId) ?? []).map((r) => {
      const child = CHILD_LEVEL[r.level];
      return (
        <div key={r.id}>
          <div className={`flex flex-wrap items-center gap-2 border-b border-slate-50 py-2 ${r.active ? '' : 'opacity-60'}`} style={{ paddingLeft: depth * 20 }}>
            <Pill>{r.level}</Pill>
            <span className="font-semibold text-ink">{r.name}</span>
            {r.level === 'country' && <span className="text-[11px] text-slate-400">{r.countryCode}</span>}
            {r.priceMultiplier !== 1 && <Pill tone="gold">×{r.priceMultiplier}</Pill>}
            {r.audienceEstimate != null && <span className="text-[11px] text-slate-400">≈ {r.audienceEstimate.toLocaleString('en-IN')} people</span>}
            {r.level === 'locality' && <span className="text-[11px] text-slate-400">{r.radiusKm} km radius</span>}
            {!r.active && <Pill tone="rose">off</Pill>}
            <span className="ml-auto flex gap-1.5">
              {child && (
                <button className={btnGhost} onClick={() => setEditing({ region: null, parent: r, level: child })}>
                  + {child}
                </button>
              )}
              <button className={btnGhost} onClick={() => setEditing({ region: r, parent: null, level: r.level })}>
                Edit
              </button>
              {r.childCount === 0 && (
                <button className={btnDanger} onClick={() => remove(r)}>
                  Remove
                </button>
              )}
            </span>
          </div>
          {renderTree(r.id, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Where ads can be aimed. A multiplier scales a place’s price (a metro costs more); the audience estimate is yours and
          is shown to shops as an estimate.
        </p>
        <button className={btnPrimary} onClick={() => setEditing({ region: null, parent: null, level: 'country' })}>
          Add country
        </button>
      </div>
      <Notice notice={notice} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      {data && <div className="card px-4 py-1 text-sm">{renderTree(null, 0)}</div>}
      {editing && (
        <RegionForm
          {...editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ tone: 'ok', text });
            reload();
          }}
        />
      )}
    </div>
  );
}

function RegionForm({
  region,
  parent,
  level,
  onClose,
  onSaved,
}: {
  region: AdRegion | null;
  parent: AdRegion | null;
  level: AdRegionLevel;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [name, setName] = useState(region?.name ?? '');
  const [countryCode, setCountryCode] = useState(region?.countryCode ?? '');
  const [multiplier, setMultiplier] = useState(String(region?.priceMultiplier ?? 1));
  const [audience, setAudience] = useState(region?.audienceEstimate == null ? '' : String(region.audienceEstimate));
  const [lat, setLat] = useState(region?.latitude == null ? '' : String(region.latitude));
  const [lng, setLng] = useState(region?.longitude == null ? '' : String(region.longitude));
  const [radius, setRadius] = useState(region?.radiusKm == null ? '' : String(region.radiusKm));
  const [active, setActive] = useState(region?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      name,
      priceMultiplier: Number(multiplier),
      audienceEstimate: audience === '' ? null : Number(audience),
      active,
    };
    if (level === 'country') body.countryCode = countryCode;
    if (level === 'locality') Object.assign(body, { latitude: lat, longitude: lng, radiusKm: radius });
    try {
      if (region) await api.patch(`/api/admin/ads/regions/${region.id}`, body);
      else await api.post('/api/admin/ads/regions', { ...body, level, parentId: parent?.id ?? null });
      onSaved(`${name} saved.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={region ? `Edit ${region.name}` : `New ${level}${parent ? ` in ${parent.name}` : ''}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        {level === 'country' && (
          <Field label="Country code" hint="Two letters: IN, AE, SG…">
            <input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} className={`${inputClass} uppercase`} />
          </Field>
        )}
        {level === 'locality' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Latitude">
              <input value={lat} onChange={(e) => setLat(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Longitude">
              <input value={lng} onChange={(e) => setLng(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Radius (km)">
              <input value={radius} onChange={(e) => setRadius(e.target.value)} className={inputClass} />
            </Field>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price multiplier" hint="1 = the rate card; 1.5 = 50% more">
            <input type="number" step="0.05" min="0.05" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Audience estimate (optional)" hint="People you expect to reach">
            <input type="number" min="0" value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Toggle on={active} onChange={setActive} label="Available" />
          <span className="text-sm text-slate-600">Available for ads</span>
        </div>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- placements */

function PlacementsTab() {
  const { data, loading, error, reload } = useApiData<AdPlacement[]>('/api/admin/ads/placements');
  const [editing, setEditing] = useState<AdPlacement | 'new' | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          The slots in the app an ad can take, what each adds to the price, and how many ads can run in one at once.
        </p>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          Add placement
        </button>
      </div>
      <Notice notice={notice} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((p) => (
          <div key={p.key} className={`card p-4 ${p.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-ink">{p.name}</h3>
                <p className="font-mono text-[11px] text-slate-400">{p.key}</p>
              </div>
              {p.active ? <Pill tone="green">on</Pill> : <Pill tone="rose">off</Pill>}
            </div>
            <p className="mt-1 text-[12px] text-slate-500">{p.description}</p>
            <dl className="mt-2 space-y-0.5 text-[12px] text-slate-600">
              <div>
                Premium: <b>{p.premiumPercent ? `${p.premiumPercent > 0 ? '+' : ''}${p.premiumPercent}%` : 'none'}</b>
                {p.premiumCents ? <b> + {rupees(p.premiumCents)}</b> : null}
              </div>
              <div>At once per region: {p.maxLivePerRegion}</div>
              <div>Sizes: {p.formats.join(', ') || 'any'}</div>
              <div>Reach: {p.allowedLevels.map((l) => LEVEL_LABEL[l]).join(', ')}</div>
              {p.sponsoredLabel && <div className="text-amber-700">Marked “Sponsored” in the app</div>}
            </dl>
            <div className="mt-3 flex justify-end">
              <button className={btnGhost} onClick={() => setEditing(p)}>
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <PlacementForm
          placement={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ tone: 'ok', text });
            reload();
          }}
        />
      )}
    </div>
  );
}

function PlacementForm({ placement, onClose, onSaved }: { placement: AdPlacement | null; onClose: () => void; onSaved: (t: string) => void }) {
  const [key, setKey] = useState(placement?.key ?? '');
  const [name, setName] = useState(placement?.name ?? '');
  const [description, setDescription] = useState(placement?.description ?? '');
  const [formats, setFormats] = useState((placement?.formats ?? []).join(', '));
  const [levels, setLevels] = useState<AdLevelKey[]>(placement?.allowedLevels ?? LEVEL_KEYS);
  const [maxLive, setMaxLive] = useState(placement?.maxLivePerRegion ?? 5);
  const [premiumPercent, setPremiumPercent] = useState(placement?.premiumPercent ?? 0);
  const [premiumCents, setPremiumCents] = useState<number | null>(placement?.premiumCents ?? 0);
  const [sponsored, setSponsored] = useState(placement?.sponsoredLabel ?? true);
  const [active, setActive] = useState(placement?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name,
      description,
      formats: formats.split(',').map((s) => s.trim()).filter(Boolean),
      allowedLevels: levels,
      maxLivePerRegion: maxLive,
      premiumPercent,
      premiumCents: premiumCents ?? 0,
      sponsoredLabel: sponsored,
      active,
    };
    try {
      if (placement) await api.patch(`/api/admin/ads/placements/${placement.key}`, body);
      else await api.post('/api/admin/ads/placements', { ...body, key });
      onSaved(`${name} saved.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={placement ? `Edit ${placement.name}` : 'New placement'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Key" hint="Used by the app; can’t change later">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              disabled={Boolean(placement)}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Image sizes" hint="Comma separated, e.g. 1200x400, 600x600">
          <input value={formats} onChange={(e) => setFormats(e.target.value)} className={inputClass} />
        </Field>
        <div>
          <span className={labelClass}>Offered for reach</span>
          <div className="flex flex-wrap gap-1.5">
            {LEVEL_KEYS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevels((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  levels.includes(l) ? 'border-emerald bg-emerald/10 text-emerald-deep' : 'border-slate-200 text-slate-500'
                }`}
              >
                {LEVEL_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Premium %">
            <input type="number" value={premiumPercent} onChange={(e) => setPremiumPercent(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Premium (fixed)">
            <RupeeInput cents={premiumCents} onChange={setPremiumCents} />
          </Field>
          <Field label="Ads at once per region">
            <input type="number" min={1} value={maxLive} onChange={(e) => setMaxLive(Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Toggle on={sponsored} onChange={setSponsored} label="Sponsored label" /> Mark as “Sponsored”
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Toggle on={active} onChange={setActive} label="Available" /> Available
          </label>
        </div>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim() || !levels.length} className={btnPrimary}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ rules */

function ruleSummary(r: AdPricingRule, options: AdOptions | null): string {
  const c = r.conditions;
  switch (r.kind) {
    case 'seasonal':
      return `${fmtDate(r.startsAt)} → ${fmtDate(r.endsAt)} (only the hours inside it)`;
    case 'peak':
      return `${c.fromHour}:00–${c.toHour}:00 IST (only those hours)`;
    case 'volume':
      return `Bookings of ${hoursLabel(c.minHours ?? 0)} or more`;
    case 'multi_region':
      return `${c.minRegions} regions or more`;
    case 'category':
      return (c.categoryIds ?? []).map((id) => options?.categories.find((x) => x.id === id)?.name ?? `#${id}`).join(', ');
    case 'enterprise':
      return (c.vendorIds ?? []).map((id) => options?.shops.find((x) => x.id === id)?.name ?? `#${id}`).join(', ');
    default:
      return '';
  }
}

function RulesTab() {
  const { data, loading, error, reload } = useApiData<AdPricingRule[]>('/api/admin/ads/rules');
  const { data: options } = useApiData<AdOptions>('/api/admin/ads/options');
  const [editing, setEditing] = useState<AdPricingRule | 'new' | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setNotice(null);
    try {
      await fn();
      setNotice({ tone: 'ok', text: ok });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: errText(err, 'That did not save.') });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Adjustments on top of the rate card, applied in priority order — each a % of the rate-card price. Packages aren’t
          affected by rules.
        </p>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          Add rule
        </button>
      </div>
      <Notice notice={notice} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      <div className="card divide-y divide-slate-100">
        {data?.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No rules yet.</p>}
        {data?.map((r) => (
          <div key={r.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${r.active ? '' : 'opacity-60'}`}>
            <Toggle on={r.active} label={`${r.name} active`} onChange={(v) => act(() => api.patch(`/api/admin/ads/rules/${r.id}`, { active: v }), `${r.name} ${v ? 'on' : 'off'}.`)} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{r.name}</span>
                <Pill>{RULE_LABEL[r.kind]}</Pill>
                <Pill tone={r.adjustPercent < 0 ? 'green' : 'gold'}>
                  {r.adjustPercent > 0 ? '+' : ''}
                  {r.adjustPercent}%
                </Pill>
              </span>
              <span className="block text-[12px] text-slate-500">
                {ruleSummary(r, options ?? null)} · priority {r.priority}
                {r.kind !== 'seasonal' && (r.startsAt || r.endsAt) && ` · bookable ${fmtDate(r.startsAt)} → ${fmtDate(r.endsAt)}`}
              </span>
            </span>
            <button className={btnGhost} onClick={() => setEditing(r)}>
              Edit
            </button>
            <button
              className={btnDanger}
              onClick={() => {
                if (window.confirm(`Delete ${r.name}?`)) act(() => api.delete(`/api/admin/ads/rules/${r.id}`), `${r.name} deleted.`);
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <RuleForm
          rule={editing === 'new' ? null : editing}
          options={options ?? null}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ tone: 'ok', text });
            reload();
          }}
        />
      )}
    </div>
  );
}

function RuleForm({ rule, options, onClose, onSaved }: { rule: AdPricingRule | null; options: AdOptions | null; onClose: () => void; onSaved: (t: string) => void }) {
  const [kind, setKind] = useState<AdRuleKind>(rule?.kind ?? 'seasonal');
  const [name, setName] = useState(rule?.name ?? '');
  const [adjust, setAdjust] = useState(rule?.adjustPercent ?? 10);
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [startsAt, setStartsAt] = useState(toLocal(rule?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocal(rule?.endsAt ?? null));
  const [fromHour, setFromHour] = useState(rule?.conditions.fromHour ?? 18);
  const [toHour, setToHour] = useState(rule?.conditions.toHour ?? 22);
  const [minHours, setMinHours] = useState(rule?.conditions.minHours ?? 168);
  const [minRegions, setMinRegions] = useState(rule?.conditions.minRegions ?? 3);
  const [picked, setPicked] = useState<number[]>(rule?.conditions.categoryIds ?? rule?.conditions.vendorIds ?? []);
  const [active, setActive] = useState(rule?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = kind === 'category' ? options?.categories ?? [] : kind === 'enterprise' ? options?.shops ?? [] : [];

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const conditions =
      kind === 'peak' ? { fromHour, toHour }
      : kind === 'volume' ? { minHours }
      : kind === 'multi_region' ? { minRegions }
      : kind === 'category' ? { categoryIds: picked }
      : kind === 'enterprise' ? { vendorIds: picked }
      : {};
    const body = { name, adjustPercent: adjust, priority, startsAt: toIso(startsAt), endsAt: toIso(endsAt), conditions, active };
    try {
      if (rule) await api.patch(`/api/admin/ads/rules/${rule.id}`, body);
      else await api.post('/api/admin/ads/rules', { ...body, kind });
      onSaved(`${name} saved.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={rule ? `Edit ${rule.name}` : 'New pricing rule'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind">
            <select value={kind} onChange={(e) => { setKind(e.target.value as AdRuleKind); setPicked([]); }} disabled={Boolean(rule)} className={inputClass}>
              {(Object.keys(RULE_LABEL) as AdRuleKind[]).map((k) => (
                <option key={k} value={k}>
                  {RULE_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deepavali season" className={inputClass} />
          </Field>
        </div>
        {kind === 'peak' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From (hour, IST)">
              <input type="number" min={0} max={23} value={fromHour} onChange={(e) => setFromHour(Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="To (hour, IST)">
              <input type="number" min={0} max={24} value={toHour} onChange={(e) => setToHour(Number(e.target.value))} className={inputClass} />
            </Field>
          </div>
        )}
        {kind === 'volume' && (
          <Field label="Bookings of at least (hours)" hint="168 = a week, 720 = a month">
            <input type="number" min={1} value={minHours} onChange={(e) => setMinHours(Number(e.target.value))} className={inputClass} />
          </Field>
        )}
        {kind === 'multi_region' && (
          <Field label="At least this many regions">
            <input type="number" min={2} value={minRegions} onChange={(e) => setMinRegions(Number(e.target.value))} className={inputClass} />
          </Field>
        )}
        {(kind === 'category' || kind === 'enterprise') && (
          <div>
            <span className={labelClass}>{kind === 'category' ? 'Categories' : 'Shops'}</span>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
              {list.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setPicked((cur) => (cur.includes(x.id) ? cur.filter((y) => y !== x.id) : [...cur, x.id]))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    picked.includes(x.id) ? 'border-emerald bg-emerald/10 text-emerald-deep' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {x.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Adjustment %" hint="Negative = discount, e.g. −10">
            <input type="number" value={adjust} onChange={(e) => setAdjust(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Priority" hint="Lower runs first">
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={kind === 'seasonal' ? 'Season starts' : 'Bookable from (optional)'}>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </Field>
          <Field label={kind === 'seasonal' ? 'Season ends' : 'Bookable until (optional)'}>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Toggle on={active} onChange={setActive} label="Active" /> Active
        </label>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- packages */

function PackagesTab() {
  const { data, loading, error, reload } = useApiData<AdPackage[]>('/api/admin/ads/packages');
  const { data: placements } = useApiData<AdPlacement[]>('/api/admin/ads/placements');
  const [editing, setEditing] = useState<AdPackage | 'new' | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const slotName = (k: string) => placements?.find((p) => p.key === k)?.name ?? k;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Fixed-price bundles shops can pick instead of building their own.</p>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          Add package
        </button>
      </div>
      <Notice notice={notice} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data?.map((p) => (
          <div key={p.id} className={`card flex flex-col p-4 ${p.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between">
              <Pill tone={p.tier === 'enterprise' ? 'gold' : 'slate'}>{p.tier}</Pill>
              {!p.active && <Pill tone="rose">off</Pill>}
            </div>
            <h3 className="mt-2 text-base font-extrabold text-ink">{p.name}</h3>
            <p className="text-2xl font-extrabold text-ink tabular-nums">{rupees(p.priceCents)}</p>
            <p className="text-[12px] text-slate-500">
              {LEVEL_LABEL[p.level]} · {hoursLabel(p.hours)} · up to {p.maxRegions} region{p.maxRegions === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">{p.description}</p>
            <ul className="mt-2 flex-1 space-y-0.5 text-[12px] text-slate-600">
              {p.placements.map((k) => (
                <li key={k}>✓ {slotName(k)}</li>
              ))}
            </ul>
            <button className={`${btnGhost} mt-3 self-end`} onClick={() => setEditing(p)}>
              Edit
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <PackageForm
          pkg={editing === 'new' ? null : editing}
          placements={placements ?? []}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ tone: 'ok', text });
            reload();
          }}
        />
      )}
    </div>
  );
}

function PackageForm({ pkg, placements, onClose, onSaved }: { pkg: AdPackage | null; placements: AdPlacement[]; onClose: () => void; onSaved: (t: string) => void }) {
  const [name, setName] = useState(pkg?.name ?? '');
  const [tier, setTier] = useState<AdPackage['tier']>(pkg?.tier ?? 'custom');
  const [description, setDescription] = useState(pkg?.description ?? '');
  const [level, setLevel] = useState<AdLevelKey>(pkg?.level ?? 'city');
  const [hours, setHours] = useState(pkg?.hours ?? 24);
  const [price, setPrice] = useState<number | null>(pkg?.priceCents ?? null);
  const [slots, setSlots] = useState<string[]>(pkg?.placements ?? []);
  const [maxRegions, setMaxRegions] = useState(pkg?.maxRegions ?? 1);
  const [active, setActive] = useState(pkg?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { name, tier, description, level, hours, priceCents: price, placements: slots, maxRegions, active };
    try {
      if (pkg) await api.patch(`/api/admin/ads/packages/${pkg.id}`, body);
      else await api.post('/api/admin/ads/packages', body);
      onSaved(`${name} saved.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={pkg ? `Edit ${pkg.name}` : 'New package'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Tier">
            <select value={tier} onChange={(e) => setTier(e.target.value as AdPackage['tier'])} className={inputClass}>
              {['basic', 'growth', 'premium', 'enterprise', 'custom'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Reach">
            <select value={level} onChange={(e) => setLevel(e.target.value as AdLevelKey)} className={inputClass}>
              {LEVEL_KEYS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hours">
            <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Price">
            <RupeeInput cents={price} onChange={setPrice} allowEmpty />
          </Field>
          <Field label="Regions">
            <input type="number" min={1} value={maxRegions} onChange={(e) => setMaxRegions(Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
        <div>
          <span className={labelClass}>Placements included</span>
          <div className="flex flex-wrap gap-1.5">
            {placements.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSlots((cur) => (cur.includes(p.key) ? cur.filter((x) => x !== p.key) : [...cur, p.key]))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  slots.includes(p.key) ? 'border-emerald bg-emerald/10 text-emerald-deep' : 'border-slate-200 text-slate-500'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Toggle on={active} onChange={setActive} label="Offered" /> Offered to shops
        </label>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim() || !price || !slots.length} className={btnPrimary}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- coupons */

function CouponsTab() {
  const { data, loading, error, reload } = useApiData<AdCoupon[]>('/api/admin/ads/coupons');
  const [editing, setEditing] = useState<AdCoupon | 'new' | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Discount codes for ad bookings — separate from shopping coupons.</p>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          Add coupon
        </button>
      </div>
      <Notice notice={notice} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      <div className="card divide-y divide-slate-100">
        {data?.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No ad coupons yet.</p>}
        {data?.map((c) => (
          <div key={c.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${c.active ? '' : 'opacity-60'}`}>
            <span className="font-mono text-sm font-bold text-ink">{c.code}</span>
            <Pill tone="green">{c.kind === 'percent' ? `${c.value}% off` : `${rupees(c.value)} off`}</Pill>
            <span className="flex-1 text-[12px] text-slate-500">
              {c.maxDiscountCents ? `up to ${rupees(c.maxDiscountCents)} · ` : ''}
              {c.minSpendCents ? `min ${rupees(c.minSpendCents)} · ` : ''}
              used {c.usedCount}
              {c.maxUses ? ` of ${c.maxUses}` : ''}
              {(c.startsAt || c.endsAt) && ` · ${fmtDate(c.startsAt)} → ${fmtDate(c.endsAt)}`}
            </span>
            {!c.active && <Pill tone="rose">off</Pill>}
            <button className={btnGhost} onClick={() => setEditing(c)}>
              Edit
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <CouponForm
          coupon={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ tone: 'ok', text });
            reload();
          }}
        />
      )}
    </div>
  );
}

function CouponForm({ coupon, onClose, onSaved }: { coupon: AdCoupon | null; onClose: () => void; onSaved: (t: string) => void }) {
  const [code, setCode] = useState(coupon?.code ?? '');
  const [kind, setKind] = useState<'percent' | 'flat'>(coupon?.kind ?? 'percent');
  const [percent, setPercent] = useState(coupon?.kind === 'percent' ? coupon.value : 10);
  const [flat, setFlat] = useState<number | null>(coupon?.kind === 'flat' ? coupon.value : null);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(coupon?.maxDiscountCents ?? null);
  const [minSpend, setMinSpend] = useState<number | null>(coupon?.minSpendCents ?? 0);
  const [maxUses, setMaxUses] = useState(coupon?.maxUses == null ? '' : String(coupon.maxUses));
  const [startsAt, setStartsAt] = useState(toLocal(coupon?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocal(coupon?.endsAt ?? null));
  const [active, setActive] = useState(coupon?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      code,
      kind,
      value: kind === 'percent' ? percent : flat,
      maxDiscountCents: maxDiscount,
      minSpendCents: minSpend ?? 0,
      maxUses: maxUses === '' ? null : Number(maxUses),
      startsAt: toIso(startsAt),
      endsAt: toIso(endsAt),
      active,
    };
    try {
      if (coupon) await api.patch(`/api/admin/ads/coupons/${coupon.id}`, body);
      else await api.post('/api/admin/ads/coupons', body);
      onSaved(`${code.toUpperCase()} saved.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={coupon ? `Edit ${coupon.code}` : 'New ad coupon'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${inputClass} font-mono uppercase`} />
          </Field>
          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'flat')} className={inputClass}>
              <option value="percent">% off</option>
              <option value="flat">₹ off</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {kind === 'percent' ? (
            <Field label="Percent off">
              <input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className={inputClass} />
            </Field>
          ) : (
            <Field label="Amount off">
              <RupeeInput cents={flat} onChange={setFlat} allowEmpty />
            </Field>
          )}
          <Field label="Most it takes off (optional)">
            <RupeeInput cents={maxDiscount} onChange={setMaxDiscount} allowEmpty />
          </Field>
          <Field label="Minimum booking">
            <RupeeInput cents={minSpend} onChange={setMinSpend} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Uses (blank = unlimited)">
            <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Valid from">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Valid until">
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Toggle on={active} onChange={setActive} label="Active" /> Active
        </label>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
            Cancel
          </button>
          <button type="submit" disabled={busy || code.trim().length < 3} className={btnPrimary}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- settings */

function SettingsTab() {
  const { data, loading, error, reload } = useApiData<AdSettings>('/api/admin/ads/settings');
  const [draft, setDraft] = useState<AdSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  useEffect(() => setDraft(data ?? null), [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setNotice(null);
    try {
      const { updatedAt: _u, currency: _c, homeCountry: _h, ...body } = draft;
      void _u;
      void _c;
      void _h;
      await api.patch('/api/admin/ads/settings', body);
      setNotice({ tone: 'ok', text: 'Settings saved. New quotes use them; paid campaigns keep the prices they were sold at.' });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: errText(err, 'Could not save.') });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !draft) return <div className="p-8 text-center text-sm text-slate-400">Loading…</div>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!draft) return null;
  const set = <K extends keyof AdSettings>(k: K, v: AdSettings[K]) => setDraft({ ...draft, [k]: v });
  const setModel = (k: keyof AdSettings['models'], v: boolean) => setDraft({ ...draft, models: { ...draft.models, [k]: v } });

  return (
    <form onSubmit={save} className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink">How GLOARO charges</h2>
        <p className="text-[12px] text-slate-500">
          An ad fee is advertising revenue. Commission is taken only from orders an ad brings in, and only on the models that
          include it — never both unless the model says so.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ['fixed', 'A · Fixed fee', 'The rate-card price for the slot, reach and time.'],
              ['commission', 'B · Commission on orders', `Nothing upfront; ${draft.commissionPercent}% of orders the ad brings in.`],
              ['fixedCommission', 'C · Fixed fee + commission', `The rate-card price plus ${draft.fixedCommissionPercent}% of orders it brings in.`],
              ['package', 'D · Packages', 'Basic / Growth / Premium / Enterprise bundles.'],
            ] as [keyof AdSettings['models'], string, string][]
          ).map(([k, label, hint]) => (
            <div key={k} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
              <Toggle on={draft.models[k]} onChange={(v) => setModel(k, v)} label={label} />
              <span>
                <span className="block text-sm font-semibold text-ink">{label}</span>
                <span className="block text-[12px] text-slate-500">{hint}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Model B commission %">
            <input type="number" step="0.5" value={draft.commissionPercent} onChange={(e) => set('commissionPercent', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Model C commission %">
            <input type="number" step="0.5" value={draft.fixedCommissionPercent} onChange={(e) => set('fixedCommissionPercent', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Order counts for the ad within (days)" hint="After a shopper taps the ad">
            <input type="number" min={1} max={90} value={draft.attributionDays} onChange={(e) => set('attributionDays', Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink">Tax</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label="Tax name">
            <input value={draft.taxLabel} onChange={(e) => set('taxLabel', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Rate %">
            <input type="number" step="0.5" value={draft.taxPercent} onChange={(e) => set('taxPercent', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="SAC code" hint="998365 = sale of advertising space">
            <input value={draft.sacCode} onChange={(e) => set('sacCode', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Currency">
            <p className="py-2.5 text-sm text-slate-600">{draft.currency} (all regions, for now)</p>
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink">Limits</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label="Minimum charge" hint="Smaller bookings are topped up to this">
            <RupeeInput cents={draft.minChargeCents} onChange={(c) => set('minChargeCents', c ?? 0)} />
          </Field>
          <Field label="Smallest booking">
            <RupeeInput cents={draft.minBudgetCents} onChange={(c) => set('minBudgetCents', c ?? 0)} />
          </Field>
          <Field label="Largest booking">
            <RupeeInput cents={draft.maxBudgetCents} onChange={(c) => set('maxBudgetCents', c ?? 0)} />
          </Field>
          <Field label="Longest campaign (hours)">
            <input type="number" min={1} value={draft.maxHours} onChange={(e) => set('maxHours', Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink">Cancellations & refunds</h2>
        <p className="text-[12px] text-slate-500">A campaign rejected by GLOARO is always refunded in full.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Fee when a shop cancels before it starts (%)">
            <input type="number" step="0.5" value={draft.cancellationFeePercent} onChange={(e) => set('cancellationFeePercent', Number(e.target.value))} className={inputClass} />
          </Field>
          <label className="flex items-center gap-3 pt-6 text-sm text-slate-600">
            <Toggle on={draft.prorataRefund} onChange={(v) => set('prorataRefund', v)} label="Pro-rata refund" />
            Refund the unserved time when a live campaign is cancelled
          </label>
        </div>
      </section>

      <Notice notice={notice} />
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
