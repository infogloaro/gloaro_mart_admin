import { useState, type FormEvent } from 'react';
import { api, ApiError, isMissingEndpoint } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { useDebounced } from '../lib/useDebounced';
import { DataTable } from '../components/ui/DataTable';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatCard } from '../components/ui/StatCard';
import { PendingApiNotice } from '../components/ui/PendingApiNotice';
import type {
  AdminShipment,
  DeliveryProvider,
  DeliveryRouting,
  Paged,
  PartnerCandidate,
  ShipmentDetail,
  ShipmentStatus,
  ShipmentSummary,
} from '../lib/types';

const ENDPOINTS = [
  'GET    /api/admin/shipments',
  'GET    /api/admin/shipments/summary',
  'GET    /api/admin/shipments/:id',
  'POST   /api/admin/shipments/:id/events',
];

const FILTERS = ['all', 'in_transit', 'out_for_delivery', 'delivered', 'failed'] as const;
type Filter = (typeof FILTERS)[number];

/** DR3: who carries it — GoKart riders near the shop, Shiprocket beyond. */
const PARTNER_FILTERS = [
  { key: 'all', label: 'All partners' },
  { key: 'gokart', label: 'GoKart' },
  { key: 'shiprocket', label: 'Shiprocket' },
  { key: 'needs_booking', label: 'Needs booking' },
] as const;
type PartnerFilter = (typeof PARTNER_FILTERS)[number]['key'];

const PROVIDER_LABEL: Record<DeliveryProvider, string> = { gokart: 'GoKart', shiprocket: 'Shiprocket', manual: 'Manual' };
const PROVIDER_TONE: Record<DeliveryProvider, string> = {
  gokart: 'border-blue-200 bg-blue-50 text-blue-700',
  shiprocket: 'border-orange-200 bg-orange-50 text-orange-700',
  manual: 'border-slate-200 bg-slate-100 text-slate-600',
};

function ProviderBadge({ provider }: { provider: DeliveryProvider }) {
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-px text-[10px] font-bold whitespace-nowrap ${PROVIDER_TONE[provider]}`}
    >
      {PROVIDER_LABEL[provider]}
    </span>
  );
}

function km(value: number | null): string | null {
  return value == null ? null : `${value < 10 ? value.toFixed(1) : Math.round(value)} km`;
}

/** Every status a shipment can be moved to by hand, in the order it happens. */
const RECORDABLE: ShipmentStatus[] = [
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'cancelled',
];

const STATUS_TONE: Record<ShipmentStatus, string> = {
  created: 'border-slate-200 bg-slate-100 text-slate-600',
  picked_up: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  in_transit: 'border-state-processing/25 bg-state-processing/10 text-state-processing-ink',
  out_for_delivery: 'border-state-shipped/30 bg-state-shipped/12 text-state-shipped-ink',
  delivered: 'border-state-success/25 bg-state-success/10 text-state-success-ink',
  failed: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  returned: 'border-state-error/25 bg-state-error/10 text-state-error-ink',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
};

const OPEN_STATUSES: ShipmentStatus[] = ['created', 'picked_up', 'in_transit', 'out_for_delivery'];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

function label(status: string): string {
  return status.replace(/_/g, ' ');
}

function rupees(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function weight(grams: number | null): string | null {
  if (grams == null) return null;
  return grams >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : `${grams} g`;
}

/** Late is a derived state, not a stored one: past its estimate and still moving. */
function isLate(s: AdminShipment): boolean {
  if (!s.estimatedDeliveryAt || !OPEN_STATUSES.includes(s.status)) return false;
  return new Date(s.estimatedDeliveryAt).getTime() < Date.now();
}

function StatusPill({ status }: { status: ShipmentStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase ${STATUS_TONE[status]}`}
    >
      {label(status)}
    </span>
  );
}

