import { useEffect, useRef, useState } from 'react';
import { assetUrl, uploadImage, type UploadArea } from '../../lib/api';
import { Icon } from './Icon';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

/**
 * An image field: upload a file to the server's uploads folder, or paste a
 * link. `value` is what gets saved — a /uploads/... path after an upload, or
 * the pasted URL — so existing rows that hold links keep working.
 */
export function ImageUpload({
  label,
  area,
  value,
  onChange,
  placeholder = 'https://…',
  small = false,
}: {
  label: string;
  area: UploadArea;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  small?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [value]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(area, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const box = small ? 'h-12 w-12' : 'h-16 w-16';
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-start gap-3">
        <div
          className={`${box} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white`}
        >
          {value && !broken ? (
            <img src={assetUrl(value)} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
          ) : (
            <Icon name="image" className="h-4 w-4 text-slate-300" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="shrink-0 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPick}
              className="hidden"
            />
          </div>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`or paste a link: ${placeholder}`}
            className={inputClass}
          />
          <p className={`text-xs ${error || broken ? 'text-rose-600' : 'text-slate-400'}`}>
            {error ?? (broken ? 'That image did not load' : 'JPG, PNG or WebP, up to 5 MB')}
          </p>
        </div>
      </div>
    </div>
  );
}
