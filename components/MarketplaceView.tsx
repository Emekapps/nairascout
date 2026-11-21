'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Search, Share2, ShoppingBag, X } from 'lucide-react';
import type { NairaScoutSnapshot, ProductListing } from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import ProductImage from './ProductImage';

interface MarketplaceViewProps {
  snapshot: NairaScoutSnapshot;
  onStartDirectCheckout: (product: ProductListing) => void;
  onOpenReferModal: (product: ProductListing) => void;
  onGoToReferrals: () => void;
}

export default function MarketplaceView({
  snapshot,
  onStartDirectCheckout,
  onOpenReferModal,
  onGoToReferrals,
}: MarketplaceViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<ProductListing | null>(null);

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
    <div className="space-y-12">
      {/* Storefront Hero: 1 balanced focal point + immediate action */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-[#E4E4DE] pb-10">
        <div className="lg:col-span-7 flex flex-col justify-between py-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-[#0B6E4F]">
              Thirteen-Generation Social Commerce · Verified Nigerian Sellers
            </p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#111814] leading-[1.08] text-balance max-w-2xl">
              Discover products worth sharing. Earn across thirteen generations.
            </h1>
            <p className="mt-5 text-base text-[#4B554E] leading-relaxed max-w-xl">
              Don’t limit your affiliate earnings to buyers you find yourself. Share traceable
              product referrals with people you know and earn from genuine qualifying sales across
              your permanent referral ancestry.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#discovery-catalogue"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] transition-colors whitespace-nowrap shrink-0"
            >
              Browse Catalogue
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onGoToReferrals}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#111814] bg-white border border-[#D8D8D0] rounded-lg hover:bg-[#F3F3EF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Referrals Inbox ({activeInboxCount})
            </button>
          </div>
        </div>

        {/* Hero Feature Showcase Card */}
        <div className="lg:col-span-5 bg-white border border-[#E4E4DE] rounded-xl overflow-hidden flex flex-col">
          <div className="relative h-56 sm:h-64 lg:h-full min-h-[240px]">
            <ProductImage
              src={snapshot.products[1]?.imageUrl || snapshot.products[0].imageUrl}
              alt={snapshot.products[1]?.title || snapshot.products[0].title}
              category={snapshot.products[1]?.category || snapshot.products[0].category}
              className="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 text-white">
              <p className="text-xs text-white/80">
                Direct Marketplace vs Referral-Card Attribution
              </p>
              <p className="mt-1 font-display text-lg font-semibold leading-snug">
                Buying from a general listing is a direct order. Buying from a Referral Card anchors
                the 20% commission pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width 4-column structural strip below hero split */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-[#E4E4DE] pb-10">
        <div>
          <p className="text-xs text-[#5C665E]">Referral Pool Source</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#111814] tabular-nums">
            20% of 10%
          </p>
          <p className="mt-1 text-xs text-[#5C665E]">Of eligible NairaScout commission</p>
        </div>
        <div>
          <p className="text-xs text-[#5C665E]">Permanent Ancestry Depth</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#111814] tabular-nums">
            Up to 13 Gen
          </p>
          <p className="mt-1 text-xs text-[#5C665E]">Ineligible ancestors are never skipped</p>
        </div>
        <div>
          <p className="text-xs text-[#5C665E]">Seller Fulfilment SLA</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#111814] tabular-nums">
            10 Days
          </p>
          <p className="mt-1 text-xs text-[#5C665E]">Delivery verified before release</p>
        </div>
        <div>
          <p className="text-xs text-[#5C665E]">Monthly Payout Policy</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#111814] tabular-nums">
            ₦5,000 Min
          </p>
          <p className="mt-1 text-xs text-[#5C665E]">15th of each month · NGN</p>
        </div>
      </section>

      {/* General Discovery Feed */}
      <section id="discovery-catalogue" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#111814]">
              General Product Discovery
            </h2>
            <p className="mt-1 text-sm text-[#556158]">
              Purchases initiated here are classified as Direct Marketplace orders (₦0 referral
              commission). Use Refer to send a traceable card to your Scouts List.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#6C776E] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products or sellers..."
                aria-label="Search products or sellers"
                className="pl-9 pr-3 py-2 text-sm bg-white border border-[#D8D8D0] rounded-lg w-60 focus:outline-none focus:border-[#0B6E4F]"
              />
            </div>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Filter by Seller city"
              className="px-3 py-2 text-sm bg-white border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city === 'All' ? 'All Locations' : city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category segmented controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#111814] text-white'
                    : 'bg-[#F0F0EA] text-[#4B554E] hover:bg-[#E4E4DC] hover:text-[#111814]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-[#E4E4DE] rounded-xl p-12 text-center">
            <p className="font-display text-lg font-semibold text-[#111814]">
              No matching products found
            </p>
            <p className="mt-1 text-sm text-[#5C665E]">
              Try clearing your search query or switching back to all categories.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setCityFilter('All');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="group bg-white border border-[#E4E4DE] rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0B6E4F]"
                >
                  <div className="aspect-[4/3] w-full">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.title}
                      category={product.category}
                      className="w-full h-full"
                    />
                  </div>
                </button>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-[#5C665E]">
                      <span className="uppercase tracking-wider font-medium">
                        {product.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{product.sellerCity}</span>
                      <span aria-hidden="true">·</span>
                      <span>{product.daysRemaining}d left</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="mt-2 text-left block w-full cursor-pointer"
                    >
                      <h3 className="font-display text-base font-semibold text-[#111814] group-hover:text-[#0B6E4F] transition-colors line-clamp-2">
                        {product.title}
                      </h3>
                    </button>

                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#4B554E]">
                      <span>{product.sellerName}</span>
                      {product.sellerVerified && (
                        <>
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-[#0B6E4F]"
                            aria-label="Verified Seller"
                          />
                          <span className="text-[#0B6E4F] font-medium">Verified Seller</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#ECECE6] space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="font-mono text-lg font-semibold text-[#111814] tabular-nums">
                          {formatWholeNaira(product.priceKobo)}
                        </span>
                        <span className="ml-2 text-xs text-[#6C776E] tabular-nums">
                          + {formatWholeNaira(product.deliveryFeeKobo)} delivery
                        </span>
                      </div>
                      <span className="text-xs text-[#5C665E] tabular-nums">
                        {product.stock} in stock
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={product.stock <= 0}
                        onClick={() => onStartDirectCheckout(product)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-[#111814] rounded-lg hover:bg-[#26332B] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                        Buy Direct
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenReferModal(product)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[#0B6E4F] bg-[#F3F8F6] border border-[#CBE2D8] rounded-lg hover:bg-[#E5F2EC] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Refer Product
                      </button>
                    </div>
                  </div>
                </div>
              </article>
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
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E4E4DE] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2">
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
                  <p className="text-xs text-[#5C665E] uppercase tracking-wider">
                    {selectedProduct.category} · {selectedProduct.sellerCity}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close product details"
                    className="p-1 text-[#5C665E] hover:text-[#111814] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="mt-2 font-display text-2xl font-bold text-[#111814]">
                  {selectedProduct.title}
                </h3>
                <p className="mt-1 text-xs text-[#0B6E4F] font-medium">
                  Seller: {selectedProduct.sellerName} (Verified Identity)
                </p>

                <p className="mt-4 text-sm text-[#4B554E] leading-relaxed">
                  {selectedProduct.description}
                </p>

                <div className="mt-5 pt-4 border-t border-[#ECECE6] space-y-2 text-xs text-[#4B554E]">
                  <p className="font-semibold text-[#111814]">Specifications &amp; Terms</p>
                  <ul className="space-y-1 list-disc list-inside">
                    {selectedProduct.specifications.map((spec) => (
                      <li key={spec}>{spec}</li>
                    ))}
                  </ul>
                  <p className="pt-2">Return policy: {selectedProduct.returnPolicy}</p>
                  <p>Warranty: {selectedProduct.warranty}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#ECECE6] space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="font-mono text-2xl font-bold text-[#111814] tabular-nums">
                      {formatWholeNaira(selectedProduct.priceKobo)}
                    </p>
                    <p className="text-xs text-[#5C665E] tabular-nums">
                      Delivery: {formatWholeNaira(selectedProduct.deliveryFeeKobo)} (excluded from
                      commission base)
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#111814] tabular-nums">
                    {selectedProduct.stock} units available
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
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-[#111814] rounded-lg hover:bg-[#26332B] cursor-pointer"
                  >
                    Buy Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = selectedProduct;
                      setSelectedProduct(null);
                      onOpenReferModal(p);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] cursor-pointer"
                  >
                    Refer Product
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
