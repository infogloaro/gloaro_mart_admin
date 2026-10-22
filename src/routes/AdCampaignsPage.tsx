import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, assetUrl, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { ImageUpload } from '../components/ui/ImageUpload';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import {
  LEVEL_LABEL,
  MODEL_LABEL,
  REGION_LEVEL,
  STATUS_LABEL,
  STATUS_TONE,
  fmtDate,
  hoursLabel,
  idempotencyKey,
  rupees,
  toIso,
  toLocal,
} from '../lib/ads';
import type {
  AdCampaignStats,
  AdCampaignDetail,
  AdCampaignList,
  AdCampaignStatus,
  AdLevel,
  AdLevelKey,
  AdModel,
  AdOptions,
  AdPlacement,
  AdQuote,
  AdRegion,
  AdSettings,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/ads/campaigns',
  'POST   /api/admin/ads/campaigns',
  'GET    /api/admin/ads/campaigns/:id',
  'PATCH  /api/admin/ads/campaigns/:id',
  'GET    /api/admin/ads/campaigns/:id/quote',
  'POST   /api/admin/ads/campaigns/:id/assets',
  'DELETE /api/admin/ads/campaigns/:id/assets/:assetId',
  'POST   /api/admin/ads/campaigns/:id/pay',
  'POST   /api/admin/ads/campaigns/:id/approve',
  'POST   /api/admin/ads/campaigns/:id/reject',
  'POST   /api/admin/ads/campaigns/:id/pause',
  'POST   /api/admin/ads/campaigns/:id/resume',
  'POST   /api/admin/ads/campaigns/:id/cancel',
  'POST   /api/admin/ads/campaigns/:id/extend',
  'POST   /api/admin/ads/payments/:paymentId/confirm',
  'POST   /api/admin/ads/refunds/:refundId/complete',
];

