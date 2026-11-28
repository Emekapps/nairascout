'use client';

// NS-UI-310, NS-UI-314, NS-UI-315: Desktop Navigation Parity for all dedicated pages
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Calculator,
  Compass,
  GitBranch,
  HelpCircle,
  Inbox,
  Lock,
  LogIn,
  Package,
  ReceiptText,
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
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onOpenGuide: () => void;
  inboxCount: number;
  unreadWalletCount?: number;
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
}

export function DesktopSidebar({
  activeTab,
  onSelectTab,
  onOpenGuide,
  inboxCount,
  unreadWalletCount = 0,
  authenticated,
  activeScout,
}: DesktopSidebarProps) {
  const pathname = usePathname();
  const isVerifiedSeller =
    authenticated && activeScout?.sellerVerificationStatus === 'VERIFIED';

  const isRouteActive = (href: string, legacyTab?: NavTab) => {
    if (pathname === '/' && legacyTab && activeTab === legacyTab) return true;
    if (href === '/') return pathname === '/' && (!activeTab || activeTab === 'marketplace');
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const linkClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm font-sans transition-colors ${
      active
        ? 'bg-accent text-accent-foreground font-semibold'
        : 'text-sidebar-foreground hover:bg-muted hover:text-foreground font-medium'
    }`;

  return (
    <aside
      aria-label="Desktop Navigation"
      className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-40 bg-sidebar border-r border-sidebar-border"
    >
      {/* Top Brand Header */}
      <div className="h-16 px-5 flex items-center border-b border-sidebar-border shrink-0">
        {pathname === '/' && onSelectTab ? (
          <button
            type="button"
            onClick={() => onSelectTab('marketplace')}
            className="text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-ring rounded-lg"
          >
            <span className="font-brand font-extrabold text-xl tracking-tight text-[#2E5339] dark:text-[#FFFFFF] transition-colors">
              NairaScout
            </span>
          </button>
        ) : (
          <Link
            href="/"
            className="text-left focus-visible:outline-2 focus-visible:outline-ring rounded-lg"
          >
            <span className="font-brand font-extrabold text-xl tracking-tight text-[#2E5339] dark:text-[#FFFFFF] transition-colors">
              NairaScout
            </span>
          </Link>
        )}
      </div>

      {/* Primary Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Feed
          </p>
          {pathname === '/' && onSelectTab ? (
            <button
              type="button"
              onClick={() => onSelectTab('marketplace')}
              className={`${linkClass(isRouteActive('/', 'marketplace'))} cursor-pointer`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Home / Marketplace</span>
              </span>
            </button>
          ) : (
            <Link href="/" className={linkClass(isRouteActive('/'))}>
              <span className="flex items-center gap-3 min-w-0">
                <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Home / Marketplace</span>
              </span>
            </Link>
          )}
        </div>

        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Referrals &amp; Network
          </p>
          <Link href="/referrals/inbox" className={linkClass(isRouteActive('/referrals/inbox'))}>
            <span className="flex items-center gap-3 min-w-0">
              <Inbox className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Inbox</span>
            </span>
            {inboxCount > 0 && (
              <span className="font-numeric text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#5C7C5D] dark:bg-[#6E9470] text-white tabular-nums">
                {inboxCount}
              </span>
            )}
          </Link>
          <Link href="/referrals/sent" className={linkClass(isRouteActive('/referrals/sent'))}>
            <span className="flex items-center gap-3 min-w-0">
              <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Sent</span>
            </span>
          </Link>
          <Link href="/network/scouts" className={linkClass(isRouteActive('/network/scouts'))}>
            <span className="flex items-center gap-3 min-w-0">
              <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Scouts List</span>
            </span>
          </Link>
          <Link href="/network/ancestry" className={linkClass(isRouteActive('/network/ancestry'))}>
            <span className="flex items-center gap-3 min-w-0">
              <GitBranch className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Ancestry</span>
            </span>
          </Link>
          <Link
            href="/network/calculator"
            className={linkClass(isRouteActive('/network/calculator'))}
          >
            <span className="flex items-center gap-3 min-w-0">
              <Calculator className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Commission Calculator</span>
            </span>
          </Link>
        </div>

        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Wallet &amp; Ledger
          </p>
          <Link href="/wallet" className={linkClass(pathname === '/wallet')}>
            <span className="flex items-center gap-3 min-w-0">
              <Wallet className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Wallet</span>
            </span>
            {unreadWalletCount > 0 && (
              <span className="font-numeric text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#5C7C5D] dark:bg-[#6E9470] text-white tabular-nums">
                {unreadWalletCount}
              </span>
            )}
          </Link>
          <Link href="/wallet/ledger" className={linkClass(isRouteActive('/wallet/ledger'))}>
            <span className="flex items-center gap-3 min-w-0">
              <ReceiptText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Financial Ledger</span>
            </span>
          </Link>
        </div>

        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Seller
          </p>
          {isVerifiedSeller ? (
            <>
              <Link href="/seller/hub" className={linkClass(isRouteActive('/seller/hub'))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Store className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Seller Hub</span>
                </span>
              </Link>
              <Link
                href="/seller/listings"
                className={linkClass(isRouteActive('/seller/listings'))}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Package className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Listings</span>
                </span>
              </Link>
              <Link href="/seller/orders" className={linkClass(isRouteActive('/seller/orders'))}>
                <span className="flex items-center gap-3 min-w-0">
                  <ReceiptText className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Order Fulfilment</span>
                </span>
              </Link>
            </>
          ) : (
            <Link href="/seller/setup" className={linkClass(isRouteActive('/seller/setup'))}>
              <span className="flex items-center gap-3 min-w-0">
                <Store className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Seller Setup</span>
              </span>
            </Link>
          )}
        </div>

        <div className="pt-3 border-t border-sidebar-border space-y-1">
          <p className="px-3 pb-1 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Account &amp; Rules
          </p>

          <Link href="/settings" className={linkClass(pathname === '/settings')}>
            <span className="flex items-center gap-3 min-w-0">
              <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Settings</span>
            </span>
          </Link>

          <Link href="/settings/privacy" className={linkClass(isRouteActive('/settings/privacy'))}>
            <span className="flex items-center gap-3 min-w-0">
              <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Privacy Settings</span>
            </span>
          </Link>

          {activeScout?.adminRole && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Shield className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
              <span>Admin</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer text-left"
          >
            <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Trust &amp; 13-Gen Guide</span>
          </button>

          <Link href="/programme-rules" className={linkClass(isRouteActive('/programme-rules'))}>
            <span className="flex items-center gap-3 min-w-0">
              <Scale className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Program Rules</span>
            </span>
          </Link>

          <Link href="/help" className={linkClass(isRouteActive('/help'))}>
            <span className="flex items-center gap-3 min-w-0">
              <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Help Center</span>
            </span>
          </Link>
        </div>
      </nav>

      {/* Sidebar Footer: Authenticated User + Theme Switcher */}
      <div className="p-3 border-t border-sidebar-border space-y-3 shrink-0">
        {authenticated && activeScout ? (
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/60">
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={activeScout.avatarUrl}
                displayName={activeScout.displayName}
                username={activeScout.handle}
                size="md"
              />
              {activeScout.accountStatus === 'ACTIVE' && (
                <span
                  aria-label="Account Active"
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#047857] border border-sidebar"
                />
              )}
            </div>
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
