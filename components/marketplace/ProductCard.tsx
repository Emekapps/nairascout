'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';
import type { ProductListing } from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import { getVideoEmbedInfo } from '@/lib/media/video-links';
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
  const images =
    product.imageUrls && product.imageUrls.length > 0
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : [];
  const videos = product.videoLinks ?? [];
  const primaryVideo = videos[0] ?? null;

  const [activeSlide, setActiveSlide] = useState(0);
  const [videoMode, setVideoMode] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const safeSlideIndex = images.length > 0 ? Math.min(activeSlide, images.length - 1) : 0;
  const currentImageSrc = images[safeSlideIndex] || product.imageUrl;

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length <= 1) return;
    setActiveSlide((prev) => (prev <= 0 ? images.length - 1 : prev - 1));
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length <= 1) return;
    setActiveSlide((prev) => (prev >= images.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || images.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 36) {
      if (delta < 0) {
        setActiveSlide((prev) => (prev >= images.length - 1 ? 0 : prev + 1));
      } else {
        setActiveSlide((prev) => (prev <= 0 ? images.length - 1 : prev - 1));
      }
    }
    setTouchStartX(null);
  };

  const embedInfo = primaryVideo ? getVideoEmbedInfo(primaryVideo, { autoplay: true }) : null;

  return (
    <article className="group rounded-2xl border border-border bg-card overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30">
      {/* Seller Attribution Strip with Rounded-Square Business Logo Frame */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar
            avatarUrl={product.sellerLogoUrl}
            displayName={product.sellerName}
            size="sm"
            shape="rounded-square"
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

      {/* Product Media: Standard Slidable Image Mode OR Inline Video Deep-Link Mode */}
      {videoMode && primaryVideo && embedInfo ? (
        <div className="space-y-2">
          <div className="relative w-full h-[33.33vh] min-h-[220px] bg-black overflow-hidden">
            {embedInfo.embedUrl ? (
              <iframe
                src={embedInfo.embedUrl}
                title={`${product.title} video`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center text-white gap-3">
                <p className="text-xs font-medium text-white/80">
                  Short {embedInfo.platform} link detected. Open on {embedInfo.platform} to watch:
                </p>
                <a
                  href={embedInfo.safeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:opacity-90"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Watch on {embedInfo.platform}
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={() => setVideoMode(false)}
              aria-label="Close inline video player"
              className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/75 text-white hover:bg-black flex items-center justify-center shadow-md cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Shrunk Horizontal Multi-Item Image Carousel Below Video */}
          {images.length > 0 && (
            <div className="px-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {images.map((imgUrl, idx) => (
                <button
                  key={`${product.id}-thumb-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveSlide(idx);
                    onInspect(product);
                  }}
                  aria-label={`View image ${idx + 1} of ${images.length}`}
                  className={`relative h-14 w-14 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${
                    safeSlideIndex === idx
                      ? 'border-foreground ring-1 ring-foreground'
                      : 'border-border opacity-85 hover:opacity-100'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.title} thumbnail ${idx + 1}`}
                    category={product.category}
                    className="w-full h-full"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Host Platform Credit Attribution */}
          <div className="px-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{embedInfo.caption}</span>
            <a
              href={embedInfo.safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              Open
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : (
        <div
          className="px-3 text-left"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => onInspect(product)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onInspect(product);
              }
            }}
            aria-label={`Inspect ${product.title}`}
            className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-muted cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ProductImage
              src={currentImageSrc}
              alt={product.title}
              category={product.category}
              className="w-full h-full"
            />
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-xs text-[10px] font-sans font-semibold uppercase tracking-wider text-foreground">
              {product.category}
            </span>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous product image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white hover:bg-black/75 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next product image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white hover:bg-black/75 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <div
                  className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/45 backdrop-blur-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {images.map((_, idx) => (
                    <button
                      key={`${product.id}-dot-${idx}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlide(idx);
                      }}
                      aria-label={`Go to image ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        safeSlideIndex === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/55'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Bottom-right Deep Link Video Button */}
            {primaryVideo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoMode(true);
                }}
                aria-label={`Play ${primaryVideo.platform} video inline`}
                className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#292D2F]/90 text-white border border-white/20 hover:bg-black text-[11px] font-semibold shadow-md backdrop-blur-xs cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                <span>{primaryVideo.platform}</span>
              </button>
            )}
          </div>
        </div>
      )}

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
