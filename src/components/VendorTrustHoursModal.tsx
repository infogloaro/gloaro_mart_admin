import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Modal } from './ui/Modal';
import type { AdminVendor } from '../lib/types';

/** Trust fields on the vendor row (SB2; the admin list returns SELECT * + verified). */
type TrustVendor = AdminVendor & {
  verified?: boolean;
  verification_hold?: boolean;
  verification_hold_reason?: string | null;
};

/** GET /api/admin/vendors/:id/hours (SB3). */
interface ShopHours {
  timezone: string;
  week: { day_of_week: number; is_closed: boolean; opens_at: string | null; closes_at: string | null }[];
  holidays: { id: number; date: string; note: string | null }[];
  open_now: boolean | null;
  daily_hours: { opens_at: string | null; closes_at: string | null };
}

type DayMode = 'open' | 'closed' | 'allday';
interface DayRow {
  mode: DayMode;
  opens: string;
  closes: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5);

function rowsFrom(h: ShopHours): DayRow[] {
  const fallback = { opens: hhmm(h.daily_hours.opens_at) || '09:00', closes: hhmm(h.daily_hours.closes_at) || '21:00' };
  return DAYS.map((_, day) => {
    const d = h.week.find((w) => w.day_of_week === day);
    if (!d) return { mode: 'open', ...fallback };
    if (d.is_closed) return { mode: 'closed', ...fallback };
    const opens = hhmm(d.opens_at);
    const closes = hhmm(d.closes_at);
    // Equal times mean open all day on the server.
    return { mode: opens === closes ? 'allday' : 'open', opens, closes };
  });
}

/**
 * Vendors → Trust & hours: the Verified badge (computed from approval and
 * approved GSTIN / PAN / bank documents) with the admin's hold on it — the
 * shop sees the reason — and the shop's opening hours, which the shop
 * normally sets in its app (holidays are the shop's own and shown read-only).
 */
