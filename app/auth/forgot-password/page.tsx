'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const ANTI_ENUMERATION_RESET_NOTICE =
  'If an account matches this email address, instructions have been sent.';

// NS-AUT-003: Forgot Password request with anti-enumeration confirmation
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseConfigured = isSupabaseBrowserConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });
      setSubmitted(true);
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
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              Password Recovery
            </div>
            <h1 className="mt-1 font-sans text-2xl font-bold text-foreground">
              Reset Your Password
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your registered email address to receive a single-use password reset link.
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

          {submitted ? (
            <div className="p-4 bg-accent border border-border rounded-xl space-y-2 text-xs text-accent-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <MailCheck className="w-4 h-4 text-success" aria-hidden="true" />
                Check Your Inbox
              </div>
              <p>{ANTI_ENUMERATION_RESET_NOTICE}</p>
              <p className="text-muted-foreground">
                Follow the link in your email to choose a new 15+ character passphrase.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Registered Email Address
                </label>
                <input
                  id="forgot-email"
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
                {busy ? 'Sending Instructions...' : 'Send Password Reset Link'}
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Cannot access this email?</span>
            <Link href="/auth/recover" className="font-semibold text-foreground hover:underline">
              Lost access to your email?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
