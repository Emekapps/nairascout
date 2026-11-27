'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
} from 'lucide-react';
import type {
  MarketplaceOrder,
  NairaScoutSnapshot,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import { getVideoEmbedInfo } from '@/lib/media/video-links';
import {
  NAIRASCOUT_EARNINGS_DISCLAIMER,
  NAIRASCOUT_TAGLINE,
} from '@/lib/constants/foundation-content';
import ProductImage from '@/components/ProductImage';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import CheckoutDrawer from '@/components/CheckoutDrawer';
import ReferProductModal from '@/components/ReferProductModal';
import { VerifiedSellerFab } from '@/components/seller/VerifiedSellerFab';

// NS-PDP-002 - NS-PDP-008: Dedicated Product Detail Page with Warm Botanical Earth & Forest Olive Design
interface ProductDetailViewProps {
  initialSnapshot: NairaScoutSnapshot;
  product: ProductListing;
  initialReferralEvent: ProductReferralEvent | null;
}

type AccordionKey = 'specs' | 'delivery' | 'returns' | 'seller';

export default function ProductDetailView({
  initialSnapshot,
  product,
  initialReferralEvent,
}: ProductDetailViewProps) {
  const [snapshot, setSnapshot] = useState<NairaScoutSnapshot>(initialSnapshot);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [activeVideoIdx, setActiveVideoIdx] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () => product.variants?.[0]?.id ?? null
  );
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [openAccordions, setOpenAccordions] = useState<Record<AccordionKey, boolean>>({
    specs: true,
    delivery: false,
    returns: false,
    seller: false,
  });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [referModalOpen, setReferModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  const liveProduct =
    snapshot.products.find((p) => p.id === product.id) ??
    snapshot.sellerListings.find((p) => p.id === product.id) ??
    product;

  const activeReferralEvent =
    initialReferralEvent && initialReferralEvent.productListingId === liveProduct.id
      ? (snapshot.referralsInbox.find((r) => r.id === initialReferralEvent.id) ??
        initialReferralEvent)
      : null;

  const images =
    liveProduct.imageUrls && liveProduct.imageUrls.length > 0
      ? liveProduct.imageUrls.slice(0, 10)
      : liveProduct.imageUrl
        ? [liveProduct.imageUrl]
        : [];
  const safeImageIdx = images.length > 0 ? Math.min(activeImageIdx, images.length - 1) : 0;
  const videos = liveProduct.videoLinks ?? [];
  const primaryVideo = videos[0] ?? null;
  const activeVideo =
    activeVideoIdx !== null && videos[activeVideoIdx]
      ? getVideoEmbedInfo(videos[activeVideoIdx], { autoplay: true })
      : null;

  const variants = liveProduct.variants ?? [];
  const hasConditionalVariants = variants.length > 1;
  const activeVariant = hasConditionalVariants
    ? (variants.find((v) => v.id === selectedVariantId) ?? variants[0])
    : null;

  const unreadNotificationsCount = (snapshot.notifications ?? []).filter(
    (n) => !(n.isRead ?? n.read)
  ).length;

  useEffect(() => {
    if (!activeReferralEvent?.id) return;
    void fetch('/api/nairascout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'NairaScout',
      },
      body: JSON.stringify({
        action: 'mark_referral_opened',
        referralEventId: activeReferralEvent.id,
      }),
    }).catch(() => undefined);
  }, [activeReferralEvent?.id]);

  const showFeedback = (type: 'ok' | 'err', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const callApi = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/nairascout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'NairaScout',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback('err', data.error || 'Action could not be completed.');
      return null;
    }
    if (data.snapshot) {
      setSnapshot(data.snapshot);
    }
    return data;
  };

  const handleConfirmOrder = async (payload: {
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
  }): Promise<MarketplaceOrder | null> => {
    const data = await callApi({ action: 'checkout', ...payload });
    if (!data?.order) return null;
    showFeedback(
      'ok',
      `Order ${data.order.id} placed (${
        data.order.attributionType === 'referral_card' ? 'Referral-Attributed' : 'Direct'
      }).`
    );
    return data.order;
  };

  const handleSendReferral = async (payload: {
    productListingId: string;
    recipientScoutIds: string[];
    note: string;
  }): Promise<ProductReferralEvent[] | null> => {
    const data = await callApi({ action: 'refer_product', ...payload });
    const events: ProductReferralEvent[] = Array.isArray(data?.events)
      ? data.events
      : data?.event
        ? [data.event]
        : [];
    if (events.length === 0) return null;
    showFeedback(
      'ok',
      events.length === 1
        ? `Referral card ${events[0].id} sent to @${events[0].recipientHandle}.`
        : `${events.length} referral cards dispatched across your Scouts List.`
    );
    return events;
  };

  const goPrevImage = () => {
    if (images.length <= 1) return;
    setActiveVideoIdx(null);
    setActiveImageIdx((prev) => (prev <= 0 ? images.length - 1 : prev - 1));
  };

  const goNextImage = () => {
    if (images.length <= 1) return;
    setActiveVideoIdx(null);
    setActiveImageIdx((prev) => (prev >= images.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || images.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 36) {
      if (delta < 0) goNextImage();
      else goPrevImage();
    }
    setTouchStartX(null);
  };

  const toggleAccordion = (key: AccordionKey) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isExpiredReferral = activeReferralEvent?.status === 'expired';
  const hasActiveReferral = Boolean(activeReferralEvent && !isExpiredReferral);
  const outOfStock = liveProduct.stock <= 0;
  const effectiveQuantity = outOfStock
    ? 1
    : Math.max(1, Math.min(liveProduct.stock, selectedQuantity));
  const merchTotalKobo = liveProduct.priceKobo * effectiveQuantity;
  const totalWithDeliveryKobo = merchTotalKobo + liveProduct.deliveryFeeKobo;
  const unitsSold = liveProduct.unitsSold ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
      <header className="sticky top-0 z-30 h-14 sm:h-16 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-muted-foreground transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Feed
          </Link>

          <Link
            href="/"
            className="hidden sm:inline-block font-brand font-extrabold text-lg tracking-tight text-foreground whitespace-nowrap shrink-0"
          >
            NairaScout
          </Link>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/notifications"
              aria-label={
                unreadNotificationsCount > 0
                  ? `Notifications (${unreadNotificationsCount} unread)`
                  : 'Notifications'
              }
              className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {unreadNotificationsCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white font-numeric text-[10px] font-bold tabular-nums flex items-center justify-center shadow-xs"
                >
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`border-b px-4 py-2.5 text-xs font-bold text-center ${
            feedback.type === 'ok'
              ? 'bg-[#F2F6F2] border-[#5C7C5D]/40 text-[#2E5339] dark:bg-[#1F2E24] dark:border-[#6E9470]/40 dark:text-[#F4F2ED]'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5">
        {/* Referral Attribution Banner when arriving via /r/[referralEventId] or ?ref= */}
        {activeReferralEvent && (
          <div className="rounded-2xl border border-[#5C7C5D]/40 bg-[#F2F6F2] dark:border-[#6E9470]/40 dark:bg-[#1F2E24] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 font-bold text-[#2E5339] dark:text-[#F4F2ED]">
                <CheckCircle2
                  className="w-4 h-4 text-[#5C7C5D] dark:text-[#6E9470] shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {isExpiredReferral
                    ? `Referral Card Expired (${activeReferralEvent.id})`
                    : `Referral-Card Attribution Active (${activeReferralEvent.id})`}
                </span>
              </div>
              <p className="text-foreground/90">
                Referred by{' '}
                <span className="font-bold">{activeReferralEvent.senderDisplayName}</span> (@
                {activeReferralEvent.senderHandle}).{' '}
                {isExpiredReferral
                  ? 'This referral window has expired; direct purchase remains available.'
                  : 'Purchasing now preserves referral attribution across Email OTP verification and checkout.'}
              </p>
              {activeReferralEvent.note && (
                <p className="text-muted-foreground italic">
                  &ldquo;{activeReferralEvent.note}&rdquo;
                </p>
              )}
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#2E5339] dark:bg-[#3A6B49] text-white font-numeric text-[11px] font-bold shrink-0 self-start sm:self-center">
              {isExpiredReferral ? 'Expired' : '30-Day Window'}
            </span>
          </div>
        )}

        {/* NS-PDP-002: Centered Rounded Product Detail Container */}
        <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* LEFT COLUMN: Desktop Vertical Strip + Main Showcase; Mobile Main Showcase + Carousel Directly Underneath */}
            <div className="lg:col-span-6 space-y-3 lg:sticky lg:top-24">
              <div className="flex flex-col lg:flex-row gap-3">
                {/* Desktop Vertical Thumbnail Strip (64px x 64px squares on left edge) */}
                {(images.length > 1 || (images.length === 1 && videos.length > 0)) && (
                  <div className="hidden lg:flex lg:flex-col gap-2.5 w-16 shrink-0 max-h-[520px] overflow-y-auto scrollbar-none">
                    {images.map((imgUrl, idx) => {
                      const active = activeVideoIdx === null && safeImageIdx === idx;
                      return (
                        <button
                          key={`desktop-thumb-${idx}`}
                          type="button"
                          onClick={() => {
                            setActiveVideoIdx(null);
                            setActiveImageIdx(idx);
                          }}
                          aria-label={`Select photo ${idx + 1}`}
                          className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#EDE4D7] dark:bg-[#262E2A] transition-all cursor-pointer ${
                            active
                              ? 'border-2 border-[#5C7C5D] dark:border-[#6E9470] ring-1 ring-[#5C7C5D]/40'
                              : 'border border-border opacity-80 hover:opacity-100'
                          }`}
                        >
                          <ProductImage
                            src={imgUrl}
                            alt={`${liveProduct.title} thumbnail ${idx + 1}`}
                            category={liveProduct.category}
                            className="w-full h-full bg-[#EDE4D7] dark:bg-[#262E2A]"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Main Product Showcase Frame */}
                <div className="flex-1 min-w-0">
                  {activeVideo ? (
                    <div className="relative aspect-square lg:aspect-[4/5] w-full rounded-xl overflow-hidden bg-black">
                      {activeVideo.embedUrl ? (
                        <iframe
                          src={activeVideo.embedUrl}
                          title={`${liveProduct.title} video`}
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                          className="w-full h-full border-0"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white gap-3">
                          <p className="text-xs font-medium text-white/85">
                            Short {activeVideo.platform} link detected. Watch on{' '}
                            {activeVideo.platform}:
                          </p>
                          <a
                            href={activeVideo.safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-[#1E241E] text-xs font-bold hover:opacity-90"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            Watch on {activeVideo.platform}
                          </a>
                        </div>
                      )}

                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-bold">
                        {activeVideo.platform}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveVideoIdx(null)}
                        className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-bold hover:bg-black cursor-pointer"
                      >
                        Back to Photos
                      </button>
                    </div>
                  ) : (
                    <div
                      className="relative aspect-square lg:aspect-[4/5] w-full rounded-xl overflow-hidden bg-[#EDE4D7] dark:bg-[#262E2A] border border-border"
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                    >
                      <ProductImage
                        src={images[safeImageIdx] || liveProduct.imageUrl}
                        alt={liveProduct.title}
                        category={liveProduct.category}
                        className="w-full h-full bg-[#EDE4D7] dark:bg-[#262E2A]"
                      />

                      {images.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={goPrevImage}
                            aria-label="Previous product image"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={goNextImage}
                            aria-label="Next product image"
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-5 h-5" aria-hidden="true" />
                          </button>
                          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xs">
                            {images.map((_, idx) => (
                              <button
                                key={`pdp-dot-${idx}`}
                                type="button"
                                onClick={() => setActiveImageIdx(idx)}
                                aria-label={`View image ${idx + 1}`}
                                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                  safeImageIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/55'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {/* NS-PDP-003: Bottom-right Deep Link Video Button */}
                      {primaryVideo && (
                        <button
                          type="button"
                          onClick={() => setActiveVideoIdx(0)}
                          aria-label={`Play ${primaryVideo.platform} video inline`}
                          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1E241E]/90 text-white border border-white/20 hover:bg-[#1E241E] text-xs font-bold shadow-md backdrop-blur-xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                          <span>{primaryVideo.platform} Video</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* NS-PDP-002 Mobile Layout: Multi-Item Thumbnail Carousel DIRECTLY UNDERNEATH main product image frame */}
              {(images.length > 1 || (images.length === 1 && videos.length > 0)) && (
                <div className="lg:hidden overflow-x-auto scrollbar-none pb-0.5">
                  <div className="flex items-center gap-2.5 w-max">
                    {images.map((imgUrl, idx) => {
                      const active = activeVideoIdx === null && safeImageIdx === idx;
                      return (
                        <button
                          key={`mobile-thumb-${idx}`}
                          type="button"
                          onClick={() => {
                            setActiveVideoIdx(null);
                            setActiveImageIdx(idx);
                          }}
                          aria-label={`Select photo ${idx + 1}`}
                          className={`relative h-16 w-16 rounded-lg overflow-hidden shrink-0 bg-[#EDE4D7] dark:bg-[#262E2A] transition-all cursor-pointer ${
                            active
                              ? 'border-2 border-[#5C7C5D] dark:border-[#6E9470]'
                              : 'border border-border opacity-80 hover:opacity-100'
                          }`}
                        >
                          <ProductImage
                            src={imgUrl}
                            alt={`${liveProduct.title} photo ${idx + 1}`}
                            category={liveProduct.category}
                            className="w-full h-full bg-[#EDE4D7] dark:bg-[#262E2A]"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Additional Seller Video Links (if multiple videos attached or host attribution when playing) */}
              {videos.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {videos.map((vid, idx) => {
                      const info = getVideoEmbedInfo(vid);
                      const isPlaying = activeVideoIdx === idx;
                      return info.embedUrl ? (
                        <button
                          key={`pdp-vid-${idx}`}
                          type="button"
                          onClick={() => setActiveVideoIdx(isPlaying ? null : idx)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            isPlaying
                              ? 'bg-[#2E5339] dark:bg-[#3A6B49] text-white border-transparent'
                              : 'bg-card text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                          {vid.platform} #{idx + 1}
                        </button>
                      ) : (
                        <a
                          key={`pdp-vid-${idx}`}
                          href={info.safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-card text-foreground border border-border hover:bg-muted"
                        >
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          {vid.platform} #{idx + 1}
                        </a>
                      );
                    })}
                  </div>
                  {activeVideo && (
                    <a
                      href={activeVideo.safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      Open on {activeVideo.platform}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Header, Social Proof, Variants, Option A Purchase Box, Benefits, CTAs, Trust Strip & Accordions */}
            <div className="lg:col-span-6 space-y-5">
              {/* NS-PDP-004: Eyebrow Tag + Title + Real Social Proof + Summary */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1 text-[#1E241E] dark:text-[#F4F2ED]">
                    <Star
                      className="w-3.5 h-3.5 fill-[#C88A2B] text-[#C88A2B] dark:fill-[#E0A13B] dark:text-[#E0A13B]"
                      aria-hidden="true"
                    />
                    {liveProduct.category}
                  </span>
                  {liveProduct.isSellerVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F2F6F2] dark:bg-[#1F2E24] border border-[#5C7C5D]/40 text-[#2E5339] dark:text-[#6E9470] font-bold">
                      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      VERIFIED SELLER
                    </span>
                  )}
                </div>

                <h1 className="font-sans text-2xl sm:text-3xl font-black tracking-tight text-[#1E241E] dark:text-[#F4F2ED] text-balance leading-tight">
                  {liveProduct.title}
                </h1>

                {/* Real NairaScout Social Proof Row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Flame
                      className="w-3.5 h-3.5 text-[#C88A2B] dark:text-[#E0A13B]"
                      aria-hidden="true"
                    />
                    {unitsSold} sold on NairaScout
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    ·
                  </span>
                  <span className="text-[#5C7C5D] dark:text-[#6E9470]">
                    {liveProduct.isSellerVerified ? 'Verified Seller' : 'Marketplace Seller'}
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    ·
                  </span>
                  <span className="text-muted-foreground font-normal">10-Day Fulfilment SLA</span>
                </div>

                <p className="text-sm text-[#596059] dark:text-[#B2B8B2] leading-relaxed line-clamp-2">
                  {liveProduct.description}
                </p>
              </div>

              {/* NS-PDP-004b: Conditional Variant / Option Swatch Row (ONLY when Seller configured options) */}
              {hasConditionalVariants && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#596059] dark:text-[#B2B8B2]">
                    CHOOSE OPTION
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {variants.map((variant) => {
                      const isSelected = activeVariant?.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVariantId(variant.id)}
                          className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-2 border-[#5C7C5D] bg-[#F2F6F2] dark:border-[#6E9470] dark:bg-[#1F2E24]'
                              : 'border border-border bg-card hover:bg-muted'
                          }`}
                        >
                          {variant.imageUrl ? (
                            <span className="w-6 h-6 rounded-full overflow-hidden bg-[#EDE4D7] dark:bg-[#262E2A] shrink-0 border border-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={variant.imageUrl}
                                alt={variant.label}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-[#EDE4D7] dark:bg-[#262E2A] border border-border shrink-0" />
                          )}
                          <span className="text-xs font-bold text-[#1E241E] dark:text-[#F4F2ED] whitespace-nowrap">
                            {variant.label}
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white inline-flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NS-PDP-005: Option A Purchase Box (#F7F5F0 / #222925) */}
              <div className="rounded-2xl bg-[#F7F5F0] dark:bg-[#222925] border border-border p-4 space-y-3.5">
                {/* Top Section: Unit Price & Delivery Breakdown Card */}
                <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#596059] dark:text-[#B2B8B2]">
                      UNIT PRICE
                    </p>
                    <p className="font-numeric text-2xl sm:text-3xl font-black text-[#1E241E] dark:text-[#F4F2ED] tabular-nums leading-none">
                      {formatWholeNaira(liveProduct.priceKobo)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="text-[11px] text-[#596059] dark:text-[#B2B8B2]">
                        Per unit
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide font-numeric tabular-nums ${
                          outOfStock
                            ? 'bg-destructive text-destructive-foreground'
                            : 'bg-[#5C7C5D] dark:bg-[#6E9470] text-white'
                        }`}
                      >
                        {outOfStock ? 'OUT OF STOCK' : `${liveProduct.stock} IN STOCK`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:border-l sm:border-border sm:pl-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#596059] dark:text-[#B2B8B2]">
                      DELIVERY FEE
                    </p>
                    <p className="font-numeric text-xl sm:text-2xl font-black text-[#1E241E] dark:text-[#F4F2ED] tabular-nums leading-none">
                      {liveProduct.deliveryFeeKobo === 0
                        ? 'FREE DELIVERY'
                        : formatWholeNaira(liveProduct.deliveryFeeKobo)}
                    </p>
                    <p className="text-[11px] text-[#596059] dark:text-[#B2B8B2]">
                      Ships from {liveProduct.sellerCity} · 10-Calendar-Day Fulfilment SLA
                    </p>
                  </div>
                </div>

                {/* Bottom Section: 3-Column Quantity Selector (1 Unit, 2 Units, 3 Units) */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { qty: 1, label: '1 Unit', badge: 'STANDARD' },
                    { qty: 2, label: '2 Units', badge: '2× QTY' },
                    { qty: 3, label: '3 Units', badge: '3× QTY' },
                  ].map((tier) => {
                    const unavailable = tier.qty > liveProduct.stock;
                    const selected = !outOfStock && effectiveQuantity === tier.qty;
                    return (
                      <button
                        key={tier.qty}
                        type="button"
                        disabled={unavailable}
                        onClick={() => setSelectedQuantity(tier.qty)}
                        className={`rounded-xl p-2.5 sm:p-3 text-left transition-all flex flex-col justify-between gap-1.5 ${
                          unavailable
                            ? 'opacity-45 cursor-not-allowed border border-[#E2DDD5] dark:border-[#2E3631] bg-card'
                            : selected
                              ? 'border-2 border-[#5C7C5D] bg-[#F2F6F2] dark:border-[#6E9470] dark:bg-[#1F2E24] cursor-pointer shadow-xs'
                              : 'border border-[#E2DDD5] dark:border-[#2E3631] bg-card hover:border-[#5C7C5D]/60 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                            {tier.label}
                          </span>
                          {selected && (
                            <span className="w-4 h-4 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white inline-flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        <p className="font-numeric text-xs sm:text-sm font-black text-[#1E241E] dark:text-[#F4F2ED] tabular-nums">
                          {formatWholeNaira(liveProduct.priceKobo * tier.qty)}
                        </p>
                        <span className="inline-block self-start px-1.5 py-0.5 rounded-md bg-[#F7F5F0] dark:bg-[#222925] border border-border text-[9px] font-bold uppercase tracking-wider text-[#596059] dark:text-[#B2B8B2]">
                          {tier.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Quantity Stepper when Stock > 3 */}
                {liveProduct.stock > 3 && (
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="font-bold text-[#596059] dark:text-[#B2B8B2]">
                      Need more than 3 units?
                    </span>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                        className="w-7 h-7 rounded-lg border border-border bg-card text-foreground flex items-center justify-center hover:bg-muted cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-numeric font-bold text-foreground w-6 text-center tabular-nums">
                        {effectiveQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedQuantity((q) => Math.min(liveProduct.stock, q + 1))
                        }
                        aria-label="Increase quantity"
                        className="w-7 h-7 rounded-lg border border-border bg-card text-foreground flex items-center justify-center hover:bg-muted cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* NS-PDP-006: 3-Line Benefits Checklist */}
              <ul className="space-y-2.5 text-xs sm:text-sm text-[#1E241E] dark:text-[#F4F2ED]">
                {[
                  'Seller fulfils within 10 calendar days of verified payment',
                  'Direct marketplace purchase or traceable referral attribution',
                  'Transparent delivery & return policy backed by NairaScout support',
                ].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#5C7C5D] dark:bg-[#6E9470] text-white inline-flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                    </span>
                    <span className="leading-snug">{benefit}</span>
                  </li>
                ))}
              </ul>

              {/* NS-PDP-006: Action Buttons (Rich Saddle Bronze #6B4214 BUY DIRECT + Deep Forest Olive #2E5339 REFER) */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full h-12 px-5 rounded-xl bg-[#6B4214] hover:bg-[#56340F] dark:bg-[#8A5820] dark:hover:bg-[#754A1A] text-[#FFFFFF] disabled:opacity-45 font-sans text-xs sm:text-sm font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="font-numeric tabular-nums">
                    {outOfStock
                      ? 'Out of Stock'
                      : `${hasActiveReferral ? 'BUY VIA REFERRAL' : 'BUY DIRECT'} — ${formatWholeNaira(totalWithDeliveryKobo)}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReferModalOpen(true)}
                  className="w-full h-12 px-5 rounded-xl bg-[#2E5339] hover:bg-[#23412C] dark:bg-[#3A6B49] dark:hover:bg-[#305A3D] text-[#FFFFFF] font-sans text-xs sm:text-sm font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>REFER TO SCOUTS LIST / SHARE LINK</span>
                </button>
              </div>

              {/* NS-PDP-007: Three-Column Trust Strip */}
              <div className="grid grid-cols-3 gap-3 py-4 border-y border-border text-center">
                <div className="space-y-1">
                  <ShieldCheck
                    className="w-5 h-5 mx-auto text-[#6B4214] dark:text-[#E0A13B]"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                    Verified Seller
                  </p>
                  <p className="text-[11px] text-[#596059] dark:text-[#B2B8B2] leading-tight">
                    KYC &amp; business checked
                  </p>
                </div>

                <div className="space-y-1">
                  <Truck
                    className="w-5 h-5 mx-auto text-[#6B4214] dark:text-[#E0A13B]"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                    10-Day SLA
                  </p>
                  <p className="text-[11px] text-[#596059] dark:text-[#B2B8B2] leading-tight">
                    Tracked Seller fulfilment
                  </p>
                </div>

                <div className="space-y-1">
                  <RotateCcw
                    className="w-5 h-5 mx-auto text-[#6B4214] dark:text-[#E0A13B]"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                    Buyer Protection
                  </p>
                  <p className="text-[11px] text-[#596059] dark:text-[#B2B8B2] leading-tight">
                    Structured return &amp; dispute review
                  </p>
                </div>
              </div>

              {/* NS-PDP-007: Expandable Accordion Rows (+ / - toggle) */}
              <div className="divide-y divide-border border-b border-border">
                {/* 1. Product Specifications */}
                <div>
                  <button
                    type="button"
                    aria-expanded={openAccordions.specs}
                    onClick={() => toggleAccordion('specs')}
                    className="w-full py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <span className="font-sans text-sm font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                      Product Specifications
                    </span>
                    {openAccordions.specs ? (
                      <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {openAccordions.specs && (
                    <div className="pb-4 space-y-2.5 text-xs text-[#596059] dark:text-[#B2B8B2] leading-relaxed">
                      <p className="whitespace-pre-line">{liveProduct.description}</p>
                      {liveProduct.specifications && liveProduct.specifications.length > 0 && (
                        <ul className="space-y-1 list-disc list-inside text-[#1E241E] dark:text-[#F4F2ED]">
                          {liveProduct.specifications.map((spec) => (
                            <li key={spec}>{spec}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Delivery & Fulfilment Details */}
                <div>
                  <button
                    type="button"
                    aria-expanded={openAccordions.delivery}
                    onClick={() => toggleAccordion('delivery')}
                    className="w-full py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <span className="font-sans text-sm font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                      Delivery &amp; Fulfilment Details
                    </span>
                    {openAccordions.delivery ? (
                      <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {openAccordions.delivery && (
                    <div className="pb-4 space-y-1.5 text-xs text-[#596059] dark:text-[#B2B8B2] leading-relaxed">
                      <p>
                        <strong className="text-[#1E241E] dark:text-[#F4F2ED]">
                          Dispatch Location:
                        </strong>{' '}
                        {liveProduct.sellerCity}
                      </p>
                      <p>
                        <strong className="text-[#1E241E] dark:text-[#F4F2ED]">
                          Delivery Charge:
                        </strong>{' '}
                        <span className="font-numeric tabular-nums">
                          {liveProduct.deliveryFeeKobo === 0
                            ? 'FREE DELIVERY'
                            : formatWholeNaira(liveProduct.deliveryFeeKobo)}
                        </span>{' '}
                        (excluded from referral commission pool)
                      </p>
                      <p>
                        Seller fulfils within 10 calendar days of verified payment. Commissions
                        stay Pending until delivery confirmation and dispute checks pass.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Return Policy & Warranty */}
                <div>
                  <button
                    type="button"
                    aria-expanded={openAccordions.returns}
                    onClick={() => toggleAccordion('returns')}
                    className="w-full py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <span className="font-sans text-sm font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                      Return Policy &amp; Warranty
                    </span>
                    {openAccordions.returns ? (
                      <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {openAccordions.returns && (
                    <div className="pb-4 space-y-1.5 text-xs text-[#596059] dark:text-[#B2B8B2] leading-relaxed">
                      <p>
                        <strong className="text-[#1E241E] dark:text-[#F4F2ED]">
                          Return Policy:
                        </strong>{' '}
                        {liveProduct.returnPolicy}
                      </p>
                      <p>
                        <strong className="text-[#1E241E] dark:text-[#F4F2ED]">Warranty:</strong>{' '}
                        {liveProduct.warranty}
                      </p>
                      <p>
                        Statutory Nigerian consumer rights apply alongside NairaScout dispute
                        support.
                      </p>
                    </div>
                  )}
                </div>

                {/* 4. Seller Information */}
                <div>
                  <button
                    type="button"
                    aria-expanded={openAccordions.seller}
                    onClick={() => toggleAccordion('seller')}
                    className="w-full py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <span className="font-sans text-sm font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                      Seller Information
                    </span>
                    {openAccordions.seller ? (
                      <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {openAccordions.seller && (
                    <div className="pb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          avatarUrl={liveProduct.sellerLogoUrl}
                          displayName={liveProduct.sellerName}
                          size="md"
                          shape="rounded-square"
                          className="bg-[#EDE4D7] dark:bg-[#262E2A] text-foreground border-border"
                        />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold text-[#1E241E] dark:text-[#F4F2ED] truncate">
                            {liveProduct.sellerName}
                          </p>
                          <p className="text-xs text-[#596059] dark:text-[#B2B8B2] flex items-center gap-1.5 flex-wrap">
                            <span>{liveProduct.sellerCity}</span>
                            <span>·</span>
                            <span>{liveProduct.category}</span>
                            {liveProduct.hasActiveSellerBadge && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                                  <Store className="w-3 h-3" aria-hidden="true" />
                                  ACTIVE
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {liveProduct.isSellerVerified && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F2F6F2] dark:bg-[#1F2E24] border border-[#5C7C5D]/40 text-[#2E5339] dark:text-[#6E9470] text-[11px] font-bold shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          KYC Verified
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#F7F5F0] dark:bg-[#222925] border border-border p-3.5 text-[11px] text-[#596059] dark:text-[#B2B8B2] space-y-1 leading-relaxed">
                <p className="font-bold text-[#1E241E] dark:text-[#F4F2ED]">
                  NairaScout · {NAIRASCOUT_TAGLINE}
                </p>
                <p>{NAIRASCOUT_EARNINGS_DISCLAIMER}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky Mobile Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-md px-4 py-2.5 pb-safe">
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => setCheckoutOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl bg-[#6B4214] hover:bg-[#56340F] dark:bg-[#8A5820] dark:hover:bg-[#754A1A] text-[#FFFFFF] disabled:opacity-45 font-sans text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {outOfStock ? 'Out of Stock' : hasActiveReferral ? 'BUY REFERRAL' : 'BUY DIRECT'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setReferModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl bg-[#2E5339] hover:bg-[#23412C] dark:bg-[#3A6B49] dark:hover:bg-[#305A3D] text-[#FFFFFF] font-sans text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>REFER</span>
          </button>
        </div>
      </div>

      <CheckoutDrawer
        key={checkoutOpen ? `${liveProduct.id}-${effectiveQuantity}` : 'closed'}
        authenticated={snapshot.authenticated}
        session={
          checkoutOpen
            ? {
                product: liveProduct,
                referralEvent: isExpiredReferral ? null : activeReferralEvent,
                initialQuantity: effectiveQuantity,
                selectedVariantLabel: activeVariant?.label ?? null,
              }
            : null
        }
        onClose={() => setCheckoutOpen(false)}
        onOtpAuthenticated={(nextSnapshot) => {
          setSnapshot(nextSnapshot);
          showFeedback('ok', 'Email verified. Complete your order below.');
        }}
        onConfirmOrder={handleConfirmOrder}
      />

      <ReferProductModal
        key={referModalOpen ? liveProduct.id : 'closed'}
        product={referModalOpen ? liveProduct : null}
        snapshot={snapshot}
        onClose={() => setReferModalOpen(false)}
        onSendReferral={handleSendReferral}
      />

      <VerifiedSellerFab
        authenticated={snapshot.authenticated}
        activeScout={snapshot.activeScout}
      />
    </div>
  );
}
