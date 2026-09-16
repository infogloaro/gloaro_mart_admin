import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Icon, type IconName } from '../components/ui/Icon';
import type { AdminNotification, NotificationType } from '../lib/types';

const TYPE_ICON: Record<NotificationType, IconName> = {
  order: 'cart',
  payment: 'card',
  vendor: 'store',
  system: 'settings',
  promo: 'megaphone',
};

const TYPE_TONE: Record<NotificationType, string> = {
  order: 'bg-navy-2/10 text-navy-2',
  payment: 'bg-gold-soft text-gold-deep',
  vendor: 'bg-state-processing/12 text-state-processing-ink',
  system: 'bg-slate-100 text-slate-500',
  promo: 'bg-mint-mist text-emerald-deep',
};

function formatWhen(value: string): string {
  const then = new Date(value);
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

interface NotificationsResponse {
  items: AdminNotification[];
  unreadCount: number;
}

/**
 * Your own inbox — order updates, payment events, vendor activity the
 * platform sent you. This is not the campaign composer the roadmap describes
 * (push/email/SMS to customers, targeted and scheduled): the backend has no
 * broadcast, targeting or scheduling model yet, only a per-account inbox.
 * Building that composer needs a campaigns table and a delivery integration
 * per channel — a separate piece of work from this page.
 */
export default function NotificationsPage() {
  const { data, loading, error, reload } = useApiData<NotificationsResponse>('/api/notifications');
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = data?.items ?? [];

  async function markRead(n: AdminNotification) {
    if (n.read_at) return;
    setActionError(null);
    try {
      await api.patch(`/api/notifications/${n.id}/read`);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not mark this as read.');
    }
  }

  async function markAll() {
    setActionError(null);
    setMarkingAll(true);
    try {
      await api.post('/api/notifications/read-all');
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not mark everything as read.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Notifications</h1>
          <p className="text-sm text-slate-500">
            Order, payment and vendor activity sent to your account.
            {data && data.unreadCount > 0 && (
              <span className="ml-1.5 font-semibold text-ink">{data.unreadCount} unread.</span>
            )}
          </p>
        </div>
        {data && data.unreadCount > 0 && (
          <button
            onClick={markAll}
            disabled={markingAll}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-emerald hover:bg-mint-mist hover:text-emerald-deep disabled:opacity-50"
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
        <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span>
          This is your own inbox. Composing and scheduling notifications <span className="font-semibold">to</span>{' '}
          customers or vendors — push, email, SMS — is a roadmap item the backend does not support yet.
        </span>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-mist text-emerald">
            <Icon name="bell" className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-slate-500">Nothing here yet.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50/80 ${
                n.read_at ? '' : 'bg-mint-mist/30'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TYPE_TONE[n.type] ?? TYPE_TONE.system}`}>
                <Icon name={TYPE_ICON[n.type] ?? 'bell'} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`truncate text-sm ${n.read_at ? 'font-medium text-slate-600' : 'font-bold text-ink'}`}>
                    {n.title}
                  </span>
                  {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>
              </span>
              <span className="shrink-0 text-[11px] text-slate-400 whitespace-nowrap">{formatWhen(n.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
