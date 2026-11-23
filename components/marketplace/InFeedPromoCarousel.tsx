'use client';

import { useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Percent,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

interface InFeedPromoCarouselProps {
  onGoToReferrals: () => void;
  activeInboxCount?: number;
}

const TOTAL_SLIDES = 8;

export function InFeedPromoCarousel({
  onGoToReferrals,
  activeInboxCount = 0,
}: InFeedPromoCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const nextIdx = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(TOTAL_SLIDES - 1, nextIdx));
    if (clamped !== activeSlide) {
      setActiveSlide(clamped);
    }
  };

  const scrollToSlide = (index: number) => {
    const el = trackRef.current;
    const target = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));
    setActiveSlide(target);
    if (!el) return;
    el.scrollTo({
      left: target * el.clientWidth,
      behavior: 'smooth',
    });
  };

  const heroSlides = [
    {
      id: 'hero-discover',
      eyebrow: 'Thirteen-Generation Social Commerce',
      headline: 'Discover products worth sharing.',
      body: 'Browse quality products from our favourite brands and vendors.',
    },
    {
      id: 'hero-share',
      eyebrow: 'Traceable Social Sharing',
      headline: 'Share them with others.',
      body: 'Share traceable product referrals with people you know.',
    },
    {
      id: 'hero-earn',
      eyebrow: 'Transparent Ledger Payouts',
      headline: 'Get paid when they make sales.',
      body: 'Earn from genuine qualifying sales across your permanent referral ancestry.',
    },
  ];

  const metricSlides = [
    {
      id: 'metric-pool',
      icon: Percent,
      label: 'Referral Pool Source',
      value: '20% of 10%',
      subtext: 'Of eligible NairaScout commission',
    },
    {
      id: 'metric-depth',
      icon: GitBranch,
      label: 'Permanent Ancestry Depth',
      value: 'Up to 13 Gen',
      subtext: 'Ineligible ancestors are never skipped',
    },
    {
      id: 'metric-sla',
      icon: ShieldCheck,
      label: 'Seller Fulfilment SLA',
      value: '10 Days',
      subtext: 'Delivery verified before release',
    },
    {
      id: 'metric-payout',
      icon: Wallet,
      label: 'Monthly Payout Policy',
      value: '₦5,000 Min',
      subtext: '15th of each month · NGN',
    },
  ];

  return (
    <section
      aria-label="NairaScout Programme & Discovery Highlights"
      className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-4"
    >
      {/* Top Carousel Header & Desktop Arrows */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          How NairaScout Works ·{' '}
          <span className="font-numeric tabular-nums text-foreground">
            {activeSlide + 1} / {TOTAL_SLIDES}
          </span>
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollToSlide(activeSlide - 1)}
            disabled={activeSlide === 0}
            aria-label="Previous slide"
            className="w-8 h-8 rounded-lg border border-border bg-background text-foreground flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollToSlide(activeSlide + 1)}
            disabled={activeSlide === TOTAL_SLIDES - 1}
            aria-label="Next slide"
            className="w-8 h-8 rounded-lg border border-border bg-background text-foreground flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Horizontal Touch-Swipe Track */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Slides 1–3: Value Proposition Slides */}
        {heroSlides.map((slide) => (
          <div
            key={slide.id}
            className="w-full shrink-0 snap-center flex flex-col sm:flex-row sm:items-center justify-between gap-5 py-1"
          >
            <div className="space-y-1.5 max-w-xl">
              <p className="font-sans text-xs font-semibold uppercase tracking-wider text-success">
                {slide.eyebrow}
              </p>
              <h3 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {slide.headline}
              </h3>
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                {slide.body}
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={onGoToReferrals}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide bg-primary text-primary-foreground border border-primary-border rounded-xl hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
              >
                Open Referrals Inbox
                {activeInboxCount > 0 && (
                  <span className="font-numeric tabular-nums px-1.5 py-0.5 rounded-md bg-white/15 text-[11px]">
                    {activeInboxCount}
                  </span>
                )}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        {/* Slide 4: Direct Marketplace vs Referral-Card Attribution */}
        <div className="w-full shrink-0 snap-center flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted text-foreground font-sans text-[11px] font-semibold uppercase tracking-wider">
              Attribution Rule
            </span>
            <h3 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Direct Marketplace vs. Referral-Card Attribution
            </h3>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">
              Buying from a general listing is a direct order (₦0 referral commission). Buying from
              a traceable Referral Card anchors the 20% commission pool.
            </p>
          </div>
        </div>

        {/* Slides 5–8: Structural Programme Metric Slides */}
        {metricSlides.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.id}
              className="w-full shrink-0 snap-center flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1"
            >
              <div className="flex items-start sm:items-center gap-4">
                <span className="w-12 h-12 rounded-2xl bg-muted text-foreground flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="space-y-0.5">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="font-numeric text-2xl md:text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {metric.value}
                  </p>
                  <p className="font-sans text-sm text-muted-foreground">{metric.subtext}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onGoToReferrals}
                className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-foreground border border-border rounded-xl hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                Open Referrals Inbox
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Interactive Pagination Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-1" role="tablist" aria-label="Carousel slides">
        {Array.from({ length: TOTAL_SLIDES }, (_, idx) => {
          const isCurrent = idx === activeSlide;
          return (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => scrollToSlide(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                isCurrent
                  ? 'w-6 bg-foreground'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/55'
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
