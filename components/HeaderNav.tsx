'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, LogIn, LogOut, Settings, Shield } from 'lucide-react';
import type { ActiveScoutDTO } from '@/lib/nairascout-store';

export type NavTab = 'marketplace' | 'referrals' | 'network' | 'wallet' | 'seller';

interface HeaderNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenGuide: () => void;
  inboxCount: number;
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
  onLogout: () => Promise<void>;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'network', label: 'Network' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'seller', label: 'Seller Hub' },
];

export default function HeaderNav({
  activeTab,
  onSelectTab,
  onOpenGuide,
  inboxCount,
  authenticated,
  activeScout,
  onLogout,
}: HeaderNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#FAFAF8]/95 backdrop-blur-sm border-b border-[#E4E4DE]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('marketplace')}
          className="font-display text-xl font-bold tracking-tight text-[#111814] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B6E4F]"
        >
          NairaScout
        </button>

        {/* Zone 2: Clean single-line typography nav links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const suffix = item.id === 'referrals' && inboxCount > 0 ? ` (${inboxCount})` : '';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B6E4F] ${
                  isActive
                    ? 'text-[#0B6E4F] font-semibold'
                    : 'text-[#4F5A52] hover:text-[#111814]'
                }`}
              >
                {item.label}
                {suffix}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0B6E4F]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action (Authenticated Account Menu or Sign In) */}
        <div className="relative shrink-0">
          {authenticated && activeScout ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6E4F]"
              >
                <span>@{activeScout.handle}</span>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E4E4DE] rounded-xl shadow-sm py-1.5 z-50">
                  <div className="px-3.5 py-2 border-b border-[#ECECE6]">
                    <p className="text-xs font-semibold text-[#111814] truncate">
                      {activeScout.displayName}
                    </p>
                    <p className="text-[11px] text-[#5C665E] truncate">{activeScout.email}</p>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#111814] hover:bg-[#F5F5F0]"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#5C665E]" aria-hidden="true" />
                    Account Settings
                  </Link>

                  {activeScout.adminRole && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#111814] hover:bg-[#F5F5F0]"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#0B6E4F]" aria-hidden="true" />
                      Admin Console
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenGuide();
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-[#111814] hover:bg-[#F5F5F0] text-left cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#5C665E]" aria-hidden="true" />
                    Trust &amp; Guide
                  </button>

                  <div className="border-t border-[#ECECE6] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        await onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-[#B91C1C] hover:bg-[#FEF2F2] text-left cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden flex items-center gap-4 px-4 pb-2.5 overflow-x-auto text-xs font-medium border-t border-[#ECECE6]"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`pt-2 pb-1 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-[#0B6E4F] text-[#0B6E4F] font-semibold'
                  : 'border-transparent text-[#556158]'
              }`}
            >
              {item.label}
              {item.id === 'referrals' && inboxCount > 0 ? ` (${inboxCount})` : ''}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
