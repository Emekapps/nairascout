'use client';

// NS-UI-310, NS-UI-313, NS-UI-314, NS-UI-315: 3-Tab Bottom Nav Bar, Accounts Drawer & More Options Drawer
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import {
  BookOpen,
  Calculator,
  ChevronRight,
  CircleEllipsis,
  GitBranch,
  HelpCircle,
  Home,
  Inbox,
  Lock,
  LogIn,
  LogOut,
  Package,
  ReceiptText,
  Scale,
  Send,
  Settings,
  Shield,
  Store,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { ActiveScoutDTO } from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import type { NavTab } from '@/components/HeaderNav';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ThemeToggle } from './ThemeToggle';

interface MobileBottomNavProps {
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onOpenGuide: () => void;
  inboxCount: number;
  unreadWalletCount?: number;
  totalEarningsKobo?: number;
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
  onLogout: () => Promise<void>;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenGuide,
  inboxCount,
  unreadWalletCount = 0,
  totalEarningsKobo = 0,
  authenticated,
  activeScout,
  onLogout,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const isVerifiedSeller =
    authenticated && activeScout?.sellerVerificationStatus === 'VERIFIED';

  const combinedMoreBadge = inboxCount + unreadWalletCount;

  const isHomeActive =
    pathname === '/' && (!activeTab || activeTab === 'marketplace');
  const isMoreRouteActive =
    pathname?.startsWith('/referrals') ||
    pathname?.startsWith('/network') ||
    pathname?.startsWith('/wallet') ||
    pathname === '/settings/privacy';

  const handleGoHome = () => {
    setAccountSheetOpen(false);
    setMoreSheetOpen(false);
    if (pathname === '/' && onSelectTab) {
      onSelectTab('marketplace');
    } else {
      router.push('/');
    }
  };

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[82px] border-t border-border bg-card/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-3 h-full items-center justify-items-center max-w-md mx-auto">
          {/* 1. Left — Home */}
          <button
            type="button"
            onClick={handleGoHome}
            aria-label="Home"
            className={`h-[74px] w-[58px] inline-flex flex-col items-center justify-center gap-0.5 text-[11px] font-sans transition-colors cursor-pointer rounded-xl ${
              isHomeActive && !accountSheetOpen && !moreSheetOpen
                ? 'text-[#2E5339] dark:text-[#FFFFFF] font-bold'
                : 'text-muted-foreground font-medium'
            }`}
          >
            <span className="w-[44px] h-[44px] inline-flex items-center justify-center">
              <Home className="w-7 h-7" aria-hidden="true" />
            </span>
            <span className="tracking-tight leading-none">Home</span>
          </button>

          {/* 2. Center — Accounts (Circular Avatar) */}
          <button
            type="button"
            onClick={() => {
              setMoreSheetOpen(false);
              setAccountSheetOpen((prev) => !prev);
            }}
            aria-label="Accounts"
            aria-expanded={accountSheetOpen}
            className={`h-[74px] w-[58px] inline-flex flex-col items-center justify-center gap-0.5 text-[11px] font-sans transition-colors cursor-pointer rounded-xl ${
              accountSheetOpen ||
              pathname?.startsWith('/seller') ||
              pathname === '/settings'
                ? 'text-[#2E5339] dark:text-[#FFFFFF] font-bold'
                : 'text-muted-foreground font-medium'
            }`}
          >
            <span className="w-[44px] h-[44px] inline-flex items-center justify-center">
              {authenticated && activeScout ? (
                <UserAvatar
                  avatarUrl={activeScout.avatarUrl}
                  displayName={activeScout.displayName}
                  username={activeScout.handle}
                  size="lg"
                  className={`!w-[44px] !h-[44px] ${
                    accountSheetOpen
                      ? 'ring-2 ring-[#2E5339] dark:ring-[#6E9470]'
                      : 'ring-1 ring-border'
                  }`}
                />
              ) : (
                <span
                  className={`w-[44px] h-[44px] rounded-full bg-muted flex items-center justify-center border ${
                    accountSheetOpen
                      ? 'border-[#2E5339] ring-2 ring-[#2E5339]'
                      : 'border-border'
                  }`}
                >
                  <User className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
                </span>
              )}
            </span>
            <span className="tracking-tight leading-none">Accounts</span>
          </button>