export function VendorTrustHoursModal({
  vendor,
  canEdit,
  onClose,
  onChanged,
}: {
  vendor: TrustVendor;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [hold, setHold] = useState(Boolean(vendor.verification_hold));
  const [verified, setVerified] = useState(Boolean(vendor.verified));
  const [reason, setReason] = useState(vendor.verification_hold_reason ?? '');
  const [holdError, setHoldError] = useState<string | null>(null);
  const [savingHold, setSavingHold] = useState(false);

  const { data: hours, loading, error: hoursError, reload } = useApiData<ShopHours>(`/api/admin/vendors/${vendor.id}/hours`, [vendor.id]);
  const [perDay, setPerDay] = useState(false);
  const [days, setDays] = useState<DayRow[]>([]);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [hoursMessage, setHoursMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (!hours) return;
    setPerDay(hours.week.length > 0);
    setDays(rowsFrom(hours));
    setTimezone(hours.timezone);
  }, [hours]);

  async function saveHold(nextHold: boolean) {
    setHoldError(null);
    if (nextHold && !reason.trim()) {
      setHoldError('Give a reason; the shop sees it in its app.');
      return;
    }
    setSavingHold(true);
    try {
      const r = await api.patch<{ verificationHold: boolean; verificationHoldReason: string | null; verified: boolean }>(
        `/api/admin/vendors/${vendor.id}/verification`,
        { hold: nextHold, reason: nextHold ? reason.trim() : null },
      );
      setHold(r.verificationHold);
      setVerified(r.verified);
      setReason(r.verificationHoldReason ?? '');
      onChanged();
    } catch (e) {
      setHoldError(e instanceof ApiError ? e.message : 'Failed to change the hold.');
    } finally {
      setSavingHold(false);
    }
  }

  async function saveHours() {
    setHoursMessage(null);
    const week = perDay
      ? days.map((d, day) =>
          d.mode === 'closed'
            ? { day, closed: true }
            : d.mode === 'allday'
              ? { day, opensAt: '00:00', closesAt: '00:00' }
              : { day, opensAt: d.opens, closesAt: d.closes },
        )
      : [];
    if (perDay && days.some((d) => d.mode === 'open' && (!d.opens || !d.closes))) {
      setHoursMessage({ ok: false, text: 'Give an opening and a closing time for every open day.' });
      return;
    }
    setSavingHours(true);
    try {
      await api.put(`/api/admin/vendors/${vendor.id}/hours`, { timezone: timezone.trim(), week });
      setHoursMessage({ ok: true, text: 'Opening hours saved.' });
      reload();
    } catch (e) {
      setHoursMessage({ ok: false, text: e instanceof ApiError ? e.message : 'Failed to save the hours.' });
    } finally {
      setSavingHours(false);
    }
  }

  const setDay = (i: number, patch: Partial<DayRow>) => setDays((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const daily =
    hours && hours.daily_hours.opens_at && hours.daily_hours.closes_at
      ? `${hhmm(hours.daily_hours.opens_at)}–${hhmm(hours.daily_hours.closes_at)}`
      : 'none set, so the shop shows no hours';

  return (
    <Modal title={`Trust & hours — ${vendor.business_name}`} onClose={onClose} wide>
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Verified badge</h3>
            {verified ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">Verified</span>
            ) : hold ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">On hold</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Not verified</span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            The badge shows by itself once the shop is approved and its GSTIN, PAN and bank documents are approved under
            KYC &amp; Documents. A hold removes it until you lift it; the shop sees your reason.
          </p>
          {canEdit && (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Reason for the hold (shown to the shop)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => saveHold(true)}
                  disabled={savingHold}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {hold ? 'Update hold reason' : 'Put badge on hold'}
                </button>
                {hold && (
                  <button
                    onClick={() => saveHold(false)}
                    disabled={savingHold}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Lift hold
                  </button>
                )}
              </div>
            </>
          )}
          {!canEdit && hold && <div className="text-sm text-amber-800">On hold: {reason}</div>}
          {holdError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{holdError}</div>}
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Opening hours</h3>
            {hours && hours.open_now != null && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${hours.open_now ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                {hours.open_now ? 'Open now' : 'Closed now'}
              </span>
            )}
          </div>
          {loading && <div className="text-sm text-slate-400">Loading…</div>}
          {hoursError && <div className="text-sm text-rose-600">{hoursError}</div>}
          {hours && (
            <>
              <p className="text-xs text-slate-500">
                The shop sets these in its app. Without hours for each day, the daily window from its delivery settings
                applies ({daily}). Checkout, the shop list and the shop page all use these on the shop's own clock.
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={perDay} disabled={!canEdit} onChange={(e) => setPerDay(e.target.checked)} />
                Different hours each day
              </label>
              {perDay && (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {days.map((d, i) => (
                    <div key={DAYS[i]} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-24 font-medium text-slate-700">{DAYS[i]}</span>
                      <select
                        value={d.mode}
                        disabled={!canEdit}
                        onChange={(e) => setDay(i, { mode: e.target.value as DayMode })}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="allday">24 hours</option>
                        <option value="closed">Closed</option>
                      </select>
                      {d.mode === 'open' && (
                        <>
                          <input type="time" value={d.opens} disabled={!canEdit} onChange={(e) => setDay(i, { opens: e.target.value })}
                            aria-label={`${DAYS[i]} opens`} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                          <span className="text-slate-400">to</span>
                          <input type="time" value={d.closes} disabled={!canEdit} onChange={(e) => setDay(i, { closes: e.target.value })}
                            aria-label={`${DAYS[i]} closes`} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                          {d.closes && d.opens && d.closes < d.opens && <span className="text-xs text-slate-400">past midnight</span>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-700">
                  Time zone{' '}
                  <input value={timezone} disabled={!canEdit} onChange={(e) => setTimezone(e.target.value)}
                    className="ml-1 w-40 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                </label>
                {canEdit && (
                  <button onClick={saveHours} disabled={savingHours} className="btn-primary ml-auto px-4 py-2 text-sm disabled:opacity-50">
                    {savingHours ? 'Saving…' : 'Save hours'}
                  </button>
                )}
              </div>
              {hoursMessage && (
                <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${hoursMessage.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  {hoursMessage.text}
                </div>
              )}
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600">Coming holidays (set by the shop)</div>
                {hours.holidays.length === 0 ? (
                  <div className="text-xs text-slate-400">None.</div>
                ) : (
                  <ul className="space-y-0.5 text-sm text-slate-700">
                    {hours.holidays.map((h) => (
                      <li key={h.id}>
                        {new Date(`${h.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {h.note ? ` · ${h.note}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
