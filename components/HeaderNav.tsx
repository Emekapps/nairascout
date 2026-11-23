'use client';

export type NavTab = 'marketplace' | 'referrals' | 'network' | 'wallet' | 'seller';

export const PRIMARY_NAV_ITEMS: { id: NavTab; label: string; shortLabel: string }[] = [
  { id: 'marketplace', label: 'Marketplace', shortLabel: 'Feed' },
  { id: 'referrals', label: 'Referrals', shortLabel: 'Referrals' },
  { id: 'network', label: 'Network', shortLabel: 'Network' },
  { id: 'wallet', label: 'Wallet', shortLabel: 'Wallet' },
  { id: 'seller', label: 'Seller Hub', shortLabel: 'Seller' },
];
