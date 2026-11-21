'use client';

import { useState } from 'react';
import {
  Ban,
  Check,
  Inbox,
  Send,
  ShieldAlert,
  ShoppingBag,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
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
  onInviteScout: (targetScoutId: string) => Promise<void>;
  onRespondInvite: (invitationId: string, decision: 'accept' | 'reject' | 'withdraw') => Promise<void>;
  onManageContact: (contactId: string, operation: 'remove' | 'toggle_block') => Promise<void>;
  onUpdateInvitePolicy: (policy: 'anyone' | 'contacts_only' | 'disabled') => Promise<void>;
}

export default function ReferralsView({
  snapshot,
  onStartReferralCheckout,
  onOpenReferModal,
  onInviteScout,
  onRespondInvite,
  onManageContact,
  onUpdateInvitePolicy,
}: ReferralsViewProps) {
  const [subTab, setSubTab] = useState<'inbox' | 'scouts_list'>('inbox');
  const [inviteTargetId, setInviteTargetId] = useState<string>('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const availableInvitees = snapshot.allScoutsDirectory.filter(
    (s) =>
      !snapshot.scoutsList.some((c) => c.scoutId === s.id) &&
      !snapshot.invitations.some((i) => i.otherScoutId === s.id && i.status === 'pending')
  );

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTargetId) return;
    setBusyAction('invite');
    await onInviteScout(inviteTargetId);
    setInviteTargetId('');
    setBusyAction(null);
  };

  return (
    <div className="space-y-8">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E4DE] pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#111814]">
            Referrals Inbox &amp; Scouts List
          </h1>
          <p className="mt-1.5 text-sm text-[#4B554E] max-w-2xl">
            Invite adds a person to your reusable Scouts List. Refer sends a specific product card
            with a unique referral-event identifier preserved through checkout.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EFEFE9] rounded-lg shrink-0 self-start">
          <button
            type="button"
            onClick={() => setSubTab('inbox')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'inbox' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" aria-hidden="true" />
            Referrals Inbox ({snapshot.referralsInbox.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('scouts_list')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'scouts_list' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            Scouts List ({snapshot.scoutsList.length})
          </button>
        </div>
      </div>

      {subTab === 'inbox' ? (
        <div className="space-y-10">
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
              <div className="bg-white border border-[#E4E4DE] rounded-xl p-10 text-center">
                <p className="font-display text-base font-semibold text-[#111814]">
                  No received product referrals yet
                </p>
                <p className="mt-1 text-sm text-[#5C665E]">
                  When Scouts in your network refer a product to you, their traceable referral cards
                  appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {snapshot.referralsInbox.map((refEvent) => {
                  const product = snapshot.products.find(
                    (p) => p.id === refEvent.productListingId
                  );
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
                            <span className="font-mono font-medium text-[#0B6E4F]">
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
          <section className="space-y-4">
            <h2 className="font-display text-xl font-bold text-[#111814]">
              Sent Product Referrals
            </h2>
            <div className="bg-white border border-[#E4E4DE] rounded-xl overflow-x-auto">
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
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column: Scouts List Contacts */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#111814]">
                Your Scouts List Contacts
              </h2>
              <span className="text-xs text-[#5C665E]">
                Adding a contact creates no commission
              </span>
            </div>

            <div className="bg-white border border-[#E4E4DE] rounded-xl divide-y divide-[#ECECE6]">
              {snapshot.scoutsList.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5C665E]">
                  Your Scouts List is empty. Invite Scouts you know on the right.
                </div>
              ) : (
                snapshot.scoutsList.map((contact) => (
                  <div
                    key={contact.contactId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-sm text-[#111814]">
                        {contact.displayName}{' '}
                        <span className="font-mono text-xs text-[#5C665E]">
                          @{contact.handle}
                        </span>
                      </p>
                      <p className="text-xs text-[#5C665E] mt-0.5">
                        {contact.city} · Added {contact.addedAt}
                        {contact.blocked ? ' · Blocked from referrals' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onManageContact(contact.contactId, 'toggle_block')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-[#D8D8D0] rounded-md text-[#4B554E] hover:text-[#111814] hover:bg-[#F3F3EF] cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                        {contact.blocked ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onManageContact(contact.contactId, 'remove')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-[#E8D0D0] rounded-md text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right column: Invite & Pending Invitations + Privacy Policy */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-4">
              <h3 className="font-display text-lg font-semibold text-[#111814]">
                Invite Scout to Scouts List
              </h3>
              <p className="text-xs text-[#5C665E]">
                Invitations expire automatically after 7 days if unanswered.
              </p>

              <form onSubmit={handleInviteSubmit} className="space-y-3">
                <select
                  value={inviteTargetId}
                  onChange={(e) => setInviteTargetId(e.target.value)}
                  aria-label="Select a Scout to invite"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                >
                  <option value="">Select a registered Scout...</option>
                  {availableInvitees.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} (@{s.handle}) · {s.city}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={!inviteTargetId || busyAction === 'invite'}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  Send Scouts List Invite
                </button>
              </form>
            </div>

            {/* Pending Invitations */}
            <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-4">
              <h3 className="font-display text-lg font-semibold text-[#111814]">
                Invitations
              </h3>
              <div className="divide-y divide-[#ECECE6]">
                {snapshot.invitations.map((inv) => (
                  <div key={inv.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[#111814]">
                        {inv.otherDisplayName} (@{inv.otherHandle})
                      </span>
                      <span className="text-xs text-[#5C665E] capitalize">
                        {inv.direction} · {inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#5C665E]">
                      {inv.otherCity} · Expires {inv.expiresAt}
                    </p>
                    {inv.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        {inv.direction === 'incoming' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onRespondInvite(inv.id, 'accept')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-md cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => onRespondInvite(inv.id, 'reject')}
                              className="px-3 py-1.5 text-xs font-medium border border-[#D8D8D0] rounded-md text-[#4B554E] cursor-pointer"
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRespondInvite(inv.id, 'withdraw')}
                            className="px-3 py-1.5 text-xs font-medium border border-[#D8D8D0] rounded-md text-[#4B554E] cursor-pointer"
                          >
                            Withdraw Invite
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Control */}
            <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                <h3 className="font-display text-base font-semibold text-[#111814]">
                  Invitation Privacy Control
                </h3>
              </div>
              <p className="text-xs text-[#5C665E]">
                Choose who may send you Scouts List invitations.
              </p>
              <select
                value={snapshot.activeScout.invitePolicy}
                onChange={(e) =>
                  onUpdateInvitePolicy(
                    e.target.value as 'anyone' | 'contacts_only' | 'disabled'
                  )
                }
                aria-label="Scouts List invitation privacy preference"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
              >
                <option value="anyone">Any verified Scout</option>
                <option value="contacts_only">Only Scouts within 2 generations</option>
                <option value="disabled">Pause new invitations</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
