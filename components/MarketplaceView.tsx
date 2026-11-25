'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Share2, ShoppingBag, X } from 'lucide-react';
import type { NairaScoutSnapshot, ProductListing } from '@/lib/nairascout-store';
import { DEFAULT_LISTING_CATEGORIES_SEED } from '@/lib/constants/nigeria-and-categories';
import { formatWholeNaira } from '@/lib/commission-engine';
import ProductImage from './ProductImage';
import { ProductCard } from './marketplace/ProductCard';
import { InFeedPromoCarousel } from './marketplace/InFeedPromoCarousel';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';
import { UserAvatar } from './shared/UserAvatar';

interface MarketplaceViewProps {
  snapshot: NairaScoutSnapshot;
  externalSearchQuery?: string;
  onExternalSearchChange?: (q: string) => void;
  externalLocationFilter?: string;
  onExternalLocationChange?: (loc: string) => void;
  externalCategoryFilter?: string;
  onExternalCategoryChange?: (cat: string) => void;
  externalSelectedProductId?: string | null;
  onClearExternalProduct?: () => void;
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
  externalSelectedProductId,
  onClearExternalProduct,
  onStartDirectCheckout,
  onOpenReferModal,
  onGoToReferrals,
}: MarketplaceViewProps) {
  const [localSelectedCategory, setLocalSelectedCategory] = useState<string>('All');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localCityFilter, setLocalCityFilter] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<ProductListing | null>(null);

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

  const activeSelectedProduct = useMemo(() => {
    if (selectedProduct) return selectedProduct;
    if (externalSelectedProductId) {
      return snapshot.products.find((p) => p.id === externalSelectedProductId) ?? null;
    }
    return null;
  }, [selectedProduct, externalSelectedProductId, snapshot.products]);

  const closeProductModal = () => {
    setSelectedProduct(null);
    onClearExternalProduct?.();
  };

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

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => {
            const active = effectiveCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-commerce text-commerce-foreground'
                    : 'bg-[#FFFFFF] dark:bg-[#181818] text-foreground hover:bg-muted dark:hover:bg-muted'
                }`}
              >
                {cat}
              </button>
            );
          })}
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
                  onInspect={(p) => {
                    onClearExternalProduct?.();
                    setSelectedProduct(p);
                  }}
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

      {/* Product Detail Modal */}
      {activeSelectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeSelectedProduct.title}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2">
            <div className="aspect-[4/3] md:aspect-auto md:min-h-[380px]">
              <ProductImage
                src={activeSelectedProduct.imageUrl}
                alt={activeSelectedProduct.title}
                category={activeSelectedProduct.category}
                className="w-full h-full"
              />
            </div>

            <div className="p-6 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <p className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {activeSelectedProduct.category} · {activeSelectedProduct.sellerCity}
                  </p>
                  <button
                    type="button"
                    onClick={closeProductModal}
                    aria-label="Close product details"
                    className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="mt-2 font-sans text-xl font-bold text-foreground">
                  {activeSelectedProduct.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <UserAvatar
                    avatarUrl={activeSelectedProduct.sellerLogoUrl}
                    displayName={activeSelectedProduct.sellerName}
                    size="sm"
                  />
                  <span className="text-muted-foreground">
                    Seller: {activeSelectedProduct.sellerName}
                  </span>
                  {activeSelectedProduct.hasActiveSellerBadge && (
                    <span className="font-medium text-foreground">· Active Seller</span>
                  )}
                  {activeSelectedProduct.isSellerVerified && (
                    <span className="font-semibold text-success">· KYC Verified</span>
                  )}
                </div>

                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  {activeSelectedProduct.description}
                </p>

                <div className="mt-5 pt-4 border-t border-border space-y-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Specifications &amp; Terms</p>
                  <ul className="space-y-1 list-disc list-inside">
                    {activeSelectedProduct.specifications.map((spec) => (
                      <li key={spec}>{spec}</li>
                    ))}
                  </ul>
                  <p className="pt-2">Return policy: {activeSelectedProduct.returnPolicy}</p>
                  <p>Warranty: {activeSelectedProduct.warranty}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="font-numeric text-2xl font-bold text-foreground tabular-nums">
                      {formatWholeNaira(activeSelectedProduct.priceKobo)}
                    </p>
                    <p className="font-numeric text-xs text-muted-foreground tabular-nums">
                      Delivery: {formatWholeNaira(activeSelectedProduct.deliveryFeeKobo)} (excluded from
                      commission base)
                    </p>
                  </div>
                  <span className="font-numeric text-xs font-medium text-foreground tabular-nums">
                    {activeSelectedProduct.stock} units left
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const p = activeSelectedProduct;
                      closeProductModal();
                      onStartDirectCheckout(p);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-commerce-foreground bg-commerce rounded-lg hover:bg-commerce/90 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                    BUY DIRECT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = activeSelectedProduct;
                      closeProductModal();
                      onOpenReferModal(p);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                    REFER
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
