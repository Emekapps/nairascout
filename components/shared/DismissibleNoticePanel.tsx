'use client';

import { useSyncExternalStore } from 'react';
import { Info } from 'lucide-react';

interface DismissibleNoticePanelProps {
  storageKey: string;
  title?: string;
  description: string;
  ariaLabel: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NOTICE_EVENT = 'nairascout-notice-change';

function subscribeNotice(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(NOTICE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(NOTICE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

function readNoticeVisibility(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { status?: string; dismissUntil?: number };
    if (parsed.status === 'dismissed_permanent') {
      return false;
    }
    if (parsed.status === 'dismissed_temp') {
      return typeof parsed.dismissUntil === 'number' && Date.now() >= parsed.dismissUntil;
    }
    return true;
  } catch {
    return true;
  }
}

export function DismissibleNoticePanel({
  storageKey,
  title,
  description,
  ariaLabel,
}: DismissibleNoticePanelProps) {
  const visible = useSyncExternalStore(
    subscribeNotice,
    () => readNoticeVisibility(storageKey),
    () => false
  );

  const handleDismiss30Days = () => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ status: 'dismissed_temp', dismissUntil: Date.now() + THIRTY_DAYS_MS })
      );
    } catch {
      // Ignore storage quota errors
    }
    window.dispatchEvent(new Event(NOTICE_EVENT));
  };

  const handleDismissPermanent = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ status: 'dismissed_permanent' }));
    } catch {
      // Ignore storage quota errors
    }
    window.dispatchEvent(new Event(NOTICE_EVENT));
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-muted p-2 text-foreground shrink-0">
          <Info className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1">
          {title && (
            <h2 className="font-sans text-sm font-bold text-foreground">
              {title}
            </h2>
          )}
          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleDismiss30Days}
              className="rounded-lg bg-primary px-3 py-1.5 font-sans text-xs font-semibold text-primary-foreground border border-primary-border hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleDismissPermanent}
              className="rounded-lg border border-border bg-secondary px-3 py-1.5 font-sans text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              Don’t show this again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
