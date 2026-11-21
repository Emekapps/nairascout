'use client';

import Link from 'next/link';
import { Inbox, Send, ShoppingBag } from 'lucide-react';
import type {
  NairaScoutSnapshot,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatWholeNaira } from '@/lib/commission-engine';
import ProductImage from './ProductImage';

interface ReferralsViewProps {
  snapshot: NairaScoutSnapshot;
  onStartReferralCheckout: (product: ProductListing, referralEvent: ProductReferralEvent) => void;
  onOpenReferModal: (product: ProductListing) => void;
}

export default function ReferralsView({
  snapshot,
  onStartReferralCheckout,
  onOpenReferModal,
}: ReferralsViewProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E4DE] pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#111814]">
            Product Referrals Inbox
          </h1>
          <p className="mt-1.5 text-sm text-[#4B554E] max-w-2xl">
            Every product referral card carries a unique referral-event identifier preserved through
            registration, Email OTP verification, and checkout.
          </p>
        </div>
        {snapshot.authenticated && (
          <Link
            href="/settings"
            className="text-xs font-semibold text-[#0B6E4F] hover:underline shrink-0"
          >
            Manage Referral Mute &amp; Privacy →
          </Link>
        )}
      </div>

      {/* Received Product Referral Cards */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-[#111814]">
            Received Product Referral Cards
          </h2>
          <span className="text-xs text-[#5C665E]">
            Selecting Buy here records Referral-Card Attribution
          </span>
        </div>

        {snapshot.referralsInbox.length === 0 ? (
          <div className="bg-white border border-[#E4E4DE] rounded-xl p-10 text-center space-y-2">
            <Inbox className="w-7 h-7 text-[#5C665E] mx-auto" aria-hidden="true" />
            <p className="font-display text-base font-semibold text-[#111814]">
              {snapshot.authenticated
                ? 'No received product referrals yet'
                : 'Sign in to view personal referral cards sent to your Scout account'}
            </p>
            <p className="text-sm text-[#5C665E]">
              When Scouts in your network refer a product to you or you open a referral link, it
              appears here with its event ID.
            </p>
            {!snapshot.authenticated && (
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="inline-block px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {snapshot.referralsInbox.map((refEvent) => {
              const product = snapshot.products.find((p) => p.id === refEvent.productListingId);
              if (!product) return null;
              const isConverted = refEvent.status === 'converted';
              const isExpired = refEvent.status === 'expired';

              return (
                <article
                  key={refEvent.id}
                  className="bg-white border border-[#E4E4DE] rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-12"
                >
                  <div className="sm:col-span-5 min-h-[200px]">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.title}
                      category={product.category}
                      className="w-full h-full"
                    />
                  </div>

                  <div className="sm:col-span-7 p-5 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#5C665E]">
                        <span className="font-mono font-medium text-[#0B6E4F]">{refEvent.id}</span>
                        <span className="capitalize">
                          {isConverted
                            ? 'Order Completed'
                            : isExpired
                            ? 'Expired'
                            : 'Active Attribution'}
                        </span>
                      </div>

                      <h3 className="mt-2 font-display text-lg font-semibold text-[#111814]">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-xs text-[#4B554E]">
                        Referred by{' '}
                        <span className="font-semibold text-[#111814]">
                          {refEvent.senderDisplayName}
                        </span>{' '}
                        (@{refEvent.senderHandle})
                      </p>

                      <p className="mt-3 text-sm text-[#3B443E] bg-[#F6F6F2] p-3 rounded-lg border border-[#ECECE6]">
                        &ldquo;{refEvent.note}&rdquo;
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#ECECE6] space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-lg font-semibold text-[#111814] tabular-nums">
                          {formatWholeNaira(product.priceKobo)}
                        </span>
                        <span className="text-xs text-[#5C665E]">
                          Seller: {product.sellerName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          disabled={isExpired || product.stock <= 0}
                          onClick={() => onStartReferralCheckout(product, refEvent)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                          Buy via Referral Card
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReferModal(product)}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-[#111814] bg-white border border-[#D8D8D0] rounded-lg hover:bg-[#F3F3EF] transition-colors whitespace-nowrap cursor-pointer"
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

      {/* Outgoing Sent Product Referrals */}
      {snapshot.authenticated && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-[#111814]">
            Sent Product Referrals
          </h2>
          <div className="bg-white border border-[#E4E4DE] rounded-xl overflow-x-auto">
            {snapshot.sentReferrals.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5C665E]">
                You have not sent any product referral cards yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E4E4DE] text-xs text-[#5C665E]">
                    <th className="py-3 px-4 font-medium">Event ID</th>
                    <th className="py-3 px-4 font-medium">Product</th>
                    <th className="py-3 px-4 font-medium">Recipient</th>
                    <th className="py-3 px-4 font-medium">Path Signature</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECECE6]">
                  {snapshot.sentReferrals.map((ev) => {
                    const prod = snapshot.products.find((p) => p.id === ev.productListingId);
                    return (
                      <tr key={ev.id} className="hover:bg-[#FAFAF8]">
                        <td className="py-3 px-4 font-mono text-xs font-medium text-[#0B6E4F]">
                          {ev.id}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#111814]">
                          {prod?.title || ev.productListingId}
                        </td>
                        <td className="py-3 px-4 text-[#4B554E]">
                          {ev.recipientDisplayName} (@{ev.recipientHandle})
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-[#5C665E]">
                          {ev.ancestryPathSignature}
                        </td>
                        <td className="py-3 px-4 capitalize text-xs font-medium text-[#111814]">
                          {ev.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
