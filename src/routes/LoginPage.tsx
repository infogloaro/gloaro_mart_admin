import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { api, ApiError } from '../lib/api';
import { setToken, type AdminJwtPayload } from '../lib/auth';
import { Icon } from '../components/ui/Icon';
import { Logo } from '../components/ui/Logo';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await api.post<{ token: string }>('/api/auth/login', { email, password });
      const payload = jwtDecode<AdminJwtPayload>(token);
      if (payload.role !== 'admin') {
        setError('This account does not have admin access.');
        return;
      }
      setToken(token);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400';

  return (
    <div className="gradient-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="animate-fade-up relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3.5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
            <Logo className="h-11 w-11" />
          </div>
          <div className="text-lg font-extrabold tracking-[0.1em] text-white">GLOARO MART</div>
          <div className="mt-0.5 text-xs font-medium text-mint-soft">Admin Console</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-7 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
          <h1 className="text-base font-bold text-ink">Sign in</h1>
          <p className="mt-0.5 mb-5 text-xs text-slate-500">Administrator access only.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="admin@gloaromart.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="animate-fade-in flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full px-4 py-2.5 text-sm">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] text-white/35">
          Gloaro Mart — location-first multi-vendor marketplace
        </p>
      </div>
    </div>
  );
}
