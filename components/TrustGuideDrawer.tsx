'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, BookOpen, ExternalLink, HelpCircle, LifeBuoy, X } from 'lucide-react';
import {
  DEFAULT_PLATFORM_POLICIES_SEED,
  NAIRASCOUT_ACCOUNTING_BOUNDARY,
  NAIRASCOUT_EARNINGS_DISCLAIMER,
  NAIRASCOUT_TAGLINE,
} from '@/lib/constants/foundation-content';
import type { NairaScoutSnapshot, SupportCase } from '@/lib/nairascout-store';
import { SafeMarkdown } from './shared/SafeMarkdown';

// NS-FND-001, NS-FND-002, NS-FND-006: Live Programme Guide, Notices & Support Drawer
interface TrustGuideDrawerProps {
  open: boolean;
  snapshot: NairaScoutSnapshot;
  onClose: () => void;
  onSubmitSupport: (payload: {
    topic: SupportCase['topic'];
    subject: string;
    details: string;
  }) => Promise<boolean>;
}

export default function TrustGuideDrawer({
  open,
  snapshot,
  onClose,
  onSubmitSupport,
}: TrustGuideDrawerProps) {
  const [section, setSection] = useState<'guide' | 'notifications' | 'support'>('guide');
  const [selectedPolicySlug, setSelectedPolicySlug] = useState<string>('programme-rules');
  const [topic, setTopic] = useState<SupportCase['topic']>('commission');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const livePolicies =
    snapshot.platformPolicies && snapshot.platformPolicies.length > 0
      ? snapshot.platformPolicies
      : DEFAULT_PLATFORM_POLICIES_SEED.map((p, idx) => ({
          id: `seed-${idx}`,
          slug: p.slug,
          title: p.title,
          summary: p.summary,
          contentMarkdown: p.contentMarkdown,
          version: p.version,
          effectiveDate: p.effectiveDate,
          isPublished: p.isPublished,
          updatedBy: null,
          updatedAt: p.effectiveDate,
        }));

  const activePolicy =
    livePolicies.find((p) => p.slug === selectedPolicySlug) ?? livePolicies[0] ?? null;

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !details.trim()) return;
    setSubmitting(true);
    const ok = await onSubmitSupport({ topic, subject, details });
    if (ok) {
      setSubject('');
      setDetails('');
    }
    setSubmitting(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trust, Programme Guide and Support"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground w-full max-w-lg h-full overflow-y-auto border-l border-border p-6 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-sans text-xl font-bold text-foreground">
              Programme Guide &amp; Trust
            </h2>
            <p className="text-xs text-muted-foreground">
              {snapshot.activeScout
                ? `Signed in as ${snapshot.activeScout.displayName} (@${snapshot.activeScout.handle})`
                : `Browsing as guest · ${NAIRASCOUT_TAGLINE}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] dark:bg-[#181818] border border-border rounded-full">
          <button
            type="button"
            onClick={() => setSection('guide')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-full cursor-pointer transition-colors ${
              section === 'guide'
                ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-xs'
                : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            13-Gen Rules
          </button>
          <button
            type="button"
            onClick={() => setSection('notifications')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-full cursor-pointer transition-colors ${
              section === 'notifications'
                ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-xs'
                : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notices (<span className="font-numeric tabular-nums">{snapshot.notifications.length}</span>)
          </button>
          <button
            type="button"
            onClick={() => setSection('support')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-full cursor-pointer transition-colors ${
              section === 'support'
                ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-xs'
                : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Support
          </button>
        </div>

        {section === 'guide' && (
          <div className="space-y-4">
            {/* Quick Links to full pages */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/programme-rules"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                Full Rules Page
                <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
              </Link>
              <Link
                href="/help"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Help Centre
                <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
              </Link>
            </div>

            {/* Policy selector pills */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] dark:bg-[#181818] border border-border rounded-full overflow-x-auto no-scrollbar snap-x">
              {livePolicies.map((policy) => {
                const active = policy.slug === activePolicy?.slug;
                return (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => setSelectedPolicySlug(policy.slug)}
                    className={`snap-start px-3 py-1 rounded-full text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold'
                        : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium'
                    }`}
                  >
                    {policy.title}
                  </button>
                );
              })}
            </div>

            {activePolicy && (
              <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border pb-2">
                  <span className="font-semibold text-foreground">{activePolicy.title}</span>
                  <span className="font-numeric tabular-nums">
                    v{activePolicy.version} · {activePolicy.effectiveDate.slice(0, 10)}
                  </span>
                </div>
                <SafeMarkdown content={activePolicy.contentMarkdown} />
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
              <p className="font-semibold text-foreground">Platform Accounting Boundary</p>
              <p>{NAIRASCOUT_ACCOUNTING_BOUNDARY}</p>
              <p className="pt-1 border-t border-border/60">{NAIRASCOUT_EARNINGS_DISCLAIMER}</p>
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div className="divide-y divide-border">
            {snapshot.notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No notifications.</p>
            ) : (
              snapshot.notifications.map((n) => {
                const isUnread = !(n.isRead ?? n.read);
                return (
                  <div key={n.id} className="py-3.5 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase">
                            New
                          </span>
                        )}
                        <span className="font-sans uppercase tracking-wider font-semibold">
                          {n.category}
                        </span>
                      </div>
                      <span className="font-numeric tabular-nums">{n.createdAt.slice(0, 10)}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {section === 'support' && (
          <div className="space-y-6">
            {!snapshot.authenticated ? (
              <p className="text-xs text-muted-foreground">
                Please sign in to submit or track a support or appeal case.
              </p>
            ) : (
              <form onSubmit={handleSupportSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="sup-topic" className="block text-xs font-medium text-muted-foreground mb-1">
                    Appeal or Inquiry Topic
                  </label>
                  <select
                    id="sup-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as SupportCase['topic'])}
                    className="w-full appearance-none pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                  >
                    <option value="commission">Commission Calculation / Ancestry</option>
                    <option value="attribution">Referral-Card Attribution</option>
                    <option value="payout">Monthly Payout / Bank Verification</option>
                    <option value="fulfilment">Order Fulfilment / Dispute</option>
                    <option value="abuse">Abuse / Spam Report</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sup-subj" className="block text-xs font-medium text-muted-foreground mb-1">
                    Subject
                  </label>
                  <input
                    id="sup-subj"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Order ID or ledger reference..."
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="sup-det" className="block text-xs font-medium text-muted-foreground mb-1">
                    Details &amp; Evidence
                  </label>
                  <textarea
                    id="sup-det"
                    rows={3}
                    required
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Describe the transaction or attribution issue..."
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Support Case'}
                </button>
              </form>
            )}

            {snapshot.supportCases.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground">Submitted Cases</p>
                {snapshot.supportCases.map((c) => (
                  <div key={c.id} className="p-3 bg-muted/50 border border-border rounded-xl">
                    <div className="flex justify-between text-xs">
                      <span className="font-numeric font-semibold text-foreground">{c.id}</span>
                      <span className="text-muted-foreground">{c.status}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1">{c.subject}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
