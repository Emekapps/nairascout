'use client';

import { useState } from 'react';
import { Bell, BookOpen, LifeBuoy, X } from 'lucide-react';
import type { NairaScoutSnapshot, SupportCase } from '@/lib/nairascout-store';

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
  const [topic, setTopic] = useState<SupportCase['topic']>('commission');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

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
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end"
    >
      <div className="bg-card text-card-foreground w-full max-w-lg h-full overflow-y-auto border-l border-border p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-sans text-xl font-bold text-foreground">
              Programme Guide &amp; Trust
            </h2>
            <p className="text-xs text-muted-foreground">
              {snapshot.activeScout
                ? `Signed in as ${snapshot.activeScout.displayName} (@${snapshot.activeScout.handle})`
                : 'Browsing as guest'}
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

        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => setSection('guide')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              section === 'guide'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            13-Gen Rules
          </button>
          <button
            type="button"
            onClick={() => setSection('notifications')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              section === 'notifications'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notices (<span className="font-numeric tabular-nums">{snapshot.notifications.length}</span>)
          </button>
          <button
            type="button"
            onClick={() => setSection('support')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              section === 'support'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Support
          </button>
        </div>

        {section === 'guide' && (
          <div className="space-y-5 text-sm text-foreground/90 leading-relaxed">
            <div>
              <h3 className="font-sans font-semibold text-foreground">
                1. One Primary Identity, Scout-First Participation
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Every registered user receives a free Scout account. Seller capabilities attach to
                the same identity and require Seller verification approval before publishing
                listings.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-semibold text-foreground">
                2. Referral-Card Attribution vs Direct Buys
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                A purchase initiated from the general marketplace is a direct order (₦0 referral
                pool). A purchase initiated from a valid product referral card or event link
                attributes the order to the Seller Scout’s permanent ancestry.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-semibold text-foreground">
                3. 20% Pool &amp; Thirteen-Generation Schedules
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Sellers receive 90% and NairaScout earns 10% of eligible merchandise revenue. Up to
                20% of NairaScout’s commission forms the referral pool. Actual ancestry depth
                selects the schedule. Ineligible ancestors receive ₦0 and are never skipped.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-semibold text-foreground">
                4. Fulfilment, Reversals &amp; Monthly Payouts
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Available balances from the preceding month are paid on the 15th (₦5,000 minimum,
                KYC + verified Nigerian bank required).
              </p>
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div className="divide-y divide-border">
            {snapshot.notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No notifications.</p>
            ) : (
              snapshot.notifications.map((n) => (
                <div key={n.id} className="py-3.5 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-sans uppercase tracking-wider font-semibold">
                      {n.category}
                    </span>
                    <span className="font-numeric tabular-nums">{n.createdAt.slice(0, 10)}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                </div>
              ))
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
                    className="w-full pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
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
