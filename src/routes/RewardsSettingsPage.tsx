import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { StatCard } from '../components/ui/StatCard';

/** GET/PATCH /api/admin/rewards/settings (backend SB11). */
interface RewardSettings {
  enabled: boolean;
  earnPoints: number;
  earnPerRupees: number;
  pointsPerRupee: number;
  maxRedeemPercent: number;
  minRedeemPoints: number;
  updatedAt: string | null;
}

type NumberKey = 'earnPoints' | 'earnPerRupees' | 'pointsPerRupee' | 'maxRedeemPercent' | 'minRedeemPoints';

const FIELDS: { key: NumberKey; label: string; hint: string; min: number; max: number; suffix?: string }[] = [
  { key: 'earnPoints', label: 'Points earned', hint: 'Points a customer earns for every step below.', min: 0, max: 1000, suffix: 'pts' },
  { key: 'earnPerRupees', label: '…for every', hint: 'Rupees paid for products (after discounts; not GST or delivery).', min: 1, max: 100000, suffix: '₹' },
  { key: 'pointsPerRupee', label: 'Points for ₹1 off', hint: 'How many points take ₹1 off at checkout.', min: 1, max: 1000, suffix: 'pts' },
  { key: 'maxRedeemPercent', label: 'Most of an order paid with points', hint: 'Share of the products (after coupons) points can pay.', min: 0, max: 100, suffix: '%' },
  { key: 'minRedeemPoints', label: 'Fewest points used at once', hint: 'Below this a customer can’t use points yet.', min: 0, max: 1000000, suffix: 'pts' },
];

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Marketing → Reward Points: the rules customers earn and spend points by.
 * Points are pending until an order is delivered; Gloaro Mart funds the
 * discount (shops are paid in full). Changes apply to the next order placed.
 */
export default function RewardsSettingsPage() {
  const { data, loading, error, reload } = useApiData<RewardSettings>('/api/admin/rewards/settings');
  const [form, setForm] = useState<RewardSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const dirty = form && data && (Object.keys(data) as (keyof RewardSettings)[]).some((k) => k !== 'updatedAt' && form[k] !== data[k]);

  async function save() {
    if (!form || !data) return;
    const body: Partial<RewardSettings> = {};
    if (form.enabled !== data.enabled) body.enabled = form.enabled;
    for (const f of FIELDS) {
      if (form[f.key] !== data[f.key]) body[f.key] = form[f.key];
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.patch('/api/admin/rewards/settings', body);
      setMessage({ ok: true, text: 'Saved. The next order placed uses these rules.' });
      reload();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  const f = form;
  // A worked example the admin can check the numbers against.
  const example = f
    ? (() => {
        const items = 100000; // ₹1,000 of products
        const earned = Math.floor(items / (Math.max(1, f.earnPerRupees) * 100)) * f.earnPoints;
        const capPaise = Math.floor((items * f.maxRedeemPercent) / 100);
        const capPoints = Math.floor((capPaise * f.pointsPerRupee) / 100);
        return { earned, earnedValue: Math.floor((earned * 100) / Math.max(1, f.pointsPerRupee)), capPoints, capPaise };
      })()
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Reward Points</h1>
        <p className="text-sm text-slate-500">
          Customers earn points on what they pay for products and spend them at checkout. Points are pending until the
          order is delivered; a cancelled order voids them and gives back points spent on it. Gloaro Mart funds the
          discount — shops are paid in full.
        </p>
      </div>

      {loading && !f && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}

      {f && example && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Earn rate" value={`${f.earnPoints} pt / ₹${f.earnPerRupees}`} icon="star" tone="gold" />
            <StatCard label="Point value" value={`${f.pointsPerRupee} pts = ₹1`} />
            <StatCard label="Status" value={f.enabled ? 'On' : 'Paused'} />
          </div>

          <div className="card space-y-4 p-5">
            <label className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-ink">Rewards on</div>
                <div className="text-xs text-slate-500">
                  Paused: no points are earned or spent; balances stay as they are.
                </div>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 accent-blue-700"
                checked={f.enabled}
                onChange={(e) => setForm({ ...f, enabled: e.target.checked })}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="text-sm font-semibold text-ink">{field.label}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={1}
                      value={f[field.key]}
                      onChange={(e) => setForm({ ...f, [field.key]: Math.trunc(Number(e.target.value)) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    {field.suffix && <span className="text-sm text-slate-500">{field.suffix}</span>}
                  </div>
                  <span className="text-xs text-slate-500">{field.hint}</span>
                </label>
              ))}
            </div>

            <div className="rounded-lg border border-gold-soft/60 bg-gold-mist px-4 py-3 text-sm text-gold-ink">
              Example: an order with ₹1,000 of products earns <b>{example.earned} points</b> (worth{' '}
              {rupees(example.earnedValue)}). On a ₹1,000 order a customer can use up to <b>{example.capPoints} points</b>{' '}
              ({rupees(example.capPaise)} off).
            </div>

            {message && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  message.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                {data?.updatedAt ? `Last changed ${new Date(data.updatedAt).toLocaleString()}` : ''}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!dirty || saving}
                  onClick={() => data && setForm(data)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={!dirty || saving}
                  onClick={save}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save rules'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
