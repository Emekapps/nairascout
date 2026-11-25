'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import {
  BookOpen,
  Compass,
  HelpCircle,
  LogIn,
  LogOut,
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
import type { NavTab } from '@/components/HeaderNav';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ThemeToggle } from './ThemeToggle';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenGuide: () => void;
  inboxCount: number;
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
  onLogout: () => Promise<void>;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenGuide,
  inboxCount,
  authenticated,
  activeScout,
  onLogout,
}: MobileBottomNavProps) {
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  const navItems: {
    id: Exclude<NavTab, 'seller'>;
    label: string;
    icon: typeof Compass;
  }[] = [
    { id: 'marketplace', label: 'Feed', icon: Compass },
    { id: 'referrals', label: 'Referrals', icon: Send },
    { id: 'network', label: 'Network', icon: Users },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t border-border bg-card/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 h-full items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAccountSheetOpen(false);
                  onSelectTab(item.id);
                }}
                className={`relative flex flex-col items-center justify-center min-h-[48px] gap-1 text-[11px] font-sans transition-colors cursor-pointer ${
                  isActive ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {item.id === 'referrals' && inboxCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-2 px-1 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground border border-primary-border font-numeric text-[10px] font-bold tabular-nums flex items-center justify-center"
                    >
                      {inboxCount}
                    </span>
                  )}
                </span>
                <span className="tracking-tight leading-none">{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setAccountSheetOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center min-h-[48px] gap-1 text-[11px] font-sans transition-colors cursor-pointer ${
              activeTab === 'seller' || accountSheetOpen
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground font-medium'
            }`}
          >
            {authenticated && activeScout ? (
              <UserAvatar
                avatarUrl={activeScout.avatarUrl}
                displayName={activeScout.displayName}
                username={activeScout.handle}
                size="xs"
                className={
                  activeTab === 'seller' || accountSheetOpen
                    ? 'ring-2 ring-primary'
                    : 'ring-1 ring-border'
                }
              />
            ) : (
              <span
                className={`h-6 w-6 rounded-full bg-muted flex items-center justify-center border ${
                  activeTab === 'seller' || accountSheetOpen
                    ? 'border-primary ring-2 ring-primary'
                    : 'border-border'
                }`}
              >
                <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              </span>
            )}
            <span className="tracking-tight leading-none">Accounts</span>
          </button>
        </div>
      </nav>

      {/* Slide-up Draggable Account & Seller Sheet */}
      <AnimatePresence>
        {accountSheetOpen && (
          <motion.div
            key="account-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Account Menu"
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
              className="w-full rounded-t-3xl bg-card border-t border-border p-5 pb-8 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="touch-none pt-1 pb-2 -mt-2 flex justify-center cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    avatarUrl={activeScout?.avatarUrl}
                    displayName={authenticated && activeScout ? activeScout.displayName : 'Guest Scout'}
                    username={authenticated && activeScout ? activeScout.handle : 'GS'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="font-sans text-base font-bold text-foreground truncate">
                      {authenticated && activeScout ? activeScout.displayName : 'Guest Scout'}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground truncate">
                      {authenticated && activeScout
                        ? `@${activeScout.handle}`
                        : 'Sign in for full access'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountSheetOpen(false)}
                  aria-label="Close account sheet"
                  className="p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setAccountSheetOpen(false);
                  onSelectTab('seller');
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-muted/60 text-sm font-semibold text-foreground cursor-pointer"
              >
                <Store className="w-4 h-4 text-foreground" aria-hidden="true" />
                Seller Hub &amp; Listings
              </button>

              <Link
                href="/settings"
                onClick={() => setAccountSheetOpen(false)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
              >
                <Settings className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Account Settings
              </Link>

              {activeScout?.adminRole && (
                <Link
                  href="/admin"
                  onClick={() => setAccountSheetOpen(false)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
                >
                  <Shield className="w-4 h-4 text-success" aria-hidden="true" />
                  Admin Governance Console
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  setAccountSheetOpen(false);
                  onOpenGuide();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground text-left cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Trust &amp; 13-Gen Guide
              </button>

              <Link
                href="/programme-rules"
                onClick={() => setAccountSheetOpen(false)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
              >
                <Scale className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Programme Rules
              </Link>

              <Link
                href="/help"
                onClick={() => setAccountSheetOpen(false)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted text-sm font-medium text-foreground"
              >
                <HelpCircle className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Help Centre
              </Link>

              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border">
                <span className="text-xs font-medium text-foreground">Appearance Theme</span>
                <ThemeToggle showLabel />
              </div>

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
                  Sign In / Register Free
                </Link>
              )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
