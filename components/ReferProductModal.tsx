'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useDragControls, type PanInfo } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Send,
  Share2,
  Users,
  X,
} from 'lucide-react';
import type {
  NairaScoutSnapshot,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import {
  NAIRASCOUT_EARNINGS_DISCLAIMER,
  NAIRASCOUT_TAGLINE,
} from '@/lib/constants/foundation-content';
import { UserIdentityRow } from './shared/UserIdentityRow';

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
  const dragControls = useDragControls();
  const activeContacts = snapshot.scoutsList.filter((c) => !c.blocked);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialRecipientId) return [initialRecipientId];
    return activeContacts[0]?.scoutId ? [activeContacts[0].scoutId] : [];
  });
  const [note, setNote] = useState('');
  const [createdEvents, setCreatedEvents] = useState<ProductReferralEvent[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedGeneral, setCopiedGeneral] = useState(false);
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

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nairascout.ng';

  const buildShareUrl = (ev: ProductReferralEvent) =>
    `${origin}/?refEvent=${ev.id}&refScout=${ev.senderHandle}`;

  const primaryQuickShareUrl =
    createdEvents[0]
      ? buildShareUrl(createdEvents[0])
      : snapshot.activeScout
        ? `${origin}/auth/register?refScout=${encodeURIComponent(snapshot.activeScout.handle)}`
        : `${origin}/`;

  const shareText = `Check out ${product.title} (${formatWholeNaira(product.priceKobo)}) on NairaScout: ${primaryQuickShareUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const handleCopy = (ev: ProductReferralEvent) => {
    navigator.clipboard?.writeText(buildShareUrl(ev));
    setCopiedId(ev.id);
    setTimeout(() => setCopiedId((prev) => (prev === ev.id ? null : prev)), 1800);
  };

  const handleCopyQuickLink = () => {
    navigator.clipboard?.writeText(primaryQuickShareUrl);
    setCopiedGeneral(true);
    setTimeout(() => setCopiedGeneral(false), 1800);
  };

  const handleClose = () => {
    setCreatedEvents([]);
    setNote('');
    onClose();
  };

  const atBatchCap = selectedIds.length >= MAX_RECIPIENTS;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Referral Card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end md:items-center justify-center md:p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0.95 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info: PanInfo) => {
          if (info.offset.y > 90 || info.velocity.y > 450) {
            handleClose();
          }
        }}
        className="w-full max-w-lg rounded-t-3xl md:rounded-2xl bg-card text-card-foreground border-t md:border border-border p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="touch-none pt-1 pb-2 -mt-2 flex justify-center cursor-grab active:cursor-grabbing"
        >
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-sans text-lg font-bold tracking-tight text-foreground">
              Referral Card
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generates a traceable referral event per selected contact (max {MAX_RECIPIENTS}{' '}
              recipients per batch).
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Summary */}
        <div className="bg-muted/60 border border-border rounded-xl p-3.5">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {product.category} · {product.sellerName}
          </p>
          <p className="font-sans text-sm font-semibold text-foreground mt-0.5">
            {product.title}
          </p>
          <p className="font-numeric text-sm font-bold text-foreground mt-1 tabular-nums">
            {formatWholeNaira(product.priceKobo)}
          </p>
        </div>

        {/* Quick Social Share Pills */}
        <div className="space-y-2">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Social Share
          </p>
          <div className="space-y-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 px-4 rounded-full bg-[#292D2F] text-white hover:bg-[#292D2F]/90 dark:bg-white dark:text-black dark:hover:bg-white/90 font-sans text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Share on WhatsApp
              <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
            </a>
            <a
              href={twitterHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 px-4 rounded-full bg-[#292D2F] text-white hover:bg-[#292D2F]/90 dark:bg-white dark:text-black dark:hover:bg-white/90 font-sans text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              Share on X / Twitter
              <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={handleCopyQuickLink}
              className="w-full h-11 px-4 rounded-full bg-[#292D2F] text-white hover:bg-[#292D2F]/90 dark:bg-white dark:text-black dark:hover:bg-white/90 font-sans text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copiedGeneral ? (
                <Check className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
              {copiedGeneral ? 'Referral Link Copied!' : 'Instagram / Copy Referral Link'}
            </button>
          </div>
        </div>

        {referralRestriction && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3.5 text-xs text-destructive flex items-start gap-2.5">
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
          <div className="space-y-4 text-xs text-muted-foreground pt-2 border-t border-border">
            <p>
              Sign in or create a free Scout account to send traceable in-app product referral
              cards to your Scouts List and earn across up to 13 generations.
            </p>
            <Link
              href="/auth/login"
              className="block w-full text-center py-2.5 px-4 font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
            >
              Sign In to Refer Products
            </Link>
          </div>
        ) : createdEvents.length > 0 ? (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="bg-accent border border-primary-border/50 rounded-xl p-4 text-xs text-accent-foreground space-y-1">
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
                <div
                  key={ev.id}
                  className="space-y-1.5 p-3 bg-muted/50 border border-border rounded-xl"
                >
                  <p className="text-[11px] font-numeric text-muted-foreground">
                    @{ev.recipientHandle} · {ev.id}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={buildShareUrl(ev)}
                      aria-label={`Event-specific referral link for ${ev.recipientHandle}`}
                      className="flex-1 px-2.5 py-1.5 font-numeric text-[11px] bg-background border border-input rounded-lg text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(ev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg cursor-pointer shrink-0"
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
              className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : activeContacts.length === 0 ? (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            <p>
              You have no active non-blocked contacts in your Scouts List yet. Invite a Scout in
              the Network → Scouts List tab first to dispatch in-app cards.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-border">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="text-xs font-medium text-foreground inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-foreground" aria-hidden="true" />
                  In-App Scouts List
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectUpTo20}
                    className="text-[11px] font-semibold text-foreground hover:underline cursor-pointer"
                  >
                    Select Eligible
                  </button>
                  <span
                    className={`font-numeric text-xs font-semibold tabular-nums ${
                      atBatchCap ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                    }`}
                  >
                    Selected: {selectedIds.length} / {MAX_RECIPIENTS} recipients
                  </span>
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-background/50">
                {activeContacts.map((c) => {
                  const checked = selectedIds.includes(c.scoutId);
                  const disabled = !checked && atBatchCap;
                  return (
                    <label
                      key={c.contactId}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 text-xs ${
                        disabled
                          ? 'opacity-50 cursor-not-allowed bg-muted/40'
                          : 'cursor-pointer hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleRecipient(c.scoutId)}
                          className="accent-foreground shrink-0"
                        />
                        <UserIdentityRow
                          avatarUrl={c.avatarUrl}
                          displayName={c.displayName}
                          username={c.handle}
                          size="sm"
                          subtitle={c.city}
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
              {atBatchCap && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  Maximum batch limit of {MAX_RECIPIENTS} recipients reached for this operation.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="ref-note"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Personal Note (Optional)
              </label>
              <textarea
                id="ref-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Share why this product is useful or verified..."
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
              />
            </div>

            <button
              type="submit"
              disabled={selectedIds.length === 0 || submitting || Boolean(referralRestriction)}
              className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              {submitting
                ? 'Generating Referral Cards...'
                : `Send Product Referral (${selectedIds.length})`}
            </button>
          </form>
        )}

        <div className="pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed space-y-1">
          <p className="font-semibold text-foreground">{NAIRASCOUT_TAGLINE}</p>
          <p>
            {NAIRASCOUT_EARNINGS_DISCLAIMER}{' '}
            <Link href="/programme-rules" onClick={handleClose} className="underline font-medium text-foreground">
              Programme Rules
            </Link>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