          {/* 3. Right — More Options (Horizontal Ellipsis Circle + Combined Badges) */}
          <button
            type="button"
            onClick={() => {
              setAccountSheetOpen(false);
              setMoreSheetOpen((prev) => !prev);
            }}
            aria-label={
              combinedMoreBadge > 0
                ? `More Options (${combinedMoreBadge} notifications)`
                : 'More Options'
            }
            aria-expanded={moreSheetOpen}
            className={`h-[74px] w-[58px] inline-flex flex-col items-center justify-center gap-0.5 text-[10px] font-sans transition-colors cursor-pointer rounded-xl ${
              moreSheetOpen || isMoreRouteActive
                ? 'text-[#2E5339] dark:text-[#FFFFFF] font-bold'
                : 'text-muted-foreground font-medium'
            }`}
          >
            <span className="relative w-[44px] h-[44px] inline-flex items-center justify-center">
              <CircleEllipsis className="w-7 h-7" aria-hidden="true" />
              {combinedMoreBadge > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 right-0 px-1 min-w-[18px] h-[18px] rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-[#FFFFFF] font-numeric text-[10px] font-bold tabular-nums flex items-center justify-center shadow-xs border border-card"
                >
                  {combinedMoreBadge > 99 ? '99+' : combinedMoreBadge}
                </span>
              )}
            </span>
            <span className="tracking-tight leading-none whitespace-nowrap">More Options</span>
          </button>
        </div>
      </nav>

      {/* NS-UI-314: Slide-up Draggable Accounts Bottom Drawer Sheet */}
      <AnimatePresence>
        {accountSheetOpen && (
          <motion.div
            key="account-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Accounts Menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
            onClick={() => setAccountSheetOpen(false)}
          >
            <motion.div
              key="account-sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info: PanInfo) => {
                if (info.offset.y > 90 || info.velocity.y > 450) {
                  setAccountSheetOpen(false);
                }
              }}
              className="w-full max-h-[86vh] overflow-y-auto rounded-t-3xl bg-card border-t border-border p-5 pb-8 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="touch-none pt-1 pb-2 -mt-2 flex justify-center cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>

