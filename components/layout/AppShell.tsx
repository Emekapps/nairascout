'use client';

import type {
  ActiveScoutDTO,
  GlobalSearchCategoryHit,
  GlobalSearchPersonHit,
  GlobalSearchProductHit,
  PlatformNotification,
} from '@/lib/nairascout-store';
import type { NavTab } from '@/components/HeaderNav';
import { DesktopSidebar } from './DesktopSidebar';
import { TopUtilityBar } from './TopUtilityBar';
import { MobileBottomNav } from './MobileBottomNav';

interface AppShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenGuide: () => void;
  inboxCount: number;
  notifications: PlatformNotification[];
  authenticated: boolean;
  activeScout: ActiveScoutDTO | null;
  onLogout: () => Promise<void>;
  searchQuery: string;
  selectedLocation: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onOpenLocationPicker: () => void;
  onOpenMobileSearch: () => void;
  onSelectSearchProduct?: (product: GlobalSearchProductHit) => void;
  onSelectSearchCategory?: (category: GlobalSearchCategoryHit) => void;
  onSelectSearchPerson?: (person: GlobalSearchPersonHit) => void;
  banners?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  activeTab,
  onSelectTab,
  onOpenGuide,
  inboxCount,
  notifications,
  authenticated,
  activeScout,
  onLogout,
  searchQuery,
  selectedLocation,
  onSearchChange,
  onSearchSubmit,
  onOpenLocationPicker,
  onOpenMobileSearch,
  onSelectSearchProduct,
  onSelectSearchCategory,
  onSelectSearchPerson,
  banners,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        onOpenGuide={onOpenGuide}
        inboxCount={inboxCount}
        authenticated={authenticated}
        activeScout={activeScout}
      />

      <div className="flex-1 flex flex-col md:pl-60 min-w-0">
        <TopUtilityBar
          searchQuery={searchQuery}
          selectedLocation={selectedLocation}
          onSearchChange={onSearchChange}
          onSearchSubmit={onSearchSubmit}
          onOpenLocationPicker={onOpenLocationPicker}
          onOpenMobileSearch={onOpenMobileSearch}
          onSelectSearchProduct={onSelectSearchProduct}
          onSelectSearchCategory={onSelectSearchCategory}
          onSelectSearchPerson={onSelectSearchPerson}
          onSelectHome={() => onSelectTab('marketplace')}
          onOpenGuide={onOpenGuide}
          notifications={notifications}
          authenticated={authenticated}
        />

        {banners}

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10">
          {children}
        </main>

        {footer}
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        onOpenGuide={onOpenGuide}
        inboxCount={inboxCount}
        authenticated={authenticated}
        activeScout={activeScout}
        onLogout={onLogout}
      />
    </div>
  );
}
