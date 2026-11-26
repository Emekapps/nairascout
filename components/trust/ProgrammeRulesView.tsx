'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, HelpCircle, Scale, ShieldCheck } from 'lucide-react';
import {
  NAIRASCOUT_ACCOUNTING_BOUNDARY,
  NAIRASCOUT_EARNINGS_DISCLAIMER,
  NAIRASCOUT_TAGLINE,
  NAIRASCOUT_VALUE_PROPOSITION,
} from '@/lib/constants/foundation-content';
import type { NairaScoutSnapshot, PlatformPolicyDTO } from '@/lib/nairascout-store';
import { ThemeToggle } from '../layout/ThemeToggle';
import { VerifiedSellerFab } from '../seller/VerifiedSellerFab';
import { SafeMarkdown } from '../shared/SafeMarkdown';

// NS-FND-001, NS-FND-002, NS-FND-006: Live Programme Rules & Platform Boundaries page
interface ProgrammeRulesViewProps {
  initialPolicies: PlatformPolicyDTO[];
  initialSnapshot: NairaScoutSnapshot;
  initialPolicySlug?: string;
}

export default function ProgrammeRulesView({
  initialPolicies,
  initialSnapshot,
  initialPolicySlug = 'programme-rules',
}: ProgrammeRulesViewProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    const matched = initialPolicies.find((p) => p.slug === initialPolicySlug);
    return matched?.slug ?? initialPolicies[0]?.slug ?? 'programme-rules';
  });

  const activePolicy = useMemo(
    () => initialPolicies.find((p) => p.slug === selectedSlug) ?? initialPolicies[0] ?? null,
    [initialPolicies, selectedSlug]
  );

  const handleSelectPolicy = (slug: string) => {
    setSelectedSlug(slug);
    if (typeof window !== 'undefined') {
      const nextUrl = `/programme-rules?policy=${encodeURIComponent(slug)}`;
      window.history.replaceState(null, '', nextUrl);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Home
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/help"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-foreground" aria-hidden="true" />
              Help Centre
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-success">
            <Scale className="w-4 h-4" aria-hidden="true" />
            <span>Official Governance &amp; Commercial Standards</span>
          </div>
          <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Programme Rules &amp; Platform Boundaries
          </h1>
          <p className="font-sans text-sm sm:text-base font-semibold text-foreground">
            {NAIRASCOUT_TAGLINE}{' '}
            <span className="font-normal text-muted-foreground">{NAIRASCOUT_VALUE_PROPOSITION}</span>
          </p>
        </section>

        {/* Horizontally sliding capsule selector for published policies */}
        {initialPolicies.length > 0 && (
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none snap-x">
            <div
              role="tablist"
              aria-label="Published platform policies"
              className="inline-flex items-center gap-1.5 p-1 bg-[#F3F4F6] dark:bg-[#181818] border border-border rounded-full w-max"
            >
              {initialPolicies.map((policy) => {
                const active = policy.slug === activePolicy?.slug;
                return (
                  <button
                    key={policy.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleSelectPolicy(policy.slug)}
                    className={`snap-start px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#000000] text-[#FFFFFF] border border-transparent dark:bg-white dark:text-black font-semibold shadow-xs'
                        : 'bg-[#FFFFFF] text-[#000000] border border-input dark:bg-secondary dark:text-foreground dark:border-border font-medium hover:opacity-90'
                    }`}
                  >
                    {policy.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activePolicy ? (
          <article className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-foreground" aria-hidden="true" />
                <span className="font-sans font-semibold text-foreground">
                  {activePolicy.title}
                </span>
              </div>
              <div className="font-numeric tabular-nums flex items-center gap-3">
                <span>v{activePolicy.version}</span>
                <span>·</span>
                <span>Effective {activePolicy.effectiveDate.slice(0, 10)}</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed bg-muted/40 border border-border rounded-xl p-3.5">
              {activePolicy.summary}
            </p>

            <SafeMarkdown content={activePolicy.contentMarkdown} />
          </article>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No published platform policies found.
          </div>
        )}

        {/* Compliance Boundaries & Non-Guarantee Disclaimers */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldCheck className="w-4 h-4 text-success" aria-hidden="true" />
              <span>Platform Accounting Boundary</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {NAIRASCOUT_ACCOUNTING_BOUNDARY}
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Scale className="w-4 h-4 text-foreground" aria-hidden="true" />
              <span>Earnings Non-Guarantee Disclosure</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {NAIRASCOUT_EARNINGS_DISCLAIMER}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
          <Link href="/help" className="font-semibold text-foreground hover:underline">
            Browse Help Centre Articles →
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Return to Marketplace
          </Link>
        </div>
      </main>

      <VerifiedSellerFab
        authenticated={initialSnapshot.authenticated}
        activeScout={initialSnapshot.activeScout}
      />
    </div>
  );
}
