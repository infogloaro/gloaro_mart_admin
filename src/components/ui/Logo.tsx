import markUrl from '../../assets/gloaro-mark.png';

interface LogoProps {
  className?: string;
}

/**
 * The Gloaro brand mark, served from src/assets so Vite fingerprints it.
 *
 * The artwork is navy and gold, so it needs a light tile behind it wherever it
 * sits on the dark shell — see the sidebar and login headers.
 */
export function Logo({ className = 'h-8 w-8' }: LogoProps) {
  return (
    <img src={markUrl} alt="Gloaro Mart" className={`${className} object-contain select-none`} draggable={false} />
  );
}
