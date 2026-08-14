import { Icon } from './Icon';

interface PendingApiNoticeProps {
  /** The error string from useApiData / ApiError. */
  error: string;
  /** Endpoints this screen needs, shown so the API work is unambiguous. */
  endpoints: string[];
  phase: string;
}

/**
 * The UI for these modules ships ahead of the API. A raw red "404" reads like a
 * bug; this says plainly that the screen is waiting on the backend and names the
 * exact routes it expects, so the contract stays visible to whoever builds them.
 */
export function PendingApiNotice({ error, endpoints, phase }: PendingApiNoticeProps) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-mint-mist/60 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald/12 text-emerald">
          <Icon name="clock" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-ink">Waiting on the API</h2>
          <p className="text-xs text-slate-500">
            This screen is built and ready. The {phase} endpoints are not deployed yet.
          </p>
        </div>
      </div>
      <div className="p-5">
        <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Endpoints required</div>
        <ul className="mt-2 space-y-1.5">
          {endpoints.map((e) => (
            <li
              key={e}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint-soft" />
              {e}
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-[11px] text-slate-400">
          Server said: {error}
        </div>
      </div>
    </div>
  );
}
