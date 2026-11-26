'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { ScoutActivityCategory, ScoutActivityItemDTO } from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';

interface ScoutActivityFeedProps {
  userId: string;
}

const ACTIVITY_CATEGORIES: Array<'All' | ScoutActivityCategory> = [
  'All',
  'Account',
  'Scouts List',
  'Product Referrals',
  'Purchases',
  'Commissions',
  'Wallet',
  'Notifications',
  'Restrictions',
];

interface ActivityApiResponse {
  items: ScoutActivityItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// NS-SCT-035 - NS-SCT-044: Chronological 8-category Scout Activity Feed grouped by Africa/Lagos date
export function ScoutActivityFeed({ userId }: ScoutActivityFeedProps) {
  const [category, setCategory] = useState<'All' | ScoutActivityCategory>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, error, refetch } = useQuery<ActivityApiResponse>({
    queryKey: ['scout-activity', userId, category, fromDate, toDate, page],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
      });
      if (category !== 'All') params.set('category', category);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/scout/activity?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || 'Failed to load activity feed.');
      }
      return res.json();
    },
  });

  const groupedByDate = useMemo(() => {
    const groups: Array<{ dateKey: string; dateLabel: string; items: ScoutActivityItemDTO[] }> = [];
    const indexByDate = new Map<string, number>();

    for (const item of data?.items ?? []) {
      const existingIdx = indexByDate.get(item.lagosDateKey);
      if (existingIdx !== undefined) {
        groups[existingIdx]!.items.push(item);
      } else {
        indexByDate.set(item.lagosDateKey, groups.length);
        groups.push({
          dateKey: item.lagosDateKey,
          dateLabel: item.lagosDateLabel,
          items: [item],
        });
      }
    }
    return groups;
  }, [data?.items]);

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-sans text-lg font-bold text-foreground">
              Scout Activity Feed
            </h2>
            <p className="text-xs text-muted-foreground">
              Chronological record across all 8 Scout account categories (Africa/Lagos time).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 text-xs font-medium rounded-xl border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] dark:bg-[#101010] rounded-xl overflow-x-auto">
          {ACTIVITY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                category === cat
                  ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-sm'
                  : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium hover:opacity-90'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Date Range Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div>
            <label
              htmlFor="activity-from-date"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              From Date
            </label>
            <input
              id="activity-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
            />
          </div>
          <div>
            <label
              htmlFor="activity-to-date"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              To Date
            </label>
            <input
              id="activity-to-date"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
            />
          </div>
          {(fromDate || toDate || category !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setCategory('All');
                setFromDate('');
                setToDate('');
                setPage(1);
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-background text-foreground hover:bg-muted cursor-pointer justify-self-start"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Loading chronological activity...
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No activity records match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <section
              key={group.dateKey}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2 text-xs font-semibold text-foreground">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                <span>{group.dateLabel}</span>
              </div>
              <div className="divide-y divide-border">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-secondary text-secondary-foreground">
                          {item.category}
                        </span>
                        {item.statusBadge && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-border text-muted-foreground">
                            {item.statusBadge}
                          </span>
                        )}
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.summary}
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0 space-y-0.5">
                      {typeof item.amountKobo === 'number' && (
                        <p className="font-numeric text-sm font-bold text-foreground tabular-nums">
                          {formatKoboToNaira(item.amountKobo)}
                        </p>
                      )}
                      <p className="font-numeric text-[11px] text-muted-foreground">
                        {item.lagosTimeLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-2xl px-4 py-3 text-xs">
          <span className="text-muted-foreground font-numeric">
            Page {data.page} · Showing {data.items.length} of {data.total} events
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              disabled={!data.hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
