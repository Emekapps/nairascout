'use client';

import { ShieldCheck, Share2, ShoppingBag, Store } from 'lucide-react';
import type { ProductListing } from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import ProductImage from '@/components/ProductImage';
import { UserAvatar } from '@/components/shared/UserAvatar';

interface ProductCardProps {
  product: ProductListing;
  onInspect: (product: ProductListing) => void;
  onBuyDirect: (product: ProductListing) => void;
  onRefer: (product: ProductListing) => void;
}

export function ProductCard({
  product,
  onInspect,
  onBuyDirect,
  onRefer,
}: ProductCardProps) {
  return (
    <article className="group rounded-2xl border border-border bg-card overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30">
      {/* Seller Attribution Strip */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar
            displayName={product.sellerName}
            size="sm"
            className="bg-secondary text-secondary-foreground border-border"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{product.sellerName}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>{product.sellerCity}</span>
              {product.hasActiveSellerBadge && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-foreground font-medium">
                    <Store className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                    ACTIVE
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {product.isSellerVerified && (
          <span
            title="KYC Verified Seller"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-success shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Verified
          </span>
        )}
      </div>

      {/* Product Media */}
      <button
        type="button"
        onClick={() => onInspect(product)}
        className="px-3 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-muted">
          <ProductImage
            src={product.imageUrl}
            alt={product.title}
            category={product.category}
            className="w-full h-full"
          />
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-xs text-[10px] font-sans font-semibold uppercase tracking-wider text-foreground">
            {product.category}
          </span>
        </div>
      </button>

      {/* Details & Monochrome Dual Actions */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => onInspect(product)}
            className="text-left block w-full cursor-pointer"
          >
            <h3 className="font-sans text-sm font-semibold line-clamp-1 text-foreground transition-colors">
              {product.title}
            </h3>
          </button>
          <p className="mt-1 font-sans text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-border">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="font-numeric text-base font-bold tabular-nums text-foreground">
                {formatWholeNaira(product.priceKobo)}
              </span>
              <span className="ml-1.5 font-numeric text-[11px] text-muted-foreground tabular-nums">
                + {formatWholeNaira(product.deliveryFeeKobo)}
              </span>
            </div>
            <span className="font-numeric text-[11px] text-muted-foreground tabular-nums">
              {product.stock} left · {product.daysRemaining}d
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => onBuyDirect(product)}
              className="inline-flex items-center justify-center gap-1.5 bg-commerce text-commerce-foreground hover:bg-commerce/90 disabled:opacity-45 font-sans text-xs font-bold uppercase tracking-wider rounded-lg h-10 transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
              BUY
            </button>
            <button
              type="button"
              onClick={() => onRefer(product)}
              className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90 font-sans text-xs font-bold uppercase tracking-wider rounded-lg h-10 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              REFER
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
