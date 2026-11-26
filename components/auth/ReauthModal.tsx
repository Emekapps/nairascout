'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Mail, ShieldCheck, X } from 'lucide-react';
import type { NairaScoutSnapshot } from '@/lib/nairascout-store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ReauthModalProps {
  open: boolean;
  email: string;
  actionLabel?: string;
  onClose: () => void;
  onSuccess: (payload: {
    lastReauthenticatedAt?: string;
    snapshot?: NairaScoutSnapshot;
  }) => void;
}

// NS-AUT-005: Sensitive-action fresh reauthentication modal (password or 6-digit email OTP)
export function ReauthModal({
  open,
  email,
  actionLabel = 'this sensitive security change',
  onClose,
  onSuccess,
}: ReauthModalProps) {
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleClose = () => {
    setPassword('');
    setOtpCode('');
    setError(null);
    setInfo(null);
    onClose();
  };

  if (!open) return null;

  const handleSendOtp = async () => {
    setError(null);
    setInfo(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setBusy(true);
    try {
      const guardRes = await fetch('/api/auth/otp-guard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'request', email }),
      });
      const guardData = await guardRes.json();
      if (!guardRes.ok) {
        if (guardData.retryAfterSeconds) {
          setResendCooldown(Number(guardData.retryAfterSeconds));
        }
        setError(guardData.error || 'Please wait before requesting another code.');
        return;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        setError('Unable to dispatch verification code. Try password confirmation instead.');
        return;
      }

      setOtpSent(true);
      setResendCooldown(60);
      setInfo(
        'If an account matches this email address, a 6-digit confirmation code valid for 10 minutes has been sent.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setBusy(true);
    try {
      if (mode === 'otp') {
        const checkRes = await fetch('/api/auth/otp-guard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'NairaScout',
          },
          body: JSON.stringify({ action: 'attempt_check', email }),
        });
        const checkData = await checkRes.json();
        if (!checkRes.ok) {
          setError(checkData.error || 'Maximum attempts reached. Request a new code.');
          return;
        }
      }

      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'NairaScout',
      };
      if (sessionData.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      }

      const res = await fetch('/api/auth/reauthenticate', {
        method: 'POST',
        headers,
        body: JSON.stringify(
          mode === 'password'
            ? { mode: 'password', password }
            : { mode: 'otp', otpCode: otpCode.trim() }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        if (mode === 'otp') {
          await fetch('/api/auth/otp-guard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'NairaScout',
            },
            body: JSON.stringify({ action: 'attempt_failed', email }),
          }).catch(() => undefined);
        }
        setError(data.error || 'Identity confirmation failed.');
        return;
      }

      if (mode === 'otp') {
        await fetch('/api/auth/otp-guard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'NairaScout',
          },
          body: JSON.stringify({ action: 'attempt_succeeded', email }),
        }).catch(() => undefined);
      }

      setPassword('');
      setOtpCode('');
      setError(null);
      setInfo(null);
      onSuccess({
        lastReauthenticatedAt: data.lastReauthenticatedAt,
        snapshot: data.snapshot,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reauth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Identity Confirmation Required
            </div>
            <h2 id="reauth-modal-title" className="font-sans text-lg font-bold text-foreground">
              Confirm Your Identity
            </h2>
            <p className="text-xs text-muted-foreground">
              Verify your credentials before completing {actionLabel}. Confirmation stays valid for
              10 minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close identity confirmation dialog"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError(null);
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
          <button
            type="button"
            onClick={() => {
              setMode('otp');
              setError(null);
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg cursor-pointer ${
              mode === 'otp'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            6-Digit Email OTP
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

        <form onSubmit={handleVerify} className="space-y-4">
          {mode === 'password' ? (
            <div>
              <label
                htmlFor="reauth-password"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Current Password for {email}
              </label>
              <input
                id="reauth-password"
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your current password"
                className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Email: {email}</span>
                <button
                  type="button"
                  disabled={busy || resendCooldown > 0}
                  onClick={handleSendOtp}
                  className="text-xs font-semibold text-success hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : otpSent
                      ? 'Resend Code'
                      : 'Send 6-Digit Code'}
                </button>
              </div>
              <div>
                <label
                  htmlFor="reauth-otp"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  6-Digit Verification Code (valid 10 min · max 5 attempts)
                </label>
                <input
                  id="reauth-otp"
                  type="text"
                  required
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 font-numeric text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Confirming...' : 'Confirm Identity'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-xs font-medium border border-border rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
