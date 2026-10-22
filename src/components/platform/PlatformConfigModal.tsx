import { useEffect, useState } from 'react';
import { API_URL, api, ApiError, isPendingApproval } from '../../lib/api';
import { useApiData } from '../../lib/useApiData';
import { Modal } from '../ui/Modal';
import type {
  Platform,
  PlatformConnection,
  PlatformConnections,
  PlatformEnvironment,
  PlatformField,
  PlatformFieldType,
  PlatformSyncLog,
} from '../../lib/types';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase';

const FIELD_TYPES: { value: PlatformFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'password', label: 'Secret' },
  { value: 'url', label: 'Link' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'On / off' },
  { value: 'textarea', label: 'Long text' },
];

/** One-click starting points for the settings most providers ask for. */
const PRESETS: PlatformField[] = [
  { key: 'api_key', label: 'API key', type: 'password', required: true, secret: true },
  { key: 'api_secret', label: 'API secret', type: 'password', required: true, secret: true },
  { key: 'merchant_id', label: 'Merchant / account ID', type: 'text', required: true, secret: false },
  { key: 'webhook_secret', label: 'Webhook signing secret', type: 'password', required: false, secret: true },
  { key: 'base_url', label: 'API base URL', type: 'url', required: false, secret: false },
];

type Tab = 'settings' | 'form' | 'activity';

/**
 * Configure one platform: its settings per environment (generated from its
 * settings form) and the form itself. Secrets are write-only here — the server
 * says which are set and never sends a value back.
 */
