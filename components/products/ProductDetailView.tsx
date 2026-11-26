'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Package,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingBag,
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

// NS-UI-022, NS-UI-023, NS-UI-024: Dedicated Product Detail Page replacing modal overlay
interface ProductDetailViewProps {
  initialSnapshot: NairaScoutSnapshot;
  product: ProductListing;
  initialReferralEvent: ProductReferralEvent | null;
}

export default function ProductDetailView({
  initialSnapshot,
  product,
  initialReferralEvent,
}: ProductDetailViewProps) {
  const [snapshot, setSnapshot] = useState<NairaScoutSnapshot>(initialSnapshot);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [activeVideoIdx, setActiveVideoIdx] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
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
  const activeVideo =
    activeVideoIdx !== null && videos[activeVideoIdx]
      ? getVideoEmbedInfo(videos[activeVideoIdx], { autoplay: true })
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

  const isExpiredReferral = activeReferralEvent?.status === 'expired';
  const outOfStock = liveProduct.stock <= 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Feed
          </Link>

          <Link
            href="/"
            className="hidden sm:inline-block font-brand font-extrabold text-lg tracking-tight text-foreground"
          >
            NairaScout
          </Link>

          <div className="flex items-center gap-2.5">
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
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#005B46] text-white font-numeric text-[10px] font-bold tabular-nums flex items-center justify-center shadow-xs"
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
          className={`border-b px-4 py-2.5 text-xs font-medium text-center ${
            feedback.type === 'ok'
              ? 'bg-[#005B46]/10 border-[#005B46]/30 text-[#005B46] dark:bg-[#005B46] dark:text-white'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Referral Attribution Banner when arriving via /r/[referralEventId] or ?ref= */}
        {activeReferralEvent && (
          <div className="rounded-2xl border border-[#005B46]/30 bg-[#005B46]/10 dark:bg-[#005B46]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 font-semibold text-[#005B46] dark:text-[#34D399]">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {isExpiredReferral
                    ? `Referral Card Expired (${activeReferralEvent.id})`
                    : `Referral-Card Attribution Active (${activeReferralEvent.id})`}
                </span>
              </div>
              <p className="text-foreground/90">
                Referred by <span className="font-semibold">{activeReferralEvent.senderDisplayName}</span>{' '}
                (@{activeReferralEvent.senderHandle}).{' '}
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
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#005B46] text-white font-numeric text-[11px] font-semibold shrink-0 self-start sm:self-center">
              {isExpiredReferral ? 'Expired' : '30-Day Window'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Slidable Gallery (up to 10 images) & Video Links */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {activeVideo ? (
                <div className="relative aspect-[4/3] w-full bg-black">
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
                      <p className="text-xs font-medium text-white/80">
                        Short {activeVideo.platform} link detected. Open on {activeVideo.platform} to watch:
                      </p>
                      <a
                        href={activeVideo.safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:opacity-90"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        Watch on {activeVideo.platform}
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveVideoIdx(null)}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-semibold hover:bg-black cursor-pointer"
                  >
                    Back to Photos
                  </button>
                </div>
              ) : (
                <div
                  className="relative aspect-[4/3] w-full bg-muted"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <ProductImage
                    src={images[safeImageIdx] || liveProduct.imageUrl}
                    alt={liveProduct.title}
                    category={liveProduct.category}
                    className="w-full h-full"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur-xs text-[11px] font-sans font-semibold uppercase tracking-wider text-foreground">
                    {liveProduct.category}
                  </span>

                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrevImage}
                        aria-label="Previous product image"
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={goNextImage}
                        aria-label="Next product image"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" aria-hidden="true" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xs">
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
                </div>
              )}

              {/* Thumbnail Strip (up to 10 images) */}
              {images.length > 1 && (
                <div className="p-3 border-t border-border bg-card overflow-x-auto no-scrollbar scrollbar-none">
                  <div className="flex items-center gap-2 w-max">
                    {images.map((imgUrl, idx) => {
                      const active = activeVideoIdx === null && safeImageIdx === idx;
                      return (
                        <button
                          key={`pdp-thumb-${idx}`}
                          type="button"
                          onClick={() => {
                            setActiveVideoIdx(null);
                            setActiveImageIdx(idx);
                          }}
                          aria-label={`Select photo ${idx + 1}`}
                          className={`relative h-16 w-16 rounded-xl overflow-hidden shrink-0 border transition-all cursor-pointer ${
                            active
                              ? 'border-foreground ring-2 ring-foreground'
                              : 'border-border opacity-80 hover:opacity-100'
                          }`}
                        >
                          <ProductImage
                            src={imgUrl}
                            alt={`${liveProduct.title} photo ${idx + 1}`}
                            category={liveProduct.category}
                            className="w-full h-full"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Embedded / Linked Product Videos */}
            {videos.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Product Videos ({videos.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {videos.map((vid, idx) => {
                    const info = getVideoEmbedInfo(vid);
                    const isPlaying = activeVideoIdx === idx;
                    return (
                      <div key={`pdp-vid-${idx}`} className="flex items-center gap-1.5">
                        {info.embedUrl ? (
                          <button
                            type="button"
                            onClick={() => setActiveVideoIdx(isPlaying ? null : idx)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                              isPlaying
                                ? 'bg-[#000000] text-[#FFFFFF] border-[#000000] dark:bg-white dark:text-black dark:border-white'
                                : 'bg-[#FFFFFF] text-[#000000] border-input dark:bg-secondary dark:text-foreground dark:border-border hover:opacity-90'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                            {vid.platform} Video #{idx + 1}
                          </button>
                        ) : (
                          <a
                            href={info.safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#FFFFFF] text-[#000000] border border-input dark:bg-secondary dark:text-foreground dark:border-border hover:opacity-90"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            Watch on {vid.platform} #{idx + 1}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Price, Seller Card, Policies & BUY DIRECT / REFER Actions */}
          <div className="lg:col-span-5 space-y-5">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    {liveProduct.category} · {liveProduct.sellerCity}
                  </span>
                  <span className="font-numeric tabular-nums">
                    {liveProduct.stock > 0
                      ? `${liveProduct.stock} units in stock · ${liveProduct.daysRemaining}d left`
                      : 'Out of stock'}
                  </span>
                </div>

                <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {liveProduct.title}
                </h1>
              </div>

              <div className="pt-4 border-t border-border space-y-1">
                <p className="font-numeric text-3xl font-bold text-foreground tabular-nums">
                  {formatWholeNaira(liveProduct.priceKobo)}
                </p>
                <p className="font-numeric text-xs text-muted-foreground tabular-nums">
                  Delivery: {formatWholeNaira(liveProduct.deliveryFeeKobo)} (excluded from
                  commission base)
                </p>
              </div>

              {/* Desktop / Tablet Primary Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => setCheckoutOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 h-12 px-4 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-[#FFFFFF] disabled:opacity-45 font-sans text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                  BUY DIRECT
                </button>
                <button
                  type="button"
                  onClick={() => setReferModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 h-12 px-4 rounded-xl bg-[#000000] hover:bg-[#1A1A1A] text-[#FFFFFF] border border-transparent dark:border-[#2E2E2E] font-sans text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  REFER
                </button>
              </div>

              <div className="rounded-xl bg-muted/50 border border-border p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
                <Clock className="w-4 h-4 text-[#005B46] dark:text-[#34D399] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  10-calendar-day Seller fulfilment SLA. Funds stay Pending until delivery
                  confirmation and dispute checks pass.
                </span>
              </div>
            </section>

            {/* Seller Information Card */}
            <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Verified Marketplace Seller
              </p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    avatarUrl={liveProduct.sellerLogoUrl}
                    displayName={liveProduct.sellerName}
                    size="md"
                    shape="rounded-square"
                    className="bg-secondary text-secondary-foreground border-border"
                  />
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-bold text-foreground truncate">
                      {liveProduct.sellerName}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{liveProduct.sellerCity}</span>
                      {liveProduct.hasActiveSellerBadge && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Store className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                            ACTIVE
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {liveProduct.isSellerVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#005B46]/10 border border-[#005B46]/30 text-[#005B46] dark:bg-[#005B46] dark:text-white text-[11px] font-semibold shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    KYC Verified
                  </span>
                )}
              </div>
            </section>

            {/* Description, Specifications & Policies */}
            <section className="bg-card border border-border rounded-2xl p-6 space-y-5 text-sm">
              <div className="space-y-2">
                <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Product Description
                </h2>
                <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                  {liveProduct.description}
                </p>
              </div>

              {liveProduct.specifications && liveProduct.specifications.length > 0 && (
                <div className="pt-4 border-t border-border space-y-2">
                  <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="w-4 h-4" aria-hidden="true" />
                    Specifications
                  </h2>
                  <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                    {liveProduct.specifications.map((spec) => (
                      <li key={spec} className="text-foreground/85">
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 border-t border-border space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <Truck className="w-4 h-4 text-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">Delivery &amp; Fulfilment</p>
                    <p>
                      Delivery charge {formatWholeNaira(liveProduct.deliveryFeeKobo)} · 10-day
                      Seller fulfilment SLA
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <RotateCcw className="w-4 h-4 text-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">Return Policy</p>
                    <p>{liveProduct.returnPolicy}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#005B46] dark:text-[#34D399] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">Warranty</p>
                    <p>{liveProduct.warranty}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="bg-card border border-border rounded-2xl p-4 text-[11px] text-muted-foreground space-y-1 leading-relaxed">
              <p className="font-semibold text-foreground">NairaScout · {NAIRASCOUT_TAGLINE}</p>
              <p>{NAIRASCOUT_EARNINGS_DISCLAIMER}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Mobile Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 pb-safe">
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => setCheckoutOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-[#FFFFFF] disabled:opacity-45 font-sans text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            BUY DIRECT
          </button>
          <button
            type="button"
            onClick={() => setReferModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-[#000000] hover:bg-[#1A1A1A] text-[#FFFFFF] border border-transparent dark:border-[#2E2E2E] font-sans text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            REFER
          </button>
        </div>
      </div>

      <CheckoutDrawer
        authenticated={snapshot.authenticated}
        session={
          checkoutOpen
            ? {
                product: liveProduct,
                referralEvent: isExpiredReferral ? null : activeReferralEvent,
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