export default function ShipmentsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [partner, setPartner] = useState<PartnerFilter>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);

  const [openId, setOpenId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = [
    filter === 'all' ? '' : `status=${filter}`,
    partner === 'all' ? '' : partner === 'needs_booking' ? 'booking=needs_booking' : `provider=${partner}`,
    `page=${page}`,
    debounced ? `q=${encodeURIComponent(debounced)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, reload } = useApiData<Paged<AdminShipment>>(`/api/admin/shipments?${query}`, [
    filter,
    partner,
    page,
    debounced,
  ]);
  const { data: summary, reload: reloadSummary } = useApiData<ShipmentSummary>('/api/admin/shipments/summary');

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Shipments</h1>
        <p className="text-sm text-slate-500">
          The physical movement of goods, tracked apart from the order. One order can ship in two parcels, and a failed
          delivery closes the shipment while the order stays open.
        </p>
      </div>

      <RoutingCard />

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {error &&
        (isMissingEndpoint(error) ? (
          <PendingApiNotice error={error} endpoints={ENDPOINTS} phase="Phase 8 shipments" />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </div>
        ))}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="On the road"
            value={String(summary.inTransit + summary.outForDelivery)}
            icon="truck"
            tone="processing"
            hint={`${summary.outForDelivery} out for delivery`}
          />
          <StatCard
            label="Running late"
            value={String(summary.late)}
            icon="clock"
            tone={summary.late > 0 ? 'critical' : 'neutral'}
            hint="Past the promised time"
          />
          <StatCard
            label="Failed delivery"
            value={String(summary.failed)}
            icon="alert"
            tone={summary.failed > 0 ? 'critical' : 'neutral'}
            hint="Needs a second attempt"
          />
          <StatCard
            label="Delivered"
            value={String(summary.delivered)}
            icon="package"
            tone="positive"
            hint={
              summary.avgDeliveryHours == null
                ? `of ${summary.total} shipments`
                : `avg ${summary.avgDeliveryHours.toFixed(1)} h door to door`
            }
          />
        </div>
      )}

      {summary && summary.unassigned > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Icon name="bike" className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{summary.unassigned}</span> shipment
            {summary.unassigned === 1 ? ' has' : 's have'} no delivery partner yet — nothing will move until one is
            assigned.
          </span>
        </div>
      )}

      {summary && summary.needsBooking > 0 && (
        <button
          type="button"
          onClick={() => {
            setPartner('needs_booking');
            setPage(1);
          }}
          className="flex w-full items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-left text-sm text-orange-800 hover:bg-orange-100"
        >
          <Icon name="package" className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{summary.needsBooking}</span> Shiprocket shipment
            {summary.needsBooking === 1 ? ' is' : 's are'} not booked yet. Book{summary.needsBooking === 1 ? ' it' : ' them'}{' '}
            in Shiprocket and enter the AWB here.
          </span>
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-200 ${
                filter === f ? 'bg-emerald text-white' : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
              }`}
            >
              {f === 'all' ? 'All' : label(f).replace(/^\w/, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
        <select
          aria-label="Delivery partner"
          value={partner}
          onChange={(e) => {
            setPartner(e.target.value as PartnerFilter);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600"
        >
          {PARTNER_FILTERS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
              {summary && p.key === 'gokart' ? ` (${summary.gokartOpen} open)` : ''}
              {summary && p.key === 'shiprocket' ? ` (${summary.shiprocketOpen} open)` : ''}
              {summary && p.key === 'needs_booking' ? ` (${summary.needsBooking})` : ''}
            </option>
          ))}
        </select>
        <div className="relative w-64">
          <Icon name="search" className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tracking number, order or customer…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-8 text-xs"
          />
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <DataTable
            rows={rows}
            keyFor={(s) => s.id}
            emptyMessage={debounced ? 'No shipment matches that search.' : 'No shipments recorded yet.'}
            columns={[
              {
                header: 'Tracking',
                render: (s) => (
                  <span>
                    <span className="block font-mono text-xs font-semibold text-ink">{s.trackingNumber}</span>
                    <span className="block text-[11px] text-slate-400">{s.orderReference}</span>
                  </span>
                ),
              },
              {
                header: 'Status',
                render: (s) => (
                  <span className="flex items-center gap-1.5">
                    <StatusPill status={s.status} />
                    {isLate(s) && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-px text-[10px] font-bold text-rose-600">
                        <Icon name="clock" className="h-2.5 w-2.5" />
                        LATE
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'Vendor',
                render: (s) => <span className="font-medium text-ink">{s.vendorName}</span>,
              },
              {
                header: 'To',
                render: (s) => (
                  <span>
                    <span className="block text-ink">{s.customerName}</span>
                    {s.deliveryCity && <span className="block text-[11px] text-slate-400">{s.deliveryCity}</span>}
                  </span>
                ),
              },
              {
                header: 'Partner',
                render: (s) => (
                  <span>
                    {s.provider && (
                      <span className="mb-0.5 flex items-center gap-1.5">
                        <ProviderBadge provider={s.provider} />
                        {km(s.distanceKm) && <span className="text-[11px] text-slate-400">{km(s.distanceKm)}</span>}
                      </span>
                    )}
                    {s.provider === 'shiprocket' ? (
                      s.externalTrackingId ? (
                        <span className="block font-mono text-[11px] text-slate-500">AWB {s.externalTrackingId}</span>
                      ) : (
                        <span className="text-xs font-semibold text-orange-600">
                          {s.bookingStatus === 'failed' ? 'Booking failed' : 'Needs booking'}
                        </span>
                      )
                    ) : s.partnerName ? (
                      <>
                        <span className="block text-ink">{s.partnerName}</span>
                        {s.externalTrackingId && (
                          <span className="block font-mono text-[11px] text-slate-400">{s.externalTrackingId}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600">
                        {s.provider === 'gokart' ? 'No rider yet' : 'Unassigned'}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: 'COD',
                className: 'text-right tabular-nums',
                render: (s) =>
                  s.codAmountCents == null ? (
                    <span className="text-xs text-slate-400">Prepaid</span>
                  ) : (
                    <span className="font-semibold text-ink">{rupees(s.codAmountCents)}</span>
                  ),
              },
              {
                header: 'Due',
                className: 'whitespace-nowrap',
                render: (s) => (
                  <span className={isLate(s) ? 'font-semibold text-state-error' : ''}>
                    {formatWhen(s.deliveredAt ?? s.estimatedDeliveryAt)}
                    {s.deliveredAt && <span className="block text-[11px] text-slate-400">delivered</span>}
                  </span>
                ),
              },
              {
                header: '',
                className: 'text-right',
                render: (s) => (
                  <button
                    onClick={() => {
                      setOpenId(s.id);
                      setActionError(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald hover:text-emerald-deep"
                  >
                    Track
                  </button>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
        </div>
      )}

      {openId != null && (
        <ShipmentDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onError={setActionError}
          onChanged={() => {
            reload();
            reloadSummary();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function ShipmentDrawer({
  id,
  onClose,
  onError,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useApiData<ShipmentDetail>(`/api/admin/shipments/${id}`, [id]);
  const { data: candidates, reload: reloadCandidates } = useApiData<PartnerCandidate[]>(
    `/api/admin/shipments/${id}/partners`,
    [id],
  );

  async function assign(partnerId: number | null) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/shipments/${id}/assign`, { partnerId });
      reload();
      reloadCandidates();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not assign the partner.');
    } finally {
      setBusy(false);
    }
  }

  const [status, setStatus] = useState<ShipmentStatus | ''>('');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [awb, setAwb] = useState('');
  const [awbUrl, setAwbUrl] = useState('');

  async function switchProvider(provider: DeliveryProvider) {
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/shipments/${id}/provider`, { provider });
      reload();
      reloadCandidates();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not change the partner.');
    } finally {
      setBusy(false);
    }
  }

  /** Booked by hand in Shiprocket's panel: the AWB marks it booked. */
  async function saveAwb(e: FormEvent) {
    e.preventDefault();
    if (!awb.trim()) return;
    onError(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/shipments/${id}`, {
        externalTrackingId: awb.trim(),
        trackingUrl: awbUrl.trim() || `https://shiprocket.co/tracking/${encodeURIComponent(awb.trim())}`,
      });
      setAwb('');
      setAwbUrl('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the AWB.');
    } finally {
      setBusy(false);
    }
  }

  async function recordEvent(e: FormEvent) {
    e.preventDefault();
    if (!status) return;
    // A failure with no stated cause is useless to whoever handles the retry.
    if (status === 'failed' && !note.trim()) {
      onError('Say why the delivery failed — the retry depends on it.');
      return;
    }
    onError(null);
    setBusy(true);
    try {
      await api.post(`/api/admin/shipments/${id}/events`, {
        status,
        description: note.trim() || null,
        location: location.trim() || null,
      });
      setStatus('');
      setNote('');
      setLocation('');
      reload();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not record the event.');
    } finally {
      setBusy(false);
    }
  }

  const closed = data ? !OPEN_STATUSES.includes(data.status) : false;

  return (
    <Modal title={data ? `Shipment ${data.trackingNumber}` : 'Shipment'} onClose={onClose} wide>
      {loading && <div className="py-8 text-center text-sm font-medium text-slate-400">Loading…</div>}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={data.status} />
            {isLate(data) && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">LATE</span>
            )}
            {data.attemptCount > 1 && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                ATTEMPT {data.attemptCount}
              </span>
            )}
            {data.trackingUrl && (
              <a
                href={data.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-deep hover:underline"
              >
                Courier tracking
                <Icon name="chevron" className="h-3 w-3" strokeWidth={2.2} />
              </a>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:grid-cols-3">
            <Field label="Order" value={data.orderReference} />
            <Field label="Vendor" value={data.vendorName} />
            <Field
              label="Partner"
              value={
                data.provider === 'shiprocket'
                  ? data.externalTrackingId
                    ? `Shiprocket · AWB ${data.externalTrackingId}`
                    : 'Shiprocket · not booked'
                  : [data.provider ? PROVIDER_LABEL[data.provider] : null, data.partnerName ?? 'Unassigned']
                      .filter(Boolean)
                      .join(' · ')
              }
            />
            <Field
              label="Distance"
              value={[km(data.distanceKm), data.deliveryMode].filter(Boolean).join(' · ') || '—'}
            />
            <Field label="Customer" value={data.customerName} />
            <Field label="Phone" value={data.customerPhone ?? '—'} />
            <Field label="City" value={data.deliveryCity ?? '—'} />
            <Field
              label="Parcels"
              value={[`${data.packageCount}`, weight(data.weightGrams)].filter(Boolean).join(' · ')}
            />
            <Field label="COD" value={data.codAmountCents == null ? 'Prepaid' : rupees(data.codAmountCents)} />
            <Field label="Dispatched" value={formatWhen(data.dispatchedAt)} />
          </dl>

          {data.failureReason && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{data.failureReason}</p>
          )}

          <div>
            <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Delivery trail</h3>
            {data.events.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Nothing scanned yet.</p>
            ) : (
              // Newest first, and the rail is drawn per row rather than as one
              // absolute line so it cannot overshoot the last event.
              <ol className="mt-2">
                {data.events.map((ev, i) => (
                  <li key={ev.id} className="flex gap-3">
                    <div className="flex w-4 shrink-0 flex-col items-center">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-emerald' : 'bg-slate-300'}`}
                      />
                      {i < data.events.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className="min-w-0 flex-1 pb-3.5">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-ink capitalize">{label(ev.status)}</span>
                        <span className="text-[11px] text-slate-400">{formatWhen(ev.occurredAt)}</span>
                      </div>
                      {ev.description && <p className="text-xs text-slate-500">{ev.description}</p>}
                      <p className="text-[11px] text-slate-400">
                        {[ev.location, ev.actorName ?? ev.actorRole].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {!closed && (
            <div className="rounded-xl border border-slate-200 p-4">
              <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Carried by</span>
              <div className="flex flex-wrap gap-1.5">
                {(['gokart', 'shiprocket', 'manual'] as DeliveryProvider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={busy || data.provider === p || data.bookingStatus === 'booked'}
                    onClick={() => switchProvider(p)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      data.provider === p
                        ? PROVIDER_TONE[p]
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 disabled:opacity-50'
                    }`}
                  >
                    {PROVIDER_LABEL[p]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {data.bookingStatus === 'booked'
                  ? 'Booked with Shiprocket — cancel it there before moving it.'
                  : 'Checkout picked this by distance from the shop. Moving it to Shiprocket takes it off the rider.'}
              </p>
            </div>
          )}

          {!closed && data.provider === 'shiprocket' && (
            <form onSubmit={saveAwb} className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
              <h3 className="text-[11px] font-bold tracking-wide text-orange-700 uppercase">
                Shiprocket booking ·{' '}
                {data.bookingStatus === 'booked' ? 'booked' : data.bookingStatus === 'failed' ? 'failed' : 'not booked'}
              </h3>
              {data.bookingError && <p className="text-xs text-rose-700">{data.bookingError}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={awb}
                  onChange={(e) => setAwb(e.target.value)}
                  placeholder={data.externalTrackingId ? `AWB ${data.externalTrackingId}` : 'AWB number'}
                  className={inputClass}
                />
                <input
                  value={awbUrl}
                  onChange={(e) => setAwbUrl(e.target.value)}
                  placeholder="Tracking link (optional)"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">
                  Book it in the Shiprocket panel, then enter the AWB. Automatic booking comes next.
                </p>
                <button
                  type="submit"
                  disabled={busy || !awb.trim()}
                  className="shrink-0 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-45"
                >
                  Save AWB
                </button>
              </div>
            </form>
          )}

          {!closed && data.provider !== 'shiprocket' && (
            <div className="rounded-xl border border-slate-200 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  {data.provider === 'gokart' ? 'GoKart rider' : 'Delivery partner'}
                </span>
                <select
                  value={data.partnerId ?? ''}
                  disabled={busy}
                  onChange={(e) => assign(e.target.value === '' ? null : Number(e.target.value))}
                  className={inputClass}
                >
                  <option value="">
                    {data.partnerId == null && data.partnerName ? `${data.partnerName} (not a registered partner)` : 'Unassigned'}
                  </option>
                  {(candidates ?? []).map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.available && p.id !== data.partnerId}>
                      {p.name} · {p.activeAssignments}/{p.dailyCapacity}
                      {p.coversArea ? ' · covers this area' : ''}
                      {!p.available && p.id !== data.partnerId ? ` — ${p.reason}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Only active partners on shift, with paperwork in date and capacity left, can be picked.
              </p>
            </div>
          )}

          {closed ? (
            <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-400">
              This shipment is closed. A further attempt is a new shipment against the same order.
            </p>
          ) : (
            <form onSubmit={recordEvent} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Record an event</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {RECORDABLE.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">Location</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Hub or area"
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                  Note{status === 'failed' && <span className="text-rose-600"> — required</span>}
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What happened"
                  className={inputClass}
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy || !status}
                  className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-45"
                >
                  {busy ? 'Recording…' : 'Add to trail'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                The trail is append-only. A wrong entry is corrected by adding the right one, not by deleting it.
              </p>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------------- routing */

/**
 * DR1: who carries an order, by its distance from the shop. Up to the radius
 * GoKart (our own riders), beyond it Shiprocket. Applies from the next
 * checkout; orders already placed keep their partner.
 */
function RoutingCard() {
  const { data: loaded, error } = useApiData<DeliveryRouting>('/api/admin/shipments/routing');
  // What the last save answered, so the card shows it without another round trip.
  const [saved, setSaved] = useState<DeliveryRouting | null>(null);
  const [editing, setEditing] = useState<DeliveryRouting | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const data = saved ?? loaded;
  if (error || !data) return null;

  async function save() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      setSaved(
        await api.patch<DeliveryRouting>('/api/admin/shipments/routing', {
          enabled: editing.enabled,
          localRadiusKm: editing.localRadiusKm,
          localPartner: editing.localPartner,
          outstationPartner: editing.outstationPartner,
        }),
      );
      setEditing(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const local = data.localPartner === 'gokart' ? 'GoKart riders' : 'manual delivery';
  const far = data.outstationPartner === 'shiprocket' ? 'Shiprocket' : 'manual courier';

  return (
    <>
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <Icon name="route" className="h-5 w-5 shrink-0 text-blue-700" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-ink">Delivery routing {data.enabled ? '' : '· off'}</div>
          <div className="text-xs text-slate-500">
            {data.enabled ? (
              <>
                Up to <b>{data.localRadiusKm} km</b> from the shop: {local}. Beyond: {far}.
              </>
            ) : (
              'Each shop’s own service area decides local or courier, and no partner is picked.'
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(data);
            setSaveError(null);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700"
        >
          Edit
        </button>
      </div>

      {editing && (
        <Modal title="Delivery routing" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-semibold text-ink">Route by distance</span>
                <span className="block text-xs text-slate-500">
                  Off: shops’ own areas decide, as before, and shipments get no partner.
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-blue-700"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Local delivery up to</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0.1}
                  max={500}
                  step={0.5}
                  value={editing.localRadiusKm}
                  onChange={(e) => setEditing({ ...editing, localRadiusKm: Number(e.target.value) })}
                  className={inputClass}
                />
                <span className="text-sm text-slate-500">km</span>
              </div>
              <span className="text-xs text-slate-500">Straight-line distance from the shop to the customer.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-ink">Within it</span>
                <select
                  value={editing.localPartner}
                  onChange={(e) => setEditing({ ...editing, localPartner: e.target.value as DeliveryRouting['localPartner'] })}
                  className={`${inputClass} mt-1`}
                >
                  <option value="gokart">GoKart (our riders)</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink">Beyond it</span>
                <select
                  value={editing.outstationPartner}
                  onChange={(e) =>
                    setEditing({ ...editing, outstationPartner: e.target.value as DeliveryRouting['outstationPartner'] })
                  }
                  className={`${inputClass} mt-1`}
                >
                  <option value="shiprocket">Shiprocket</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Applies to the next order placed. Charges stay each shop’s own: its delivery charge within the distance, its
              outstation charge beyond. A shop that doesn’t ship outside its area still isn’t offered beyond it.
            </p>
            {saveError && <p className="text-sm font-medium text-rose-700">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Field({ label: name, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{name}</dt>
      <dd className="truncate font-medium text-ink">{value}</dd>
    </div>
  );
}
