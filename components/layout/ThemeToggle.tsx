'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

const subscribe = () => () => {};

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Midnight Obsidian Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Midnight Obsidian Dark Mode'}
      className="inline-flex items-center justify-center gap-2 min-h-[40px] min-w-[40px] px-2.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
    >
      {mounted ? (
        isDark ? (
          <Sun className="w-4 h-4 text-yellow-400 fill-yellow-400/20" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4 text-[#C0C0C0] fill-slate-300/20" aria-hidden="true" />
        )
      ) : (
        <Sun className="w-4 h-4 text-yellow-400 fill-yellow-400/20" aria-hidden="true" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold whitespace-nowrap">
          {mounted ? (isDark ? 'Light Mode' : 'Midnight Dark') : 'Theme'}
        </span>
      )}
    </button>
  );
}
