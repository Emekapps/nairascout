'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';
import { ThemeToggle } from './layout/ThemeToggle';

async function provisionPostgreSqlProfile(
  payload?: {
    displayName?: string;
    username?: string;
    locationState?: string;
    referralEventId?: string | null;
    referralScoutUsername?: string | null;
  },
  accessToken?: string | null
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'NairaScout',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch('/api/auth/provision', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not provision your PostgreSQL Scout record.');
  }
  return data;
}

export function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabaseConfigured = isSupabaseBrowserConfigured();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }

      await provisionPostgreSqlProfile(undefined, data.session?.access_token);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      setInfo(`Verification code sent to ${email.trim()}. Check your inbox and enter the 6-digit OTP below.`);
      setOtpStep('verify');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      await provisionPostgreSqlProfile(undefined, data.session?.access_token);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Marketplace
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-brand font-extrabold text-xl tracking-tight text-foreground">
              NairaScout
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-2xl p-7 space-y-6">
          <div>
            <h1 className="font-sans text-2xl font-bold text-foreground">
              Sign In to NairaScout
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              One primary identity across Scout referrals, Seller operations, and your Wallet.
            </p>
          </div>

          {!supabaseConfigured && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              Supabase Auth environment variables are missing. Configure{' '}
              <span className="font-sans">NEXT_PUBLIC_SUPABASE_URL</span>,{' '}
              <span className="font-sans">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, and{' '}
              <span className="font-sans">DATABASE_URL</span> to enable live authentication.
            </div>
          )}

          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('otp');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg cursor-pointer ${
                mode === 'otp'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              Email OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg cursor-pointer ${
                mode === 'password'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              Password
            </button>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 bg-accent border border-border rounded-xl text-xs text-accent-foreground">
              {info}
            </div>
          )}

          {mode === 'otp' ? (
            otpStep === 'request' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-email" className="block text-xs font-medium text-muted-foreground mb-1">
                    Email Address
                  </label>
                  <input
                    id="otp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !supabaseConfigured}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Sending Code...' : 'Send Email Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-code" className="block text-xs font-medium text-muted-foreground mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="otp-code"
                    type="text"
                    required
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter code from email"
                    className="w-full px-3.5 py-2.5 font-sans text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('request');
                      setOtpCode('');
                      setInfo(null);
                    }}
                    className="px-3.5 py-2.5 text-xs font-medium border border-border rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="pw-email" className="block text-xs font-medium text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  id="pw-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label htmlFor="pw-pass" className="block text-xs font-medium text-muted-foreground mb-1">
                  Password
                </label>
                <input
                  id="pw-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !supabaseConfigured}
                className="w-full py-2.5 px-4 text-xs font-semibold text-commerce-foreground bg-commerce rounded-xl hover:bg-commerce/90 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Signing In...' : 'Sign In with Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          New to NairaScout?{' '}
          <Link href="/auth/register" className="font-semibold text-success hover:underline">
            Create your free Scout account
          </Link>
        </p>
      </div>
    </div>
  );
}

export { RegisterWizard as RegisterForm } from './auth/RegisterWizard';
