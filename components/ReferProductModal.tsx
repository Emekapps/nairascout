'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Send, X } from 'lucide-react';
import type {
  NairaScoutSnapshot,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';

interface ReferProductModalProps {
  product: ProductListing | null;
  snapshot: NairaScoutSnapshot;
  initialRecipientId?: string | null;
  onClose: () => void;
  onSendReferral: (payload: {
    productListingId: string;
    recipientScoutId: string;
    note: string;
  }) => Promise<ProductReferralEvent | null>;
}

export default function ReferProductModal({
  product,
  snapshot,
  initialRecipientId,
  onClose,
  onSendReferral,
}: ReferProductModalProps) {
  const activeContacts = snapshot.scoutsList.filter((c) => !c.blocked);
  const [recipientId, setRecipientId] = useState<string>(
    initialRecipientId || activeContacts[0]?.scoutId || ''
  );
  const [note, setNote] = useState('');
  const [createdEvent, setCreatedEvent] = useState<ProductReferralEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!product) return null;

  const selectedId = recipientId || activeContacts[0]?.scoutId || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    const ev = await onSendReferral({
      productListingId: product.id,
      recipientScoutId: selectedId,
      note,
    });
    if (ev) {
      setCreatedEvent(ev);
    }
    setSubmitting(false);
  };

  const shareUrl = createdEvent
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://nairascout.ng'}/?refEvent=${createdEvent.id}&refScout=${createdEvent.senderHandle}`
    : '';

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleClose = () => {
    setCreatedEvent(null);
    setNote('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Refer Product"
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-[#E4E4DE] rounded-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#111814]">
              Refer Product to Scout
            </h2>
            <p className="text-xs text-[#5C665E] mt-0.5">
              Creates a unique, traceable product referral event (not a recruitment action).
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
        ) : createdEvent ? (
          <div className="space-y-4">
            <div className="bg-[#F3F8F6] border border-[#CBE2D8] rounded-lg p-4 text-xs text-[#0B6E4F] space-y-1">
              <p className="font-semibold">
                Referral Event {createdEvent.id} Created
              </p>
              <p>
                Sent to @{createdEvent.recipientHandle}. Attribution is preserved if the recipient
                initiates checkout from this referral card or link.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#4B554E]">
                Event-Specific External Referral Link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  aria-label="Event-specific referral link"
                  className="flex-1 px-3 py-2 font-mono text-xs bg-[#FAFAF8] border border-[#D8D8D0] rounded-lg text-[#111814]"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-[#111814] rounded-lg cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
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
              <label
                htmlFor="ref-recipient"
                className="block text-xs font-medium text-[#4B554E] mb-1"
              >
                Select Contact from Scouts List
              </label>
              <select
                id="ref-recipient"
                value={selectedId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
              >
                {activeContacts.map((c) => (
                  <option key={c.contactId} value={c.scoutId}>
                    {c.displayName} (@{c.handle}) · {c.city}
                  </option>
                ))}
              </select>
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
              disabled={!selectedId || submitting}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              {submitting ? 'Generating Referral Card...' : 'Send Product Referral'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