const TABS: { key: string; label: string; statuses: AdCampaignStatus[] | null }[] = [
  { key: 'approval', label: 'Needs approval', statuses: ['pending_approval'] },
  { key: 'payment', label: 'Waiting for payment', statuses: ['pending_payment'] },
  { key: 'running', label: 'Live & scheduled', statuses: ['live', 'scheduled', 'paused'] },
  { key: 'draft', label: 'Drafts', statuses: ['draft'] },
  { key: 'done', label: 'Completed', statuses: ['completed'] },
  { key: 'closed', label: 'Rejected & cancelled', statuses: ['rejected', 'cancelled'] },
  { key: 'all', label: 'All', statuses: null },
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';
const btnPrimary = 'rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45';
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-45';
const btnDanger = 'rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-45';

type NoticeState = { tone: 'ok' | 'error'; text: string } | null;
const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
        notice.tone === 'ok' ? 'border-state-success/25 bg-state-success/10 text-state-success-ink' : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      {notice.text}
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

function StatusBadge({ status }: { status: AdCampaignStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ------------------------------------------------------------------- page */

export default function AdCampaignsPage() {
  const [tab, setTab] = useState('approval');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);
  const [openId, setOpenId] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);

  const statuses = TABS.find((t) => t.key === tab)?.statuses;
  const query = [statuses ? `status=${statuses.join(',')}` : '', `page=${page}`, debounced ? `q=${encodeURIComponent(debounced)}` : '']
    .filter(Boolean)
    .join('&');
  const { data, loading, error, reload } = useApiData<AdCampaignList>(`/api/admin/ads/campaigns?${query}`, [tab, page, debounced]);
  const count = (t: (typeof TABS)[number]) => (t.statuses && data ? t.statuses.reduce((n, s) => n + (data.counts[s] ?? 0), 0) : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Ad campaigns</h1>
          <p className="text-sm text-slate-500">
            Shops’ paid promotions: approve what’s been paid for, follow what’s live, and book ads for shops that call in.
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setBooking(true)}>
          Book an ad for a shop
        </button>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Ad Promotions" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>
        ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {TABS.map((t) => {
            const n = count(t);
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap ${
                  tab === t.key ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                }`}
              >
                {t.label}
                {n ? <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${tab === t.key ? 'bg-white/25' : 'bg-slate-100'}`}>{n}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="relative w-64">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Reference, title or shop…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && data && (
        <div className="card overflow-hidden">
          <DataTable
            rows={data.items}
            keyFor={(c) => c.id}
            emptyMessage={tab === 'approval' ? 'Nothing is waiting for approval.' : 'No campaigns here.'}
            columns={[
              {
                header: 'Campaign',
                render: (c) => (
                  <span className="flex items-center gap-3">
                    {c.thumbnail ? (
                      <img src={assetUrl(c.thumbnail)} alt="" className="h-10 w-20 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-10 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">no image</span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{c.title}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{c.reference}</span>
                    </span>
                  </span>
                ),
              },
              {
                header: 'Shop',
                render: (c) => (
                  <span>
                    <span className="block text-ink">{c.shopName}</span>
                    <span className="block text-[11px] text-slate-400">{c.shopCity}</span>
                  </span>
                ),
              },
              {
                header: 'Where',
                render: (c) => (
                  <span className="block max-w-56">
                    <span className="block text-[13px] text-slate-700">{c.regionNames}</span>
                    <span className="block text-[11px] text-slate-400">
                      {LEVEL_LABEL[c.level]} · {c.placements.length} placement{c.placements.length === 1 ? '' : 's'}
                    </span>
                  </span>
                ),
              },
              {
                header: 'When',
                className: 'whitespace-nowrap',
                render: (c) => (
                  <span className="text-[12px]">
                    <span className="block">{fmtDate(c.startsAt)}</span>
                    <span className="block text-slate-400">{hoursLabel(c.hours)}</span>
                  </span>
                ),
              },
              {
                header: 'Amount',
                className: 'text-right tabular-nums',
                render: (c) => (
                  <span>
                    <span className="block font-bold text-ink">{c.model === 'commission' ? `${c.commissionPercent}% of orders` : rupees(c.totalCents)}</span>
                    {c.refundedCents > 0 && <span className="block text-[11px] text-state-error">{rupees(c.refundedCents)} refunded</span>}
                  </span>
                ),
              },
              { header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
              {
                header: '',
                className: 'text-right',
                render: (c) => (
                  <button className={btnGhost} onClick={() => setOpenId(c.id)}>
                    Open
                  </button>
                ),
              },
            ]}
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {booking && (
        <BookingModal
          onClose={() => setBooking(false)}
          onCreated={(id) => {
            setBooking(false);
            setTab('draft');
            reload();
            setOpenId(id);
          }}
        />
      )}
      {openId != null && <CampaignModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
}

/* ---------------------------------------------------------------- booking */

function BookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
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
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [offerText, setOfferText] = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Visit shop');
  const [ctaKind, setCtaKind] = useState<'shop' | 'product' | 'url' | 'call' | 'whatsapp'>('shop');
  const [ctaTarget, setCtaTarget] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [model, setModel] = useState<AdModel>('fixed');
  const [packageId, setPackageId] = useState<number | ''>('');
  const [level, setLevel] = useState<AdLevelKey>('city');
  const [regionIds, setRegionIds] = useState<number[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState(tomorrow);
  const [hours, setHours] = useState(24);
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<AdQuote | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkg = options?.packages.find((p) => p.id === packageId) ?? null;
  const effectiveLevel = model === 'package' && pkg ? pkg.level : level;
  const home = settings?.homeCountry ?? 'IN';
  const regionChoices = (regions ?? []).filter(
    (r) =>
      r.active &&
      r.level === REGION_LEVEL[effectiveLevel] &&
      (effectiveLevel === 'country' ? r.countryCode === home : effectiveLevel === 'international' ? r.countryCode !== home : true),
  );
  const slotChoices = (placements ?? []).filter(
    (p) => p.active && p.allowedLevels.includes(effectiveLevel) && (model !== 'package' || !pkg || pkg.placements.includes(p.key)),
  );
  const enabledModels = (Object.keys(MODEL_LABEL) as AdModel[]).filter((m) =>
    settings
      ? { fixed: settings.models.fixed, commission: settings.models.commission, fixed_commission: settings.models.fixedCommission, package: settings.models.package }[m]
      : m === 'fixed',
  );
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  useEffect(() => {
    setRegionIds((ids) => ids.filter((id) => regionChoices.some((r) => r.id === id)));
    setSlots((s) => s.filter((k) => slotChoices.some((p) => p.key === k)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLevel, packageId, model, regions, placements]);

  const booking = {
    vendorId: vendorId || undefined,
    categoryId: categoryId || undefined,
    model,
    level: effectiveLevel,
    packageId: model === 'package' ? packageId || undefined : undefined,
    regionIds,
    placements: slots,
    startsAt: toIso(startsAt),
    hours: model === 'package' ? pkg?.hours : hours,
    couponCode: coupon.trim() || undefined,
  };
  const bookingKey = JSON.stringify(booking);
  const debouncedKey = useDebounced(bookingKey, 400);

  // The price updates as the booking changes.
  useEffect(() => {
    if (!regionIds.length || !slots.length) {
      setQuote(null);
      setProblem(null);
      return;
    }
    let live = true;
    api
      .post<AdQuote>('/api/admin/ads/quote', JSON.parse(debouncedKey))
      .then((q) => live && (setQuote(q), setProblem(null)))
      .catch((err) => live && (setQuote(null), setProblem(errText(err, 'Could not price this.'))));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await api.post<AdCampaignDetail>('/api/admin/ads/campaigns', {
        ...booking,
        title,
        offerText,
        description,
        ctaLabel,
        ctaKind,
        ctaTarget: ctaTarget || undefined,
      });
      onCreated(c.id);
    } catch (err) {
      setError(errText(err, 'Could not save the campaign.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Book an ad for a shop" onClose={onClose} wide>
      <form onSubmit={create} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-[12px] font-bold tracking-wide text-slate-400 uppercase">1 · Shop and message</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shop">
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                  <option value="">Choose the shop</option>
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
            <Field label="Headline">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Deepavali sale" className={inputClass} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Offer (optional)">
                <input value={offerText} onChange={(e) => setOfferText(e.target.value)} maxLength={160} placeholder="Flat 20% off on silk sarees" className={inputClass} />
              </Field>
              <Field label="Button text">
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={30} className={inputClass} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Button opens">
                <select value={ctaKind} onChange={(e) => setCtaKind(e.target.value as typeof ctaKind)} className={inputClass}>
                  <option value="shop">The shop’s page</option>
                  <option value="product">A product</option>
                  <option value="url">A link</option>
                  <option value="call">A phone call</option>
                  <option value="whatsapp">A WhatsApp chat</option>
                </select>
              </Field>
              {ctaKind !== 'shop' && (
                <Field label={ctaKind === 'product' ? 'Product id' : ctaKind === 'url' ? 'Link (https://…)' : 'Phone number'}>
                  <input value={ctaTarget} onChange={(e) => setCtaTarget(e.target.value)} className={inputClass} />
                </Field>
              )}
            </div>
            <Field label="Details (optional)">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-[12px] font-bold tracking-wide text-slate-400 uppercase">2 · Where and when</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="How it’s charged">
                <select value={model} onChange={(e) => setModel(e.target.value as AdModel)} className={inputClass}>
                  {enabledModels.map((m) => (
                    <option key={m} value={m}>
                      {MODEL_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
              {model === 'package' && (
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
              )}
            </div>
            {model !== 'package' && (
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
              <span className={labelClass}>Target</span>
              {regionChoices.length === 0 ? (
                <p className="text-sm text-slate-400">No {REGION_LEVEL[effectiveLevel]} regions yet — add them under Ad Pricing → Regions.</p>
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
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${slots.includes(p.key) ? 'border-emerald bg-emerald/5' : 'border-slate-200'}`}
                  >
                    <input type="checkbox" checked={slots.includes(p.key)} onChange={() => setSlots((s) => toggle(s, p.key))} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{p.name}</span>
                      <span className="block text-[11px] text-slate-400">{p.formats.join(', ') || 'any size'}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Starts">
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
              </Field>
              {model !== 'package' ? (
                <Field label="Hours" hint={hoursLabel(hours)}>
                  <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass} />
                </Field>
              ) : (
                <Field label="Duration">
                  <p className="py-2.5 text-sm text-slate-600">{pkg ? hoursLabel(pkg.hours) : '—'}</p>
                </Field>
              )}
              <Field label="Ad coupon">
                <input value={coupon} onChange={(e) => setCoupon(e.target.value)} className={`${inputClass} uppercase`} />
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-ink">Price</h3>
            {!quote && !problem && <p className="mt-1 text-sm text-slate-400">Pick where it shows to see the price.</p>}
            {problem && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{problem}</p>}
            {quote && <QuoteBreakdown quote={quote} />}
          </div>
          <p className="text-[11px] text-slate-400">
            Saving makes a draft. Next you add the banner and take payment — the price is fixed at that moment.
          </p>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
              Cancel
            </button>
            <button type="submit" disabled={busy || !vendorId || !title.trim() || !quote} className={btnPrimary}>
              {busy ? 'Saving…' : 'Save draft'}
            </button>
          </div>
        </aside>
      </form>
    </Modal>
  );
}

function QuoteBreakdown({ quote }: { quote: AdQuote }) {
  return (
    <div className="mt-2 space-y-1.5 text-sm">
      {quote.lines.map((l, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span className={l.kind === 'rule' || l.kind === 'coupon' ? 'text-slate-500' : 'text-slate-700'}>{l.label}</span>
          <span className={`shrink-0 tabular-nums ${l.amountCents < 0 ? 'text-state-success' : ''}`}>
            {l.amountCents < 0 ? '−' : ''}
            {rupees(Math.abs(l.amountCents))}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-slate-600">
        <span>
          {quote.taxLabel} {quote.taxPercent}%
        </span>
        <span className="tabular-nums">{rupees(quote.taxCents)}</span>
      </div>
      <div className="flex justify-between text-base font-extrabold text-ink">
        <span>Total</span>
        <span className="tabular-nums">{rupees(quote.totalCents)}</span>
      </div>
      {quote.commissionPercent > 0 && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
          + {quote.commissionPercent}% of orders the ad brings in ({quote.attributionDays} days)
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- detail */

type Prompt =
  | { kind: 'pay' }
  | { kind: 'reject' }
  | { kind: 'cancel' }
  | { kind: 'extend' }
  | { kind: 'confirm'; paymentId: number; amountCents: number }
  | { kind: 'refund'; refundId: number; amountCents: number }
  | null;

function CampaignModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { data: c, loading, error, reload } = useApiData<AdCampaignDetail>(`/api/admin/ads/campaigns/${id}`, [id]);
  const { data: placements } = useApiData<AdPlacement[]>('/api/admin/ads/placements');
  const { data: settings } = useApiData<AdSettings>('/api/admin/ads/settings');
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [uploadPath, setUploadPath] = useState('');

  const slotName = (k: string) => placements?.find((p) => p.key === k)?.name ?? k;
  const canEditImages = c != null && ['draft', 'pending_payment', 'pending_approval'].includes(c.status);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ tone: 'ok', text: ok });
      setPrompt(null);
      reload();
      onChanged();
    } catch (err) {
      setNotice({ tone: 'error', text: errText(err, 'That did not work.') });
    } finally {
      setBusy(false);
    }
  }

  // An uploaded image is attached with its real size, so the slot fit can be checked.
  useEffect(() => {
    if (!uploadPath || !c) return;
    const img = new Image();
    img.onload = () =>
      act(
        () => api.post(`/api/admin/ads/campaigns/${c.id}/assets`, { url: uploadPath, kind: 'banner', width: img.naturalWidth, height: img.naturalHeight }),
        'Banner added.',
      ).finally(() => setUploadPath(''));
    img.onerror = () => {
      setNotice({ tone: 'error', text: 'That image could not be read.' });
      setUploadPath('');
    };
    img.src = assetUrl(uploadPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadPath]);

  const wanted = useMemo(() => new Set((placements ?? []).filter((p) => c?.placements.includes(p.key)).flatMap((p) => p.formats)), [placements, c]);

  return (
    <Modal title={c ? `${c.reference} · ${c.title}` : 'Campaign'} onClose={onClose} wide>
      {loading && !c && <div className="py-8 text-center text-sm text-slate-400">Loading…</div>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {c && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <span className="text-xs text-slate-500">
              {c.shopName} · {MODEL_LABEL[c.model]} · booked by {c.createdByRole === 'admin' ? 'GLOARO' : 'the shop'}
            </span>
          </div>
          {c.rejectionReason && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">Rejected: {c.rejectionReason}</p>}
          {c.cancelReason && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">Cancelled: {c.cancelReason}</p>}
          <Notice notice={notice} />

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {/* The banner as it would sit in the app. */}
              <section>
                <h3 className={labelClass}>Banner</h3>
                {c.assets.length === 0 && <p className="text-sm text-slate-400">No image yet — it’s needed before payment.</p>}
                <div className="space-y-2">
                  {c.assets.map((a) => {
                    const size = a.width && a.height ? `${a.width}x${a.height}` : null;
                    const fits = !wanted.size || (size != null && wanted.has(size));
                    return (
                      <div key={a.id} className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="relative">
                          <img src={assetUrl(a.url)} alt="" className="max-h-56 w-full object-cover" />
                          <span className="absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">Sponsored</span>
                          {(c.offerText || c.ctaLabel) && (
                            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 text-white">
                              <span className="text-sm font-bold">{c.offerText || c.title}</span>
                              {c.ctaLabel && <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-ink">{c.ctaLabel}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]">
                          <span className={fits ? 'text-slate-500' : 'font-semibold text-amber-700'}>
                            {size ?? 'size unknown'}
                            {!fits && ` — the slots want ${[...wanted].join(' or ')}`}
                          </span>
                          {canEditImages && (
                            <button className="font-semibold text-rose-600" onClick={() => act(() => api.delete(`/api/admin/ads/campaigns/${c.id}/assets/${a.id}`), 'Image removed.')}>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {canEditImages && c.assets.length < 5 && (
                  <div className="mt-2">
                    <ImageUpload label="Add banner image" area="ads" value={uploadPath} onChange={setUploadPath} small />
                  </div>
                )}
              </section>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
                <Info label="Starts" value={fmtDate(c.startsAt)} />
                <Info label="Ends" value={fmtDate(c.endsAt)} />
                <Info label="Duration" value={hoursLabel(c.hours)} />
                <Info label="Reach" value={LEVEL_LABEL[c.level]} />
                <Info label="Regions" value={c.regions.map((r) => r.name).join(', ')} />
                <Info label="Placements" value={c.placements.map(slotName).join(', ')} />
                <Info label="Button" value={`${c.ctaLabel ?? '—'} → ${c.ctaKind}${c.ctaTarget ? ` (${c.ctaTarget})` : ''}`} />
                {c.offerText && <Info label="Offer" value={c.offerText} />}
                {c.couponCode && <Info label="Ad coupon" value={c.couponCode} />}
              </dl>
              {c.description && <p className="text-sm text-slate-600">{c.description}</p>}

              {c.payments.length > 0 && (
                <section>
                  <h3 className={labelClass}>Payments</h3>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {c.payments.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                        <span className="font-semibold text-ink tabular-nums">{rupees(p.amountCents)}</span>
                        <span className="text-slate-500">
                          {p.purpose === 'extension' ? `extension +${p.extensionHours} h` : 'booking'} ·{' '}
                          {p.method === 'settlement' ? 'from next payout' : p.method}
                          {p.reference ? ` · ${p.reference}` : ''}
                          {p.invoiceNumber ? ` · ${p.invoiceNumber}` : ''}
                        </span>
                        <span className={`ml-auto text-[11px] font-bold uppercase ${p.status === 'paid' ? 'text-state-success' : p.status === 'pending' ? 'text-amber-600' : 'text-slate-400'}`}>
                          {p.status}
                        </span>
                        {p.status === 'pending' && (
                          <button className={btnPrimary} onClick={() => setPrompt({ kind: 'confirm', paymentId: p.id, amountCents: p.amountCents })}>
                            Money received
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {c.refunds.length > 0 && (
                <section>
                  <h3 className={labelClass}>Refunds</h3>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {c.refunds.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                        <span className="font-semibold text-state-error tabular-nums">−{rupees(r.amountCents)}</span>
                        <span className="text-slate-500">
                          {r.method === 'settlement' ? 'credited on next payout' : 'to send back'} · {r.reason}
                          {r.reference ? ` · ${r.reference}` : ''}
                        </span>
                        <span className={`ml-auto text-[11px] font-bold uppercase ${r.status === 'completed' ? 'text-state-success' : 'text-amber-600'}`}>{r.status}</span>
                        {r.status === 'pending' && (
                          <button className={btnPrimary} onClick={() => setPrompt({ kind: 'refund', refundId: r.id, amountCents: r.amountCents })}>
                            Refund sent
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {c.invoices.length > 0 && (
                <section>
                  <h3 className={labelClass}>Tax invoices</h3>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {c.invoices.map((i) => (
                      <div key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                        <span className="font-mono font-semibold text-ink">{i.number}</span>
                        <span className="text-slate-500">
                          {fmtDate(i.date)} · taxable {rupees(i.taxableCents)} ·{' '}
                          {i.supplyType === 'intra_state' ? `CGST ${rupees(i.cgstCents)} + SGST ${rupees(i.sgstCents)}` : `IGST ${rupees(i.igstCents)}`}
                        </span>
                        <span className="ml-auto font-semibold tabular-nums">{rupees(i.totalCents)}</span>
                      </div>
                    ))}
                  </div>
                  {!c.invoices[0].sellerGstin && (
                    <p className="mt-1 text-[11px] text-amber-700">GLOARO’s GSTIN isn’t set — add it in General Settings so ad invoices carry it.</p>
                  )}
                </section>
              )}

              <section>
                <h3 className={labelClass}>History</h3>
                <ol className="space-y-1 text-[12px]">
                  {c.history.map((h) => (
                    <li key={h.id} className="flex gap-2">
                      <span className="w-36 shrink-0 text-slate-400">{fmtDate(h.at)}</span>
                      <span className="text-slate-600">
                        <b>{STATUS_LABEL[h.to as AdCampaignStatus] ?? h.to}</b>
                        {h.actorName ? ` · ${h.actorName}` : h.actorRole === 'system' ? ' · automatic' : ''}
                        {h.note ? ` — ${h.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <aside className="space-y-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-ink">{c.status === 'draft' ? 'Estimated price' : 'Price paid'}</h3>
                <div className="mt-2 space-y-1.5 text-sm">
                  {c.priceLines.map((l, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="text-slate-600">{l.label}</span>
                      <span className="shrink-0 tabular-nums">{l.amountCents < 0 ? `−${rupees(-l.amountCents)}` : rupees(l.amountCents)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-slate-600">
                    <span>GST</span>
                    <span className="tabular-nums">{rupees(c.taxCents)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-ink">
                    <span>Total</span>
                    <span className="tabular-nums">{rupees(c.totalCents)}</span>
                  </div>
                  {c.paidCents > 0 && (
                    <p className="text-[12px] text-slate-500">
                      Paid {rupees(c.paidCents)}
                      {c.refundedCents ? ` · refunded ${rupees(c.refundedCents)}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {!['draft', 'pending_payment', 'pending_approval'].includes(c.status) && <ResultsCard id={c.id} />}

              <div className="flex flex-col gap-2">
                {c.status === 'draft' && (
                  <button className={btnPrimary} disabled={!c.assets.length} onClick={() => setPrompt({ kind: 'pay' })}>
                    {c.model === 'commission' ? 'Submit for approval' : 'Take payment'}
                  </button>
                )}
                {c.status === 'pending_approval' && (
                  <>
                    <button className={btnPrimary} disabled={busy} onClick={() => act(() => api.post(`/api/admin/ads/campaigns/${c.id}/approve`), 'Approved.')}>
                      Approve
                    </button>
                    <button className={btnDanger} onClick={() => setPrompt({ kind: 'reject' })}>
                      Reject (refund in full)
                    </button>
                  </>
                )}
                {c.status === 'pending_payment' && (
                  <button className={btnDanger} onClick={() => setPrompt({ kind: 'reject' })}>
                    Reject
                  </button>
                )}
                {c.status === 'live' && (
                  <button className={btnGhost} disabled={busy} onClick={() => act(() => api.post(`/api/admin/ads/campaigns/${c.id}/pause`), 'Paused.')}>
                    Pause
                  </button>
                )}
                {c.status === 'paused' && (
                  <button className={btnPrimary} disabled={busy} onClick={() => act(() => api.post(`/api/admin/ads/campaigns/${c.id}/resume`), 'Resumed.')}>
                    Resume
                  </button>
                )}
                {['scheduled', 'live', 'paused'].includes(c.status) && c.model !== 'package' && (
                  <button className={btnGhost} onClick={() => setPrompt({ kind: 'extend' })}>
                    Extend
                  </button>
                )}
                {!['completed', 'rejected', 'cancelled'].includes(c.status) && (
                  <button className={btnDanger} onClick={() => setPrompt({ kind: 'cancel' })}>
                    Cancel campaign
                  </button>
                )}
              </div>

              {prompt?.kind === 'pay' && <PayPanel campaign={c} busy={busy} act={act} onClose={() => setPrompt(null)} />}
              {prompt?.kind === 'extend' && <ExtendPanel campaign={c} busy={busy} act={act} onClose={() => setPrompt(null)} />}
              {prompt?.kind === 'reject' && (
                <ReasonPanel
                  title="Why is it rejected?"
                  note={c.paidCents ? `${rupees(c.paidCents - c.refundedCents)} is refunded in full.` : 'Nothing was paid.'}
                  action="Reject"
                  busy={busy}
                  onClose={() => setPrompt(null)}
                  onSubmit={(reason) => act(() => api.post(`/api/admin/ads/campaigns/${c.id}/reject`, { reason }), 'Rejected.')}
                />
              )}
              {prompt?.kind === 'cancel' && (
                <ReasonPanel
                  title="Why is it cancelled?"
                  note={cancelNote(c, settings ?? null)}
                  action="Cancel campaign"
                  busy={busy}
                  onClose={() => setPrompt(null)}
                  onSubmit={(reason) => act(() => api.post(`/api/admin/ads/campaigns/${c.id}/cancel`, { reason }), 'Cancelled.')}
                />
              )}
              {prompt?.kind === 'confirm' && (
                <ReferencePanel
                  title={`${rupees(prompt.amountCents)} received?`}
                  hint="The bank or UPI reference of the payment"
                  action="Confirm payment"
                  busy={busy}
                  onClose={() => setPrompt(null)}
                  onSubmit={(reference) => act(() => api.post(`/api/admin/ads/payments/${prompt.paymentId}/confirm`, { reference }), 'Payment confirmed.')}
                />
              )}
              {prompt?.kind === 'refund' && (
                <ReferencePanel
                  title={`${rupees(prompt.amountCents)} sent back?`}
                  hint="The bank or UPI reference of the refund"
                  action="Mark refunded"
                  busy={busy}
                  onClose={() => setPrompt(null)}
                  onSubmit={(reference) => act(() => api.post(`/api/admin/ads/refunds/${prompt.refundId}/complete`, { reference }), 'Refund recorded.')}
                />
              )}
            </aside>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** What the ad has done: views and taps from the app, orders it brought in. */
function ResultsCard({ id }: { id: number }) {
  const { data } = useApiData<AdCampaignStats>(`/api/admin/ads/campaigns/${id}/stats`, [id]);
  if (!data) return null;
  const n = new Intl.NumberFormat('en-IN');
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-ink">Results</h3>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          ['Views', n.format(data.impressions)],
          ['Taps', n.format(data.clicks)],
          ['CTR', data.ctr == null ? '—' : `${(data.ctr * 100).toFixed(1)}%`],
          ['Enquiries', n.format(data.enquiries)],
          ['Orders', n.format(data.orders)],
          ['Commission', rupees(data.commissionCents)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5">
            <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
            <div className="text-sm font-bold text-ink tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      {data.orders > 0 && <p className="mt-2 text-[11px] text-slate-500">Orders worth {rupees(data.orderValueCents)} came from taps on this ad.</p>}
    </div>
  );
}

function cancelNote(c: AdCampaignDetail, s: AdSettings | null): string {
  const paid = c.paidCents - c.refundedCents;
  if (!paid) return 'Nothing was paid, so nothing is refunded.';
  if (new Date(c.startsAt).getTime() > Date.now()) {
    return `It hasn’t started: ${rupees(Math.round((paid * (100 - (s?.cancellationFeePercent ?? 0))) / 100))} back (${s?.cancellationFeePercent ?? 0}% fee kept).`;
  }
  return s?.prorataRefund ? 'It’s running: the unserved share of the time is refunded.' : 'It’s running: no refund under the current policy.';
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="font-medium break-words text-ink">{value}</dd>
    </div>
  );
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>;

function PayPanel({ campaign, busy, act, onClose }: { campaign: AdCampaignDetail; busy: boolean; act: Act; onClose: () => void }) {
  const { data: now, error } = useApiData<AdQuote>(`/api/admin/ads/campaigns/${campaign.id}/quote`, [campaign.id]);
  const [method, setMethod] = useState<'settlement' | 'offline'>('settlement');
  const [reference, setReference] = useState('');
  const [key] = useState(idempotencyKey);
  const commission = campaign.model === 'commission';
  return (
    <div className="space-y-2.5 rounded-xl border border-emerald/30 bg-emerald/5 p-3.5">
      <h4 className="text-sm font-bold text-ink">{commission ? 'Submit for approval' : 'Take payment'}</h4>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {now && !commission && (
        <p className="text-sm">
          Price now: <b className="tabular-nums">{rupees(now.totalCents)}</b>
          {now.totalCents !== campaign.totalCents && <span className="block text-[12px] text-amber-700">It changed from {rupees(campaign.totalCents)} — this new amount is what’s charged.</span>}
        </p>
      )}
      {!commission && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" checked={method === 'settlement'} onChange={() => setMethod('settlement')} className="mt-1" />
            <span>
              <b>From the shop’s next payout</b>
              <span className="block text-[12px] text-slate-500">Deducted in the weekly settlement. It goes to approval now.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" checked={method === 'offline'} onChange={() => setMethod('offline')} className="mt-1" />
            <span>
              <b>Bank transfer / UPI</b>
              <span className="block text-[12px] text-slate-500">Waits until you confirm the money arrived.</span>
            </span>
          </label>
          {method === 'offline' && <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Note or expected reference (optional)" className={inputClass} />}
        </>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
          Back
        </button>
        <button
          className={btnPrimary}
          disabled={busy || (!now && !commission)}
          onClick={() =>
            act(
              () =>
                api.post(
                  `/api/admin/ads/campaigns/${campaign.id}/pay`,
                  { method, reference: reference || undefined, acceptTotalCents: now?.totalCents, idempotencyKey: key },
                ),
              commission ? 'Submitted for approval.' : method === 'settlement' ? 'Paid from the next payout — now waiting for approval.' : 'Booked — waiting for the payment.',
            )
          }
        >
          {busy ? 'Working…' : commission ? 'Submit' : method === 'settlement' ? `Charge ${now ? rupees(now.totalCents) : ''}` : 'Book, payment to follow'}
        </button>
      </div>
    </div>
  );
}

function ExtendPanel({ campaign, busy, act, onClose }: { campaign: AdCampaignDetail; busy: boolean; act: Act; onClose: () => void }) {
  const [hours, setHours] = useState(24);
  const [method, setMethod] = useState<'settlement' | 'offline'>('settlement');
  const [price, setPrice] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [key] = useState(idempotencyKey);
  const debouncedHours = useDebounced(hours, 400);

  // Asking without agreeing to a price returns the price (409 with a quote).
  useEffect(() => {
    let live = true;
    setPrice(null);
    setProblem(null);
    api
      .post(`/api/admin/ads/campaigns/${campaign.id}/extend`, { hours: debouncedHours, method })
      .catch((err: unknown) => {
        if (!live) return;
        const q = err instanceof ApiError ? (err.body as { quote?: AdQuote } | null)?.quote : undefined;
        if (q) setPrice(q.totalCents);
        else setProblem(errText(err, 'Could not price the extension.'));
      });
    return () => {
      live = false;
    };
  }, [campaign.id, debouncedHours, method]);

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 p-3.5">
      <h4 className="text-sm font-bold text-ink">Extend</h4>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Add hours" hint={hoursLabel(hours)}>
          <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Paid">
          <select value={method} onChange={(e) => setMethod(e.target.value as 'settlement' | 'offline')} className={inputClass}>
            <option value="settlement">From next payout</option>
            <option value="offline">Bank / UPI</option>
          </select>
        </Field>
      </div>
      {price != null && (
        <p className="text-sm">
          Only the added time is charged: <b className="tabular-nums">{rupees(price)}</b>
        </p>
      )}
      {problem && <p className="text-sm text-rose-600">{problem}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
          Back
        </button>
        <button
          className={btnPrimary}
          disabled={busy || price == null}
          onClick={() =>
            act(
              () => api.post(`/api/admin/ads/campaigns/${campaign.id}/extend`, { hours, method, acceptTotalCents: price, idempotencyKey: key }),
              method === 'settlement' ? `Extended by ${hoursLabel(hours)}.` : 'Extension booked — it applies once the payment is confirmed.',
            )
          }
        >
          {busy ? 'Working…' : 'Extend'}
        </button>
      </div>
    </div>
  );
}

function ReasonPanel({ title, note, action, busy, onClose, onSubmit }: { title: string; note: string; action: string; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} placeholder="The shop is told this" />
      <p className="text-[12px] text-slate-600">{note}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
          Back
        </button>
        <button className={btnDanger} disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim())}>
          {busy ? 'Working…' : action}
        </button>
      </div>
    </div>
  );
}

function ReferencePanel({ title, hint, action, busy, onClose, onSubmit }: { title: string; hint: string; action: string; busy: boolean; onClose: () => void; onSubmit: (ref: string) => void }) {
  const [reference, setReference] = useState('');
  return (
    <div className="space-y-2.5 rounded-xl border border-emerald/30 bg-emerald/5 p-3.5">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={hint} className={inputClass} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
          Back
        </button>
        <button className={btnPrimary} disabled={busy || !reference.trim()} onClick={() => onSubmit(reference.trim())}>
          {busy ? 'Working…' : action}
        </button>
      </div>
    </div>
  );
}
