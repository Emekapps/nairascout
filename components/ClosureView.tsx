'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Store, Trash2 } from 'lucide-react';
import type { NairaScoutSnapshot } from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E4E4DE] rounded-xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-[#0B6E4F] mx-auto" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-[#111814]">
            Sign In to Manage Account Closure
          </h1>
          <p className="text-sm text-[#5C665E]">
            Review open order obligations, close Seller capabilities independently, or close your
            full NairaScout account while preserving immutable ancestry &amp; ledger history.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-[#111814] border border-[#D8D8D0] rounded-lg"
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
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white border-b border-[#E4E4DE]">
        <div className="max-w-[1040px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111814] hover:text-[#0B6E4F]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Account Settings
          </Link>
          <span className="font-mono text-xs text-[#5C665E]">@{scout.handle}</span>
        </div>
      </header>

      <main className="max-w-[1040px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        <div className="border-b border-[#E4E4DE] pb-6">
          <h1 className="font-display text-3xl font-bold text-[#111814]">
            Two-Track Voluntary Closure
          </h1>
          <p className="mt-1.5 text-sm text-[#4B554E] max-w-2xl">
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
                ? 'bg-[#F3F8F6] border-[#CBE2D8] text-[#0B6E4F]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Obligation Assessment Summary */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border border-[#E4E4DE] rounded-xl p-5 text-xs">
          <div>
            <p className="text-[#5C665E]">Open Buyer / Seller Orders</p>
            <p className="mt-1 font-mono text-xl font-bold text-[#111814] tabular-nums">
              {assessment.openBuyerOrdersCount} / {assessment.openSellerOrdersCount}
            </p>
          </div>
          <div>
            <p className="text-[#5C665E]">Disputed Orders</p>
            <p className="mt-1 font-mono text-xl font-bold text-[#B91C1C] tabular-nums">
              {assessment.disputedOrdersCount}
            </p>
          </div>
          <div>
            <p className="text-[#5C665E]">Pending Commissions</p>
            <p className="mt-1 font-mono text-xl font-bold text-[#B45309] tabular-nums">
              {formatKoboToNaira(assessment.pendingWalletKobo)}
            </p>
          </div>
          <div>
            <p className="text-[#5C665E]">Available Balance</p>
            <p className="mt-1 font-mono text-xl font-bold text-[#0B6E4F] tabular-nums">
              {formatKoboToNaira(assessment.availableWalletKobo)}
            </p>
          </div>
        </section>

        {assessment.blockingReason && (
          <div className="p-4 bg-[#FFFBEB] border border-[#E5CFA3] rounded-xl text-xs text-[#78350F]">
            <strong>Pre-closure Obligation Check:</strong> {assessment.blockingReason}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Track 1: Seller Capability Closure */}
          <section className="bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <Store className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-bold text-[#111814]">
                  Track 1: Close Seller Capabilities Only
                </h2>
                <p className="mt-1 text-xs text-[#4B554E] leading-relaxed">
                  Deactivates your Seller storefront, expires active listings, and stops Seller
                  renewals. Your primary Scout account, referral cards, and commission wallet remain
                  fully operational.
                </p>
              </div>
            </div>

            {!scout.sellerProfile ? (
              <p className="text-xs text-[#5C665E] bg-[#FAFAF8] p-4 rounded-lg border border-[#ECECE6]">
                You do not have an active Seller profile attached to your account.
              </p>
            ) : !hasActiveSeller ? (
              <p className="text-xs text-[#0B6E4F] bg-[#F3F8F6] p-4 rounded-lg border border-[#CBE2D8]">
                Seller capabilities ({scout.sellerProfile.sellerName}) are already closed. Your Scout
                role remains active.
              </p>
            ) : (
              <form onSubmit={handleCloseSeller} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#4B554E] mb-1">
                    Reason for Closing Seller Store (Optional)
                  </label>
                  <input
                    type="text"
                    value={sellerReason}
                    onChange={(e) => setSellerReason(e.target.value)}
                    placeholder="e.g., Pausing retail inventory temporarily"
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    assessment.disputedOrdersCount > 0 ||
                    assessment.openSellerOrdersCount > 0
                  }
                  className="w-full py-2.5 px-4 text-xs font-semibold text-[#B45309] border border-[#E5CFA3] bg-[#FFFBEB] rounded-lg hover:bg-[#FEF3C7] disabled:opacity-45 cursor-pointer"
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
          <section className="bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-bold text-[#111814]">
                  Track 2: Close Full NairaScout Account
                </h2>
                <p className="mt-1 text-xs text-[#4B554E] leading-relaxed">
                  Disables authentication, closes any Seller capabilities, blocks future referrals,
                  and preserves your fixed <span className="font-mono">referral_ancestry</span> slot
                  and <span className="font-mono">commission_ledger_entries</span> permanently.
                </p>
              </div>
            </div>

            <form onSubmit={handleCloseFullAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Closure Reason (Optional)
                </label>
                <input
                  type="text"
                  value={accountReason}
                  onChange={(e) => setAccountReason(e.target.value)}
                  placeholder="Optional feedback..."
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Type <span className="font-mono font-bold">CLOSE MY ACCOUNT</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CLOSE MY ACCOUNT"
                  className="w-full px-3 py-2 font-mono text-sm border border-[#E8D0D0] rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={
                  busy ||
                  confirmText.trim().toUpperCase() !== 'CLOSE MY ACCOUNT' ||
                  !assessment.canCloseFullAccount
                }
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#B91C1C] rounded-lg hover:bg-[#991B1B] disabled:opacity-45 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                {busy ? 'Closing Full Account...' : 'Close Full Account & Preserve Ledger'}
              </button>
            </form>

            <div className="flex items-center gap-2 text-xs text-[#5C665E] pt-2 border-t border-[#ECECE6]">
              <CheckCircle2 className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
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
