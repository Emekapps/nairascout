'use client';

// NS-UI-310, NS-UI-319 & NS-SCT-070/075: Dedicated Wallet & 20-Record Cursor-Paginated Financial Ledger Views
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { formatRemainingCooldown } from '@/lib/auth/rbac';
import type {
  LedgerEntryStatus,
  NairaScoutSnapshot,
  PaginatedLedgerResponse,
} from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import {
  NAIRASCOUT_ACCOUNTING_BOUNDARY,
  NAIRASCOUT_EARNINGS_DISCLAIMER,
} from '@/lib/constants/foundation-content';
import { WalletHeroCard } from './wallet/WalletHeroCard';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';

interface WalletViewProps {
  snapshot: NairaScoutSnapshot;
  viewMode?: 'all' | 'wallet' | 'ledger';
  onSnapshotUpdated?: (next: NairaScoutSnapshot) => void;
}

const LEDGER_STATUS_FILTERS: ReadonlyArray<'All' | LedgerEntryStatus> = [
  'All',
  'Pending',
  'Available',
  'On Hold',
  'Paid',
  'Reversed',
];

function StatusLabel({ status }: { status: LedgerEntryStatus }) {
  if (status === 'Available') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C7C5D] dark:text-[#6E9470]">
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
  if (status === 'Paid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
        Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
      Reversed
    </span>
  );
}

