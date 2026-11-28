'use client';

// NS-UI-310 & NS-UI-314: Light Mode (Yellow Sun #EAB308) / Dark Mode (Silver Moon #CBD5E1) Theme Toggle
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
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="inline-flex items-center justify-center gap-2 min-h-[40px] min-w-[40px] px-2.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
    >
      {mounted ? (
        isDark ? (
          <Sun className="w-4 h-4 text-[#EAB308] fill-[#EAB308]/20" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4 text-[#CBD5E1] fill-[#CBD5E1]/25" aria-hidden="true" />
        )
      ) : (
        <Sun className="w-4 h-4 text-[#EAB308] fill-[#EAB308]/20" aria-hidden="true" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold whitespace-nowrap">
          {mounted ? (isDark ? 'Light Mode' : 'Dark Mode') : 'Theme'}
        </span>
      )}
    </button>
  );
}
