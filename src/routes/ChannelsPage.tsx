import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import { PlatformConfigModal } from '../components/platform/PlatformConfigModal';
import type {
  BotKey,
  BotKeysResponse,
  ChannelEntry,
  ChannelGroup,
  ChannelsResponse,
  Paged,
  WhatsAppButton,
  WhatsAppCategory,
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppOverview,
  WhatsAppProviderKey,
  WhatsAppTemplate,
  WhatsAppRule,
  WhatsAppRulesResponse,
  WhatsAppTemplatesResponse,
  WhatsAppTemplateStatus,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/channels',
  'POST   /api/admin/channels/whatsapp/setup',
  'GET    /api/admin/channels/bot-keys',
  'POST   /api/admin/channels/bot-keys',
  'DELETE /api/admin/channels/bot-keys/:id',
  'GET    /api/admin/whatsapp/templates',
  'POST   /api/admin/whatsapp/templates',
  'POST   /api/admin/whatsapp/templates/sync',
  'PATCH  /api/admin/whatsapp/templates/:id',
  'DELETE /api/admin/whatsapp/templates/:id',
  'POST   /api/admin/whatsapp/templates/:id/submit',
  'GET    /api/admin/whatsapp/messages',
  'POST   /api/admin/whatsapp/messages/:id/retry',
  'POST   /api/admin/whatsapp/test-send',
  'GET    /api/admin/whatsapp/rules',
  'PATCH  /api/admin/whatsapp/rules/:event',
];

type Tab = 'overview' | 'rules' | 'templates' | 'messages';

const GROUPS: { key: ChannelGroup; label: string; hint: string }[] = [
  { key: 'communication', label: 'Communication', hint: 'Talking to customers, shops and partners' },
  { key: 'verification', label: 'Verification', hint: 'Proving who someone is' },
  { key: 'notification', label: 'Notification', hint: 'Telling people something happened' },
  { key: 'marketing', label: 'Marketing', hint: 'Bringing people in' },
  { key: 'integration', label: 'Integration', hint: 'Systems Gloaro Mart talks to' },
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

const TEMPLATE_TONE: Record<WhatsAppTemplateStatus, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  pending: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  approved: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  rejected: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  disabled: 'border-slate-200 bg-slate-100 text-slate-500',
};

