'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Bell,
  Compass,
  RefreshCw,
  Send,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import type { ActiveScoutDTO, ScoutOverviewStatsDTO } from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import type { StatsPeriodPreset } from '@/lib/utils/africa-lagos';
import type { NavTab } from '@/components/HeaderNav';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { RestrictionNoticeBanner } from '@/components/shared/RestrictionNoticeBanner';

interface ScoutOverviewDashboardProps {
  activeScout: ActiveScoutDTO;
  unreadNotificationsCount: number;
  onNavigateTab: (tab: NavTab) => void;
  onOpenScoutsList: () => void;
  onOpenActivityFeed: () => void;
}

const PERIOD_OPTIONS: { id: StatsPeriodPreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'previous_month', label: 'Previous Month' },
  { id: 'custom', label: 'Custom' },
];

function getLagosGreeting(): string {
  try {
    const hourStr = new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hour = Number(hourStr);
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  } catch {
    return 'Welcome back';
  }
}

// NS-SCT-019 - NS-SCT-026 & NS-SCT-054 - NS-SCT-064: 6-Section Scout Overview & Referral Statistics (5-min TanStack Query cache)
export function ScoutOverviewDashboard({
  activeScout,
  unreadNotificationsCount,
  onNavigateTab,
  onOpenScoutsList,
  onOpenActivityFeed,
}: ScoutOverviewDashboardProps) {
  const [period, setPeriod] = useState<StatsPeriodPreset>('last_30_days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data, isLoading, isFetching, error, refetch } = useQuery<ScoutOverviewStatsDTO>({
    queryKey: ['scout-stats', activeScout.id, period, customFrom, customTo],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        if (customFrom) params.set('from', customFrom);
        if (customTo) params.set('to', customTo);
      }
      const res = await fetch(`/api/scout/stats?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || 'Could not load Scout overview.');
      }
      return res.json();
    },
  });

  const greeting = getLagosGreeting();

  return (
    <div className="space-y-6">
      <RestrictionNoticeBanner activeScout={activeScout} />

      {/* 1. Header Section */}
      <section className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <UserAvatar
            avatarUrl={activeScout.avatarUrl}
            displayName={activeScout.displayName}
            username={activeScout.handle}
            size="lg"
            shape="rounded-square"
          />
          <div className="min-w-0 space-y-1">
            <h2 className="font-sans text-lg sm:text-xl font-bold text-foreground truncate">
              {greeting}, {activeScout.displayName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>@{activeScout.handle}</span>
              <span>·</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold ${
                  activeScout.accountStatus === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'bg-destructive/15 text-destructive'
                }`}
              >
                {activeScout.accountStatus === 'ACTIVE'
                  ? 'Account Active'
                  : activeScout.accountStatus === 'SUSPENDED'
                    ? 'Account suspended'
                    : activeScout.accountStatus === 'RESTRICTED'
                      ? 'Account limited'
                      : activeScout.accountStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/notifications"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-background text-foreground hover:bg-muted transition-colors"
          >
            <Bell className="w-3.5 h-3.5" aria-hidden="true" />
            Notifications
            {unreadNotificationsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-numeric text-[10px] font-bold tabular-nums">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </section>

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          {(error as Error).message}
        </div>
      )}

      {/* 2. Wallet Summary Card & 4. Commission Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-sans text-base font-bold text-foreground">Wallet Summary</h3>
              <p className="text-xs text-muted-foreground">
                Authoritative ledger balances · Last updated{' '}
                <span className="font-numeric">
                  {data?.computedAtLagos || 'Loading...'}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('wallet')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline cursor-pointer"
            >
              Open Wallet
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-background p-3.5">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="mt-1 font-numeric text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {data ? formatKoboToNaira(data.wallet.pendingKobo) : '₦—'}
              </p>
              <p className="text-[11px] text-muted-foreground">Pending fulfilment</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3.5">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="mt-1 font-numeric text-lg font-bold text-success tabular-nums">
                {data ? formatKoboToNaira(data.wallet.withdrawableNowKobo) : '₦—'}
              </p>
              <p className="text-[11px] text-muted-foreground">Ready for 15th payout</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3.5">
              <p className="text-xs text-muted-foreground">Withdrawn (Cumulative)</p>
              <p className="mt-1 font-numeric text-lg font-bold text-foreground tabular-nums">
                {data ? formatKoboToNaira(data.wallet.paidKobo) : '₦—'}
              </p>
              <p className="text-[11px] text-muted-foreground">Settled to bank</p>
            </div>
          </div>

          {/* Progress toward ₦5,000 minimum withdrawal threshold */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Progress toward ₦5,000 minimum withdrawal threshold
              </span>
              <span className="font-numeric font-semibold text-foreground tabular-nums">
                {data ? `${data.wallet.thresholdProgressPct}%` : '0%'}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${data?.wallet.thresholdProgressPct ?? 0}%` }}
              />
            </div>
          </div>
        </section>

        {/* 4. Commission Summary */}
        <section className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-sans text-base font-bold text-foreground">Commission Summary</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('wallet')}
              className="text-xs font-semibold text-foreground hover:underline cursor-pointer"
            >
              Full History →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Pending Commissions</p>
              <p className="mt-1 font-numeric text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {data ? formatKoboToNaira(data.commissions.pendingKobo) : '₦—'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Available Commissions</p>
              <p className="mt-1 font-numeric text-base font-bold text-success tabular-nums">
                {data ? formatKoboToNaira(data.commissions.availableKobo) : '₦—'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-border">
            {isLoading ? (
              <p className="py-4 text-xs text-muted-foreground">Loading recent commissions...</p>
            ) : !data || data.commissions.recentItems.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">
                No commission entries recorded yet.
              </p>
            ) : (
              data.commissions.recentItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{item.productTitle}</p>
                    <p className="text-muted-foreground font-numeric">
                      Gen {item.generation} · {item.createdAtLagos}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-numeric font-bold text-foreground tabular-nums">
                      {formatKoboToNaira(item.amountKobo)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{item.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 3. Referral Performance Summary */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-sans text-base font-bold text-foreground">
              Referral Performance Summary
            </h3>
            <p className="text-xs text-muted-foreground">
              Event-based attribution metrics in Africa/Lagos (WAT)
              {data ? ` · ${data.startDate} to ${data.endDate}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] dark:bg-[#101010] rounded-xl overflow-x-auto">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                  period === opt.id
                    ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-sm'
                    : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium hover:opacity-90'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div>
              <label
                htmlFor="stats-custom-from"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                From (Africa/Lagos)
              </label>
              <input
                id="stats-custom-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>
            <div>
              <label
                htmlFor="stats-custom-to"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                To (Africa/Lagos)
              </label>
              <input
                id="stats-custom-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">Referrals Sent</p>
            <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
              {data ? data.referrals.sentCount : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Distinct events created</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">Delivered</p>
            <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
              {data ? data.referrals.deliveredCount : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Delivered to recipients</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">Opened · Open Rate</p>
            <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
              {data ? `${data.referrals.openedCount}` : '—'}{' '}
              <span className="text-sm font-semibold text-muted-foreground">
                ({data ? `${data.referrals.openRatePct}%` : '—'})
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Deduplicated per event</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">Attributed Purchases</p>
            <p className="mt-1 font-numeric text-2xl font-bold text-success tabular-nums">
              {data ? data.referrals.attributedPurchasesCount : '—'}{' '}
              <span className="text-sm font-semibold text-muted-foreground">
                ({data ? `${data.referrals.conversionRatePct}%` : '—'})
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Completed, non-refunded</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">Eligible Sales Value</p>
            <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
              {data ? formatKoboToNaira(data.referrals.eligibleSalesKobo) : '₦—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Net of refunds</p>
          </div>
        </div>
      </section>

      {/* 5. Recent Activity Preview & 6. Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-sans text-base font-bold text-foreground">Recent Activity</h3>
            <button
              type="button"
              onClick={onOpenActivityFeed}
              className="text-xs font-semibold text-foreground hover:underline cursor-pointer"
            >
              View All Activity →
            </button>
          </div>

          {!data || data.recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              No activity events recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.recentActivity.slice(0, 5).map((ev) => (
                <div
                  key={ev.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-secondary text-secondary-foreground">
                        {ev.category}
                      </span>
                      <p className="text-xs font-semibold text-foreground truncate">{ev.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ev.summary}</p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    {typeof ev.amountKobo === 'number' && (
                      <p className="font-numeric text-xs font-bold text-foreground tabular-nums">
                        {formatKoboToNaira(ev.amountKobo)}
                      </p>
                    )}
                    <p className="font-numeric text-[11px] text-muted-foreground">
                      {ev.lagosDateLabel} · {ev.lagosTimeLabel}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6. Quick Actions */}
        <section className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 self-start">
          <h3 className="font-sans text-base font-bold text-foreground">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab('marketplace')}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted text-left cursor-pointer"
            >
              <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
              Find Products
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('referrals')}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-primary text-primary-foreground border border-primary-border text-xs font-semibold hover:bg-primary/90 text-left cursor-pointer"
            >
              <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
              Refer a Product
            </button>
            <button
              type="button"
              onClick={onOpenScoutsList}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted text-left cursor-pointer"
            >
              <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
              Scouts List
            </button>
            <button
              type="button"
              onClick={onOpenActivityFeed}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted text-left cursor-pointer"
            >
              <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
              Referral Activity
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('wallet')}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted text-left cursor-pointer"
            >
              <Wallet className="w-4 h-4 shrink-0" aria-hidden="true" />
              Wallet
            </button>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted text-left"
            >
              <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
              Manage Profile
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
