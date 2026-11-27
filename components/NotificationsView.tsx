'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronRight,
  Lock,
} from 'lucide-react';
import type { NairaScoutSnapshot, PlatformNotification } from '@/lib/nairascout-store';
import { ThemeToggle } from './layout/ThemeToggle';
import { VerifiedSellerFab } from './seller/VerifiedSellerFab';

interface NotificationsViewProps {
  initialSnapshot: NairaScoutSnapshot;
}

export default function NotificationsView({ initialSnapshot }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<PlatformNotification[]>(
    initialSnapshot.notifications ?? []
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !(n.isRead ?? n.read)).length,
    [notifications]
  );

  const handleOpenNotification = async (notice: PlatformNotification) => {
    setExpandedId((prev) => (prev === notice.id ? null : notice.id));

    const alreadyRead = Boolean(notice.isRead ?? notice.read);
    if (alreadyRead) return;

    // Optimistically clear green unread badge immediately
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notice.id
          ? { ...item, isRead: true, read: true, readAt: nowIso }
          : item
      )
    );

    setBusyId(notice.id);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ notificationId: notice.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, isRead: true, read: true, readAt: item.readAt ?? nowIso }))
    );

    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      }
    } finally {
      setMarkingAll(false);
    }
  };

  if (!initialSnapshot.authenticated || !initialSnapshot.activeScout) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-foreground mx-auto" aria-hidden="true" />
          <h1 className="font-sans text-2xl font-bold text-foreground">
            Sign In to View Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            Account notices, order updates, verification outcomes, and Seller alerts appear here
            once signed in.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-foreground border border-border rounded-xl"
            >
              Back to Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Feed
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground">
              <Bell className="w-4 h-4" aria-hidden="true" />
              {unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread notifications`}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white font-numeric text-[10px] font-bold tabular-nums flex items-center justify-center"
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white font-numeric text-xs font-semibold tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" />
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Tap any notification to open details and mark it as read.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              disabled={markingAll}
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground self-start sm:self-auto cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#5C7C5D] dark:text-[#6E9470]" aria-hidden="true" />
              {markingAll ? 'Marking all...' : 'Mark all as read'}
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-2">
            <Bell className="w-7 h-7 text-muted-foreground mx-auto" aria-hidden="true" />
            <p className="font-sans text-base font-semibold text-foreground">
              You are all caught up
            </p>
            <p className="text-xs text-muted-foreground">
              Order updates, verification decisions, and account alerts will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notice) => {
              const isUnread = !(notice.isRead ?? notice.read);
              const isExpanded = expandedId === notice.id;
              const safeActionUrl =
                notice.actionUrl && notice.actionUrl.startsWith('/') ? notice.actionUrl : null;

              return (
                <article
                  key={notice.id}
                  className={`rounded-2xl border transition-colors overflow-hidden ${
                    isUnread
                      ? 'bg-card border-[#5C7C5D]/50 dark:border-[#6E9470]/50 shadow-xs'
                      : 'bg-card border-border opacity-90'
                  }`}
                >
                  <button
                    type="button"
                    disabled={busyId === notice.id}
                    onClick={() => handleOpenNotification(notice)}
                    className="w-full text-left p-4 sm:p-5 space-y-2 cursor-pointer hover:bg-muted/35 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isUnread && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white text-[10px] font-bold uppercase tracking-wider shrink-0"
                            aria-label="Unread notification"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" />
                            New
                          </span>
                        )}
                        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {notice.category}
                        </span>
                      </div>

                      <span className="font-numeric text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {notice.createdAt.slice(0, 10)}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <h2 className="font-sans text-sm font-bold text-foreground">
                          {notice.title}
                        </h2>
                        <p
                          className={`text-xs text-muted-foreground leading-relaxed ${
                            isExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          {notice.body}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  {isExpanded && safeActionUrl && (
                    <div className="px-4 sm:px-5 pb-4 pt-1 flex items-center justify-end border-t border-border/60 bg-muted/20">
                      <Link
                        href={safeActionUrl}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline py-1"
                      >
                        Open related page
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      <VerifiedSellerFab
        authenticated={initialSnapshot.authenticated}
        activeScout={initialSnapshot.activeScout}
      />
    </div>
  );
}
