import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import type { Banner } from '../lib/types';

const RECOMMENDED_WIDTH = 1200;
const RECOMMENDED_HEIGHT = 480;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function readImage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not read image dimensions.'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function BannersPage() {
  const { data: banners, loading, error, reload } = useApiData<Banner[]>('/api/admin/banners');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFormError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 2MB.`);
      return;
    }
    try {
      const { dataUrl, width, height } = await readImage(file);
      setImageDataUrl(dataUrl);
      setImageDims({ width, height });
    } catch {
      setFormError('Could not read that image. Try a different file.');
    }
  }

  function resetForm() {
    setTitle('');
    setSubtitle('');
    setLinkUrl('');
    setImageDataUrl(null);
    setImageDims(null);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!imageDataUrl) {
      setFormError('Choose a banner image to upload.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/admin/banners', {
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        linkUrl: linkUrl.trim() || null,
        imageData: imageDataUrl,
        sortOrder: banners?.length ?? 0,
      });
      resetForm();
      setShowForm(false);
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to upload banner.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(banner: Banner) {
    setActionError(null);
    try {
      await api.patch(`/api/admin/banners/${banner.id}`, { isActive: !banner.is_active });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update banner.');
    }
  }

  async function deleteBanner(banner: Banner) {
    setActionError(null);
    try {
      await api.delete(`/api/admin/banners/${banner.id}`);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete banner.');
    }
  }

  const dimsMismatch =
    imageDims &&
    (imageDims.width !== RECOMMENDED_WIDTH || imageDims.height !== RECOMMENDED_HEIGHT);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Home Banners</h1>
        <button
          onClick={() => {
            setShowForm((s) => !s);
            if (showForm) resetForm();
          }}
          className="btn-primary px-4 py-2 text-sm"
        >
          {showForm ? 'Cancel' : '+ Upload Banner'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 card p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Banner Image</label>
            <p className="mb-2 text-xs text-slate-500">
              Recommended size: <span className="font-semibold">{RECOMMENDED_WIDTH} × {RECOMMENDED_HEIGHT}px</span>{' '}
              ({(RECOMMENDED_WIDTH / RECOMMENDED_HEIGHT).toFixed(2)}:1 ratio) · JPG or PNG · Max 2MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {imageDims && (
              <p className={`mt-2 text-xs font-medium ${dimsMismatch ? 'text-amber-600' : 'text-emerald-600'}`}>
                Uploaded image is {imageDims.width} × {imageDims.height}px
                {dimsMismatch ? ' — different from the recommended size, it will be cropped/stretched to fit.' : ' — matches the recommended size.'}
              </p>
            )}
            {imageDataUrl && (
              <img
                src={imageDataUrl}
                alt="Banner preview"
                className="mt-3 h-32 w-full max-w-md rounded-lg border border-slate-200 object-cover"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Big Savings Every Day"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Subtitle (optional)</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Shop top picks across every category"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Link URL (optional)</label>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{formError}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Uploading…' : 'Upload Banner'}
          </button>
        </form>
      )}

      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && banners && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {banners.length === 0 && <p className="text-sm text-slate-500">No banners uploaded yet.</p>}
          {banners.map((b) => (
            <div key={b.id} className="overflow-hidden card">
              <img src={b.image_data} alt={b.title ?? 'Banner'} className="h-32 w-full object-cover" />
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    {b.title && <div className="text-sm font-bold text-brand-navy">{b.title}</div>}
                    {b.subtitle && <div className="text-xs text-slate-500">{b.subtitle}</div>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => toggleActive(b)}
                    className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    {b.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteBanner(b)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
