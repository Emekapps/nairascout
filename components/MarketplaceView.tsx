'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import type { NairaScoutSnapshot, ProductListing } from '@/lib/nairascout-store';
import { DEFAULT_LISTING_CATEGORIES_SEED } from '@/lib/constants/nigeria-and-categories';
import { ProductCard } from './marketplace/ProductCard';
import { InFeedPromoCarousel } from './marketplace/InFeedPromoCarousel';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';

interface MarketplaceViewProps {
  snapshot: NairaScoutSnapshot;
  externalSearchQuery?: string;
  onExternalSearchChange?: (q: string) => void;
  externalLocationFilter?: string;
  onExternalLocationChange?: (loc: string) => void;
  externalCategoryFilter?: string;
  onExternalCategoryChange?: (cat: string) => void;
  onStartDirectCheckout: (product: ProductListing) => void;
  onOpenReferModal: (product: ProductListing) => void;
  onGoToReferrals: () => void;
}

export default function MarketplaceView({
  snapshot,
  externalSearchQuery,
  onExternalSearchChange,
  externalLocationFilter,
  onExternalLocationChange,
  externalCategoryFilter,
  onExternalCategoryChange,
  onStartDirectCheckout,
  onOpenReferModal,
  onGoToReferrals,
}: MarketplaceViewProps) {
  const [localSelectedCategory, setLocalSelectedCategory] = useState<string>('All');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localCityFilter, setLocalCityFilter] = useState<string>('All');

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = onExternalSearchChange ?? setLocalSearchQuery;
  const cityFilter = externalLocationFilter !== undefined ? externalLocationFilter : localCityFilter;
  const setCityFilter = onExternalLocationChange ?? setLocalCityFilter;
  const selectedCategory =
    externalCategoryFilter !== undefined ? externalCategoryFilter : localSelectedCategory;
  const setSelectedCategory = onExternalCategoryChange ?? setLocalSelectedCategory;

  const preferredCategories = useMemo(
    () =>
      snapshot.authenticated && snapshot.activeScout
        ? snapshot.activeScout.preferredCategories.filter(Boolean)
        : [],
    [snapshot.authenticated, snapshot.activeScout]
  );
  const hasPreferredCategories = preferredCategories.length > 0;

  const activePlatformCategories = useMemo(() => {
    return snapshot.categories && snapshot.categories.length > 0
      ? snapshot.categories.filter((c) => c.isActive).map((c) => c.name)
      : DEFAULT_LISTING_CATEGORIES_SEED.map((c) => c.name);
  }, [snapshot.categories]);

  const categories = useMemo(() => {
    if (hasPreferredCategories) {
      const preferredSet = new Set(preferredCategories);
      const orderedActive = activePlatformCategories.filter((c) => preferredSet.has(c));
      const remaining = preferredCategories.filter((c) => !orderedActive.includes(c));
      const base = ['All', ...orderedActive, ...remaining];
      if (
        externalCategoryFilter &&
        externalCategoryFilter !== 'All' &&
        !base.includes(externalCategoryFilter)
      ) {
        return [...base, externalCategoryFilter];
      }
      return base;
    }

    const productCats = snapshot.products.map((p) => p.category);
    const cats = Array.from(new Set([...activePlatformCategories, ...productCats]));
    return ['All', ...cats];
  }, [hasPreferredCategories, preferredCategories, activePlatformCategories, snapshot.products, externalCategoryFilter]);

  const effectiveCategory =
    selectedCategory === 'All' || categories.includes(selectedCategory) ? selectedCategory : 'All';

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const preferredSet = hasPreferredCategories ? new Set(preferredCategories) : null;
    return snapshot.products.filter((p) => {
      const catMatch =
        effectiveCategory === 'All'
          ? preferredSet
            ? preferredSet.has(p.category)
            : true
          : p.category === effectiveCategory;
      const cityMatch = cityFilter === 'All' || p.sellerCity === cityFilter;
      const textMatch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.sellerName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return catMatch && cityMatch && textMatch;
    });
  }, [
    snapshot.products,
    effectiveCategory,
    hasPreferredCategories,
    preferredCategories,
    cityFilter,
    searchQuery,
  ]);

  const activeInboxCount = snapshot.referralsInbox.filter((r) => r.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Product Discovery Feed — Top of Marketplace */}
      <section id="discovery-catalogue" className="space-y-4">
        <DismissibleNoticePanel
          storageKey="nairascout_feed_discovery_notice_v1"
          title="General Product Discovery"
          description="Direct BUY initiates a direct marketplace order • REFER shares a traceable Referral Card"
          ariaLabel="General Product Discovery Notice"
        />

        {/* Category Filter Pills (NS-UI-020 border-input + NS-UI-021 hidden scrollbar & mobile halfway peek) */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1">
          <div className="flex items-center gap-2 w-max">
            {categories.map((cat) => {
              const active = effectiveCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 text-xs rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                    active
                      ? 'bg-[#2E5339] text-[#FFFFFF] border-[#2E5339] dark:bg-[#3A6B49] dark:text-[#FFFFFF] dark:border-[#3A6B49] font-semibold'
                      : 'bg-card text-foreground border-border hover:bg-muted font-medium'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <p className="font-sans text-lg font-semibold text-foreground">
                {snapshot.products.length === 0
                  ? 'No published listings yet'
                  : hasPreferredCategories
                    ? 'No listings in your selected Preferred Categories yet'
                    : 'No matching products found'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshot.products.length === 0
                  ? 'Verified Sellers can create product listings, save them as draft, and publish them to the live marketplace from the Seller Hub'
                  : hasPreferredCategories
                    ? 'Try clearing filters or adding more categories under Account Settings → Preferred Categories.'
                    : 'Try clearing your search query or switching back to all categories.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                {snapshot.products.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setCityFilter('All');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
                {hasPreferredCategories && snapshot.authenticated && (
                  <Link
                    href="/settings"
                    className="px-4 py-2 text-xs font-semibold text-foreground border border-border bg-background hover:bg-muted rounded-xl"
                  >
                    Edit Preferred Categories
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product, index) => (
              <Fragment key={product.id}>
                <ProductCard
                  product={product}
                  onBuyDirect={onStartDirectCheckout}
                  onRefer={onOpenReferModal}
                />
                {(index + 1) % 25 === 0 && (
                  <div className="col-span-full">
                    <InFeedPromoCarousel
                      onGoToReferrals={onGoToReferrals}
                      activeInboxCount={activeInboxCount}
                    />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
