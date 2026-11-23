'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Store, Trash2 } from 'lucide-react';
import type { NairaScoutSnapshot } from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ThemeToggle } from './layout/ThemeToggle';

interface ClosureViewProps {
  initialSnapshot: NairaScoutSnapshot;
}

export default function ClosureView({ initialSnapshot }: ClosureViewProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<NairaScoutSnapshot>(initialSnapshot);
  const [sellerReason, setSellerReason] = useState('');
  const [accountReason, setAccountReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  const scout = snapshot.activeScout;

  if (!snapshot.authenticated || !scout) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-foreground mx-auto" aria-hidden="true" />
          <h1 className="font-sans text-2xl font-bold text-foreground">
            Sign In to Manage Account Closure
          </h1>
          <p className="text-sm text-muted-foreground">
            Review open order obligations, close Seller capabilities independently, or close your
            full NairaScout account while preserving immutable ancestry &amp; ledger history.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-foreground border border-border rounded-xl"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const assessment = scout.closureAssessment;
  const hasActiveSeller =
    Boolean(scout.sellerProfile) && scout.sellerProfile?.sellerStatus !== 'CLOSED';

  const handleCloseSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'close_seller', reason: sellerReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Could not close Seller capabilities.' });
        return;
      }
      if (data.snapshot) setSnapshot(data.snapshot);
      setSellerReason('');
      setFeedback({
        type: 'ok',
        message:
          'Seller capability closed (Track 1). Active Seller listings expired; your Scout account, referral events, and wallet remain operational.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCloseFullAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim().toUpperCase() !== 'CLOSE MY ACCOUNT') return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'close_account', reason: accountReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Full account closure failed.' });
        return;
      }
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card/85 backdrop-blur-md border-b border-border sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Account Settings
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-sans text-xs text-muted-foreground">@{scout.handle}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        <div className="border-b border-border pb-6">
          <h1 className="font-sans text-2xl md:text-3xl font-bold text-foreground">
            Two-Track Voluntary Closure
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            Close only your Seller capability while remaining an active Scout, or permanently close
            your entire NairaScout identity while preserving immutable referral ancestry and ledger
            entries.
          </p>
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-xs font-medium ${
              feedback.type === 'ok'
                ? 'bg-accent border-border text-accent-foreground'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Obligation Assessment Summary */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-card border border-border rounded-2xl p-5 text-xs">
          <div>
            <p className="text-muted-foreground">Open Buyer / Seller Orders</p>
            <p className="mt-1 font-numeric text-xl font-bold text-foreground tabular-nums">
              {assessment.openBuyerOrdersCount} / {assessment.openSellerOrdersCount}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Disputed Orders</p>
            <p className="mt-1 font-numeric text-xl font-bold text-destructive tabular-nums">
              {assessment.disputedOrdersCount}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending Commissions</p>
            <p className="mt-1 font-numeric text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatKoboToNaira(assessment.pendingWalletKobo)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Available Balance</p>
            <p className="mt-1 font-numeric text-xl font-bold text-foreground tabular-nums">
              {formatKoboToNaira(assessment.availableWalletKobo)}
            </p>
          </div>
        </section>

        {assessment.blockingReason && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-800 dark:text-amber-200">
            <strong>Pre-closure Obligation Check:</strong> {assessment.blockingReason}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Track 1: Seller Capability Closure */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <Store className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-sans text-lg font-bold text-foreground">
                  Track 1: Close Seller Capabilities Only
                </h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Deactivates your Seller storefront, expires active listings, and stops Seller
                  renewals. Your primary Scout account, referral cards, and commission wallet remain
                  fully operational.
                </p>
              </div>
            </div>

            {!scout.sellerProfile ? (
              <p className="text-xs text-muted-foreground bg-muted/50 p-4 rounded-xl border border-border">
                You do not have an active Seller profile attached to your account.
              </p>
            ) : !hasActiveSeller ? (
              <p className="text-xs text-accent-foreground bg-accent p-4 rounded-xl border border-border">
                Seller capabilities ({scout.sellerProfile.sellerName}) are already closed. Your Scout
                role remains active.
              </p>
            ) : (
              <form onSubmit={handleCloseSeller} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Reason for Closing Seller Store (Optional)
                  </label>
                  <input
                    type="text"
                    value={sellerReason}
                    onChange={(e) => setSellerReason(e.target.value)}
                    placeholder="e.g., Pausing retail inventory temporarily"
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    assessment.disputedOrdersCount > 0 ||
                    assessment.openSellerOrdersCount > 0
                  }
                  className="w-full py-2.5 px-4 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/40 bg-amber-500/10 rounded-xl hover:bg-amber-500/20 disabled:opacity-45 cursor-pointer"
                >
                  {assessment.disputedOrdersCount > 0 || assessment.openSellerOrdersCount > 0
                    ? 'Resolve Open / Disputed Seller Orders First'
                    : busy
                      ? 'Closing Seller Capabilities...'
                      : 'Close Seller Capabilities (Keep Scout Active)'}
                </button>
              </form>
            )}
          </section>

          {/* Track 2: Full Account Closure */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-sans text-lg font-bold text-foreground">
                  Track 2: Close Full NairaScout Account
                </h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Disables authentication, closes any Seller capabilities, blocks future referrals,
                  and preserves your fixed <span className="font-sans font-medium">referral_ancestry</span> slot
                  and <span className="font-sans font-medium">commission_ledger_entries</span> permanently.
                </p>
              </div>
            </div>

            <form onSubmit={handleCloseFullAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Closure Reason (Optional)
                </label>
                <input
                  type="text"
                  value={accountReason}
                  onChange={(e) => setAccountReason(e.target.value)}
                  placeholder="Optional feedback..."
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Type <span className="font-sans font-bold">CLOSE MY ACCOUNT</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CLOSE MY ACCOUNT"
                  className="w-full px-3 py-2 font-sans text-sm bg-background text-foreground border border-destructive/40 rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={
                  busy ||
                  confirmText.trim().toUpperCase() !== 'CLOSE MY ACCOUNT' ||
                  !assessment.canCloseFullAccount
                }
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-destructive-foreground bg-destructive rounded-xl hover:bg-destructive/90 disabled:opacity-45 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                {busy ? 'Closing Full Account...' : 'Close Full Account & Preserve Ledger'}
              </button>
            </form>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" aria-hidden="true" />
              <span>
                Historical orders, referral events, and ancestry chains remain non-deletable for
                downstream Scouts.
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
