'use client';

import { Wallet } from 'lucide-react';
import { formatKoboToNaira } from '@/lib/commission-engine';

interface WalletHeroCardProps {
  availableKobo: number;
  pendingKobo: number;
  paidKobo: number;
  nextPayoutDate: string;
}

export function WalletHeroCard({
  availableKobo,
  pendingKobo,
  paidKobo,
  nextPayoutDate,
}: WalletHeroCardProps) {
  return (
    <section
      aria-label="Available Wallet Summary"
      className="bg-[#292D2F] border border-primary-border text-white rounded-2xl p-5 sm:p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-sans text-xs font-medium text-white/75">Available Balance</p>
          <p className="mt-1.5 font-numeric text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-white">
            {formatKoboToNaira(availableKobo)}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-4 font-numeric text-xs tabular-nums text-white/85">
        <div className="flex flex-wrap items-center gap-6">
          <span>
            Pending: <strong>{formatKoboToNaira(pendingKobo)}</strong>
          </span>
          <span>
            Total Withdrawn: <strong>{formatKoboToNaira(paidKobo)}</strong>
          </span>
        </div>
        <span>Next Payout: {nextPayoutDate}</span>
      </div>
    </section>
  );
}