              {/* 1. User Profile Card */}
              <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-[#FBF7F2] dark:bg-[#222925] border border-border">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <UserAvatar
                      avatarUrl={activeScout?.avatarUrl}
                      displayName={
                        authenticated && activeScout ? activeScout.displayName : 'Guest Scout'
                      }
                      username={authenticated && activeScout ? activeScout.handle : 'GS'}
                      size="lg"
                      className="!w-14 !h-14 text-base"
                    />
                    {authenticated && activeScout?.accountStatus === 'ACTIVE' && (
                      <span
                        title="Account Active"
                        aria-label="Account Active"
                        className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#047857] border-2 border-card"
                      />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-sans text-base font-bold text-foreground truncate">
                      {authenticated && activeScout ? activeScout.displayName : 'Guest Scout'}
                    </p>
                    <p className="font-sans text-xs font-medium text-muted-foreground truncate">
                      {authenticated && activeScout
                        ? `@${activeScout.handle}`
                        : 'Sign in for full access'}
                    </p>
                    {authenticated && activeScout?.email && (
                      <p className="font-sans text-xs text-muted-foreground truncate">
                        {activeScout.email}
                      </p>
                    )}
                    {authenticated && activeScout && (
                      <p className="pt-1 font-sans text-xs font-semibold text-foreground tabular-nums">
                        Inbox ({inboxCount} {inboxCount === 1 ? 'referral' : 'referrals'}) • Total
                        earnings ({formatWholeNaira(totalEarningsKobo)})
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountSheetOpen(false)}
                  aria-label="Close account sheet"
                  className="p-2 -mr-1 -mt-1 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Exact Top-Down Menu Order (NS-UI-314) */}
              <div className="space-y-1.5">
                {/* 2. Settings */}
                <Link
                  href="/settings"
                  onClick={() => setAccountSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Settings
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* 3. Seller Setup (ONLY when NOT yet Verified Seller) */}
                {!isVerifiedSeller && (
                  <Link
                    href="/seller/setup"
                    onClick={() => setAccountSheetOpen(false)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-[#F2F6F2] dark:bg-[#1F2E24] border border-[#5C7C5D]/30 text-sm font-semibold text-foreground"
                  >
                    <span className="flex items-center gap-3">
                      <Store className="w-4 h-4 text-[#2E5339] dark:text-[#6E9470]" aria-hidden="true" />
                      Seller Setup
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                )}

                {/* 4, 5, 6. Verified Seller Pages (ONLY when verification_status === 'VERIFIED') */}
                {isVerifiedSeller && (
                  <>
                    <Link
                      href="/seller/hub"
                      onClick={() => setAccountSheetOpen(false)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-muted/60 text-sm font-semibold text-foreground"
                    >
                      <span className="flex items-center gap-3">
                        <Store className="w-4 h-4 text-[#2E5339] dark:text-[#6E9470]" aria-hidden="true" />
                        Seller Hub
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    </Link>

                    <Link
                      href="/seller/listings"
                      onClick={() => setAccountSheetOpen(false)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                    >
                      <span className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        Listings
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    </Link>

                    <Link
                      href="/seller/orders"
                      onClick={() => setAccountSheetOpen(false)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                    >
                      <span className="flex items-center gap-3">
                        <ReceiptText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        Order Fulfilment
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </>
                )}

                {/* 7. Trust & 13-Gen Guide */}
                <button
                  type="button"
                  onClick={() => {
                    setAccountSheetOpen(false);
                    onOpenGuide();
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground text-left cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Trust &amp; 13-Gen Guide
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </button>

                {/* 8. Program Rules */}
                <Link
                  href="/programme-rules"
                  onClick={() => setAccountSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Scale className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Program Rules
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* 9. Help Center */}
                <Link
                  href="/help"
                  onClick={() => setAccountSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Help Center
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {activeScout?.adminRole && (
                  <Link
                    href="/admin"
                    onClick={() => setAccountSheetOpen(false)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
                  >
                    <span className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-success" aria-hidden="true" />
                      Admin Governance Console
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                )}

                {/* 10. Appearance (Light / Dark Mode Toggle) */}
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border">
                  <span className="text-xs font-medium text-foreground">Appearance</span>
                  <ThemeToggle showLabel />
                </div>

                {/* 11. Sign out Button (or Sign In / Join Free for Guests) */}
                <div className="pt-1">
                  {authenticated ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setAccountSheetOpen(false);
                        await onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      Sign out
                    </button>
                  ) : (
                    <Link
                      href="/auth/login"
                      onClick={() => setAccountSheetOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold bg-primary text-primary-foreground border border-primary-border"
                    >
                      <LogIn className="w-4 h-4" aria-hidden="true" />
                      Sign In / Join Free
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NS-UI-315: Slide-up Draggable More Options Bottom Drawer Sheet */}
      <AnimatePresence>
        {moreSheetOpen && (
          <motion.div
            key="more-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="More Options Menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
            onClick={() => setMoreSheetOpen(false)}
          >
            <motion.div
              key="more-sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info: PanInfo) => {
                if (info.offset.y > 90 || info.velocity.y > 450) {
                  setMoreSheetOpen(false);
                }
              }}
              className="w-full max-h-[86vh] overflow-y-auto rounded-t-3xl bg-card border-t border-border p-5 pb-8 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="touch-none pt-1 pb-2 -mt-2 flex justify-center cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="font-sans text-base font-bold text-foreground">
                  More Options
                </h2>
                <button
                  type="button"
                  onClick={() => setMoreSheetOpen(false)}
                  aria-label="Close more options sheet"
                  className="p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Exact Top-Down Menu Order (NS-UI-315) */}
              <div className="space-y-1.5">
                {/* 1. Inbox */}
                <Link
                  href="/referrals/inbox"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Inbox className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Inbox
                  </span>
                  <span className="flex items-center gap-2">
                    {inboxCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white font-numeric text-[11px] font-bold tabular-nums">
                        {inboxCount}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                </Link>

                {/* 2. Sent */}
                <Link
                  href="/referrals/sent"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Send className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Sent
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* 3. Scouts List */}
                <Link
                  href="/network/scouts"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Scouts List
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* 4. Ancestry */}
                <Link
                  href="/network/ancestry"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <GitBranch className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Ancestry
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* 5. Wallet */}
                <Link
                  href="/wallet"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Wallet className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Wallet
                  </span>
                  <span className="flex items-center gap-2">
                    {unreadWalletCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white font-numeric text-[11px] font-bold tabular-nums">
                        {unreadWalletCount}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                </Link>

                {/* 6. Financial Ledger */}
                <Link
                  href="/wallet/ledger"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <ReceiptText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Financial Ledger
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* 7. Commission Calculator */}
                <Link
                  href="/network/calculator"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Calculator className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Commission Calculator
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* 8. Privacy Settings */}
                <Link
                  href="/settings/privacy"
                  onClick={() => setMoreSheetOpen(false)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    Privacy Settings
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
