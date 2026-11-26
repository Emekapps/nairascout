'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileUp, ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

// NS-AUT-007: Support-assisted account recovery intake form (lost email access)
export default function AccountRecoveryPage() {
  const [claimedEmail, setClaimedEmail] = useState('');
  const [claimedUsername, setClaimedUsername] = useState('');
  const [contactEmailForUpdates, setContactEmailForUpdates] = useState('');
  const [reason, setReason] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!evidenceFile) {
      setError('Upload government ID or ownership evidence (PDF, JPG, PNG, or WebP).');
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('claimedEmail', claimedEmail.trim());
      formData.append('claimedUsername', claimedUsername.trim());
      formData.append('contactEmailForUpdates', contactEmailForUpdates.trim());
      formData.append('reason', reason.trim());
      formData.append('evidence', evidenceFile);

      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'NairaScout',
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit account recovery request.');
        return;
      }

      setSubmittedRef(data.requestId || 'SUBMITTED');
    } catch {
      setError('Network error while submitting recovery request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4">
      <div className="max-w-lg w-full mx-auto space-y-6">
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
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              Support-Assisted Account Recovery
            </div>
            <h1 className="mt-1 font-sans text-2xl font-bold text-foreground">
              Lost Access to Your Email?
            </h1>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Submit proof of identity and account ownership for dual-officer review. Approved
              recoveries revoke all prior sessions and place a mandatory{' '}
              <strong className="text-foreground">24-hour cooling-off lock</strong> on withdrawals
              and payout bank changes.
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

          {submittedRef ? (
            <div className="p-5 bg-accent border border-border rounded-xl space-y-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-success text-sm">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Recovery Request Submitted
              </div>
              <p className="text-foreground leading-relaxed">
                If an account matches the supplied details, our Support and Trust &amp; Safety
                officers will review your evidence and contact{' '}
                <strong className="font-semibold">{contactEmailForUpdates}</strong>.
              </p>
              <p className="font-numeric text-[11px] text-muted-foreground">
                Reference ID: {submittedRef}
              </p>
              <Link
                href="/auth/login"
                className="inline-block px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rec-claimed-email"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
                    Lost Registered Email
                  </label>
                  <input
                    id="rec-claimed-email"
                    type="email"
                    required
                    value={claimedEmail}
                    onChange={(e) => setClaimedEmail(e.target.value)}
                    placeholder="old-email@example.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rec-claimed-user"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
                    Scout Username (Optional)
                  </label>
                  <input
                    id="rec-claimed-user"
                    type="text"
                    value={claimedUsername}
                    onChange={(e) => setClaimedUsername(e.target.value)}
                    placeholder="amara_okafor"
                    className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="rec-contact-email"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  New Reachable Email for Updates &amp; Reassignment
                </label>
                <input
                  id="rec-contact-email"
                  type="email"
                  required
                  value={contactEmailForUpdates}
                  onChange={(e) => setContactEmailForUpdates(e.target.value)}
                  placeholder="new-reachable@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <div>
                <label
                  htmlFor="rec-reason"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Ownership Details &amp; Reason for Lost Access (min 15 characters)
                </label>
                <textarea
                  id="rec-reason"
                  rows={3}
                  required
                  minLength={15}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe why you lost access to your email, your Nigerian state, recent Scout referrals, or bank settlement summary..."
                  className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <div>
                <label
                  htmlFor="rec-evidence"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Government ID / Ownership Proof (PDF, JPG, PNG, WebP · max 10 MB)
                </label>
                <label
                  htmlFor="rec-evidence"
                  className="flex items-center gap-2.5 px-3.5 py-3 border border-dashed border-input rounded-xl bg-muted/30 cursor-pointer hover:bg-muted/50 text-xs"
                >
                  <FileUp className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-foreground truncate">
                    {evidenceFile
                      ? `${evidenceFile.name} (${Math.round(evidenceFile.size / 1024)} KB)`
                      : 'Choose NIN slip, International Passport, Driver License, or bank statement'}
                  </span>
                </label>
                <input
                  id="rec-evidence"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Uploading Evidence...' : 'Submit Account Recovery Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
