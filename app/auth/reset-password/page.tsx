'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { validatePasswordLocally } from '@/lib/auth/password-policy';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { PasswordStrengthInput } from '@/components/auth/PasswordStrengthInput';

// NS-AUT-003: Reset Password enforcing 15-char NIST policy, session revocation & security audit log
export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [hasSession, setHasSession] = useState<boolean | null>(() =>
    createSupabaseBrowserClient() ? null : false
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data.session?.user;
      setHasSession(Boolean(user));
      if (user?.email) setEmail(user.email);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const local = validatePasswordLocally(password, { email });
    if (!local.valid) {
      setError(local.errors[0] || 'Password does not meet security requirements.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setBusy(true);
    try {
      // Server-side NIST + HaveIBeenPwned verification
      const pwRes = await fetch('/api/auth/password-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ password, email }),
      });
      const pwData = await pwRes.json();
      if (!pwRes.ok || !pwData.valid) {
        setError(pwData?.errors?.[0] || pwData?.error || 'Choose a stronger unique password.');
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }

      // Revoke all other active sessions across devices
      await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);

      // Audit PASSWORD_RESET_COMPLETED + create in-app security notification
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'NairaScout',
      };
      if (sessionData.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      }

      await fetch('/api/auth/security-event', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'PASSWORD_RESET_COMPLETED',
          details: { scope: 'others_revoked' },
        }),
      }).catch(() => undefined);

      setCompleted(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
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
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Choose New Passphrase
            </div>
            <h1 className="mt-1 font-sans text-2xl font-bold text-foreground">
              Set a New Password
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Updating your password signs out all other active devices automatically.
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

          {completed ? (
            <div className="p-4 bg-accent border border-border rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Password Reset Completed
              </div>
              <p className="text-foreground">
                Your new password is active and all other sessions have been signed out. Redirecting
                you to NairaScout...
              </p>
            </div>
          ) : hasSession === false ? (
            <div className="p-4 bg-muted/60 border border-border rounded-xl space-y-3 text-xs">
              <p className="text-foreground font-semibold">Reset Link Required or Expired</p>
              <p className="text-muted-foreground">
                Open the password reset link sent to your email, or request a new link below.
              </p>
              <Link
                href="/auth/forgot-password"
                className="inline-block px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl"
              >
                Request New Reset Link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordStrengthInput
                id="reset-pass"
                label="New Password (minimum 15 characters)"
                value={password}
                onChange={setPassword}
                autoFocus
                email={email}
              />

              <div>
                <label
                  htmlFor="reset-confirm"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                />
              </div>

              <button
                type="submit"
                disabled={busy || hasSession === null}
                className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Updating Password...' : 'Save New Password & Revoke Other Sessions'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
