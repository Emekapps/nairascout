'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { ActiveScoutDTO } from '@/lib/nairascout-store';

interface VerifiedSellerFabProps {
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
}

export function VerifiedSellerFab({ authenticated, activeScout }: VerifiedSellerFabProps) {
  const pathname = usePathname();

  const isVerifiedActiveSeller =
    authenticated &&
    activeScout?.sellerProfile?.sellerStatus === 'ACTIVE' &&
    activeScout?.sellerVerificationStatus === 'VERIFIED';

  if (!isVerifiedActiveSeller || pathname === '/seller/listings/new') {
    return null;
  }

  return (
    <Link
      href="/seller/listings/new"
      aria-label="Create Listing"
      title="Create Listing"
      className="fixed right-4 bottom-20 md:bottom-6 z-40 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#2E5339] text-white dark:bg-[#3A6B49] dark:text-white shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Plus className="w-6 h-6 stroke-[2.25]" aria-hidden="true" />
    </Link>
  );
}
