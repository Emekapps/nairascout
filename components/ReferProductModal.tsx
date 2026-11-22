'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Copy, Send, Users, X } from 'lucide-react';
import type {
  NairaScoutSnapshot,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';

const MAX_RECIPIENTS = 20;

interface ReferProductModalProps {
  product: ProductListing | null;
  snapshot: NairaScoutSnapshot;
  initialRecipientId?: string | null;
  onClose: () => void;
  onSendReferral: (payload: {
    productListingId: string;
    recipientScoutIds: string[];
    note: string;
  }) => Promise<ProductReferralEvent[] | null>;
}

export default function ReferProductModal({
  product,
  snapshot,
  initialRecipientId,
  onClose,
  onSendReferral,
}: ReferProductModalProps) {
  const activeContacts = snapshot.scoutsList.filter((c) => !c.blocked);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialRecipientId) return [initialRecipientId];
    return activeContacts[0]?.scoutId ? [activeContacts[0].scoutId] : [];
  });
  const [note, setNote] = useState('');
  const [createdEvents, setCreatedEvents] = useState<ProductReferralEvent[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!product) return null;

  const referralRestriction = snapshot.activeScout?.activeRestrictions?.find(
    (r) => r.status === 'ACTIVE' && r.capabilityCode === 'CREATE_REFERRAL'
  );

  const toggleRecipient = (scoutId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(scoutId)) {
        return prev.filter((id) => id !== scoutId);
      }
      if (prev.length >= MAX_RECIPIENTS) {
        return prev;
      }
      return [...prev, scoutId];
    });
  };

  const handleSelectUpTo20 = () => {
    const eligible = activeContacts.slice(0, MAX_RECIPIENTS);
    setSelectedIds(eligible.map((c) => c.scoutId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || selectedIds.length > MAX_RECIPIENTS) return;
    setSubmitting(true);
    const events = await onSendReferral({
      productListingId: product.id,
      recipientScoutIds: selectedIds,
      note,
    });
    if (events && events.length > 0) {
      setCreatedEvents(events);
    }
    setSubmitting(false);
  };

  const buildShareUrl = (ev: ProductReferralEvent) =>
    `${typeof window !== 'undefined' ? window.location.origin : 'https://nairascout.ng'}/?refEvent=${ev.id}&refScout=${ev.senderHandle}`;

  const handleCopy = (ev: ProductReferralEvent) => {
    navigator.clipboard?.writeText(buildShareUrl(ev));
    setCopiedId(ev.id);
    setTimeout(() => setCopiedId((prev) => (prev === ev.id ? null : prev)), 1800);
  };

  const handleClose = () => {
    setCreatedEvents([]);
    setNote('');
    onClose();
  };

  const atBatchCap = selectedIds.length >= MAX_RECIPIENTS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Refer Product"
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-[#E4E4DE] rounded-xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#111814]">
              Refer Product to Scouts List
            </h2>
            <p className="text-xs text-[#5C665E] mt-0.5">
              Generates one unique, traceable referral event per selected contact (max{' '}
              {MAX_RECIPIENTS} recipients per batch).
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1 text-[#5C665E] hover:text-[#111814] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#FAFAF8] border border-[#E4E4DE] rounded-lg p-3.5">
          <p className="text-xs text-[#5C665E]">
            {product.category} · {product.sellerName}
          </p>
          <p className="font-display text-sm font-semibold text-[#111814] mt-0.5">
            {product.title}
          </p>
          <p className="font-mono text-sm font-bold text-[#0B6E4F] mt-1 tabular-nums">
            {formatWholeNaira(product.priceKobo)}
          </p>
        </div>

        {referralRestriction && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3.5 text-xs text-[#991B1B] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Referral Capability Restricted (CREATE_REFERRAL)</p>
              <p className="mt-0.5">
                {referralRestriction.reason}. You may appeal this restriction from Account Settings.
              </p>
            </div>
          </div>
        )}

        {!snapshot.authenticated ? (
          <div className="space-y-4 text-xs text-[#4B554E]">
            <p>
              Sign in or create a free Scout account to send product referrals from your Scouts
              List and earn across up to 13 generations.
            </p>
            <Link
              href="/auth/login"
              className="block w-full text-center py-2.5 px-4 font-semibold text-white bg-[#0B6E4F] rounded-lg"
            >
              Sign In to Refer Products
            </Link>
          </div>
        ) : createdEvents.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-[#F3F8F6] border border-[#CBE2D8] rounded-lg p-4 text-xs text-[#0B6E4F] space-y-1">
              <p className="font-semibold">
                {createdEvents.length} Referral{' '}
                {createdEvents.length === 1 ? 'Event' : 'Events'} Created
              </p>
              <p>
                Dispatched to {createdEvents.map((e) => `@${e.recipientHandle}`).join(', ')}.
                Attribution is preserved when a recipient initiates checkout from a referral card
                or link.
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {createdEvents.map((ev) => (
                <div key={ev.id} className="space-y-1 p-2.5 bg-[#FAFAF8] border border-[#E4E4DE] rounded-lg">
                  <p className="text-[11px] font-mono text-[#4B554E]">
                    @{ev.recipientHandle} · {ev.id}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={buildShareUrl(ev)}
                      aria-label={`Event-specific referral link for ${ev.recipientHandle}`}
                      className="flex-1 px-2.5 py-1.5 font-mono text-[11px] bg-white border border-[#D8D8D0] rounded text-[#111814]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(ev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#111814] rounded cursor-pointer shrink-0"
                    >
                      {copiedId === ev.id ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedId === ev.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : activeContacts.length === 0 ? (
          <div className="text-xs text-[#5C665E] space-y-2">
            <p>
              You have no active non-blocked contacts in your Scouts List yet. Invite a Scout in
              the Network → Scouts List tab first.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="text-xs font-medium text-[#4B554E] inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0B6E4F]" aria-hidden="true" />
                  Select Recipients from Scouts List
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectUpTo20}
                    className="text-[11px] font-semibold text-[#0B6E4F] hover:underline cursor-pointer"
                  >
                    Select Eligible
                  </button>
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      atBatchCap ? 'text-[#B45309]' : 'text-[#0B6E4F]'
                    }`}
                  >
                    Selected: {selectedIds.length} / {MAX_RECIPIENTS} recipients
                  </span>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border border-[#D8D8D0] rounded-lg divide-y divide-[#ECECE6] bg-white">
                {activeContacts.map((c) => {
                  const checked = selectedIds.includes(c.scoutId);
                  const disabled = !checked && atBatchCap;
                  return (
                    <label
                      key={c.contactId}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 text-xs ${
                        disabled ? 'opacity-50 cursor-not-allowed bg-[#FAFAF8]' : 'cursor-pointer hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleRecipient(c.scoutId)}
                          className="accent-[#0B6E4F]"
                        />
                        <div>
                          <p className="font-semibold text-[#111814]">
                            {c.displayName}{' '}
                            <span className="font-mono font-normal text-[#5C665E]">@{c.handle}</span>
                          </p>
                          <p className="text-[11px] text-[#5C665E]">{c.city}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {atBatchCap && (
                <p className="mt-1 text-[11px] text-[#B45309]">
                  Maximum batch limit of {MAX_RECIPIENTS} recipients reached for this operation.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="ref-note"
                className="block text-xs font-medium text-[#4B554E] mb-1"
              >
                Personal Note (Optional)
              </label>
              <textarea
                id="ref-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Share why this product is useful or verified..."
                className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
              />
            </div>

            <button
              type="submit"
              disabled={selectedIds.length === 0 || submitting || Boolean(referralRestriction)}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              {submitting
                ? 'Generating Referral Cards...'
                : `Send Product Referral (${selectedIds.length})`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
