import { useState, FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const redirectTo = searchParams.get('redirect') || '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth', { email, password });
      login(data.user, data.accessToken, data.refreshToken);
      navigate(redirectTo);
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Invalid email or password. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,230,0.75),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(22,33,49,0.14),transparent_28%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-[28px] border border-[rgba(214,180,93,0.35)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] shadow-[0_24px_60px_rgba(12,22,38,0.2)]">
            <KeyRound className="h-9 w-9 text-[var(--gold-soft)]" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
            Lodge Night Operations
          </p>
          <h1 className="mt-3 font-display text-5xl text-[var(--ink-strong)]">LodgeKey</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Sign in to the lodge dashboard, ceremony planning, and festive board tools.
          </p>
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_26px_70px_rgba(12,22,38,0.12)] backdrop-blur-sm">
          <h2 className="font-display text-3xl text-[var(--ink-strong)]">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Use the seeded demo lodge account or your own credentials.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[var(--ink-strong)]"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="secretary@vulcan4510.co.uk"
                  className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] py-3 pl-11 pr-4 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[var(--ink-strong)]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] py-3 pl-11 pr-11 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] transition hover:text-[var(--ink-strong)]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl border border-[rgba(214,180,93,0.18)] bg-[linear-gradient(135deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(12,22,38,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-[var(--gold-deep)] underline-offset-4 transition hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--ink-faint)]">
          freemasons.app - Game On Solutions Ltd
        </p>
      </div>
    </div>
  );
}
