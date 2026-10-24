import { useState } from 'react';
import { api, ApiError, assetUrl } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { Modal } from './ui/Modal';
import { ImageUpload } from './ui/ImageUpload';
import type { AdminVendor } from '../lib/types';

/** One photo in a shop's gallery (GET /api/admin/vendors/:id/gallery, SB1). */
interface GalleryPhoto {
  id: number;
  url: string;
  caption: string | null;
  sortOrder: number;
  status: 'visible' | 'hidden';
  hiddenReason: string | null;
  createdAt: string;
}

/** Branding fields on the vendor row (the admin list returns SELECT *). */
type BrandedVendor = AdminVendor & {
  description?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
};

/**
 * Vendors → Shop page: what customers see on this shop's page — its
 * description, logo, cover and photo gallery — with the admin's corrections:
 * fix the words, upload or remove the logo and cover, hide a photo (the shop
 * sees the reason) or show it again. The shop uploads its own pictures in the app.
 */
export function VendorShopPageModal({
  vendor,
  canEdit,
  onClose,
  onSaved,
}: {
  vendor: BrandedVendor;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(vendor.description ?? '');
  const [logo, setLogo] = useState(vendor.logo_url ?? null);
  const [cover, setCover] = useState(vendor.cover_image_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState<number | null>(null);
  const { data: gallery, loading, error: galleryError, reload } = useApiData<{ items: GalleryPhoto[]; max: number }>(
    `/api/admin/vendors/${vendor.id}/gallery`,
    [vendor.id],
  );

  const changed =
    description.trim() !== (vendor.description ?? '') || logo !== (vendor.logo_url ?? null) || cover !== (vendor.cover_image_url ?? null);

  async function save() {
    setError(null);
    if (description.trim().length > 1000) {
      setError('The description is at most 1000 characters.');
      return;
    }
    setSaving(true);
    try {
      // Only what changed; '' / null clears it on the server.
      const body: Record<string, string | null> = {};
      if (description.trim() !== (vendor.description ?? '')) body.description = description.trim();
      if (logo !== (vendor.logo_url ?? null)) body.logoUrl = logo;
      if (cover !== (vendor.cover_image_url ?? null)) body.coverImageUrl = cover;
      await api.patch(`/api/admin/vendors/${vendor.id}`, body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save the shop page.');
    } finally {
      setSaving(false);
    }
  }

  async function setPhotoStatus(photo: GalleryPhoto, status: 'visible' | 'hidden') {
    let reason: string | null = null;
    if (status === 'hidden') {
      reason = window.prompt('Why hide this photo? The shop sees this reason.', '');
      if (reason === null) return;
      if (!reason.trim()) {
        setError('Give a reason to hide the photo.');
        return;
      }
    }
    setError(null);
    setBusyPhoto(photo.id);
    try {
      await api.patch(`/api/admin/vendors/${vendor.id}/gallery/${photo.id}`, { status, reason });
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to change the photo.');
    } finally {
      setBusyPhoto(null);
    }
  }

  // An admin can upload a logo or cover for the shop as well as remove one;
  // uploads land under /uploads/vendors, the only place the server accepts.
  const picture = (label: string, value: string | null, set: (v: string | null) => void, wide: boolean) => (
    <div className="space-y-2">
      {canEdit ? (
        <ImageUpload label={label} area="vendors" value={value ?? ''} onChange={(v) => set(v.trim() || null)} small={!wide} />
      ) : (
        <div className="text-sm font-medium text-slate-700">{label}</div>
      )}
      {value ? (
        wide && (
          <img src={assetUrl(value)} alt={label} className="aspect-[16/9] w-full rounded-lg border border-slate-200 object-cover" />
        )
      ) : (
        <div className="text-xs text-slate-400">None set — the app shows the shop's initial{wide ? ' and no cover' : ''}.</div>
      )}
      {!canEdit && value && !wide && (
        <img src={assetUrl(value)} alt={label} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
      )}
    </div>
  );

  return (
    <Modal title={`Shop page — ${vendor.business_name}`} onClose={onClose} wide>
      <div className="space-y-5">
        <p className="text-xs text-slate-500">
          What customers see on this shop's page. The shop uploads its own pictures in the vendor app; here you can
          correct the words, upload or remove the logo and cover, and hide a photo.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            rows={4}
            maxLength={1000}
            placeholder="No description yet."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
          />
          <div className="text-right text-xs text-slate-400">{description.trim().length} / 1000</div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {picture('Logo', logo, setLogo, false)}
          {picture('Cover', cover, setCover, true)}
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <button onClick={save} disabled={!changed || saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save shop page'}
            </button>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Photo gallery</h3>
            {gallery && <span className="text-xs text-slate-400">{gallery.items.length} of {gallery.max} photos</span>}
          </div>
          {loading && <div className="text-sm text-slate-400">Loading…</div>}
          {galleryError && <div className="text-sm text-rose-600">{galleryError}</div>}
          {gallery && gallery.items.length === 0 && <div className="text-sm text-slate-400">The shop hasn't added photos yet.</div>}
          {gallery && gallery.items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.items.map((p) => (
                <div key={p.id} className={`rounded-lg border p-2 ${p.status === 'hidden' ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'}`}>
                  <img src={assetUrl(p.url)} alt={p.caption ?? 'Shop photo'} className="aspect-square w-full rounded-md object-cover" />
                  <div className="mt-1 truncate text-xs text-slate-600">{p.caption ?? 'No caption'}</div>
                  {p.status === 'hidden' && <div className="text-xs text-rose-700">Hidden: {p.hiddenReason}</div>}
                  {canEdit && (
                    <button
                      onClick={() => setPhotoStatus(p, p.status === 'hidden' ? 'visible' : 'hidden')}
                      disabled={busyPhoto === p.id}
                      className={`mt-1 rounded-md px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                        p.status === 'hidden' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p.status === 'hidden' ? 'Show again' : 'Hide'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
      </div>
    </Modal>
  );
}
