'use client';

import { Fragment, useMemo, useState } from 'react';
import { MapPin, Search, Share2, ShoppingBag, X } from 'lucide-react';
import type { NairaScoutSnapshot, ProductListing } from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import ProductImage from './ProductImage';
import { ProductCard } from './marketplace/ProductCard';
import { InFeedPromoCarousel } from './marketplace/InFeedPromoCarousel';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';

interface MarketplaceViewProps {
  snapshot: NairaScoutSnapshot;
  externalSearchQuery?: string;
  onExternalSearchChange?: (q: string) => void;
  onStartDirectCheckout: (product: ProductListing) => void;
  onOpenReferModal: (product: ProductListing) => void;
  onGoToReferrals: () => void;
}

export default function MarketplaceView({
  snapshot,
  externalSearchQuery,
  onExternalSearchChange,
  onStartDirectCheckout,
  onOpenReferModal,
  onGoToReferrals,
}: MarketplaceViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<ProductListing | null>(null);

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = onExternalSearchChange ?? setLocalSearchQuery;

  const categories = useMemo(() => {
    const cats = Array.from(new Set(snapshot.products.map((p) => p.category)));
    return ['All', ...cats];
  }, [snapshot.products]);

  const cities = useMemo(() => {
    const c = Array.from(new Set(snapshot.products.map((p) => p.sellerCity)));
    return ['All', ...c];
  }, [snapshot.products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshot.products.filter((p) => {
      const catMatch = selectedCategory === 'All' || p.category === selectedCategory;
      const cityMatch = cityFilter === 'All' || p.sellerCity === cityFilter;
      const textMatch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.sellerName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return catMatch && cityMatch && textMatch;
    });
  }, [snapshot.products, selectedCategory, cityFilter, searchQuery]);

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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products or sellers..."
              aria-label="Search products or sellers"
              className="w-full h-10 pl-10 pr-8 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative shrink-0">
            <MapPin
              className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Filter by Seller location"
              className="w-full sm:w-auto h-10 pl-8 pr-3.5 text-xs sm:text-sm bg-card text-foreground border border-border rounded-xl focus:outline-none focus:border-ring cursor-pointer"
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city === 'All' ? 'All Locations' : city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-commerce text-commerce-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-muted'
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
                  ? 'No published marketplace listings yet'
                  : 'No matching products found'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshot.products.length === 0
                  ? 'Verified Sellers can create draft listings and publish them to the live PostgreSQL catalogue from Seller Hub.'
                  : 'Try clearing your search query or switching back to all categories.'}
              </p>
              {snapshot.products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('All');
                    setCityFilter('All');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product, index) => (
              <Fragment key={product.id}>
                <ProductCard
                  product={product}
                  onInspect={setSelectedProduct}
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
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedProduct.title}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2">
            <div className="aspect-[4/3] md:aspect-auto md:min-h-[380px]">
              <ProductImage
                src={selectedProduct.imageUrl}
                alt={selectedProduct.title}
                category={selectedProduct.category}
                className="w-full h-full"
              />
            </div>

            <div className="p-6 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <p className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {selectedProduct.category} · {selectedProduct.sellerCity}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close product details"
                    className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="mt-2 font-sans text-xl font-bold text-foreground">
                  {selectedProduct.title}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Seller: {selectedProduct.sellerName}
                  </span>
                  {selectedProduct.hasActiveSellerBadge && (
                    <span className="font-medium text-foreground">· Active Seller</span>
                  )}
                  {selectedProduct.isSellerVerified && (
                    <span className="font-semibold text-success">· KYC Verified</span>
                  )}
                </div>

                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  {selectedProduct.description}
                </p>

                <div className="mt-5 pt-4 border-t border-border space-y-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Specifications &amp; Terms</p>
                  <ul className="space-y-1 list-disc list-inside">
                    {selectedProduct.specifications.map((spec) => (
                      <li key={spec}>{spec}</li>
                    ))}
                  </ul>
                  <p className="pt-2">Return policy: {selectedProduct.returnPolicy}</p>
                  <p>Warranty: {selectedProduct.warranty}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="font-numeric text-2xl font-bold text-foreground tabular-nums">
                      {formatWholeNaira(selectedProduct.priceKobo)}
                    </p>
                    <p className="font-numeric text-xs text-muted-foreground tabular-nums">
                      Delivery: {formatWholeNaira(selectedProduct.deliveryFeeKobo)} (excluded from
                      commission base)
                    </p>
                  </div>
                  <span className="font-numeric text-xs font-medium text-foreground tabular-nums">
                    {selectedProduct.stock} units left
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const p = selectedProduct;
                      setSelectedProduct(null);
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
                      const p = selectedProduct;
                      setSelectedProduct(null);
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
