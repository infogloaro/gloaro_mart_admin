import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, any render-time throw unmounts the whole admin and leaves a
 * blank page with nothing on screen explaining why.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="animate-fade-up m-6 overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-[0_18px_46px_-28px_rgba(225,29,72,0.5)]">
        <div className="flex items-center gap-3 border-b border-rose-200 bg-rose-50 px-6 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Icon name="alert" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-rose-800">This page failed to render</h2>
            <p className="text-sm text-rose-700">
              Usually this means the server sent data in a shape the page did not expect.
            </p>
          </div>
        </div>
        <div className="p-6">
          <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-[0.6rem] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="btn-primary px-4 py-2 text-sm">
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
