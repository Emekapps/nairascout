'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ThemeToggle } from '../layout/ThemeToggle';

interface AdminMfaGateProps {
  hasVerifiedFactor: boolean;
}

// NS-AUT-006: Mandatory Admin TOTP MFA (aal2) enrollment & verification gate
export function AdminMfaGate({ hasVerifiedFactor }: AdminMfaGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(() => Boolean(createSupabaseBrowserClient()));
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => {
        if (!active) return;
        const verified = (data?.totp ?? []).find((f) => f.status === 'verified');
        if (verified) {
          setVerifiedFactorId(verified.id);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleStartEnrollment = async () => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'NairaScout Admin TOTP',
      });
      if (enrollErr || !data) {
        setError(enrollErr?.message || 'Could not initialize TOTP enrollment.');
        return;
      }
      setEnrolling({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const targetFactorId = enrolling?.factorId || verifiedFactorId;
    if (!targetFactorId) {
      setError('No TOTP factor found. Start Authenticator enrollment first.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setBusy(true);
    try {
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: targetFactorId,
        code: code.trim(),
      });
      if (verifyErr) {
        setError(verifyErr.message);
        return;
      }

      if (enrolling) {
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
          body: JSON.stringify({ action: 'MFA_ENABLED', details: { factorId: targetFactorId } }),
        }).catch(() => undefined);
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const showChallenge = Boolean(verifiedFactorId || (hasVerifiedFactor && !enrolling));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Return to Marketplace
          </Link>
          <ThemeToggle />
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-2xl p-7 space-y-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              Mandatory Administrator MFA (aal2)
            </div>
            <h1 className="font-sans text-2xl font-bold text-foreground">
              Admin Two-Factor Verification
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Platform Administrators must verify a hardware or Authenticator App TOTP code before
              viewing or modifying any governance data.
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

          {loading ? (
            <p className="text-xs text-muted-foreground">Checking enrolled TOTP factors...</p>
          ) : enrolling ? (
            <form onSubmit={handleVerifyChallenge} className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <p className="text-xs font-semibold text-foreground">
                  1. Scan QR Code in Your Authenticator App
                </p>
                {(enrolling.qrCode.startsWith('data:image/svg+xml') ||
                  enrolling.qrCode.startsWith('data:image/png')) && (
                  <div className="bg-white p-3 rounded-xl inline-block border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enrolling.qrCode}
                      alt="Admin TOTP QR Code"
                      className="w-40 h-40"
                    />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Manual secret:{' '}
                  <code className="font-mono text-foreground select-all">{enrolling.secret}</code>
                </p>
              </div>

              <div>
                <label
                  htmlFor="admin-totp-enroll-code"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  2. Enter 6-Digit Authenticator Code
                </label>
                <input
                  id="admin-totp-enroll-code"
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 font-numeric text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={busy || code.trim().length < 6}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                {busy ? 'Verifying...' : 'Activate Admin 2FA & Enter Console'}
              </button>
            </form>
          ) : showChallenge ? (
            <form onSubmit={handleVerifyChallenge} className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                <Smartphone className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                <span>Enter the current 6-digit code from your enrolled Authenticator App.</span>
              </div>
              <div>
                <label
                  htmlFor="admin-totp-code"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  6-Digit TOTP Code
                </label>
                <input
                  id="admin-totp-code"
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 font-numeric text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <button
                type="submit"
                disabled={busy || code.trim().length < 6}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                {busy ? 'Verifying...' : 'Verify TOTP & Unlock Admin Console'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
                No verified Authenticator App is enrolled on your administrator account yet. Enroll
                TOTP 2FA now to unlock the Governance Console.
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleStartEnrollment}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                <QrCode className="w-4 h-4" aria-hidden="true" />
                {busy ? 'Starting Setup...' : 'Enroll Authenticator App (TOTP)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