export function PlatformConfigModal({
  platform,
  onClose,
  onChanged,
}: {
  platform: Platform;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useApiData<PlatformConnections>(`/api/admin/platforms/${platform.id}/connections`);
  const [tab, setTab] = useState<Tab>('settings');
  const [env, setEnv] = useState<PlatformEnvironment>(platform.environment);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const refresh = () => {
    reload();
    onChanged();
  };

  // A platform with no settings yet starts on the form editor.
  useEffect(() => {
    if (data && data.schema.length === 0) setTab('form');
  }, [data]);

  async function switchEnvironment(next: PlatformEnvironment) {
    setNotice(null);
    try {
      const r = await api.patch(`/api/admin/platforms/${platform.id}`, { environment: next });
      if (isPendingApproval(r)) setNotice({ tone: 'warn', text: r.message });
      else setNotice({ tone: 'ok', text: `${platform.name} now uses its ${next === 'live' ? 'Live' : 'Test'} settings.` });
      refresh();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not switch environment.' });
    }
  }

  const connection = data?.connections.find((c) => c.environment === env);

  return (
    <Modal title={`Configure ${platform.name}`} onClose={onClose} wide>
      {loading && <div className="p-6 text-center text-sm text-slate-400">Loading…</div>}
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

      {data && connection && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl border border-slate-200 p-1">
              {(['settings', 'form', 'activity'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    tab === t ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t === 'settings' ? 'Settings' : t === 'form' ? `Form fields (${data.schema.length})` : 'Activity'}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {data.connector ? `${data.connector.name} connector · ` : 'No connector · '}
              In use:{' '}
              <span className={`font-bold ${data.environment === 'live' ? 'text-rose-600' : 'text-sky-700'}`}>
                {data.environment === 'live' ? 'Live' : 'Test'}
              </span>
            </span>
          </div>

          {data.webhookPath && tab === 'settings' && <WebhookUrl path={data.webhookPath} />}

          {notice && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
                notice.tone === 'ok'
                  ? 'border-state-success/25 bg-state-success/10 text-state-success-ink'
                  : notice.tone === 'warn'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {notice.text}
            </div>
          )}

          {tab === 'settings' ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {(['test', 'live'] as PlatformEnvironment[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setEnv(e);
                      setNotice(null);
                    }}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                      env === e ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {e === 'live' ? 'Live' : 'Test'} settings
                    {!data.connections.find((c) => c.environment === e)?.complete && (
                      <span className="ml-1.5 text-xs opacity-70">· incomplete</span>
                    )}
                  </button>
                ))}
                {env !== data.environment && (
                  <button
                    onClick={() => switchEnvironment(env)}
                    className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Use {env === 'live' ? 'Live' : 'Test'} settings
                  </button>
                )}
              </div>
              <SettingsForm
                key={`${env}-${connection.updatedAt}-${data.schema.length}`}
                platformId={platform.id}
                schema={data.schema}
                connection={connection}
                canStoreSecrets={data.canStoreSecrets}
                canTest={data.canTest}
                onSaved={(text) => {
                  setNotice({ tone: 'ok', text });
                  refresh();
                }}
                onNotice={setNotice}
                onTested={refresh}
                onEditForm={() => setTab('form')}
              />
            </>
          ) : tab === 'activity' ? (
            <ActivityLog platformId={platform.id} />
          ) : (
            <FormEditor
              platformId={platform.id}
              schema={data.schema}
              onSaved={() => {
                setNotice({ tone: 'ok', text: 'Settings form saved.' });
                setTab('settings');
                refresh();
              }}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function SettingsForm({
  platformId,
  schema,
  connection,
  canStoreSecrets,
  canTest,
  onSaved,
  onNotice,
  onTested,
  onEditForm,
}: {
  platformId: number;
  schema: PlatformField[];
  connection: PlatformConnection;
  canStoreSecrets: boolean;
  canTest: boolean;
  onSaved: (text: string) => void;
  onNotice: (n: { tone: 'ok' | 'warn' | 'error'; text: string } | null) => void;
  /** A test changes the connection status whether it passes or not. */
  onTested: () => void;
  onEditForm: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      schema
        .filter((f) => !f.secret)
        .map((f) => [f.key, f.type === 'boolean' ? connection.values[f.key] === true : String(connection.values[f.key] ?? '')])
    )
  );
  // Only secrets the admin touches are sent: a value replaces, null clears.
  const [secrets, setSecrets] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  if (schema.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
        <p className="text-sm font-semibold text-slate-600">This platform has no settings yet.</p>
        <button onClick={onEditForm} className="mt-2 text-sm font-semibold text-sky-700 hover:underline">
          Add its settings form
        </button>
      </div>
    );
  }

  async function save() {
    onNotice(null);
    setSaving(true);
    try {
      const plain: Record<string, string | boolean | null> = {};
      for (const f of schema.filter((x) => !x.secret)) {
        const v = values[f.key];
        plain[f.key] = typeof v === 'string' ? v.trim() || null : v;
      }
      const r = await api.put(`/api/admin/platforms/${platformId}/connections/${connection.environment}`, {
        values: plain,
        secrets,
      });
      if (isPendingApproval(r)) onNotice({ tone: 'warn', text: r.message });
      else onSaved(`${connection.environment === 'live' ? 'Live' : 'Test'} settings saved.`);
    } catch (err) {
      onNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save the settings.' });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    onNotice(null);
    setTesting(true);
    try {
      const r = await api.post<{ ok: boolean; message: string | null }>(
        `/api/admin/platforms/${platformId}/connections/${connection.environment}/test`
      );
      onNotice({ tone: 'ok', text: r.message ?? 'Connection works.' });
    } catch (err) {
      const tone = err instanceof ApiError && err.status === 409 ? 'warn' : 'error';
      onNotice({ tone, text: err instanceof ApiError ? err.message : 'The test failed.' });
    } finally {
      setTesting(false);
      onTested();
    }
  }

  const hasSecrets = schema.some((f) => f.secret);

  return (
    <div className="space-y-4">
      {hasSecrets && !canStoreSecrets && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          The server has no PLATFORM_SECRETS_KEY, so secret settings can’t be saved yet.
        </p>
      )}
      {connection.environment === 'live' && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
          Live settings: real credentials, real money. Double-check before saving.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {schema.map((f) => (
          <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
            <span className={labelClass}>
              {f.label}
              {f.required && <span className="text-rose-500"> *</span>}
            </span>
            {f.secret ? (
              <SecretInput
                isSet={connection.secretsSet[f.key] === true}
                pending={secrets[f.key]}
                onChange={(v) => setSecrets((s) => ({ ...s, [f.key]: v }))}
                onReset={() =>
                  setSecrets((s) => {
                    const next = { ...s };
                    delete next[f.key];
                    return next;
                  })
                }
              />
            ) : f.type === 'boolean' ? (
              <label className="flex items-center gap-2 py-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={values[f.key] === true}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))}
                />
                Enabled
              </label>
            ) : f.type === 'select' ? (
              <select
                value={String(values[f.key] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className={inputClass}
              >
                <option value="">Not set</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                value={String(values[f.key] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                rows={3}
                className={inputClass}
              />
            ) : (
              <input
                value={String(values[f.key] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                placeholder={f.type === 'url' ? 'https://…' : undefined}
                className={inputClass}
              />
            )}
            {f.help && <span className="mt-1 block text-xs text-slate-400">{f.help}</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">
          {connection.complete ? 'All required settings are filled in.' : `${connection.missingRequired.length} required setting(s) missing.`}
          {connection.lastError && <span className="ml-1 text-rose-600">Last test: {connection.lastError}</span>}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={test}
            disabled={testing}
            title={canTest ? undefined : 'No connector is built for this platform yet'}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-60">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The address to paste into the provider's webhook settings. */
function WebhookUrl({ path }: { path: string }) {
  const url = `${API_URL}${path}`;
  const [copied, setCopied] = useState(false);
  const local = /\/\/(localhost|127\.0\.0\.1)/.test(url);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <span className={labelClass}>Webhook URL</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-slate-700">{url}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Paste this in the provider’s webhook settings. Events are accepted only while the platform is enabled, and only
        when their signature matches the saved secret.
        {local && ' This is a local address, so a provider on the internet cannot reach it until the backend is deployed.'}
      </p>
    </div>
  );
}

const LOG_STYLE: Record<PlatformSyncLog['status'], string> = {
  ok: 'bg-state-success/10 text-state-success-ink',
  error: 'bg-rose-50 text-rose-700',
  rejected: 'bg-amber-50 text-amber-800',
};

/** Recent connection tests and webhooks, newest first. */
function ActivityLog({ platformId }: { platformId: number }) {
  const { data, loading, error, reload } = useApiData<PlatformSyncLog[]>(`/api/admin/platforms/${platformId}/logs`);
  if (loading) return <div className="p-6 text-center text-sm text-slate-400">Loading…</div>;
  if (error) return <p className="text-sm font-medium text-rose-600">{error}</p>;
  if (!data || data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        Nothing yet. Connection tests and incoming webhooks will show here.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button onClick={reload} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50">
          Refresh
        </button>
      </div>
      <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
        {data.map((l) => (
          <div key={l.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
            <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold capitalize ${LOG_STYLE[l.status]}`}>
              {l.status}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink">
                {l.event ?? l.kind}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {l.kind} · {l.environment === 'live' ? 'Live' : 'Test'}
                </span>
              </div>
              {l.message && <div className="text-slate-600">{l.message}</div>}
              {l.detail && <div className="truncate font-mono text-[11px] text-slate-400">{JSON.stringify(l.detail)}</div>}
            </div>
            <span className="shrink-0 text-xs text-slate-400">
              {new Date(l.created_at).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A secret is never shown: it reads "Set" with Replace / Clear, or takes a new value. */
function SecretInput({
  isSet,
  pending,
  onChange,
  onReset,
}: {
  isSet: boolean;
  pending: string | null | undefined;
  onChange: (value: string | null) => void;
  onReset: () => void;
}) {
  if (pending === undefined && isSet) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-500">
          •••••••• set
        </span>
        <button type="button" onClick={() => onChange('')} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">
          Replace
        </button>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">
          Clear
        </button>
      </div>
    );
  }
  if (pending === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">Will be cleared on save</span>
        <button type="button" onClick={onReset} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        autoComplete="new-password"
        value={pending ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? 'New value' : 'Not set'}
        className={inputClass}
      />
      {isSet && (
        <button type="button" onClick={onReset} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Keep
        </button>
      )}
    </div>
  );
}

type DraftField = PlatformField & { optionsText: string };

function FormEditor({ platformId, schema, onSaved }: { platformId: number; schema: PlatformField[]; onSaved: () => void }) {
  const [fields, setFields] = useState<DraftField[]>(() =>
    schema.map((f) => ({ ...f, optionsText: (f.options ?? []).join(', ') }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<DraftField>) =>
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  function addField(base?: PlatformField) {
    setFields((fs) => {
      let key = base?.key ?? `setting_${fs.length + 1}`;
      while (fs.some((f) => f.key === key)) key = `${key}_2`;
      return [
        ...fs,
        { key, label: base?.label ?? '', type: base?.type ?? 'text', required: base?.required ?? false, secret: base?.secret ?? false, optionsText: '' },
      ];
    });
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api.put(`/api/admin/platforms/${platformId}/settings-form`, {
        fields: fields.map(({ optionsText, ...f }) => ({
          ...f,
          key: f.key.trim(),
          label: f.label.trim(),
          options: f.type === 'select' ? optionsText.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
        })),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the form.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        The settings this platform needs. The settings form is built from this list, so any provider can be set up
        without code changes. Secret settings are stored encrypted and never shown again.
      </p>

      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 p-2.5">
              <input
                value={f.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label, e.g. API key"
                className={`${inputClass} col-span-12 sm:col-span-3`}
              />
              <input
                value={f.key}
                onChange={(e) => update(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                placeholder="key"
                className={`${inputClass} col-span-6 font-mono sm:col-span-3`}
              />
              <select
                value={f.type}
                onChange={(e) => {
                  const type = e.target.value as PlatformFieldType;
                  update(i, { type, secret: type === 'password' ? true : type === 'boolean' || type === 'select' ? false : f.secret });
                }}
                className={`${inputClass} col-span-6 sm:col-span-2`}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="col-span-12 flex items-center gap-3 text-xs font-medium whitespace-nowrap text-slate-600 sm:col-span-4">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  Required
                </label>
                <label className="flex items-center gap-1.5" title="Stored encrypted, never shown again">
                  <input
                    type="checkbox"
                    checked={f.secret}
                    disabled={f.type === 'password' || f.type === 'boolean' || f.type === 'select'}
                    onChange={(e) => update(i, { secret: e.target.checked })}
                  />
                  Secret
                </label>
                <button
                  type="button"
                  onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}
                  className="ml-auto rounded-lg px-2 py-1 text-rose-600 hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
              {f.type === 'select' && (
                <input
                  value={f.optionsText}
                  onChange={(e) => update(i, { optionsText: e.target.value })}
                  placeholder="Options, comma-separated: auto, manual"
                  className={`${inputClass} col-span-12`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => addField()}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Add setting
        </button>
        <span className="text-xs text-slate-400">Quick add:</span>
        {PRESETS.filter((p) => !fields.some((f) => f.key === p.key)).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => addField(p)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

      <div className="flex justify-end border-t border-slate-100 pt-3">
        <button onClick={save} disabled={saving} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-60">
          {saving ? 'Saving…' : 'Save form'}
        </button>
      </div>
    </div>
  );
}
