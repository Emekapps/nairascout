'use client';

import Link from 'next/link';
import {
  BookOpen,
  Compass,
  HelpCircle,
  LogIn,
  Scale,
  Send,
  Settings,
  Shield,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import type { ActiveScoutDTO } from '@/lib/nairascout-store';
import type { NavTab } from '@/components/HeaderNav';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ThemeToggle } from './ThemeToggle';

interface DesktopSidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenGuide: () => void;
  inboxCount: number;
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
}

const SIDEBAR_TABS: {
  id: NavTab;
  label: string;
  icon: typeof Compass;
}[] = [
  { id: 'marketplace', label: 'Marketplace', icon: Compass },
  { id: 'referrals', label: 'Referrals', icon: Send },
  { id: 'network', label: 'Network', icon: Users },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'seller', label: 'Seller Hub', icon: Store },
];

export function DesktopSidebar({
  activeTab,
  onSelectTab,
  onOpenGuide,
  inboxCount,
  authenticated,
  activeScout,
}: DesktopSidebarProps) {

  return (
    <aside
      aria-label="Desktop Navigation"
      className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-40 bg-sidebar border-r border-sidebar-border"
    >
      {/* Top Brand Header */}
      <div className="h-16 px-5 flex items-center border-b border-sidebar-border shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('marketplace')}
          className="text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-ring rounded-lg"
        >
          <span className="font-brand font-extrabold text-xl tracking-tight text-foreground transition-colors">
            NairaScout
          </span>
        </button>
      </div>

      {/* Primary Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>

        {SIDEBAR_TABS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-sans transition-colors cursor-pointer ${
                isActive
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-sidebar-foreground hover:bg-muted hover:text-foreground font-medium'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'referrals' && inboxCount > 0 && (
                <span className="font-numeric text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground border border-primary-border tabular-nums">
                  {inboxCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-4 mt-4 border-t border-sidebar-border space-y-1">
          <p className="px-3 pb-1 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Account &amp; Rules
          </p>

          <Link
            href="/settings"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Settings</span>
          </Link>

          {activeScout?.adminRole && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Shield className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
              <span>Admin</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer text-left"
          >
            <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Trust &amp; Guide</span>
          </button>

          <Link
            href="/programme-rules"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Scale className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Programme Rules</span>
          </Link>

          <Link
            href="/help"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Help Centre</span>
          </Link>
        </div>
      </nav>

      {/* Sidebar Footer: Authenticated User + Theme Switcher */}
      <div className="p-3 border-t border-sidebar-border space-y-3 shrink-0">
        {authenticated && activeScout ? (
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/60">
            <UserAvatar
              avatarUrl={activeScout.avatarUrl}
              displayName={activeScout.displayName}
              username={activeScout.handle}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {activeScout.displayName}
              </p>
              <p className="font-sans text-[11px] text-muted-foreground truncate">
                @{activeScout.handle}
              </p>
            </div>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
            Sign In / Join Free
          </Link>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] font-sans text-muted-foreground">Appearance</span>
          <ThemeToggle showLabel />
        </div>
      </div>
    </aside>
  );
}
