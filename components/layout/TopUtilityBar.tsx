'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  BookOpen,
  ChevronDown,
  LogIn,
  LogOut,
  Search,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import type { ActiveScoutDTO, PlatformNotification } from '@/lib/nairascout-store';
import { ThemeToggle } from './ThemeToggle';

interface TopUtilityBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onSelectHome: () => void;
  onOpenGuide: () => void;
  notifications: PlatformNotification[];
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
  onLogout: () => Promise<void>;
}

export function TopUtilityBar({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSelectHome,
  onOpenGuide,
  notifications,
  authenticated,
  activeScout,
  onLogout,
}: TopUtilityBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-5">
        {/* Mobile Brand Wordmark */}
        <button
          type="button"
          onClick={onSelectHome}
          className="md:hidden shrink-0 cursor-pointer"
        >
          <span className="font-brand font-extrabold text-xl tracking-tight text-foreground">
            NairaScout
          </span>
        </button>

        {/* Search Input (Desktop & Tablet) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          className="hidden sm:block flex-1 max-w-md relative"
        >
          <Search
            className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search products, categories, or verified sellers..."
            aria-label="Search products, categories, or verified sellers"
            className="w-full h-10 pl-10 pr-8 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Right Utility Cluster */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <ThemeToggle />

          {/* Notifications Bell wired to PostgreSQL notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNoticesOpen((prev) => !prev);
                setMenuOpen(false);
              }}
              aria-label={`Notifications (${notifications.length})`}
              aria-expanded={noticesOpen}
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {notifications.length > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-success"
                />
              )}
            </button>

            {noticesOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-3 z-50 space-y-2">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-border">
                  <span className="font-sans text-xs font-bold text-foreground">
                    Notices ({notifications.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNoticesOpen(false);
                      onOpenGuide();
                    }}
                    className="text-[11px] font-semibold text-foreground hover:underline cursor-pointer"
                  >
                    Open Trust &amp; Guide
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No active notifications.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border">
                    {notifications.slice(0, 5).map((n) => (
                      <div key={n.id} className="py-2.5 px-1 space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-sans uppercase font-semibold">{n.category}</span>
                          <span className="font-numeric tabular-nums">{n.createdAt.slice(0, 10)}</span>
                        </div>
                        <p className="text-xs font-semibold text-foreground">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Profile / Sign In Menu */}
          <div className="relative">
            {authenticated && activeScout ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((prev) => !prev);
                    setNoticesOpen(false);
                  }}
                  aria-expanded={menuOpen}
                  className="inline-flex items-center gap-1.5 h-10 px-3 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span className="font-sans">@{activeScout.handle}</span>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg py-1.5 z-50">
                    <div className="px-3.5 py-2 border-b border-border">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {activeScout.displayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {activeScout.email}
                      </p>
                    </div>

                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-foreground hover:bg-muted"
                    >
                      <Settings className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                      Account Settings
                    </Link>

                    {activeScout.adminRole && (
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs text-foreground font-semibold hover:bg-muted"
                      >
                        <Shield className="w-3.5 h-3.5 text-success" aria-hidden="true" />
                        Admin Console
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenGuide();
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-foreground hover:bg-muted text-left cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                      Trust &amp; Guide
                    </button>

                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          setMenuOpen(false);
                          await onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-destructive hover:bg-destructive/10 text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 h-10 px-3.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
