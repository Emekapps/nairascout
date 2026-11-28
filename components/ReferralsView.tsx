'use client';

// NS-UI-310 & NS-UI-318: Dedicated Inbox & Sent Referrals Views
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Inbox, Search, Send, ShoppingBag, X } from 'lucide-react';
import type {
  NairaScoutSnapshot,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import ProductImage from './ProductImage';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';

interface ReferralsViewProps {
  snapshot: NairaScoutSnapshot;
  viewMode?: 'all' | 'inbox' | 'sent';
  onStartReferralCheckout: (product: ProductListing, referralEvent: ProductReferralEvent) => void;
  onOpenReferModal: (product: ProductListing) => void;
}

export default function ReferralsView({
  snapshot,
  viewMode = 'all',
  onStartReferralCheckout,
  onOpenReferModal,
}: ReferralsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredInbox = useMemo(() => {
    if (!normalizedQuery) return snapshot.referralsInbox;
    return snapshot.referralsInbox.filter((ev) => {
      const product = snapshot.products.find((p) => p.id === ev.productListingId);
      return (
        ev.id.toLowerCase().includes(normalizedQuery) ||
        ev.senderDisplayName.toLowerCase().includes(normalizedQuery) ||
        ev.senderHandle.toLowerCase().includes(normalizedQuery) ||
        ev.note.toLowerCase().includes(normalizedQuery) ||
        (product?.title.toLowerCase().includes(normalizedQuery) ?? false) ||
        (product?.sellerName.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [snapshot.referralsInbox, snapshot.products, normalizedQuery]);

  const filteredSent = useMemo(() => {
    if (!normalizedQuery) return snapshot.sentReferrals;
    return snapshot.sentReferrals.filter((ev) => {
      const product = snapshot.products.find((p) => p.id === ev.productListingId);
      return (
        ev.id.toLowerCase().includes(normalizedQuery) ||
        ev.recipientDisplayName.toLowerCase().includes(normalizedQuery) ||
        ev.recipientHandle.toLowerCase().includes(normalizedQuery) ||
        ev.ancestryPathSignature.toLowerCase().includes(normalizedQuery) ||
        (product?.title.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [snapshot.sentReferrals, snapshot.products, normalizedQuery]);

  const showInbox = viewMode === 'all' || viewMode === 'inbox';
  const showSent = viewMode === 'all' || viewMode === 'sent';
  const pageTitle =
    viewMode === 'inbox' ? 'Inbox' : viewMode === 'sent' ? 'Sent' : 'Referrals';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
            {pageTitle}
          </h1>
          {viewMode === 'inbox' && (
            <p className="text-xs text-muted-foreground">
              Referral cards received from Scouts. Selecting Buy here records Referral-Card Attribution.
            </p>
          )}
          {viewMode === 'sent' && (
            <p className="text-xs text-muted-foreground">
              Audit trail of product referral cards you have dispatched to your Scouts List.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {viewMode === 'inbox' && (
            <Link
              href="/referrals/sent"
              className="text-xs font-semibold text-[#2E5339] dark:text-[#6E9470] hover:underline"
            >
              View Sent Referrals →
            </Link>
          )}
          {viewMode === 'sent' && (
            <Link
              href="/referrals/inbox"
              className="text-xs font-semibold text-[#2E5339] dark:text-[#6E9470] hover:underline"
            >
              View Inbox →
            </Link>
          )}
          {snapshot.authenticated && (
            <Link
              href="/settings/privacy"
              className="text-xs font-semibold text-foreground hover:underline"
            >
              Manage Privacy Settings →
            </Link>
          )}
        </div>
      </div>

      {/* Dismissible Notice Panel + Search Bar */}
      <div className="space-y-4">
        <DismissibleNoticePanel
          storageKey={
            viewMode === 'sent'
              ? 'nairascout_referrals_sent_notice_v1'
              : 'nairascout_referrals_inbox_notice_v1'
          }
          title={viewMode === 'sent' ? 'Sent Referral Cards' : 'Product Referrals Inbox'}
          description="Every product referral card carries a unique referral-event identifier preserved through registration, Email OTP verification, and checkout."
          ariaLabel="Product Referrals Notice"
        />

        <div className="relative">
          <Search
            className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search referral cards by product, scout, or event ID..."
            aria-label="Search referral cards"
            className="w-full h-10 pl-10 pr-9 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear referral search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inbox */}
      {showInbox && (
        <section className="space-y-4">
          {viewMode === 'all' && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-sans text-lg md:text-xl font-bold text-foreground">
                Inbox
              </h2>
              <span className="text-xs text-muted-foreground">
                Selecting Buy here records Referral-Card Attribution
              </span>
            </div>
          )}

          {filteredInbox.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-2">
              <Inbox className="w-7 h-7 text-muted-foreground mx-auto" aria-hidden="true" />
              <p className="font-sans text-base font-semibold text-foreground">
                {snapshot.referralsInbox.length > 0 && normalizedQuery
                  ? 'No matching referrals found'
                  : snapshot.authenticated
                    ? 'No referrals inbox'
                    : 'Sign in to view personal referral cards sent to your Scout account'}
              </p>
              <p className="text-sm text-muted-foreground">
                {snapshot.referralsInbox.length > 0 && normalizedQuery
                  ? 'Try clearing your search query to view all referral cards.'
                  : 'When Scouts in your network refer a product to you or you open a referral link, it appears here with its event ID.'}
              </p>
              {snapshot.referralsInbox.length > 0 && normalizedQuery ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                !snapshot.authenticated && (
                  <div className="pt-2">
                    <Link
                      href="/auth/login"
                      className="inline-block px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
                    >
                      Sign In
                    </Link>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredInbox.map((refEvent) => {
                const product = snapshot.products.find((p) => p.id === refEvent.productListingId);
                if (!product) return null;
                const isConverted = refEvent.status === 'converted';
                const isExpired = refEvent.status === 'expired';
                const productRefHref = `/products/${encodeURIComponent(product.id)}?ref=${encodeURIComponent(refEvent.id)}`;

                return (
                  <article
                    key={refEvent.id}
                    className="bg-card border border-border rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-12"
                  >
                    <Link href={productRefHref} className="sm:col-span-5 min-h-[200px] block">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.title}
                        category={product.category}
                        className="w-full h-full"
                      />
                    </Link>

                    <div className="sm:col-span-7 p-5 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-numeric font-semibold text-foreground">
                            {refEvent.id}
                          </span>
                          <span className="capitalize">
                            {isConverted
                              ? 'Order Completed'
                              : isExpired
                                ? 'Expired'
                                : 'Active Attribution'}
                          </span>
                        </div>

                        <Link href={productRefHref} className="block mt-2">
                          <h3 className="font-sans text-base font-semibold text-foreground hover:underline">
                            {product.title}
                          </h3>
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Referred by{' '}
                          <span className="font-semibold text-foreground">
                            {refEvent.senderDisplayName}
                          </span>{' '}
                          (<span className="font-sans">@{refEvent.senderHandle}</span>)
                        </p>

                        <p className="mt-3 text-sm text-foreground/90 bg-muted/60 p-3 rounded-xl border border-border">
                          &ldquo;{refEvent.note}&rdquo;
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border space-y-3">
                        <Link href={productRefHref} className="flex items-baseline justify-between">
                          <span className="font-numeric text-lg font-bold text-foreground tabular-nums">
                            {formatWholeNaira(product.priceKobo)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Seller: {product.sellerName}
                          </span>
                        </Link>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isExpired || product.stock <= 0}
                            onClick={() => {
                              void fetch('/api/nairascout', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'X-Requested-With': 'NairaScout',
                                },
                                body: JSON.stringify({
                                  action: 'mark_referral_opened',
                                  referralEventId: refEvent.id,
                                }),
                              }).catch(() => undefined);
                              onStartReferralCheckout(product, refEvent);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#FFFFFF] bg-[#6B4214] rounded-lg hover:bg-[#56340F] dark:bg-[#8A5820] dark:hover:bg-[#754A1A] disabled:opacity-45 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                            Buy via Card
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenReferModal(product)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#FFFFFF] bg-[#2E5339] border border-transparent rounded-lg hover:bg-[#23412C] dark:bg-[#3A6B49] dark:hover:bg-[#305A3D] transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" aria-hidden="true" />
                            Refer On
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Sent */}
      {showSent && (
        <section className="space-y-4">
          {viewMode === 'all' && (
            <h2 className="font-sans text-lg md:text-xl font-bold text-foreground">
              Sent
            </h2>
          )}

          {!snapshot.authenticated ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
              <Send className="w-7 h-7 text-muted-foreground mx-auto" aria-hidden="true" />
              <p className="font-sans text-base font-semibold text-foreground">
                Sign in to view your sent referral cards
              </p>
              <Link
                href="/auth/login"
                className="inline-block px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-x-auto">
              {filteredSent.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {snapshot.sentReferrals.length > 0 && normalizedQuery
                    ? 'No matching sent referrals found.'
                    : 'You have not sent any product referral cards yet.'}
                </div>
              ) : (
                <table className="w-full min-w-[680px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-3 px-4 font-medium">Event ID</th>
                      <th className="py-3 px-4 font-medium">Product</th>
                      <th className="py-3 px-4 font-medium">Recipient</th>
                      <th className="py-3 px-4 font-medium">Path Signature</th>
                      <th className="py-3 px-4 font-medium">Sent / Expires</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSent.map((ev) => {
                      const prod = snapshot.products.find((p) => p.id === ev.productListingId);
                      return (
                        <tr key={ev.id} className="hover:bg-muted/40">
                          <td className="py-3 px-4 font-numeric text-xs font-semibold text-foreground">
                            {ev.id}
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            <Link
                              href={`/products/${encodeURIComponent(ev.productListingId)}`}
                              className="hover:underline"
                            >
                              {prod?.title || ev.productListingId}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {ev.recipientDisplayName} (
                            <span className="font-sans">@{ev.recipientHandle}</span>)
                          </td>
                          <td className="py-3 px-4 font-numeric text-xs text-muted-foreground">
                            {ev.ancestryPathSignature}
                          </td>
                          <td className="py-3 px-4 font-numeric text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {ev.createdAt.slice(0, 10)} → {ev.expiresAt.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 capitalize text-xs font-semibold text-foreground">
                            {ev.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
