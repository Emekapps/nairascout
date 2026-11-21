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
      className="fixed inset-0 z-50 bg-black/45 flex justify-end"
    >
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto border-l border-[#E4E4DE] p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[#ECECE6] pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#111814]">
              Programme Guide &amp; Trust
            </h2>
            <p className="text-xs text-[#5C665E]">
              Signed in as {snapshot.activeScout.displayName} (@{snapshot.activeScout.handle})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="p-1 text-[#5C665E] hover:text-[#111814] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EFEFE9] rounded-lg">
          <button
            type="button"
            onClick={() => setSection('guide')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              section === 'guide' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            13-Gen Rules
          </button>
          <button
            type="button"
            onClick={() => setSection('notifications')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              section === 'notifications' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notices ({snapshot.notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('support')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              section === 'support' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Support
          </button>
        </div>

        {section === 'guide' && (
          <div className="space-y-5 text-sm text-[#3B443E] leading-relaxed">
            <div>
              <h3 className="font-display font-semibold text-[#111814]">
                1. Product Commerce, Not Recruitment
              </h3>
              <p className="mt-1 text-xs text-[#556158]">
                Scout accounts are free. NairaScout never pays commissions for user registration,
                adding Scouts List contacts, or Seller subscriptions. Commissions arise strictly
                from genuine qualifying merchandise purchases.
              </p>
            </div>

            <div>
              <h3 className="font-display font-semibold text-[#111814]">
                2. Referral-Card Attribution vs Direct Buys
              </h3>
              <p className="mt-1 text-xs text-[#556158]">
                A purchase initiated from the general marketplace is a direct order (₦0 referral
                pool). A purchase initiated from a valid product referral card or event link
                attributes the order to the Seller Scout’s permanent ancestry.
              </p>
            </div>

            <div>
              <h3 className="font-display font-semibold text-[#111814]">
                3. 20% Pool &amp; Thirteen-Generation Schedules
              </h3>
              <p className="mt-1 text-xs text-[#556158]">
                Sellers receive 90% and NairaScout earns 10% of eligible merchandise revenue
                (excluding delivery and separately charged taxes). Up to 20% of NairaScout’s
                commission forms the referral pool. Actual ancestry depth selects the schedule
                (1/2 for 1 gen; 1/4, 1/5 for 2 gens; 1/5, 1/6, 1/10 for 3 gens; 1/6 down to 1/120
                for 4–13 gens). Ineligible ancestors receive ₦0 and are never skipped.
              </p>
            </div>

            <div>
              <h3 className="font-display font-semibold text-[#111814]">
                4. Fulfilment, Reversals &amp; Monthly Payouts
              </h3>
              <p className="mt-1 text-xs text-[#556158]">
                Sellers have 10 calendar days to fulfil paid orders. Commissions move from Pending
                to Available only after delivery confirmation and fraud/dispute checks. Available
                balances from the preceding month are paid on the 15th (₦5,000 minimum, KYC +
                verified Nigerian bank required).
              </p>
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div className="divide-y divide-[#ECECE6]">
            {snapshot.notifications.map((n) => (
              <div key={n.id} className="py-3.5 first:pt-0 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#5C665E]">
                  <span className="uppercase tracking-wider font-medium">{n.category}</span>
                  <span className="font-mono">{n.createdAt.slice(0, 10)}</span>
                </div>
                <p className="text-sm font-semibold text-[#111814]">{n.title}</p>
                <p className="text-xs text-[#4B554E] leading-relaxed">{n.body}</p>
              </div>
            ))}
          </div>
        )}

        {section === 'support' && (
          <div className="space-y-6">
            <form onSubmit={handleSupportSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="sup-topic" className="block text-xs font-medium text-[#4B554E] mb-1">
                  Appeal or Inquiry Topic
                </label>
                <select
                  id="sup-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as SupportCase['topic'])}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white"
                >
                  <option value="commission">Commission Calculation / Ancestry</option>
                  <option value="attribution">Referral-Card Attribution</option>
                  <option value="payout">Monthly Payout / Bank Verification</option>
                  <option value="fulfilment">Order Fulfilment / Dispute</option>
                  <option value="abuse">Abuse / Spam Report</option>
                </select>
              </div>
              <div>
                <label htmlFor="sup-subj" className="block text-xs font-medium text-[#4B554E] mb-1">
                  Subject
                </label>
                <input
                  id="sup-subj"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Order ID or ledger reference..."
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="sup-det" className="block text-xs font-medium text-[#4B554E] mb-1">
                  Details &amp; Evidence
                </label>
                <textarea
                  id="sup-det"
                  rows={3}
                  required
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe the transaction or attribution issue..."
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Support Case'}
              </button>
            </form>

            {snapshot.supportCases.length > 0 && (
              <div className="space-y-2 border-t border-[#ECECE6] pt-4">
                <p className="text-xs font-semibold text-[#111814]">Submitted Cases</p>
                {snapshot.supportCases.map((c) => (
                  <div key={c.id} className="p-3 bg-[#FAFAF8] border border-[#E4E4DE] rounded-lg">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono font-semibold text-[#0B6E4F]">{c.id}</span>
                      <span className="text-[#5C665E]">{c.status}</span>
                    </div>
                    <p className="text-sm font-medium text-[#111814] mt-1">{c.subject}</p>
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
