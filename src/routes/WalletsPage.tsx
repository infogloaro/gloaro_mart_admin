import { useState } from 'react';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';
import type { VendorWallet, WalletTransaction } from '../lib/types';

function money(cents: number) {
  return `₹${(cents / 100).toFixed(2)}`;
}

export default function WalletsPage() {
  const { data: wallets, loading, error } = useApiData<VendorWallet[]>('/api/admin/wallets');
  const [viewing, setViewing] = useState<VendorWallet | null>(null);

  const totalHeld = (wallets ?? []).reduce((sum, w) => sum + Number(w.balance_cents), 0);
  const withBalance = (wallets ?? []).filter((w) => Number(w.balance_cents) > 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Vendor Wallets</h1>
        <p className="text-sm text-slate-500">
          Balances accrue when an order is marked delivered. Payouts are not modelled yet, so these are read-only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total held" value={money(totalHeld)} icon="wallet" tone="gold" />
        <StatCard label="Vendors with a balance" value={`${withBalance}`} />
        <StatCard label="Vendors total" value={`${wallets?.length ?? 0}`} />
      </div>

      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && wallets && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Vendor', render: (w) => <span className="font-medium">{w.business_name}</span> },
              {
                header: 'Owner',
                render: (w) => (
                  <div>
                    <div>{w.owner_name || '—'}</div>
                    <div className="text-xs text-slate-500">{w.owner_email}</div>
                  </div>
                ),
              },
              {
                header: 'Balance',
                render: (w) => (
                  <span className="font-semibold text-gold-ink tabular-nums">{money(Number(w.balance_cents))}</span>
                ),
              },
              {
                header: 'Last movement',
                render: (w) => (w.updated_at ? new Date(w.updated_at).toLocaleDateString() : '—'),
              },
              {
                header: 'Actions',
                render: (w) => (
                  <button
                    onClick={() => setViewing(w)}
                    className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Transactions
                  </button>
                ),
              },
            ]}
            rows={wallets}
            keyFor={(w) => w.vendor_id}
            emptyMessage="No vendors yet."
          />
        </div>
      )}

      {viewing && <TransactionsModal wallet={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function TransactionsModal({ wallet, onClose }: { wallet: VendorWallet; onClose: () => void }) {
  const { data: transactions, loading, error } = useApiData<WalletTransaction[]>(
    `/api/admin/wallets/${wallet.vendor_id}/transactions`,
    [wallet.vendor_id]
  );

  return (
    <Modal title={`${wallet.business_name} — Wallet`} onClose={onClose} wide>
      <div className="mb-3 rounded-lg border border-gold-soft/60 bg-gold-mist px-4 py-3">
        <div className="text-xs font-medium text-gold-ink">Current balance</div>
        <div className="text-2xl font-bold text-gold-ink tabular-nums">{money(Number(wallet.balance_cents))}</div>
      </div>
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && transactions && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <DataTable
            columns={[
              { header: 'Date', render: (t) => new Date(t.created_at).toLocaleString() },
              { header: 'Description', render: (t) => t.description ?? '—' },
              { header: 'Order', render: (t) => (t.order_id ? `#${t.order_id}` : '—') },
              {
                header: 'Amount',
                render: (t) => <span className="font-medium text-emerald-700">+{money(t.amount_cents)}</span>,
              },
              { header: 'Balance after', render: (t) => money(t.balance_after_cents) },
            ]}
            rows={transactions}
            keyFor={(t) => t.id}
            emptyMessage="No transactions yet — this vendor has no delivered orders."
          />
        </div>
      )}
    </Modal>
  );
}
