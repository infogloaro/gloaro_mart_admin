import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { AdminOrderListRow, Paged, VendorWallet } from './types';

/** The order lifecycle as the backend stores it. */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'packed',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface DashboardExtras {
  /** Catalogue size — the list endpoint's `total`, not a page of rows. */
  productTotal: number | null;
  /** Sum of every vendor wallet balance: what the platform still owes out. */
  pendingPayoutCents: number | null;
  payoutVendorCount: number | null;
  ordersByStatus: Record<OrderStatus, number> | null;
  recentOrders: AdminOrderListRow[] | null;
}

const EMPTY: DashboardExtras = {
  productTotal: null,
  pendingPayoutCents: null,
  payoutVendorCount: null,
  ordersByStatus: null,
  recentOrders: null,
};

/**
 * Everything the dashboard needs beyond `/reports/summary`, assembled from the
 * existing admin list endpoints — a count is just a `pageSize=1` fetch read for
 * its `total`.
 *
 * Each piece settles on its own: one failing endpoint blanks its own card
 * rather than taking the whole dashboard down with it.
 */
export function useDashboardExtras() {
  const [data, setData] = useState<DashboardExtras>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const [products, wallets, recent, ...statuses] = await Promise.allSettled([
      api.get<Paged<unknown>>('/api/admin/products?page=1&pageSize=1'),
      api.get<VendorWallet[]>('/api/admin/wallets'),
      api.get<Paged<AdminOrderListRow>>('/api/admin/orders?page=1&pageSize=6'),
      ...ORDER_STATUSES.map((s) => api.get<Paged<unknown>>(`/api/admin/orders?status=${s}&page=1&pageSize=1`)),
    ]);

    const walletRows = wallets.status === 'fulfilled' ? wallets.value : null;

    // Partial status data would draw a donut that silently misstates the split,
    // so the chart is only fed once every slice has landed.
    const statusTotals = statuses.every((s) => s.status === 'fulfilled')
      ? (Object.fromEntries(
          ORDER_STATUSES.map((s, i) => [
            s,
            (statuses[i] as PromiseFulfilledResult<Paged<unknown>>).value.total,
          ])
        ) as Record<OrderStatus, number>)
      : null;

    setData({
      productTotal: products.status === 'fulfilled' ? products.value.total : null,
      pendingPayoutCents: walletRows ? walletRows.reduce((sum, w) => sum + (w.balance_cents ?? 0), 0) : null,
      payoutVendorCount: walletRows ? walletRows.filter((w) => (w.balance_cents ?? 0) > 0).length : null,
      ordersByStatus: statusTotals,
      recentOrders: recent.status === 'fulfilled' ? recent.value.items : null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { extras: data, loading, reload: load };
}
