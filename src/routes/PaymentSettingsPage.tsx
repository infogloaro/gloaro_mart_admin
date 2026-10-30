import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Icon } from '../components/ui/Icon';
import { PlatformConfigModal } from '../components/platform/PlatformConfigModal';
import type { Platform } from '../lib/types';

/** GET/PATCH /api/admin/payments/settings (backend RZ3). */
interface PaymentSettings {
  onlineEnabled: boolean;
  codEnabled: boolean;
  codMaxCents: number | null;
  updatedAt: string | null;
  /** Online is what customers really get: the switch and working keys. */
  onlineLive: boolean;
  razorpay: {
    setUp: boolean;
    ready: boolean;
    environment: 'test' | 'live' | null;
    keyId: string | null;
    hasWebhookSecret: boolean;
    connectionStatus: string | null;
    lastTestedAt: string | null;
    lastError: string | null;
    webhookUrl: string;
    webhookEvents: string[];
    platform: Platform | null;
  };
}

/**
 * Payments & Finance → Payment settings: what checkout offers (online through
 * Razorpay, cash on delivery and its limit) and the Razorpay keys, test and
 * live apart. Changes apply to the next checkout; nothing needs redeploying.
 */
export default function PaymentSettingsPage() {
  const { data: loaded, loading, error, reload } = useApiData<PaymentSettings>('/api/admin/payments/settings');
  const [data, setData] = useState<PaymentSettings | null>(null);
  const [codLimit, setCodLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    setData(loaded);
    setCodLimit(loaded.codMaxCents == null ? '' : String(loaded.codMaxCents / 100));
  }, [loaded]);

  async function patch(body: Partial<Pick<PaymentSettings, 'onlineEnabled' | 'codEnabled' | 'codMaxCents'>>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await api.patch<PaymentSettings>('/api/admin/payments/settings', body);
      setData(next);
      setCodLimit(next.codMaxCents == null ? '' : String(next.codMaxCents / 100));
      setMessage({ ok: true, text: done });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  }

  async function openKeys() {
    if (!data) return;
    setMessage(null);
    if (data.razorpay.platform) {
      setConfiguring(true);
      return;
    }
    setBusy(true);
    try {
      setData(await api.post<PaymentSettings>('/api/admin/payments/settings/razorpay'));
      setConfiguring(true);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : 'Could not set up Razorpay.' });
    } finally {
      setBusy(false);
    }
  }

  function saveCodLimit() {
    const trimmed = codLimit.trim();
    if (trimmed === '') return patch({ codMaxCents: null }, 'COD has no limit now.');
    const rupees = Number(trimmed);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setMessage({ ok: false, text: 'Enter the most a COD order may be, in rupees, or leave it empty.' });
      return;
    }
    return patch({ codMaxCents: Math.round(rupees * 100) }, `COD is for orders up to ₹${rupees.toLocaleString('en-IN')} now.`);
  }

  const rz = data?.razorpay;
  const savedLimit = data?.codMaxCents == null ? '' : String(data.codMaxCents / 100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Payment settings</h1>
        <p className="text-sm text-slate-500">
          How customers can pay at checkout. Online payment goes through Razorpay (UPI, cards, net banking, wallets); an
          order counts as paid only once Razorpay confirms it to the server. Changes apply to the next checkout.
        </p>
      </div>

      {loading && !data && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {message && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
            message.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {data && rz && (
        <>
          {/* Razorpay keys */}
          <div className="card space-y-3 p-5">
            <div className="flex flex-wrap items-start gap-3">
              <Icon name="card" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">Razorpay</span>
                  <StatusChip ok={rz.ready} text={rz.ready ? 'Keys saved' : rz.setUp ? 'Keys missing' : 'Not set up'} />
                  {rz.environment && (
                    <span
                      className={`rounded-md border px-1.5 py-px text-[10px] font-bold uppercase ${
                        rz.environment === 'live'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {rz.environment === 'live' ? 'Live — real money' : 'Test mode'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {rz.keyId ? (
                    <>
                      Key ID <span className="font-mono">{rz.keyId}</span>
                      {rz.lastTestedAt && <> · tested {new Date(rz.lastTestedAt).toLocaleString()}</>}
                      {rz.connectionStatus === 'connected' && ' · connection OK'}
                    </>
                  ) : (
                    'Razorpay dashboard → Account & Settings → API keys. Test keys start rzp_test_, live keys rzp_live_.'
                  )}
                </p>
                {rz.lastError && <p className="mt-1 text-xs text-rose-600">{rz.lastError}</p>}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={openKeys}
                className="rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {rz.setUp ? 'Keys & mode' : 'Set up Razorpay'}
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-xs text-slate-600">
              <div className="mb-1 font-semibold text-ink">Webhook {rz.hasWebhookSecret ? '· secret saved' : '· secret not saved'}</div>
              In Razorpay → Settings → Webhooks, add this URL with a secret, tick{' '}
              {rz.webhookEvents.map((e, i) => (
                <span key={e}>
                  <span className="font-mono">{e}</span>
                  {i < rz.webhookEvents.length - 1 ? ', ' : ''}
                </span>
              ))}
              , and save the same secret under Keys &amp; mode. It confirms payments even when a customer closes the app
              mid-payment, and reports refunds.
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px]">
                  {rz.webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(rz.webhookUrl).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-blue-300"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* What checkout offers */}
          <div className="card divide-y divide-slate-100">
            <Toggle
              title="Pay online"
              hint={
                data.onlineLive
                  ? `Customers see “Pay online: UPI, cards, net banking, wallets”${rz.environment === 'test' ? ' — test mode, no real money moves' : ''}.`
                  : rz.ready
                    ? 'Off: customers don’t see it.'
                    : 'Needs Razorpay keys for the mode in use first.'
              }
              checked={data.onlineEnabled}
              disabled={busy || (!data.onlineEnabled && !rz.ready)}
              onChange={(v) => patch({ onlineEnabled: v }, v ? 'Online payment is on.' : 'Online payment is off.')}
            />
            <Toggle
              title="Cash on delivery"
              hint="Pay the rider (or the shop at pickup)."
              checked={data.codEnabled}
              disabled={busy}
              onChange={(v) => patch({ codEnabled: v }, v ? 'Cash on delivery is on.' : 'Cash on delivery is off.')}
            />
            <div className="flex flex-wrap items-end gap-3 px-5 py-4">
              <label className="block min-w-48 flex-1">
                <span className="text-sm font-semibold text-ink">Largest COD order</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-slate-500">₹</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="No limit"
                    value={codLimit}
                    onChange={(e) => setCodLimit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <span className="text-xs text-slate-500">Above it, customers must pay online. Empty = no limit.</span>
              </label>
              <button
                type="button"
                disabled={busy || codLimit.trim() === savedLimit}
                onClick={saveCodLimit}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                Save limit
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            An online order holds its stock for 15 minutes; unpaid after that, it is cancelled and the stock goes back. A
            payment that still arrives later is refunded automatically. Refunds you approve on the Refunds page go back to
            the customer’s card or UPI through Razorpay.
            {data.updatedAt && <> Last changed {new Date(data.updatedAt).toLocaleString()}.</>}
          </p>
        </>
      )}

      {configuring && rz?.platform && (
        <PlatformConfigModal
          platform={rz.platform}
          onClose={() => setConfiguring(false)}
          onChanged={() => {
            reload();
          }}
        />
      )}
    </div>
  );
}

function StatusChip({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'
      }`}
    >
      {text}
    </span>
  );
}

function Toggle({
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 px-5 py-4 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 accent-blue-700"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
