import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import type { MenuItem, MenuLinkType } from '../lib/types';

const LINK_TYPES: MenuLinkType[] = ['section', 'category', 'vendor', 'url'];

/** Sections the app knows how to open. Anything else renders but does nothing. */
const KNOWN_SECTIONS = ['shop', 'b2b', 'near_me', 'orders', 'wallet', 'referral', 'support', 'profile'];

export default function MenuPage() {
  const { data: items, loading, error, reload } = useApiData<MenuItem[]>('/api/menu/admin');
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function toggleActive(item: MenuItem) {
    setActionError(null);
    setBusyId(item.id);
    try {
      await api.patch(`/api/menu/admin/${item.id}`, { isActive: !item.is_active });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update menu item.');
    } finally {
      setBusyId(null);
    }
  }

  async function move(item: MenuItem, direction: -1 | 1) {
    if (!items) return;
    const ordered = [...items];
    const index = ordered.findIndex((i) => i.id === item.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

    setActionError(null);
    setBusyId(item.id);
    try {
      await api.put('/api/menu/admin/reorder', { order: ordered.map((i) => i.id) });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to reorder menu.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: MenuItem) {
    if (!confirm(`Remove "${item.label}" from the app menu?`)) return;
    setActionError(null);
    setBusyId(item.id);
    try {
      await api.delete(`/api/menu/admin/${item.id}`);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete menu item.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">App Menu</h1>
          <p className="text-sm text-slate-500">
            Controls the side menu in the customer app. Changes appear the next time a customer opens the drawer — no
            app update needed.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="shrink-0 btn-primary px-4 py-2 text-sm"
        >
          Add item
        </button>
      </div>

      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}

      {!loading && !error && items && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'Order',
                render: (item) => (
                  <div className="flex items-center gap-1">
                    <button
                      disabled={busyId === item.id}
                      onClick={() => move(item, -1)}
                      className="rounded border border-slate-200 px-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      disabled={busyId === item.id}
                      onClick={() => move(item, 1)}
                      className="rounded border border-slate-200 px-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                ),
              },
              { header: 'Label', render: (item) => <span className="font-medium">{item.label}</span> },
              {
                header: 'Opens',
                render: (item) => (
                  <div>
                    <div className="text-slate-700">
                      {item.link_type}
                      {item.link_value ? ` · ${item.link_value}` : ''}
                    </div>
                    {item.link_type === 'section' && item.link_value && !KNOWN_SECTIONS.includes(item.link_value) && (
                      <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        App has no such section
                      </span>
                    )}
                    {(item.link_type === 'vendor' || item.link_type === 'url') && (
                      <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        Not handled by the app yet
                      </span>
                    )}
                  </div>
                ),
              },
              { header: 'Icon', render: (item) => item.icon_key || '—' },
              {
                header: 'Visible',
                render: (item) => (
                  <button
                    disabled={busyId === item.id}
                    onClick={() => toggleActive(item)}
                    className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                      item.is_active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {item.is_active ? 'Visible' : 'Hidden'}
                  </button>
                ),
              },
              {
                header: 'Actions',
                render: (item) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(item)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      disabled={busyId === item.id}
                      onClick={() => remove(item)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={items}
            keyFor={(item) => item.id}
            emptyMessage="No menu items yet. The app drawer will be empty until you add some."
          />
        </div>
      )}

      {editing && (
        <MenuItemModal
          item={editing === 'new' ? null : editing}
          nextOrder={items?.length ?? 0}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function MenuItemModal({
  item,
  nextOrder,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(item?.label ?? '');
  const [iconKey, setIconKey] = useState(item?.icon_key ?? '');
  const [linkType, setLinkType] = useState<MenuLinkType>(item?.link_type ?? 'section');
  const [linkValue, setLinkValue] = useState(item?.link_value ?? '');
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    if (linkType !== 'section' && !linkValue.trim()) {
      setError(`A ${linkType} item needs a value, or tapping it does nothing.`);
      return;
    }

    setSubmitting(true);
    const body = {
      label: label.trim(),
      iconKey: iconKey.trim() || null,
      linkType,
      linkValue: linkValue.trim() || null,
      isActive,
      ...(item ? {} : { sortOrder: nextOrder }),
    };
    try {
      if (item) {
        await api.patch(`/api/menu/admin/${item.id}`, body);
      } else {
        await api.post('/api/menu/admin', body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save menu item.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={item ? `Edit "${item.label}"` : 'Add menu item'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Near Me"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Opens</label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as MenuLinkType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
            >
              {LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {linkType === 'section' ? 'Section' : linkType === 'category' ? 'Category slug' : 'Value'}
            </label>
            {linkType === 'section' ? (
              <select
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              >
                <option value="">—</option>
                {KNOWN_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder={linkType === 'category' ? 'grocery' : 'https://…'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Icon key</label>
          <input
            value={iconKey}
            onChange={(e) => setIconKey(e.target.value)}
            placeholder="near_me"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Known keys: shop, b2b, near_me, orders, wallet, referral, support, profile, grocery, fashion, gadgets,
            home, beauty. Anything else falls back to a chevron.
          </p>
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className="text-slate-700">Visible in the app</span>
        </label>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
