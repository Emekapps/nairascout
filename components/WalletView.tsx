'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownToLine,
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { formatRemainingCooldown } from '@/lib/auth/rbac';
import type {
  CommissionHistoryRowDTO,
  NairaScoutSnapshot,
  WithdrawalRequestDTO,
} from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import {
  NAIRASCOUT_ACCOUNTING_BOUNDARY,
  NAIRASCOUT_EARNINGS_DISCLAIMER,
} from '@/lib/constants/foundation-content';
import { WalletHeroCard } from './wallet/WalletHeroCard';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';
import { RestrictionNoticeBanner } from './shared/RestrictionNoticeBanner';

interface WalletViewProps {
  snapshot: NairaScoutSnapshot;
  onSnapshotUpdated?: (next: NairaScoutSnapshot) => void;
}

interface CommissionsCursorResponse {
  items: CommissionHistoryRowDTO[];
  nextCursor: { createdAt: string; id: string } | null;
  hasMore: boolean;
  productOptions: Array<{ id: string; title: string }>;
}

const COMMISSION_STATUS_FILTERS = [
  'All',
  'Pending',
  'Available',
  'Withdrawn',
  'Reversed / Adjusted',
] as const;

function StatusLabel({
  status,
}: {
  status: CommissionHistoryRowDTO['displayStatus'];
}) {
  if (status === 'Available') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        Available
      </span>
    );
  }
  if (status === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        Pending
      </span>
    );
  }
  if (status === 'On Hold') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        On Hold
      </span>
    );
  }
  if (status === 'Withdrawn') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
        Withdrawn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
      Reversed / Adjusted
    </span>
  );
}