export default function WalletView({
  snapshot,
  viewMode = 'all',
  onSnapshotUpdated,
}: WalletViewProps) {
  const [statusFilter, setStatusFilter] = useState<'All' | LedgerEntryStatus>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);

  // Withdrawal request form state
  const [withdrawAmountNaira, setWithdrawAmountNaira] = useState('');
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{
    type: 'ok' | 'err';
    message: string;
  } | null>(null);

  const showWalletOverview = viewMode === 'all' || viewMode === 'wallet';
  const showLedger = viewMode === 'all' || viewMode === 'ledger';

  const {
    data: paginatedLedger,
    isLoading: ledgerLoading,
    isFetching: ledgerFetching,
  } = useQuery<PaginatedLedgerResponse>({
    queryKey: [
      'wallet-ledger',
      snapshot.activeScout?.id ?? 'guest',
      statusFilter,
      fromDate,
      toDate,
      productFilter.trim(),
      cursor,
    ],
    enabled: Boolean(snapshot.authenticated && snapshot.activeScout && viewMode === 'ledger'),
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('limit', '20');
      if (statusFilter !== 'All') qs.set('status', statusFilter);
      if (fromDate) qs.set('from', fromDate);
      if (toDate) qs.set('to', toDate);
      if (productFilter.trim()) qs.set('product', productFilter.trim());
      if (cursor) qs.set('cursor', cursor);
      const res = await fetch(`/api/wallet/ledger?${qs.toString()}`);
      if (!res.ok) {
        throw new Error('Could not load ledger entries.');
      }
      return res.json();
    },
    staleTime: 60_000,
  });

  const filteredSnapshotLedger = useMemo(() => {
    if (statusFilter === 'All') return snapshot.ledgerEntries;
    return snapshot.ledgerEntries.filter((entry) => entry.status === statusFilter);
  }, [snapshot.ledgerEntries, statusFilter]);

  if (!snapshot.authenticated || !snapshot.activeScout) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
        <h1 className="font-sans text-xl md:text-2xl font-bold text-foreground">
          {viewMode === 'ledger'
            ? 'Sign In to View Your Immutable Financial Ledger'
            : 'Sign In to View Your Referral Earnings Wallet'}
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

  const canQueueWithdrawal =
    !remainingCooldown &&
    activeScout.kycVerified &&
    activeScout.bankVerified &&
    withdrawableNowKobo >= wallet.minimumPayoutKobo;

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawFeedback(null);

    const parsedNaira = withdrawAmountNaira.trim() ? Number(withdrawAmountNaira) : null;
    const requestedKobo =
      parsedNaira !== null && Number.isFinite(parsedNaira)
        ? Math.round(parsedNaira * 100)
        : withdrawableNowKobo;

    if (requestedKobo < wallet.minimumPayoutKobo) {
      setWithdrawFeedback({
        type: 'err',
        message: 'Minimum withdrawal threshold is ₦5,000.00.',
      });
      return;
    }

    setWithdrawBusy(true);
    try {
      const res = await fetch('/api/nairascout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({
          action: 'request_withdrawal',
          amountKobo: requestedKobo,
        }),
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
      setWithdrawAmountNaira('');
      setWithdrawFeedback({
        type: 'ok',
        message: `Withdrawal queued for the ${data.withdrawal?.scheduledPayoutDate ?? wallet.nextPayoutDate} monthly payout run.`,
      });
    } catch {
      setWithdrawFeedback({
        type: 'err',
        message: 'Network error while queuing withdrawal request.',
      });
    } finally {
      setWithdrawBusy(false);
    }
  };

  const resetLedgerFilters = () => {
    setCursor(null);
    setCursorHistory([]);
  };

  const ledgerRows =
    viewMode === 'ledger' ? paginatedLedger?.entries ?? [] : filteredSnapshotLedger;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-5">
        <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
          {viewMode === 'ledger' ? 'Financial Ledger' : 'Wallet'}
        </h1>
        {viewMode === 'wallet' && (
          <Link
            href="/wallet/ledger"
            className="text-xs font-semibold text-[#2E5339] dark:text-[#6E9470] hover:underline"
          >
            View Financial Ledger →
          </Link>
        )}
        {viewMode === 'ledger' && (
          <Link
            href="/wallet"
            className="text-xs font-semibold text-[#2E5339] dark:text-[#6E9470] hover:underline"
          >
            ← Back to Wallet Summary
          </Link>
        )}
      </div>

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

      {showWalletOverview && (
        <>
          <DismissibleNoticePanel
            storageKey="nairascout_wallet_ledger_notice_v1"
            title="Referral Earnings Wallet & Ledger"
            description="Internal accounting derived strictly from the immutable financial ledger. Separate from Seller proceeds. Paid and Reversed figures are cumulative historical states."
            ariaLabel="Referral Earnings Wallet & Ledger Notice"
          />

          {/* Hero Wallet Card (Deep Forest Olive) */}
          <WalletHeroCard
            availableKobo={withdrawableNowKobo}
            pendingKobo={wallet.pendingKobo}
            paidKobo={wallet.paidKobo}
            nextPayoutDate={wallet.nextPayoutDate}
          />

          {/* Five Distinct Wallet States (Stacked Vertically on dedicated /wallet page per NS-UI-319) */}
          <section
            className={
              viewMode === 'wallet'
                ? 'grid grid-cols-1 gap-3'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3'
            }
          >
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="mt-2 font-numeric text-xl font-bold text-[#5C7C5D] dark:text-[#6E9470] tabular-nums">
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

            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs text-muted-foreground">Paid (Cumulative)</p>
              <p className="mt-2 font-numeric text-xl font-semibold text-foreground tabular-nums">
                {formatKoboToNaira(wallet.paidKobo)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Settled to bank account</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs text-muted-foreground">Reversed (Cumulative)</p>
              <p className="mt-2 font-numeric text-xl font-semibold text-destructive tabular-nums">
                {formatKoboToNaira(wallet.reversedKobo)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Refunds &amp; cancellations</p>
            </div>
          </section>

          {/* Monthly Payout Policy, KYC Readiness & Withdrawal Request */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className="w-4 h-4 text-[#5C7C5D] dark:text-[#6E9470]"
                    aria-hidden="true"
                  />
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
                          ? 'text-[#5C7C5D] dark:text-[#6E9470]'
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
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/settings?tab=verification"
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary text-secondary-foreground border border-border hover:bg-muted"
                  >
                    Manage Bank &amp; KYC
                  </Link>
                  <Link
                    href="/programme-rules?policy=payout-policy"
                    className="text-xs font-semibold text-foreground hover:underline"
                  >
                    Payout Policy →
                  </Link>
                </div>
              </div>

              <form
                onSubmit={handleRequestWithdrawal}
                className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 space-y-3"
              >
                <div>
                  <p className="text-xs text-muted-foreground">Eligible for Monthly Payout</p>
                  <p className="font-numeric text-xl font-bold text-foreground tabular-nums mt-0.5">
                    {formatKoboToNaira(withdrawableNowKobo)}
                  </p>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      wallet.eligibleForNextPayout
                        ? 'text-[#5C7C5D] dark:text-[#6E9470]'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {wallet.eligibleForNextPayout
                      ? 'Minimum ₦5,000 threshold satisfied'
                      : 'Requires KYC, verified bank & ₦5,000 minimum'}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="wallet-withdrawal-amount"
                    className="block text-[11px] font-medium text-muted-foreground mb-1"
                  >
                    Withdrawal Amount (₦ · Leave blank for full Available balance)
                  </label>
                  <input
                    id="wallet-withdrawal-amount"
                    type="number"
                    min={5000}
                    step={100}
                    value={withdrawAmountNaira}
                    onChange={(e) => setWithdrawAmountNaira(e.target.value)}
                    placeholder={`e.g. ${Math.max(5000, Math.floor(withdrawableNowKobo / 100))}`}
                    className="w-full px-3.5 py-2 font-numeric text-sm bg-background text-foreground border border-input rounded-xl tabular-nums"
                  />
                </div>

                {withdrawFeedback && (
                  <p
                    role="status"
                    className={`text-xs font-medium ${
                      withdrawFeedback.type === 'ok'
                        ? 'text-[#5C7C5D] dark:text-[#6E9470]'
                        : 'text-destructive'
                    }`}
                  >
                    {withdrawFeedback.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={withdrawBusy || !canQueueWithdrawal}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#2E5339] text-[#FFFFFF] dark:bg-[#3A6B49] hover:opacity-90 disabled:opacity-45 cursor-pointer"
                >
                  {withdrawBusy ? 'Queuing Request...' : 'Request Monthly Payout'}
                </button>
              </form>
            </div>
          </section>

          {/* NS-FND-001 & NS-FND-002: Platform Accounting Boundary & Earnings Disclosure */}
          <section className="bg-card border border-border rounded-2xl p-5 space-y-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Platform Accounting Boundary</p>
            <p className="leading-relaxed">{NAIRASCOUT_ACCOUNTING_BOUNDARY}</p>
            <p className="leading-relaxed pt-1 border-t border-border/60">
              {NAIRASCOUT_EARNINGS_DISCLAIMER}
            </p>
          </section>
        </>
      )}

      {showLedger && (
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-sans text-xl font-bold text-foreground">
                Immutable Financial Ledger
              </h2>
              <p className="text-xs text-muted-foreground">
                Append-only ledger entries. Delivery releases and refund reversals create linked
                references.
              </p>
            </div>

            {/* NS-UI-020 & NS-UI-021 Sliding Filter Pills */}
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-w-full">
              <div className="flex items-center gap-1.5 p-1 bg-[#F7F5F0] dark:bg-[#222925] border border-border rounded-xl w-max">
                {LEDGER_STATUS_FILTERS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st);
                      resetLedgerFilters();
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors border ${
                      statusFilter === st
                        ? 'bg-[#2E5339] text-[#FFFFFF] border-[#2E5339] dark:bg-[#3A6B49] dark:text-[#FFFFFF] dark:border-[#3A6B49] font-semibold shadow-sm'
                        : 'bg-card text-foreground border-border font-medium hover:opacity-90'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {viewMode === 'ledger' && (
            <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="ledger-filter-from"
                  className="block text-[11px] font-medium text-muted-foreground mb-1"
                >
                  From Date (Africa/Lagos)
                </label>
                <input
                  id="ledger-filter-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    resetLedgerFilters();
                  }}
                  className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div>
                <label
                  htmlFor="ledger-filter-to"
                  className="block text-[11px] font-medium text-muted-foreground mb-1"
                >
                  To Date (Africa/Lagos)
                </label>
                <input
                  id="ledger-filter-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    resetLedgerFilters();
                  }}
                  className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div>
                <label
                  htmlFor="ledger-filter-product"
                  className="block text-[11px] font-medium text-muted-foreground mb-1"
                >
                  Product, Order ID, or Reference
                </label>
                <input
                  id="ledger-filter-product"
                  type="search"
                  value={productFilter}
                  onChange={(e) => {
                    setProductFilter(e.target.value);
                    resetLedgerFilters();
                  }}
                  placeholder="Search product or order..."
                  className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                />
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-x-auto">
            {viewMode === 'ledger' && ledgerLoading ? (
              <div className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Loading ledger entries...
              </div>
            ) : ledgerRows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No ledger entries match the selected filter.
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Reference</th>
                    <th className="py-3 px-4 font-medium">Order / Event</th>
                    <th className="py-3 px-4 font-medium">Tier</th>
                    <th className="py-3 px-4 font-medium">Status &amp; Notes</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledgerRows.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/40">
                      <td className="py-3 px-4 font-numeric text-xs text-foreground whitespace-nowrap">
                        {entry.reference}
                        {entry.linkedToReference && (
                          <p className="text-[11px] text-muted-foreground">
                            Linked: {entry.linkedToReference}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {entry.createdAt.slice(0, 10)}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-numeric text-xs text-muted-foreground whitespace-nowrap">
                        <p className="text-foreground font-medium">{entry.orderId}</p>
                        {'productTitle' in entry && Boolean(entry.productTitle) && (
                          <p className="font-sans text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {String(entry.productTitle)}
                          </p>
                        )}
                        {entry.referralEventId && <p>{entry.referralEventId.slice(0, 8)}…</p>}
                      </td>
                      <td className="py-3 px-4 font-numeric text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        Gen {entry.generation} ({entry.fractionLabel})
                      </td>
                      <td className="py-3 px-4 text-xs max-w-xs">
                        <StatusLabel status={entry.status} />
                        <p className="mt-1 text-muted-foreground">{entry.description}</p>
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

          {viewMode === 'ledger' && paginatedLedger && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="font-numeric tabular-nums">
                Showing {ledgerRows.length} entries (20 per page · {paginatedLedger.totalCount} total
                matching)
              </span>
              <div className="flex items-center gap-2">
                {cursorHistory.length > 0 && (
                  <button
                    type="button"
                    disabled={ledgerFetching}
                    onClick={() => {
                      const prev = [...cursorHistory];
                      const lastCursor = prev.pop() ?? null;
                      setCursorHistory(prev);
                      setCursor(lastCursor);
                    }}
                    className="px-3.5 py-2 font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
                  >
                    ← Previous 20
                  </button>
                )}
                {paginatedLedger.hasMore && paginatedLedger.nextCursor && (
                  <button
                    type="button"
                    disabled={ledgerFetching}
                    onClick={() => {
                      setCursorHistory((prev) => [...prev, cursor]);
                      setCursor(paginatedLedger.nextCursor);
                    }}
                    className="px-3.5 py-2 font-semibold rounded-xl bg-[#2E5339] text-[#FFFFFF] dark:bg-[#3A6B49] hover:opacity-90 cursor-pointer disabled:opacity-50"
                  >
                    Next 20 →
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
