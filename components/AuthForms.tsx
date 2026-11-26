'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
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
    termsAcceptedAt?: string | null;
    privacyAcknowledgedAt?: string | null;
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
  return data as { ok: boolean; accountStatus?: string };
}

const ANTI_ENUMERATION_OTP_MESSAGE =
  'If an account matches this email address, instructions have been sent.';
const ANTI_ENUMERATION_LOGIN_ERROR = 'Invalid email or password.';

// NS-AUT-002 & NS-AUT-004: Anti-enumeration Login, 60s OTP resend timer, 30-min idle / 7-day expiry banners
export function LoginForm({
  initialError = null,
  reason = null,
}: {
  initialError?: string | null;
  reason?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabaseConfigured = isSupabaseBrowserConfigured();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const reasonBanner =
    reason === 'idle_timeout'
      ? 'Signed out after 30 minutes of inactivity. Please sign in again to continue.'
      : reason === 'session_expired'
        ? 'Session expired after 7 days. Please sign in again to continue.'
        : null;

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(
        'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
      return;
    }

    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (authError) {
        // NS-AUT-002: Uniform anti-enumeration response on login failure
        setError(ANTI_ENUMERATION_LOGIN_ERROR);
        return;
      }

      const provisioned = await provisionPostgreSqlProfile(
        undefined,
        data.session?.access_token
      );
      if (provisioned.accountStatus === 'PENDING_ACTIVATION') {
        router.push(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        router.refresh();
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : ANTI_ENUMERATION_LOGIN_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const dispatchOtpCode = async () => {
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(
        'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      const guardRes = await fetch('/api/auth/otp-guard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'request', email: normalizedEmail }),
      });
      const guardData = await guardRes.json();
      if (!guardRes.ok) {
        if (guardData.retryAfterSeconds) {
          setResendCooldown(Number(guardData.retryAfterSeconds));
        }
        setError(guardData.error || 'Please wait before requesting a new code.');
        return;
      }

      await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setResendCooldown(60);
      setInfo(`${ANTI_ENUMERATION_OTP_MESSAGE} Codes remain valid for 10 minutes.`);
      setOtpStep('verify');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchOtpCode();
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

    const normalizedEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      const checkRes = await fetch('/api/auth/otp-guard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'attempt_check', email: normalizedEmail }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        setError(checkData.error || 'Maximum 5 attempts reached. Request a new code.');
        return;
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otpCode.trim(),
        type: 'email',
      });
      if (verifyError) {
        const failRes = await fetch('/api/auth/otp-guard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'NairaScout',
          },
          body: JSON.stringify({ action: 'attempt_failed', email: normalizedEmail }),
        });
        const failData = await failRes.json().catch(() => ({}));
        setError(
          failData?.locked
            ? failData.error
            : `Invalid or expired verification code (${failData?.attemptsRemaining ?? 0} attempts remaining).`
        );
        return;
      }

      await fetch('/api/auth/otp-guard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'attempt_succeeded', email: normalizedEmail }),
      }).catch(() => undefined);

      const provisioned = await provisionPostgreSqlProfile(
        undefined,
        data.session?.access_token
      );
      if (provisioned.accountStatus === 'PENDING_ACTIVATION') {
        router.push(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        router.refresh();
        return;
      }

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

          {reasonBanner && (
            <div
              role="status"
              className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-300"
            >
              {reasonBanner}
            </div>
          )}

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
            <div
              role="alert"
              className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive"
            >
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
                  <label
                    htmlFor="otp-email"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
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
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="otp-code"
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      6-Digit Verification Code (valid 10 min · max 5 attempts)
                    </label>
                    <button
                      type="button"
                      disabled={busy || resendCooldown > 0}
                      onClick={dispatchOtpCode}
                      className="text-xs font-semibold text-success hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                    </button>
                  </div>
                  <input
                    id="otp-code"
                    type="text"
                    required
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full px-3.5 py-2.5 font-numeric text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
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
                <label
                  htmlFor="pw-email"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
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
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="pw-pass"
                    className="block text-xs font-medium text-muted-foreground"
                  >
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-semibold text-success hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="pw-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••••••••••"
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

          <div className="pt-3 border-t border-border flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>No access to your email?</span>
            <Link href="/auth/recover" className="font-semibold text-foreground hover:underline">
              Lost access to your email?
            </Link>
          </div>
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
