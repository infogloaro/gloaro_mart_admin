import type { AdCampaignStatus, AdLevelKey, AdModel, AdRegionLevel } from './types';

/** Shared by the Ad Promotions pages. */

export const LEVEL_KEYS: AdLevelKey[] = ['local', 'city', 'district', 'state', 'country', 'international'];

export const LEVEL_LABEL: Record<AdLevelKey, string> = {
  local: 'Local area', city: 'City', district: 'District', state: 'State', country: 'Country', international: 'International',
};

/** Which regions each reach level is aimed at. */
export const REGION_LEVEL: Record<AdLevelKey, AdRegionLevel> = {
  local: 'locality', city: 'city', district: 'district', state: 'state', country: 'country', international: 'country',
};

export const MODEL_LABEL: Record<AdModel, string> = {
  fixed: 'Fixed fee', commission: 'Commission on orders', fixed_commission: 'Fixed fee + commission', package: 'Package',
};

export const STATUS_LABEL: Record<AdCampaignStatus, string> = {
  draft: 'Draft',
  pending_payment: 'Waiting for payment',
  pending_approval: 'Needs approval',
  scheduled: 'Approved · scheduled',
  live: 'Live',
  paused: 'Paused',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const STATUS_TONE: Record<AdCampaignStatus, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  pending_payment: 'border-amber-200 bg-amber-50 text-amber-700',
  pending_approval: 'border-state-pending/25 bg-state-pending/10 text-state-pending-ink',
  scheduled: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  live: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-slate-200 bg-slate-100 text-slate-500',
  rejected: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  cancelled: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
};

export function rupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function hoursLabel(h: number): string {
  if (h % 720 === 0) return `${h / 720} month${h === 720 ? '' : 's'} (${h} h)`;
  if (h % 168 === 0) return `${h / 168} week${h === 168 ? '' : 's'}`;
  if (h % 24 === 0) return `${h / 24} day${h === 24 ? '' : 's'}`;
  return `${h} hour${h === 1 ? '' : 's'}`;
}

/** A datetime-local value (the admin's local time) as ISO. */
export const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

/** ISO as a datetime-local value. */
export function toLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** A fresh key per attempt, so a retried click never charges twice. */
export const idempotencyKey = () => `adm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
