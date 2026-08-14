import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The page content sits inside an `animate-fade-up` wrapper, and an animated
  // transform makes that div the containing block for `position: fixed`. Left
  // in place, the overlay covers only the current page's box instead of the
  // viewport and a tall dialog gets clipped to it — so render into <body>.
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-shell-deep/55 p-4 sm:p-6"
      onClick={onClose}
    >
      {/*
        The dialog owns the scrolling, not the backdrop. Scrolling the backdrop
        pushed the title bar off the top of the screen on tall forms, leaving a
        headerless box floating over the page.
      */}
      <div
        className={`animate-fade-up flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_32px_80px_-24px_rgba(24,24,27,0.45)] ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="h-4 w-1 rounded-full bg-emerald" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-ink"
          >
            <Icon name="x" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