const MESSAGE_TONE: Record<WhatsAppMessageStatus, string> = {
  queued: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  sending: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  sent: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  delivered: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  read: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  failed: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  received: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  skipped: 'border-slate-200 bg-slate-100 text-slate-500',
};

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${tone}`}
    >
      {children}
    </span>
  );
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatPhone(digits: string): string {
  return digits.startsWith('91') && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
}

function Notice({ notice }: { notice: { tone: 'ok' | 'error'; text: string } | null }) {
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

export default function ChannelsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const { data, loading, error, reload } = useApiData<ChannelsResponse>('/api/admin/channels');
  const wa = data?.whatsapp;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Channels</h1>
        <p className="text-sm text-slate-500">
          Every way Gloaro Mart reaches people and systems, in one place. WhatsApp is live; the rest are on the way.
        </p>
      </div>

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Channels" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {loading && !data && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {data && wa && (
        <>
          <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(
              [
                ['overview', 'Overview'],
                ['rules', 'Order updates'],
                ['templates', 'WhatsApp templates'],
                ['messages', 'WhatsApp messages'],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                disabled={t !== 'overview' && !wa.setUp}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-40 ${
                  tab === t ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <WhatsAppCard wa={wa} onChanged={reload} />
              <BotAccess />
              <ChannelDirectory channels={data.channels} />
            </>
          )}
          {tab === 'templates' && <TemplatesTab ready={wa.ready} onChanged={reload} />}
          {tab === 'rules' && <RulesTab />}
          {tab === 'messages' && <MessagesTab />}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- overview */

function WhatsAppCard({ wa, onChanged }: { wa: WhatsAppOverview; onChanged: () => void }) {
  const [configuring, setConfiguring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function setUp() {
    setBusy(true);
    setNotice(null);
    try {
      await api.post('/api/admin/channels/whatsapp/setup');
      onChanged();
      setConfiguring(true);
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not set up WhatsApp.' });
    } finally {
      setBusy(false);
    }
  }

  async function switchProvider(key: WhatsAppProviderKey) {
    if (key === provider) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.put('/api/admin/channels/whatsapp/provider', { provider: key });
      onChanged();
      setNotice({
        tone: 'ok',
        text:
          key === 'ultramsg'
            ? 'WhatsApp now sends through UltraMsg. Order updates use the templates’ text as it is — no Meta approval needed.'
            : 'WhatsApp now sends through Meta. Only approved templates are sent.',
      });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not switch the provider.' });
    } finally {
      setBusy(false);
    }
  }

  const provider: WhatsAppProviderKey = wa.provider ?? 'whatsapp_cloud';
  const ultra = provider === 'ultramsg';
  const steps = ultra
    ? [
        { done: wa.setUp && Boolean(wa.platform?.setup_complete), text: 'Scan the QR code in the UltraMsg dashboard, then enter the instance ID and token' },
        { done: wa.connectionStatus === 'connected', text: 'Test the connection (Configure → Settings → Test)' },
        { done: wa.platform?.status === 'active', text: 'Set the platform Active in Configure, so messages go out and the webhook is accepted' },
        { done: false, text: 'In UltraMsg, set the webhook URL to …/api/webhooks/platforms/whatsapp_ultramsg?secret=<webhook secret>, with “message received” and “message ack” on — so START / STOP work' },
      ]
    : [
        { done: wa.setUp && Boolean(wa.platform?.setup_complete), text: 'Enter the phone number ID, business account ID, access token and app secret' },
        { done: wa.connectionStatus === 'connected', text: 'Test the connection (Configure → Settings → Test)' },
        { done: (wa.templates?.approved ?? 0) > 0, text: 'Submit templates to Meta, or Sync to bring in approved ones' },
        { done: wa.platform?.status === 'active', text: 'Set the platform Active in Configure, so Meta’s webhook is accepted' },
      ];

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald/10 text-emerald-deep">
            <Icon name="chat" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-ink">WhatsApp</h2>
            <p className="text-xs text-slate-500">
              {ultra ? 'UltraMsg' : 'Meta Cloud API'} · order updates, shop alerts and customer replies
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wa.setUp && (
            <>
              <Badge
                tone={
                  wa.connectionStatus === 'connected'
                    ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                    : wa.connectionStatus === 'error'
                      ? 'border-state-error/25 bg-state-error/10 text-state-error-ink'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                }
              >
                {wa.connectionStatus === 'connected' ? 'Connected' : wa.connectionStatus === 'error' ? 'Test failed' : 'Not tested'}
              </Badge>
              <Badge
                tone={
                  wa.environment === 'live'
                    ? 'border-rose-200 bg-rose-50 text-rose-600'
                    : 'border-sky-200 bg-sky-50 text-sky-700'
                }
              >
                {wa.environment === 'live' ? 'Live' : 'Test'}
              </Badge>
            </>
          )}
          {wa.setUp && wa.platform ? (
            <button
              onClick={() => setConfiguring(true)}
              className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep"
            >
              Configure
            </button>
          ) : (
            <button
              onClick={setUp}
              disabled={busy}
              className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
            >
              {busy ? 'Setting up…' : 'Set up WhatsApp'}
            </button>
          )}
        </div>
      </div>

      {wa.providers && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={labelClass + ' mb-0'}>Sends through</span>
          <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
            {wa.providers.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={busy}
                onClick={() => switchProvider(p.key)}
                className={`rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                  p.inUse ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
                }`}
              >
                {p.label}
                {p.connectionStatus === 'connected' && <span className="ml-1">✓</span>}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400">
            {ultra
              ? 'Temporary: plain-text messages from a QR-linked number, no Meta approval. Keep volumes low — WhatsApp may block numbers that use unofficial APIs.'
              : 'Official: approved templates only. Switch to UltraMsg while Meta approval is pending.'}
          </span>
        </div>
      )}

      <div className="mt-3">
        <Notice notice={notice} />
      </div>

      {wa.lastError && wa.connectionStatus === 'error' && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{wa.lastError}</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Getting connected</h3>
          <ol className="mt-2 space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.done ? 'bg-emerald text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {s.done ? '✓' : i + 1}
                </span>
                <span className={s.done ? 'text-slate-400 line-through' : 'text-slate-600'}>{s.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-slate-400">
            {ultra
              ? 'Customers get order updates after they send START to the linked number; shops get new-order alerts unless they send STOP. '
              : 'The full list of what to get from Meta is in docs/whatsapp-plan.md. '}
            Credentials are entered only here and stored encrypted — never send them by chat or email.
          </p>
        </div>

        {wa.setUp && (
          <div className="grid grid-cols-3 gap-2 self-start">
            <Mini label="Approved templates" value={wa.templates?.approved ?? 0} />
            <Mini label="Waiting on Meta" value={wa.templates?.pending ?? 0} />
            <Mini label="Drafts" value={wa.templates?.drafts ?? 0} />
            <Mini label="Sent, 24 h" value={wa.last24h?.sent ?? 0} />
            <Mini label="Failed, 24 h" value={wa.last24h?.failed ?? 0} alert={(wa.last24h?.failed ?? 0) > 0} />
            <Mini label="In queue" value={wa.last24h?.queued ?? 0} />
          </div>
        )}
      </div>

      {wa.ready && <TestSend anyTemplate={ultra} />}

      {configuring && wa.platform && (
        <PlatformConfigModal platform={wa.platform} onClose={() => setConfiguring(false)} onChanged={onChanged} />
      )}
    </section>
  );
}

function Mini({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`text-lg font-extrabold tabular-nums ${alert ? 'text-state-error' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

/** anyTemplate: UltraMsg sends any template's text, so drafts can be tried too. */
function TestSend({ anyTemplate = false }: { anyTemplate?: boolean }) {
  const { data } = useApiData<WhatsAppTemplatesResponse>(
    anyTemplate ? '/api/admin/whatsapp/templates' : '/api/admin/whatsapp/templates?status=approved',
  );
  const approved = (data?.items ?? []).filter((t) => t.status !== 'disabled');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'template' | 'text'>('template');
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [values, setValues] = useState<string[]>([]);
  const [buttonParam, setButtonParam] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const template = approved.find((t) => t.id === templateId);
  const dynamicButton = template?.buttons.some((b) => b.type === 'URL' && /\{\{1\}\}$/.test(b.url ?? ''));

  function pick(id: number | '') {
    setTemplateId(id);
    const t = approved.find((x) => x.id === id);
    setValues(t ? [...t.bodyExamples] : []);
    setButtonParam('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await api.post<WhatsAppMessage & { message: string }>(
        '/api/admin/whatsapp/test-send',
        mode === 'template'
          ? { to, templateId: templateId || undefined, variables: values, buttonParam: buttonParam || undefined }
          : { to, text },
      );
      setNotice({ tone: r.status === 'failed' ? 'error' : 'ok', text: r.message });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'The test send failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">Send a test message</h3>
        <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {(['template', 'text'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${mode === m ? 'bg-emerald text-white' : 'text-slate-500'}`}
            >
              {m === 'template' ? 'Template' : 'Text'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {anyTemplate
          ? 'UltraMsg sends the template’s text (or your text) as a normal WhatsApp message to any number.'
          : mode === 'template'
          ? 'With Meta’s test number, only numbers added as test recipients in the Meta app receive it. hello_world is approved on every new account — Sync templates to bring it in.'
          : 'Free text reaches someone only within 24 hours of their last message to you.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>To</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
        </label>
        {mode === 'template' && (
          <label className="block">
            <span className={labelClass}>Template</span>
            <select
              value={templateId}
              onChange={(e) => pick(e.target.value ? Number(e.target.value) : '')}
              className={inputClass}
            >
              <option value="">
                {approved.length ? (anyTemplate ? 'Pick a template' : 'Pick an approved template') : 'No approved template yet'}
              </option>
              {approved.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {mode === 'template' && template && (
        <div className="space-y-2">
          {values.map((v, i) => (
            <label key={i} className="block">
              <span className={labelClass}>{`{{${i + 1}}}`}</span>
              <input
                value={v}
                onChange={(e) => setValues((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                className={inputClass}
              />
            </label>
          ))}
          {dynamicButton && (
            <label className="block">
              <span className={labelClass}>End of the button link</span>
              <input value={buttonParam} onChange={(e) => setButtonParam(e.target.value)} className={inputClass} />
            </label>
          )}
          <p className="rounded-xl border border-emerald/20 bg-white px-3.5 py-2.5 text-sm whitespace-pre-line text-slate-700">
            {template.bodyText.replace(/\{\{(\d+)\}\}/g, (m, n) => values[Number(n) - 1] || m)}
          </p>
        </div>
      )}
      {mode === 'text' && (
        <label className="block">
          <span className={labelClass}>Message</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputClass} />
        </label>
      )}
      <Notice notice={notice} />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !to || (mode === 'template' ? !template : !text.trim())}
          className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
        >
          {busy ? 'Sending…' : 'Send test'}
        </button>
      </div>
    </form>
  );
}

/** Keys for the Gloaro WhatsApp bot, which takes orders in chat and places them here. */
function BotAccess() {
  const { data, error, reload } = useApiData<BotKeysResponse>('/api/admin/channels/bot-keys');
  const [name, setName] = useState('Gloaro bot');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setNotice(null);
    try {
      const r = await api.post<BotKey & { key: string }>('/api/admin/channels/bot-keys', { name });
      setFresh({ name: r.name, key: r.key });
      setCopied(false);
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not create the key.' });
    } finally {
      setCreating(false);
    }
  }

  async function revoke(k: BotKey) {
    if (!window.confirm(`Revoke “${k.name}” (${k.prefix}…)? The bot stops working with it at once.`)) return;
    setNotice(null);
    try {
      await api.delete(`/api/admin/channels/bot-keys/${k.id}`);
      setNotice({ tone: 'ok', text: `${k.name} revoked.` });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not revoke the key.' });
    }
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const active = (data?.items ?? []).filter((k) => !k.revokedAt);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Bot access</h2>
          <p className="text-xs text-slate-500">
            The Gloaro WhatsApp bot takes orders in chat and places them here, as the customer whose number it is. Orders
            show under the “{data?.salesChannel ?? 'whatsapp_bot'}” sales channel.
          </p>
        </div>
        {data && (
          <span className="text-xs text-slate-500">
            <span className="font-bold text-ink tabular-nums">{data.ordersLast30Days}</span> bot orders in 30 days
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <Notice notice={notice} />
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {fresh && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              Copy this key now — it won’t be shown again. Put it in the bot’s settings as GLOARO_MART_BOT_KEY.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 font-mono text-xs break-all text-ink">
                {fresh.key}
              </code>
              <button
                type="button"
                onClick={copy}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={() => setFresh(null)} className="text-xs font-semibold text-amber-700">
                Done
              </button>
            </div>
          </div>
        )}

        {active.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {active.map((k) => (
              <div key={k.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{k.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    <span className="font-mono">{k.prefix}…</span> · made {formatTime(k.createdAt)}
                    {k.createdByName ? ` by ${k.createdByName}` : ''} · last used {k.lastUsedAt ? formatTime(k.lastUsedAt) : 'never'}
                  </span>
                </span>
                <button
                  onClick={() => revoke(k)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <label className="block min-w-55 flex-1">
            <span className={labelClass}>New key name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-lg bg-emerald px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
          >
            {creating ? 'Creating…' : 'Create bot key'}
          </button>
        </form>
        <p className="text-[11px] text-slate-400">
          Anyone with a key can place orders as any customer by number, so keep it in the bot’s server settings only.
          Revoke it here if it leaks.
        </p>
      </div>
    </section>
  );
}

function ChannelDirectory({ channels }: { channels: ChannelEntry[] }) {
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const items = channels.filter((c) => c.group === g.key);
        if (items.length === 0) return null;
        return (
          <section key={g.key}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-bold text-ink">{g.label}</h2>
              <span className="text-[11px] text-slate-400">{g.hint}</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((c) => (
                <div
                  key={c.key}
                  className={`rounded-xl border px-4 py-3 ${
                    c.status === 'coming_soon' ? 'border-dashed border-slate-200 bg-slate-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-semibold ${c.status === 'coming_soon' ? 'text-slate-500' : 'text-ink'}`}>
                      {c.name}
                    </span>
                    <Badge
                      tone={
                        c.status === 'available'
                          ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                          : c.status === 'built_in'
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-400'
                      }
                    >
                      {c.status === 'available' ? 'Available' : c.status === 'built_in' ? 'Built in' : 'Coming soon'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-slate-500">{c.description}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- templates */

function TemplatesTab({ ready, onChanged }: { ready: boolean; onChanged: () => void }) {
  const { data, loading, error, reload } = useApiData<WhatsAppTemplatesResponse>('/api/admin/whatsapp/templates');
  const [editing, setEditing] = useState<WhatsAppTemplate | 'new' | null>(null);
  const [busyId, setBusyId] = useState<number | 'sync' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function refresh() {
    reload();
    onChanged();
  }

  async function act(id: number | 'sync', fn: () => Promise<string>) {
    setBusyId(id);
    setNotice(null);
    try {
      setNotice({ tone: 'ok', text: await fn() });
      refresh();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'That did not work.' });
    } finally {
      setBusyId(null);
    }
  }

  const sync = () =>
    act('sync', async () => {
      const r = await api.post<{ total: number; updated: number; added: number; removed: number }>(
        '/api/admin/whatsapp/templates/sync',
      );
      return `Meta has ${r.total} template(s): ${r.updated} updated, ${r.added} added${r.removed ? `, ${r.removed} no longer on Meta` : ''}.`;
    });
  const submit = (t: WhatsAppTemplate) =>
    act(t.id, async () => {
      const r = await api.post<WhatsAppTemplate>(`/api/admin/whatsapp/templates/${t.id}/submit`);
      return `${t.name} sent to Meta — now ${r.status}.`;
    });
  const remove = (t: WhatsAppTemplate) => {
    if (!window.confirm(`Delete ${t.name} (${t.language})${t.metaTemplateId ? ' here and on Meta' : ''}?`)) return;
    act(t.id, async () => {
      await api.delete(`/api/admin/whatsapp/templates/${t.id}`);
      return `${t.name} deleted.`;
    });
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Meta approves every template before it can be sent. Drafts below are the ones the plan calls for — review the
          wording, then submit.
        </p>
        <div className="flex gap-2">
          <button
            onClick={sync}
            disabled={!ready || busyId === 'sync'}
            title={ready ? undefined : 'Connect WhatsApp first'}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-45"
          >
            {busyId === 'sync' ? 'Syncing…' : 'Sync from Meta'}
          </button>
          <button
            onClick={() => setEditing('new')}
            className="rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep"
          >
            New template
          </button>
        </div>
      </div>

      <Notice notice={notice} />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}

      {data && (
        <div className="card overflow-hidden">
          <DataTable
            rows={items}
            keyFor={(t) => t.id}
            emptyMessage="No templates yet."
            columns={[
              {
                header: 'Template',
                render: (t) => (
                  <span>
                    <span className="block font-mono text-xs font-semibold text-ink">{t.name}</span>
                    <span className="block text-[11px] text-slate-400">
                      {t.language} · {t.category.toLowerCase()}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Message',
                render: (t) => (
                  <span className="block max-w-md">
                    <span className="line-clamp-2 text-[13px] text-slate-600">{t.preview}</span>
                    {t.rejectedReason && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-state-error">{t.rejectedReason}</span>
                    )}
                  </span>
                ),
              },
              { header: 'Status', render: (t) => <Badge tone={TEMPLATE_TONE[t.status]}>{t.status}</Badge> },
              {
                header: '',
                className: 'text-right whitespace-nowrap',
                render: (t) => {
                  const editable = ['draft', 'rejected', 'paused'].includes(t.status);
                  return (
                    <span className="inline-flex gap-1.5">
                      <button
                        onClick={() => setEditing(t)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                      >
                        {editable ? 'Edit' : 'View'}
                      </button>
                      {editable && (
                        <button
                          onClick={() => submit(t)}
                          disabled={!ready || busyId === t.id}
                          title={ready ? undefined : 'Connect WhatsApp first'}
                          className="rounded-lg bg-emerald px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                        >
                          {busyId === t.id ? 'Sending…' : t.status === 'draft' ? 'Submit' : 'Resubmit'}
                        </button>
                      )}
                      <button
                        onClick={() => remove(t)}
                        disabled={busyId === t.id || (Boolean(t.metaTemplateId) && !ready)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-45"
                      >
                        Delete
                      </button>
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      )}

      {editing && data && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          languages={data.languages}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  languages,
  categories,
  onClose,
  onSaved,
}: {
  template: WhatsAppTemplate | null;
  languages: string[];
  categories: WhatsAppCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const readOnly = template != null && !['draft', 'rejected', 'paused'].includes(template.status);
  const onMeta = Boolean(template?.metaTemplateId);
  const [name, setName] = useState(template?.name ?? '');
  const [language, setLanguage] = useState(template?.language ?? 'en');
  const [category, setCategory] = useState<WhatsAppCategory>(template?.category ?? 'UTILITY');
  const [purpose, setPurpose] = useState(template?.purpose ?? '');
  const [headerText, setHeaderText] = useState(template?.headerText ?? '');
  const [bodyText, setBodyText] = useState(template?.bodyText ?? '');
  const [footerText, setFooterText] = useState(template?.footerText ?? '');
  const [examples, setExamples] = useState<string[]>(template?.bodyExamples ?? []);
  const [buttons, setButtons] = useState<WhatsAppButton[]>(template?.buttons ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One sample per {{n}} in the text, kept as the text changes.
  const varCount = useMemo(() => {
    const nums = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    return nums.length ? Math.max(...nums) : 0;
  }, [bodyText]);
  const samples = Array.from({ length: varCount }, (_, i) => examples[i] ?? '');

  function setButton(i: number, patch: Partial<WhatsAppButton>) {
    setButtons((cur) => cur.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      language,
      category,
      purpose: purpose.trim() || null,
      headerText,
      bodyText,
      footerText,
      bodyExamples: samples,
      buttons,
    };
    try {
      if (template) await api.patch(`/api/admin/whatsapp/templates/${template.id}`, body);
      else await api.post('/api/admin/whatsapp/templates', body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the template.');
    } finally {
      setBusy(false);
    }
  }

  const preview = bodyText.replace(/\{\{(\d+)\}\}/g, (m, n) => samples[Number(n) - 1] || m);

  return (
    <Modal title={template ? `Template ${template.name}` : 'New WhatsApp template'} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <fieldset disabled={readOnly} className="space-y-3">
          {readOnly && (
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
              This template is {template?.status} — Meta signed off on this wording, so it can’t be changed. Make a new one
              for different wording.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className={labelClass}>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                disabled={onMeta || readOnly}
                placeholder="order_placed"
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={onMeta || readOnly} className={inputClass}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as WhatsAppCategory)} className={inputClass}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>Header (optional)</span>
            <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Message — use {'{{1}}'}, {'{{2}}'}… for the parts that change</span>
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} maxLength={1024} className={inputClass} />
            <span className="mt-1 block text-right text-[11px] text-slate-400">{bodyText.length} / 1024</span>
          </label>
          {varCount > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {samples.map((s, i) => (
                <label key={i} className="block">
                  <span className={labelClass}>{`Sample for {{${i + 1}}}`}</span>
                  <input
                    value={s}
                    onChange={(e) =>
                      setExamples(() => {
                        const next = [...samples];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          )}
          <label className="block">
            <span className={labelClass}>Footer (optional)</span>
            <input value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} className={inputClass} />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>Buttons (up to 3)</span>
              {buttons.length < 3 && !readOnly && (
                <button
                  type="button"
                  onClick={() => setButtons((cur) => [...cur, { type: 'QUICK_REPLY', text: '' }])}
                  className="text-xs font-semibold text-emerald-deep"
                >
                  + Add button
                </button>
              )}
            </div>
            <div className="space-y-2">
              {buttons.map((b, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-[130px_1fr_1fr_auto]">
                  <select
                    value={b.type}
                    onChange={(e) => setButton(i, { type: e.target.value as WhatsAppButton['type'] })}
                    className={inputClass}
                  >
                    <option value="QUICK_REPLY">Quick reply</option>
                    <option value="URL">Link</option>
                    <option value="PHONE_NUMBER">Call</option>
                  </select>
                  <input
                    value={b.text}
                    onChange={(e) => setButton(i, { text: e.target.value })}
                    maxLength={25}
                    placeholder="Button text"
                    className={inputClass}
                  />
                  {b.type === 'URL' ? (
                    <input
                      value={b.url ?? ''}
                      onChange={(e) => setButton(i, { url: e.target.value })}
                      placeholder="https://gloaromart.com/orders/{{1}}"
                      className={inputClass}
                    />
                  ) : b.type === 'PHONE_NUMBER' ? (
                    <input
                      value={b.phone ?? ''}
                      onChange={(e) => setButton(i, { phone: e.target.value })}
                      placeholder="+919876543210"
                      className={inputClass}
                    />
                  ) : (
                    <span />
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setButtons((cur) => cur.filter((_, j) => j !== i))}
                      className="px-1 text-slate-400 hover:text-rose-600"
                      aria-label="Remove button"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  )}
                  {b.type === 'URL' && /\{\{1\}\}$/.test(b.url ?? '') && (
                    <input
                      value={b.example ?? ''}
                      onChange={(e) => setButton(i, { example: e.target.value })}
                      placeholder="Sample end of link, e.g. 123"
                      className={`${inputClass} sm:col-span-4`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={labelClass}>Used for (optional)</span>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="order_placed" className={inputClass} />
          </label>
        </fieldset>

        {/* The message as it lands on a phone. */}
        <div className="space-y-2">
          <span className={labelClass}>Preview</span>
          <div className="rounded-2xl bg-[#E7DDD3] p-3">
            <div className="rounded-xl rounded-tl-none bg-white px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-sm">
              {headerText && <p className="mb-1 font-bold">{headerText}</p>}
              <p className="whitespace-pre-line">{preview || 'Your message…'}</p>
              {footerText && <p className="mt-1 text-[11px] text-slate-400">{footerText}</p>}
            </div>
            {buttons.map((b, i) => (
              <div key={i} className="mt-1 rounded-xl bg-white py-1.5 text-center text-[13px] font-semibold text-sky-600 shadow-sm">
                {b.text || 'Button'}
              </div>
            ))}
          </div>
          {template?.rejectedReason && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">Meta: {template.rejectedReason}</p>
          )}
        </div>

        <div className="space-y-2 lg:col-span-2">
          {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-emerald px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save draft'}
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------ order updates */

function RulesTab() {
  const { data, loading, error, reload } = useApiData<WhatsAppRulesResponse>('/api/admin/whatsapp/rules');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function toggle(rule: WhatsAppRule) {
    setBusy(rule.event);
    setNotice(null);
    try {
      await api.patch(`/api/admin/whatsapp/rules/${rule.event}`, { enabled: !rule.enabled });
      setNotice({ tone: 'ok', text: `${rule.label}: ${rule.enabled ? 'switched off' : 'switched on — events from now on are sent'}.` });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not change the rule.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Sent to the WhatsApp number the customer ordered from, once per event, only if they’ve opted in — and to the mobile
        number on the delivery address unless it wrote STOP. Shop alerts go to the shop owner’s phone. Events older than{' '}
        {data?.maxAgeHours ?? 6} hours are never sent.
        {data?.provider === 'ultramsg' &&
          ' Sending through UltraMsg: each template’s text is sent as it is, approved or not; Order placed adds the itemised bill and Invoice ready attaches the PDF.'}
      </p>
      {data && (!data.connected || !data.platformActive) && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          {!data.connected
            ? 'Nothing is sent until WhatsApp is connected (Overview → Configure → Test).'
            : 'Nothing is sent until the WhatsApp platform is set Active (Overview → Configure).'}
        </div>
      )}
      <Notice notice={notice} />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}
      {loading && !data && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}
      {data && (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.items.map((r) => (
            <div key={r.event} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink">
                    {r.label}
                    {r.audience === 'shop' && (
                      <span className="ml-2 align-middle">
                        <Badge tone="border-sky-200 bg-sky-50 text-sky-700">To shop</Badge>
                      </span>
                    )}
                  </h3>
                  <p className="text-[12px] text-slate-500">{r.description}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={r.enabled}
                  onClick={() => toggle(r)}
                  disabled={busy === r.event}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                    r.enabled ? 'bg-emerald' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.enabled ? 'left-5.5' : 'left-0.5'}`}
                  />
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-mono font-semibold text-slate-600">
                  {r.templateName} ({r.language})
                </span>
                {r.templateStatus && <Badge tone={TEMPLATE_TONE[r.templateStatus]}>{r.templateStatus}</Badge>}
                {r.enabled && (
                  <Badge
                    tone={
                      r.sendsNow
                        ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }
                  >
                    {r.sendsNow ? 'Sending' : 'Waiting'}
                  </Badge>
                )}
              </div>
              {r.preview && (
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] leading-snug text-slate-600">{r.preview}</p>
              )}
              {r.problem && <p className="mt-1.5 text-[11px] font-semibold text-amber-700">{r.problem}</p>}
              <p className="mt-2 text-[11px] text-slate-400">
                Last 7 days: {r.last7d.sent} sent · {r.last7d.skipped} skipped
                {r.last7d.failed ? ` · ${r.last7d.failed} failed` : ''}
                {r.enabledAt ? ` · on since ${formatTime(r.enabledAt)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- messages */

const MESSAGE_FILTERS = ['all', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'received'] as const;

function MessagesTab() {
  const [filter, setFilter] = useState<(typeof MESSAGE_FILTERS)[number]>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const query = [filter === 'all' ? '' : `status=${filter}`, `page=${page}`, debounced ? `q=${encodeURIComponent(debounced)}` : '']
    .filter(Boolean)
    .join('&');
  const { data, loading, error, reload } = useApiData<Paged<WhatsAppMessage>>(`/api/admin/whatsapp/messages?${query}`, [
    filter,
    page,
    debounced,
  ]);

  async function retry(m: WhatsAppMessage) {
    setBusyId(m.id);
    setNotice(null);
    try {
      const r = await api.post<WhatsAppMessage>(`/api/admin/whatsapp/messages/${m.id}/retry`);
      setNotice({ tone: r.status === 'failed' ? 'error' : 'ok', text: r.status === 'failed' ? `Failed again: ${r.errorMessage}` : 'Sent again.' });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not resend.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {MESSAGE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold capitalize ${
                filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Number, template or text…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      <Notice notice={notice} />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}
      {loading && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}

      {!loading && data && (
        <div className="card overflow-hidden">
          <DataTable
            rows={data.items}
            keyFor={(m) => m.id}
            emptyMessage="No messages yet."
            columns={[
              { header: 'When', className: 'whitespace-nowrap', render: (m) => formatTime(m.createdAt) },
              {
                header: 'Number',
                render: (m) => (
                  <span>
                    <span className="block font-mono text-xs text-ink">
                      {m.direction === 'in' ? '← ' : '→ '}
                      {formatPhone(m.phone)}
                    </span>
                    {m.userName && <span className="block text-[11px] text-slate-400">{m.userName}</span>}
                  </span>
                ),
              },
              {
                header: 'Message',
                render: (m) => (
                  <span className="block max-w-md">
                    <span className="block text-[11px] font-semibold text-slate-400">
                      {m.kind === 'template' ? m.templateName : 'text'}
                      {m.event ? ` · ${m.event}` : ''}
                    </span>
                    <span className="line-clamp-2 text-[13px] text-slate-600">{m.body}</span>
                    {m.skipReason && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">Not sent: {m.skipReason}</span>
                    )}
                    {m.errorMessage && m.status !== 'sent' && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-state-error">
                        {m.errorMessage}
                        {m.nextAttemptAt && ` · retry ${formatTime(m.nextAttemptAt)}`}
                      </span>
                    )}
                  </span>
                ),
              },
              { header: 'Status', render: (m) => <Badge tone={MESSAGE_TONE[m.status]}>{m.status}</Badge> },
              {
                header: '',
                className: 'text-right',
                render: (m) =>
                  m.status === 'failed' && m.direction === 'out' ? (
                    <button
                      onClick={() => retry(m)}
                      disabled={busyId === m.id}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep disabled:opacity-50"
                    >
                      {busyId === m.id ? 'Sending…' : 'Send again'}
                    </button>
                  ) : null,
              },
            ]}
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
