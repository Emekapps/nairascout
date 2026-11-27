'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { ArrowLeft, BookOpen, ChevronRight, HelpCircle, Search, ShieldCheck, X } from 'lucide-react';
import {
  HELP_ARTICLE_CATEGORIES,
  HELP_AUDIENCE_ROLES,
  NAIRASCOUT_EARNINGS_DISCLAIMER,
  NAIRASCOUT_TAGLINE,
  type HelpArticleCategory,
} from '@/lib/constants/foundation-content';
import type { HelpArticleDTO, NairaScoutSnapshot } from '@/lib/nairascout-store';
import { ThemeToggle } from '../layout/ThemeToggle';
import { VerifiedSellerFab } from '../seller/VerifiedSellerFab';
import { SafeMarkdown } from '../shared/SafeMarkdown';

// NS-FND-005: Help Centre & Knowledge Base UI
interface HelpCentreViewProps {
  initialArticles: HelpArticleDTO[];
  initialSnapshot: NairaScoutSnapshot;
  initialQuery?: string;
  initialCategory?: string;
  initialArticleSlug?: string;
}

const CATEGORY_LABEL_MAP = new Map<string, string>(
  HELP_ARTICLE_CATEGORIES.map((c) => [c.id, c.label])
);
const ROLE_LABEL_MAP = new Map<string, string>(
  HELP_AUDIENCE_ROLES.map((r) => [r.id, r.label])
);

export default function HelpCentreView({
  initialArticles,
  initialSnapshot,
  initialQuery = '',
  initialCategory = 'ALL',
  initialArticleSlug = '',
}: HelpCentreViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory && CATEGORY_LABEL_MAP.has(initialCategory.toUpperCase())
      ? initialCategory.toUpperCase()
      : 'ALL'
  );
  const [selectedArticle, setSelectedArticle] = useState<HelpArticleDTO | null>(() => {
    if (!initialArticleSlug) return null;
    return initialArticles.find((a) => a.slug === initialArticleSlug) ?? null;
  });

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialArticles.filter((article) => {
      const catOk = selectedCategory === 'ALL' || article.category === selectedCategory;
      const textOk =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        article.bodyMarkdown.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [initialArticles, searchQuery, selectedCategory]);

  const categoriesWithAll: Array<{ id: 'ALL' | HelpArticleCategory; label: string }> = [
    { id: 'ALL', label: 'All Topics' },
    ...HELP_ARTICLE_CATEGORIES,
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Home
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/programme-rules"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-success" aria-hidden="true" />
              <span className="hidden sm:inline">Programme Rules</span>
              <span className="sm:hidden">Rules</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-success">
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                <span>NairaScout Knowledge Base · {NAIRASCOUT_TAGLINE}</span>
              </div>
              <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Help Centre
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                Guides for Scouts, Buyers, and Verified Sellers covering traceable referrals, the
                13-generation commission schedule, Seller verification, and monthly payouts.
              </p>
            </div>
          </div>

          <div className="relative max-w-xl">
            <Search
              className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Help Centre (e.g. 13 generations, verification, payouts)..."
              aria-label="Search Help Centre articles"
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-card text-foreground border border-border rounded-xl focus:outline-none focus:border-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear Help Centre search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Horizontally sliding capsule category pills */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none snap-x">
            <div
              role="tablist"
              aria-label="Help Centre categories"
              className="inline-flex items-center gap-1.5 p-1 bg-[#F7F5F0] dark:bg-[#222925] border border-border rounded-full w-max"
            >
              {categoriesWithAll.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`snap-start px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2E5339] text-[#FFFFFF] border border-[#2E5339] dark:bg-[#3A6B49] dark:text-[#FFFFFF] dark:border-[#3A6B49] font-semibold shadow-xs'
                        : 'bg-card text-foreground border border-border font-medium hover:opacity-90'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {filteredArticles.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
            <BookOpen className="w-7 h-7 text-muted-foreground mx-auto" aria-hidden="true" />
            <h2 className="font-sans text-base font-bold text-foreground">
              No Help Articles Match Your Search
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Try a broader keyword or switch back to All Topics. You can also review full
              commercial rules under Programme Rules.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground border border-primary-border cursor-pointer"
              >
                Reset Filters
              </button>
              <Link
                href="/programme-rules"
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted"
              >
                Open Programme Rules
              </Link>
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((article) => {
              const categoryLabel = CATEGORY_LABEL_MAP.get(article.category) ?? article.category;
              const roleLabel = ROLE_LABEL_MAP.get(article.audienceRole) ?? article.audienceRole;
              return (
                <article
                  key={article.id}
                  className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-foreground/30 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="font-sans font-semibold uppercase tracking-wider text-success">
                        {categoryLabel}
                      </span>
                      <span className="font-sans shrink-0">
                        {roleLabel} ·{' '}
                        <span className="font-numeric tabular-nums">
                          {article.updatedAt.slice(0, 10)}
                        </span>
                      </span>
                    </div>
                    <h2 className="font-sans text-base font-bold text-foreground leading-snug">
                      {article.title}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {article.summary}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(article)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline cursor-pointer"
                    >
                      Read article
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="bg-card border border-border rounded-2xl p-5 space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Platform Notice &amp; Earnings Disclaimer</p>
          <p className="leading-relaxed">{NAIRASCOUT_EARNINGS_DISCLAIMER}</p>
        </section>
      </main>

      {/* Article Detail Drawer / Bottom Sheet */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div
            key="help-article-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={selectedArticle.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end md:items-center justify-center md:p-4"
            onClick={() => setSelectedArticle(null)}
          >
            <motion.div
              key="help-article-sheet"
              initial={{ y: 40, opacity: 0.96 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info: PanInfo) => {
                if (info.offset.y > 90 || info.velocity.y > 450) {
                  setSelectedArticle(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-t-3xl md:rounded-2xl bg-card text-card-foreground border-t md:border border-border p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl"
            >
              <div className="touch-none pt-1 pb-2 -mt-2 flex justify-center cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-success">
                    {CATEGORY_LABEL_MAP.get(selectedArticle.category) ?? selectedArticle.category} ·{' '}
                    {ROLE_LABEL_MAP.get(selectedArticle.audienceRole) ??
                      selectedArticle.audienceRole}
                  </p>
                  <h2 className="font-sans text-lg sm:text-xl font-bold text-foreground">
                    {selectedArticle.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Updated{' '}
                    <span className="font-numeric tabular-nums">
                      {selectedArticle.updatedAt.slice(0, 10)}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  aria-label="Close article"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <SafeMarkdown content={selectedArticle.bodyMarkdown} />

              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <Link
                  href="/programme-rules"
                  className="font-semibold text-foreground hover:underline"
                >
                  Read Official Programme Rules →
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground border border-primary-border font-semibold cursor-pointer"
                >
                  Close Article
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <VerifiedSellerFab
        authenticated={initialSnapshot.authenticated}
        activeScout={initialSnapshot.activeScout}
      />
    </div>
  );
}