// NS-SCT-065 - NS-SCT-075 & NS-SCT-084: Wallet, Authoritative Withdrawals & 20-Item Cursor Commission History
export default function WalletView({ snapshot, onSnapshotUpdated }: WalletViewProps) {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [productFilter, setProductFilter] = useState<string>('All');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [loadedExtraPages, setLoadedExtraPages] = useState<CommissionHistoryRowDTO[]>([]);
  const [extraNextCursor, setExtraNextCursor] = useState<{
    createdAt: string;
    id: string;
  } | null>(null);
  const [extraHasMore, setExtraHasMore] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{
    type: 'ok' | 'err';
    message: string;
  } | null>(null);

  const userId = snapshot.activeScout?.id ?? '';

  const resetCursorPagination = () => {
    setLoadedExtraPages([]);
    setExtraNextCursor(null);
    setExtraHasMore(null);
  };

  const commissionsQuery = useQuery<CommissionsCursorResponse>({
    queryKey: ['scout-commissions', userId, statusFilter, productFilter, fromDate, toDate],
    enabled: Boolean(snapshot.authenticated && userId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (productFilter !== 'All') params.set('productId', productFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/scout/commissions?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || 'Could not load commission history.');
      }
      return res.json();
    },
  });

  const withdrawalsQuery = useQuery<{ requests: WithdrawalRequestDTO[] }>({
    queryKey: ['scout-withdrawals', userId],
    enabled: Boolean(snapshot.authenticated && userId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await fetch('/api/wallet/withdraw', { cache: 'no-store' });
      if (!res.ok) return { requests: [] };
      return res.json();
    },
  });

  if (!snapshot.authenticated || !snapshot.activeScout) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
        <h1 className="font-sans text-xl md:text-2xl font-bold text-foreground">
          Sign In to View Your Referral Earnings Wallet
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Wallet balances, immutable ledger entries, and Nigerian payout verification details are
          accessible only to the authenticated Scout.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const { wallet, activeScout } = snapshot;
  const remainingCooldown = formatRemainingCooldown(activeScout.withdrawalCooldownUntil);
  const withdrawableNowKobo = wallet.withdrawableNowKobo ?? wallet.availableKobo;
  const pendingWithdrawalKobo = wallet.pendingWithdrawalKobo ?? 0;

  const firstPageItems = commissionsQuery.data?.items ?? [];
  const displayedCommissions = [...firstPageItems, ...loadedExtraPages];
  const currentNextCursor =
    loadedExtraPages.length > 0 ? extraNextCursor : (commissionsQuery.data?.nextCursor ?? null);
  const hasMorePages =
    extraHasMore !== null ? extraHasMore : Boolean(commissionsQuery.data?.hasMore);

  const handleLoadMore = async () => {
    if (!currentNextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        cursorCreatedAt: currentNextCursor.createdAt,
        cursorId: currentNextCursor.id,
      });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (productFilter !== 'All') params.set('productId', productFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/scout/commissions?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const nextPage: CommissionsCursorResponse = await res.json();
      setLoadedExtraPages((prev) => [...prev, ...nextPage.items]);
      setExtraNextCursor(nextPage.nextCursor);
      setExtraHasMore(nextPage.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  // NS-SCT-075: Authoritative server-side withdrawal trigger (server re-queries live ledger balances)
  const handleRequestWithdrawal = async () => {
    setWithdrawBusy(true);
    setWithdrawFeedback(null);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithdrawFeedback({
          type: 'err',
          message: data.error || 'Could not queue withdrawal request.',
        });
        return;
      }
      if (data.snapshot && onSnapshotUpdated) {
        onSnapshotUpdated(data.snapshot);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['scout-withdrawals'] }),
        queryClient.invalidateQueries({ queryKey: ['scout-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['scout-activity'] }),
        queryClient.invalidateQueries({ queryKey: ['scout-commissions'] }),
      ]);
      setWithdrawFeedback({
        type: 'ok',
        message: `Withdrawal request for ${formatKoboToNaira(
          data.withdrawalRequest.amountKobo
        )} queued for the ${data.withdrawalRequest.scheduledPayoutDate} payout run.`,
      });
    } catch {
      setWithdrawFeedback({
        type: 'err',
        message: 'Network error while submitting withdrawal request.',
      });
    } finally {
      setWithdrawBusy(false);
    }
  };

  const hasWithdrawalRestriction = activeScout.activeRestrictions.some(
    (r) =>
      r.status === 'ACTIVE' &&
      (!r.expiresAt || new Date(r.expiresAt) > new Date()) &&
      (r.scope === 'ACCOUNT' || r.capabilityCode === 'REQUEST_WITHDRAWAL')
  );

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-5">
        <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
          Wallet
        </h1>
      </div>

      {/* Restriction Awareness Banner (NS-SCT-084 - NS-SCT-095) */}
      <RestrictionNoticeBanner activeScout={activeScout} />

      {remainingCooldown && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <Clock
            className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-semibold">
              24-Hour Post-Recovery Financial Cooling-Off Lock Active ({remainingCooldown} remaining)
            </p>
            <p className="opacity-90">
              Following support-assisted account recovery, withdrawal requests and payout bank
              destination edits are locked until{' '}
              <span className="font-numeric font-medium">
                {new Date(activeScout.withdrawalCooldownUntil!).toLocaleString()}
              </span>
              .
            </p>
          </div>
        </div>
      )}

      <DismissibleNoticePanel
        storageKey="nairascout_wallet_ledger_notice_v1"
        title="Referral Earnings Wallet & Ledger"
        description="Internal accounting derived strictly from the immutable financial ledger. Separate from Seller proceeds. Paid and Reversed figures are cumulative historical states."
        ariaLabel="Referral Earnings Wallet & Ledger Notice"
      />

      {/* Hero Wallet Card (Charcoal Black #292D2F) */}
      <WalletHeroCard
        availableKobo={withdrawableNowKobo}
        pendingKobo={wallet.pendingKobo}
        paidKobo={wallet.paidKobo}
        nextPayoutDate={wallet.nextPayoutDate}
      />

      {/* Five Distinct Wallet States */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="mt-2 font-numeric text-xl font-bold text-success tabular-nums">
            {formatKoboToNaira(withdrawableNowKobo)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pendingWithdrawalKobo > 0
              ? `${formatKoboToNaira(pendingWithdrawalKobo)} queued for payout`
              : 'Passed fulfilment & checks'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Pending Commission</p>
          <p className="mt-2 font-numeric text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatKoboToNaira(wallet.pendingKobo)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pending fulfilment · Not withdrawable
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">On Hold</p>
          <p className="mt-2 font-numeric text-xl font-bold text-foreground tabular-nums">
            {formatKoboToNaira(wallet.onHoldKobo)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Dispute or review hold</p>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#181818] border border-border rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Paid (Cumulative)</p>
          <p className="mt-2 font-numeric text-xl font-semibold text-foreground tabular-nums">
            {formatKoboToNaira(wallet.paidKobo)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Settled to bank account</p>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#181818] border border-border rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Reversed (Cumulative)</p>
          <p className="mt-2 font-numeric text-xl font-semibold text-destructive tabular-nums">
            {formatKoboToNaira(wallet.reversedKobo)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Refunds &amp; cancellations</p>
        </div>
      </section>

      {/* Monthly Payout Policy, KYC Readiness & Authoritative Withdrawal Request */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" aria-hidden="true" />
              <h2 className="font-sans text-base font-semibold text-foreground">
                Payout — 15th of Each Month
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Commissions that became Available during the preceding calendar month qualify once
              cumulative eligible balance meets the ₦5,000 minimum, KYC is verified, and a
              same-name Nigerian bank account is confirmed. Balances are always verified directly
              from the authoritative ledger on the server.
            </p>
            <div className="pt-2 flex flex-wrap gap-6 text-xs text-muted-foreground">
              <span>
                KYC Identity:{' '}
                <strong
                  className={
                    activeScout.kycVerified
                      ? 'text-success'
                      : 'text-amber-600 dark:text-amber-400'
                  }
                >
                  {activeScout.kycVerified ? 'Verified' : 'Pending'}
                </strong>
              </span>
              <span>
                Bank Account:{' '}
                <strong className="text-foreground">{activeScout.bankSummary}</strong>
              </span>
              <span>
                Next Scheduled Run:{' '}
                <strong className="font-numeric text-foreground tabular-nums">
                  {wallet.nextPayoutDate}
                </strong>
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 space-y-2.5">
            <p className="text-xs text-muted-foreground">Available for Withdrawal Request</p>
            <p className="font-numeric text-xl font-bold text-foreground tabular-nums">
              {formatKoboToNaira(withdrawableNowKobo)}
            </p>
            <p
              className={`text-xs font-medium ${
                wallet.eligibleForNextPayout ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              {wallet.eligibleForNextPayout
                ? 'Minimum ₦5,000 threshold satisfied'
                : 'Requires KYC, verified bank & ₦5,000 minimum'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={
                  withdrawBusy ||
                  !wallet.eligibleForNextPayout ||
                  Boolean(remainingCooldown) ||
                  hasWithdrawalRestriction
                }
                onClick={handleRequestWithdrawal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
              >
                {withdrawBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {withdrawBusy ? 'Submitting...' : 'Request Withdrawal'}
              </button>
              <Link
                href="/programme-rules?policy=payout-policy"
                className="text-xs font-semibold text-foreground hover:underline"
              >
                Payout Policy →
              </Link>
            </div>
          </div>
        </div>

        {withdrawFeedback && (
          <div
            role="status"
            className={`p-3 rounded-xl border text-xs font-medium ${
              withdrawFeedback.type === 'ok'
                ? 'bg-accent border-border text-accent-foreground'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            {withdrawFeedback.message}
          </div>
        )}

        {(withdrawalsQuery.data?.requests?.length ?? 0) > 0 && (
          <div className="pt-3 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-foreground">Withdrawal Requests</p>
            <div className="divide-y divide-border rounded-xl border border-border bg-background">
              {withdrawalsQuery.data!.requests.slice(0, 5).map((wr) => (
                <div
                  key={wr.id}
                  className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {formatKoboToNaira(wr.amountKobo)} · {wr.bankSummary}
                    </p>
                    <p className="text-muted-foreground font-numeric">
                      Requested {wr.requestedAtLagos} · Payout Run {wr.scheduledPayoutDate}
                    </p>
                  </div>
                  <span className="self-start sm:self-center px-2.5 py-0.5 rounded-md font-semibold bg-secondary text-secondary-foreground">
                    {wr.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* NS-FND-001 & NS-FND-002: Platform Accounting Boundary & Earnings Disclosure */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Platform Accounting Boundary</p>
        <p className="leading-relaxed">{NAIRASCOUT_ACCOUNTING_BOUNDARY}</p>
        <p className="leading-relaxed pt-1 border-t border-border/60">
          {NAIRASCOUT_EARNINGS_DISCLAIMER}
        </p>
      </section>

      {/* Commission History with 20-Item Cursor Pagination (NS-SCT-065 - NS-SCT-075) */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-sans text-xl font-bold text-foreground">
                Commission History
              </h2>
              <p className="text-xs text-muted-foreground">
                Append-only ledger records loaded 20 at a time in Africa/Lagos time. Delivery
                releases and refund reversals create linked references.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] dark:bg-[#181818] rounded-xl overflow-x-auto">
              {COMMISSION_STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    resetCursorPagination();
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                    statusFilter === st
                      ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-sm'
                      : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium hover:opacity-90'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card border border-border rounded-2xl p-4">
            <div>
              <label
                htmlFor="commission-product-filter"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Product Filter
              </label>
              <select
                id="commission-product-filter"
                value={productFilter}
                onChange={(e) => {
                  setProductFilter(e.target.value);
                  resetCursorPagination();
                }}
                className="w-full px-3.5 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              >
                <option value="All">All Products</option>
                {(commissionsQuery.data?.productOptions ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="commission-from-date"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                From Date (Africa/Lagos)
              </label>
              <input
                id="commission-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  resetCursorPagination();
                }}
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>
            <div>
              <label
                htmlFor="commission-to-date"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                To Date (Africa/Lagos)
              </label>
              <input
                id="commission-to-date"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  resetCursorPagination();
                }}
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          {commissionsQuery.isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading commission history...
            </div>
          ) : displayedCommissions.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No commission records match the selected filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Reference</th>
                  <th className="py-3 px-4 font-medium">Product · Order</th>
                  <th className="py-3 px-4 font-medium">Tier</th>
                  <th className="py-3 px-4 font-medium">Earned / Released</th>
                  <th className="py-3 px-4 font-medium">Status &amp; Notes</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedCommissions.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/40">
                    <td className="py-3 px-4 font-numeric text-xs text-foreground whitespace-nowrap">
                      {entry.reference}
                      {entry.linkedToReference && (
                        <p className="text-[11px] text-muted-foreground">
                          Linked: {entry.linkedToReference}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground">
                      <p className="font-medium">{entry.productTitle}</p>
                      <p className="font-numeric text-muted-foreground">
                        {entry.orderId}
                        {entry.referralEventId ? ` · ${entry.referralEventId.slice(0, 8)}…` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-numeric text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      Gen {entry.generation} ({entry.fractionLabel})
                    </td>
                    <td className="py-3 px-4 font-numeric text-xs text-muted-foreground whitespace-nowrap">
                      <p>Earned: {entry.createdAtLagos}</p>
                      <p>Released: {entry.releasedAtLagos || '—'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs max-w-xs">
                      <StatusLabel status={entry.displayStatus} />
                      <p className="mt-1 text-muted-foreground">
                        {entry.reversalReason || entry.description}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-numeric text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                      {formatKoboToNaira(entry.amountKobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {hasMorePages && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
            >
              {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {loadingMore ? 'Loading Next 20...' : 'Load More (Next 20)'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
