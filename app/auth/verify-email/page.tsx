'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MailCheck, ShieldCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { provisionPostgreSqlProfile } from '@/components/auth/RegisterWizard';

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (email) return;
    const supabase = createSupabaseBrowserClient();
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, [email]);

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Enter your registered email address first.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

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
        setError(guardData.error || 'Please wait before requesting another code.');
        return;
      }

      await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setResendCooldown(60);
      setInfo(
        'If an account matches this email address, instructions have been sent. Codes remain valid for 10 minutes.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
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

      let verifiedSession = null;
      const signupVerify = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code.trim(),
        type: 'signup',
      });
      if (signupVerify.error) {
        const emailVerify = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: code.trim(),
          type: 'email',
        });
        if (emailVerify.error) {
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
        verifiedSession = emailVerify.data.session;
      } else {
        verifiedSession = signupVerify.data.session;
      }

      await fetch('/api/auth/otp-guard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'attempt_succeeded', email: normalizedEmail }),
      }).catch(() => undefined);

      await provisionPostgreSqlProfile(undefined, verifiedSession?.access_token);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email activation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Sign In
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-brand font-extrabold text-xl tracking-tight text-foreground">
              NairaScout
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-2xl p-7 space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <MailCheck className="w-4 h-4" aria-hidden="true" />
              Account Activation Pending
            </div>
            <h1 className="mt-1 font-sans text-2xl font-bold text-foreground">
              Verify Your Email Address
            </h1>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Your account is currently <strong className="text-foreground">PENDING_ACTIVATION</strong>.
              Confirm your email address to activate Scout referrals, Seller operations, and Wallet
              actions.
            </p>
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

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label
                htmlFor="verify-email-addr"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Email Address
              </label>
              <input
                id="verify-email-addr"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="verify-email-code"
                  className="block text-xs font-medium text-muted-foreground"
                >
                  6-Digit Verification Code (valid 10 min · max 5 attempts)
                </label>
                <button
                  type="button"
                  disabled={busy || resendCooldown > 0}
                  onClick={handleResend}
                  className="text-xs font-semibold text-success hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                </button>
              </div>
              <input
                id="verify-email-code"
                type="text"
                required
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full px-3.5 py-2.5 font-numeric text-sm bg-background text-foreground border border-input rounded-xl"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              {busy ? 'Activating...' : 'Verify & Activate Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// NS-AUT-002: Email activation screen for PENDING_ACTIVATION accounts
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
