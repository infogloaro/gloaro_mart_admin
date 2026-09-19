import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Icon } from '../components/ui/Icon';
import { clearToken } from '../lib/auth';
import type { PlatformSettings } from '../lib/types';

/** Form state is all strings — inputs give strings, and the API takes nulls for blanks. */
type Draft = {
  platformName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string;
  currencyCode: string;
  invoicePrefix: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  maintenanceMessage: string;
};

const EMPTY: Draft = {
  platformName: '',
  tagline: '',
  logoUrl: '',
  faviconUrl: '',
  supportEmail: '',
  supportPhone: '',
  whatsappNumber: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  gstNumber: '',
  currencyCode: 'INR',
  invoicePrefix: 'GLM',
  instagramUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  maintenanceMessage: '',
};

function toDraft(s: PlatformSettings): Draft {
  return {
    platformName: s.platform_name ?? '',
    tagline: s.tagline ?? '',
    logoUrl: s.logo_url ?? '',
    faviconUrl: s.favicon_url ?? '',
    supportEmail: s.support_email ?? '',
    supportPhone: s.support_phone ?? '',
    whatsappNumber: s.whatsapp_number ?? '',
    addressLine: s.address_line ?? '',
    city: s.city ?? '',
    state: s.state ?? '',
    pincode: s.pincode ?? '',
    gstNumber: s.gst_number ?? '',
    currencyCode: s.currency_code ?? 'INR',
    invoicePrefix: s.invoice_prefix ?? 'GLM',
    instagramUrl: s.instagram_url ?? '',
    facebookUrl: s.facebook_url ?? '',
    youtubeUrl: s.youtube_url ?? '',
    maintenanceMessage: s.maintenance_message ?? '',
  };
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * Self-service password change, gated by an OTP mailed to infogloaro@gmail.com —
 * the change only takes effect once that code comes back. A confirmed change
 * ends every session, this one included, so it logs the admin out.
 */
function ChangePasswordSection() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match.');

    setSaving(true);
    try {
      const res = await api.post<{ message: string }>('/api/admin/me/password/otp', {
        currentPassword,
        newPassword,
      });
      setOtpRequested(true);
      setNotice(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the password change.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!otp.trim()) return setError('Enter the OTP.');

    setSaving(true);
    try {
      await api.post('/api/admin/me/password/otp/confirm', { otp: otp.trim() });
      // Held on screen briefly: the redirect is instant otherwise, and the
      // operator never sees that the change actually succeeded.
      setNotice('Password changed. Signing you out…');
      setTimeout(() => {
        clearToken();
        navigate('/login', { replace: true });
      }, 1800);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not confirm the OTP.');
      setSaving(false);
    }
  }

  if (otpRequested) {
    return (
      <Section title="My account" hint="Enter the OTP sent to infogloaro@gmail.com to finish changing your password.">
        <form onSubmit={handleConfirmOtp} className="grid gap-3 sm:grid-cols-3">
          <Field label="OTP" value={otp} onChange={setOtp} placeholder="123456" />
          {notice && (
            <div className="sm:col-span-3 rounded-xl border border-mint-soft bg-mint-mist px-4 py-2.5 text-sm font-medium text-emerald-deep">
              {notice}
            </div>
          )}
          {error && (
            <div className="sm:col-span-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}
          <div className="sm:col-span-3 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm">
              {saving ? 'Confirming…' : 'Confirm and change password'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpRequested(false);
                setOtp('');
                setError(null);
                setNotice(null);
              }}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Start over
            </button>
          </div>
        </form>
      </Section>
    );
  }

  return (
    <Section title="My account" hint="An OTP is mailed to infogloaro@gmail.com before the change takes effect.">
      <form onSubmit={handleRequestOtp} className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="••••••••"
        />
        <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="••••••••" />
        <Field
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
        />
        {error && (
          <div className="sm:col-span-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}
        <div className="sm:col-span-3">
          <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm">
            {saving ? 'Sending OTP…' : 'Send OTP'}
          </button>
        </div>
      </form>
    </Section>
  );
}

export default function SettingsPage() {
  const { data: settings, loading, error, reload } = useApiData<PlatformSettings>('/api/admin/settings');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDraft(toDraft(settings));
    setMaintenanceMode(settings.maintenance_mode);
  }, [settings]);

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setNotice(null);

    if (!draft.platformName.trim()) return setSaveError('Platform name cannot be empty.');
    if (!draft.currencyCode.trim()) return setSaveError('Currency code cannot be empty.');
    if (!draft.invoicePrefix.trim()) return setSaveError('Invoice prefix cannot be empty.');
    if (maintenanceMode && !draft.maintenanceMessage.trim()) {
      return setSaveError('Write the message customers will see while maintenance mode is on.');
    }

    // Blank text means "clear this field", so send null rather than "".
    const body: Record<string, unknown> = { maintenanceMode };
    for (const [key, value] of Object.entries(draft)) {
      body[key] = value.trim() === '' ? null : value.trim();
    }
    body.platformName = draft.platformName.trim();
    body.currencyCode = draft.currencyCode.trim().toUpperCase();
    body.invoicePrefix = draft.invoicePrefix.trim().toUpperCase();

    setSaving(true);
    try {
      await api.put('/api/admin/settings', body);
      setNotice('Settings saved.');
      reload();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
        {error}
      </div>
    );
  }

  return (
    // The account card sits outside the settings form, not inside it: its own
    // <form> nested in this one is invalid HTML, and the browser drops the
    // inner submit handler, so "Send OTP" posted the page instead of firing.
    <div className="max-w-4xl space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">General Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Branding and business details. The app reads these, so a logo or a support number changes without a new
          release.
        </p>
      </div>

      <ChangePasswordSection />

      <form onSubmit={handleSubmit} className="space-y-4">
      <Section title="Brand" hint="Shown on the app home, invoices and support screens.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Platform name" value={draft.platformName} onChange={set('platformName')} placeholder="Gloaro Mart" />
          <Field
            label="Tagline"
            value={draft.tagline}
            onChange={set('tagline')}
            placeholder="One Ecosystem. Multiple Business Solutions."
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Field label="Logo URL" value={draft.logoUrl} onChange={set('logoUrl')} placeholder="https://…/logo.png" />
            <LogoPreview url={draft.logoUrl} label="Logo preview" />
          </div>
          <div>
            <Field
              label="Favicon URL"
              value={draft.faviconUrl}
              onChange={set('faviconUrl')}
              placeholder="https://…/favicon.png"
            />
            <LogoPreview url={draft.faviconUrl} label="Favicon preview" small />
          </div>
        </div>
      </Section>

      <Section title="Contact & support" hint="Where customers reach you from the app.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Support email"
            type="email"
            value={draft.supportEmail}
            onChange={set('supportEmail')}
            placeholder="support@gloaromart.com"
          />
          <Field
            label="Support phone"
            value={draft.supportPhone}
            onChange={set('supportPhone')}
            placeholder="9876543210"
          />
          <Field
            label="WhatsApp number"
            value={draft.whatsappNumber}
            onChange={set('whatsappNumber')}
            placeholder="9876543210"
          />
        </div>
      </Section>

      <Section title="Business details" hint="Printed on invoices and shown in the app's legal screens.">
        <Field label="Registered address" value={draft.addressLine} onChange={set('addressLine')} placeholder="12A, Anna Nagar" />
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label="City" value={draft.city} onChange={set('city')} placeholder="Madurai" />
          <Field label="State" value={draft.state} onChange={set('state')} placeholder="Tamil Nadu" />
          <Field label="Pincode" value={draft.pincode} onChange={set('pincode')} placeholder="625020" />
          <Field label="GST number" value={draft.gstNumber} onChange={set('gstNumber')} placeholder="33ABCDE1234F1Z5" />
        </div>
      </Section>

      <Section title="Billing" hint="Used when invoices are generated.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Currency code" value={draft.currencyCode} onChange={set('currencyCode')} placeholder="INR" />
          <Field
            label="Invoice prefix"
            value={draft.invoicePrefix}
            onChange={set('invoicePrefix')}
            placeholder="GLM"
            hint="Invoice numbers read like GLM-2026-00001."
          />
        </div>
      </Section>

      <Section title="Social links">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Instagram" value={draft.instagramUrl} onChange={set('instagramUrl')} placeholder="https://instagram.com/…" />
          <Field label="Facebook" value={draft.facebookUrl} onChange={set('facebookUrl')} placeholder="https://facebook.com/…" />
          <Field label="YouTube" value={draft.youtubeUrl} onChange={set('youtubeUrl')} placeholder="https://youtube.com/@…" />
        </div>
      </Section>

      <Section title="Maintenance mode" hint="Turn this on only while the marketplace should be closed to customers.">
        <label className="flex items-start gap-2.5 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(e) => setMaintenanceMode(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Close the app to customers
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              The catalogue is replaced by your message. Admin and vendor tools keep working.
            </span>
          </span>
        </label>
        {maintenanceMode && (
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Message shown to customers</label>
            <textarea
              value={draft.maintenanceMessage}
              onChange={(e) => set('maintenanceMessage')(e.target.value)}
              rows={2}
              placeholder="We're back in a couple of hours."
              className={inputClass}
            />
          </div>
        )}
      </Section>

      {saveError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {saveError}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-mint-soft bg-mint-mist px-4 py-2.5 text-sm font-medium text-emerald-deep">
          <Icon name="shield" className="h-4 w-4" />
          {notice}
        </div>
      )}

      {/* Sticky so a long form never hides the only way to save it. */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-slate-200 bg-canvas/95 px-1 py-3">
        <span className="text-xs text-slate-500">
          {settings ? `Last updated ${new Date(settings.updated_at).toLocaleString()}` : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!settings) return;
              setDraft(toDraft(settings));
              setMaintenanceMode(settings.maintenance_mode);
              setSaveError(null);
              setNotice(null);
            }}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Reset
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
      </form>
    </div>
  );
}

function LogoPreview({ url, label, small = false }: { url: string; label: string; small?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  const box = small ? 'h-9 w-9' : 'h-14 w-14';
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <div className={`${box} flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white`}>
        {url && !broken ? (
          <img src={url} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <Icon name="image" className="h-4 w-4 text-slate-300" />
        )}
      </div>
      <span className="text-xs text-slate-500">{broken ? 'That URL did not load' : label}</span>
    </div>
  );
}
