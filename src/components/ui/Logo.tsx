import { useState } from 'react';
import markUrl from '../../assets/gloaro-mark.png';
import { useBrand } from '../../lib/brand';

interface LogoProps {
  className?: string;
}

/**
 * The logo uploaded on the Settings page, or the Gloaro brand mark (served
 * from src/assets so Vite fingerprints it) when none is set or it fails to load.
 *
 * The artwork is navy and gold, so it needs a light tile behind it wherever it
 * sits on the dark shell — see the sidebar and login headers.
 */
export function Logo({ className = 'h-8 w-8' }: LogoProps) {
  const { name, logoUrl } = useBrand();
  const [failed, setFailed] = useState<string | null>(null);
  const src = logoUrl && failed !== logoUrl ? logoUrl : markUrl;
  return (
    <img
      src={src}
      alt={name ?? 'Gloaro Mart'}
      onError={() => logoUrl && setFailed(logoUrl)}
      className={`${className} object-contain select-none`}
      draggable={false}
    />
  );
}
