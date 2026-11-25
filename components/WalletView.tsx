'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { LedgerEntryStatus, NairaScoutSnapshot } from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import {
  NAIRASCOUT_ACCOUNTING_BOUNDARY,
  NAIRASCOUT_EARNINGS_DISCLAIMER,
} from '@/lib/constants/foundation-content';
import { WalletHeroCard } from './wallet/WalletHeroCard';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';

interface WalletViewProps {
  snapshot: NairaScoutSnapshot;
}

function StatusLabel({ status }: { status: LedgerEntryStatus }) {
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

export default function WalletView({ snapshot }: WalletViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLedger = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshot.ledgerEntries.filter((entry) => {
      const statusOk = statusFilter === 'All' || entry.status === statusFilter;
      const textOk =
        !q ||
        entry.reference.toLowerCase().includes(q) ||
        entry.orderId.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q);
      return statusOk && textOk;
    });
  }, [snapshot.ledgerEntries, statusFilter, searchQuery]);

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

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-5">
        <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
          Wallet
        </h1>
      </div>

      <DismissibleNoticePanel
        storageKey="nairascout_wallet_ledger_notice_v1"
        title="Referral Earnings Wallet & Ledger"
        description="Internal accounting derived strictly from the immutable financial ledger. Separate from Seller proceeds. Paid and Reversed figures are cumulative historical states."
        ariaLabel="Referral Earnings Wallet & Ledger Notice"
      />

      {/* Hero Wallet Card (Charcoal Black #292D2F) */}
      <WalletHeroCard
        availableKobo={wallet.availableKobo}
        pendingKobo={wallet.pendingKobo}
        paidKobo={wallet.paidKobo}
        nextPayoutDate={wallet.nextPayoutDate}
      />

      {/* Five Distinct Wallet States */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="mt-2 font-numeric text-xl font-bold text-success tabular-nums">
            {formatKoboToNaira(wallet.availableKobo)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Passed fulfilment &amp; checks</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Pending Commission</p>
          <p className="mt-2 font-numeric text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatKoboToNaira(wallet.pendingKobo)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Pending settlement · Not withdrawable</p>
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

      {/* Monthly Payout Policy & KYC Readiness */}
      <section className="bg-card border border-border rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
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
            same-name Nigerian bank account is confirmed.
          </p>
          <div className="pt-2 flex flex-wrap gap-6 text-xs text-muted-foreground">
            <span>
              KYC Identity:{' '}
              <strong
                className={
                  activeScout.kycVerified ? 'text-success' : 'text-amber-600 dark:text-amber-400'
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

        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 space-y-1.5">
          <p className="text-xs text-muted-foreground">Preceding-Month Eligible Available</p>
          <p className="font-numeric text-xl font-bold text-foreground tabular-nums">
            {formatKoboToNaira(wallet.precedingMonthAvailableKobo)}
          </p>
          <p className={`text-xs font-medium ${wallet.eligibleForNextPayout ? 'text-success' : 'text-muted-foreground'}`}>
            {wallet.eligibleForNextPayout
              ? 'Minimum ₦5,000 threshold satisfied'
              : 'Requires KYC, verified bank & ₦5,000 minimum'}
          </p>
          <Link
            href="/programme-rules?policy=payout-policy"
            className="inline-block pt-1 text-xs font-semibold text-foreground hover:underline"
          >
            Read Payout Policy →
          </Link>
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

      {/* Immutable Ledger Table */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-sans text-xl font-bold text-foreground">
              Ledger
            </h2>
            <p className="text-xs text-muted-foreground">
              Entries are append-only; delivery releases and refund reversals create new linked
              references.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ref or order ID..."
                aria-label="Search ledger entries"
                className="pl-9 pr-3 py-2 text-xs bg-card text-foreground border border-border rounded-xl w-52 focus:outline-none focus:border-ring"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] dark:bg-[#181818] rounded-xl overflow-x-auto">
              {['All', 'Available', 'Pending', 'On Hold', 'Paid', 'Reversed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
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
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          {filteredLedger.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No ledger entries match the selected filter.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Ledger Reference</th>
                  <th className="py-3 px-4 font-medium">Order / Event</th>
                  <th className="py-3 px-4 font-medium">Gen · Fraction</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLedger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/40">
                    <td className="py-3 px-4 font-numeric text-xs text-foreground whitespace-nowrap">
                      {entry.reference}
                    </td>
                    <td className="py-3 px-4 font-numeric text-xs text-muted-foreground whitespace-nowrap">
                      {entry.orderId}
                      {entry.referralEventId ? ` · ${entry.referralEventId}` : ''}
                    </td>
                    <td className="py-3 px-4 font-numeric text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      Gen {entry.generation} ({entry.fractionLabel})
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground/90 max-w-md">
                      {entry.description}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusLabel status={entry.status} />
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
      </section>
    </div>
  );
}
