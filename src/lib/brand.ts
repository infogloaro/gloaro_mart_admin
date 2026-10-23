import { useEffect, useState } from 'react';
import { API_URL, assetUrl } from './api';

/** The brand set on the Settings page: shown in the sidebar, the login screen and the browser tab. */
export interface Brand {
  name: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const EMPTY: Brand = { name: null, logoUrl: null, faviconUrl: null };
const CHANGED = 'gloaro:brand-changed';

let current: Brand = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<(b: Brand) => void>();

// The public settings route needs no sign-in, so the login screen can use it too.
function load(): Promise<void> {
  inflight ??= fetch(`${API_URL}/api/settings`)
    .then((res) => (res.ok ? res.json() : null))
    .then((s: { platform_name?: string; logo_url?: string; favicon_url?: string } | null) => {
      if (!s) return;
      current = {
        name: s.platform_name?.trim() || null,
        logoUrl: assetUrl(s.logo_url) || null,
        faviconUrl: assetUrl(s.favicon_url) || null,
      };
      applyFavicon(current.faviconUrl);
      listeners.forEach((fn) => fn(current));
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const defaultFavicon = typeof document === 'undefined' ? null : document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href;

function applyFavicon(url: string | null) {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  const href = url || defaultFavicon;
  if (link && href) link.href = href;
}

/** Call after saving settings so every brand on screen picks up the change. */
export function notifyBrandChanged() {
  window.dispatchEvent(new Event(CHANGED));
}

if (typeof window !== 'undefined') window.addEventListener(CHANGED, () => void load());

export function useBrand(): Brand {
  const [brand, setBrand] = useState(current);
  useEffect(() => {
    listeners.add(setBrand);
    if (current === EMPTY) void load();
    return () => {
      listeners.delete(setBrand);
    };
  }, []);
  return brand;
}
