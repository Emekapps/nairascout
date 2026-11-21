'use client';

import { useState } from 'react';
import { Check, PackagePlus, Store } from 'lucide-react';
import {
  NairaScoutSnapshot,
  OrderFulfilmentStatus,
  SELLER_PLANS,
  SellerPlanId,
} from '@/lib/nairascout-store';
import { formatKoboToNaira, formatWholeNaira } from '@/lib/commission-engine';

interface SellerHubViewProps {
  snapshot: NairaScoutSnapshot;
  onAdvanceOrder: (orderId: string, nextStatus: OrderFulfilmentStatus) => Promise<void>;
  onCreateListing: (payload: {
    title: string;
    category: string;
    priceNaira: number;
    deliveryFeeNaira: number;
    stock: number;
    description: string;
  }) => Promise<boolean>;
  onSelectPlan: (planId: SellerPlanId) => Promise<void>;
}

export default function SellerHubView({
  snapshot,
  onAdvanceOrder,
  onCreateListing,
  onSelectPlan,
}: SellerHubViewProps) {
  const [subTab, setSubTab] = useState<'operations' | 'plans'>('operations');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Kitchen & Pantry');
  const [priceNaira, setPriceNaira] = useState('18500');
  const [deliveryFeeNaira, setDeliveryFeeNaira] = useState('2500');
  const [stock, setStock] = useState('10');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentPlan = SELLER_PLANS[snapshot.activeScout.sellerPlan];
  const { sellerStats } = snapshot;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    const ok = await onCreateListing({
      title,
      category,
      priceNaira: Number(priceNaira),
      deliveryFeeNaira: Number(deliveryFeeNaira),
      stock: Number(stock),
      description,
    });
    if (ok) {
      setTitle('');
      setDescription('');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E4DE] pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#111814]">
            Seller Operations &amp; Subscriptions
          </h1>
          <p className="mt-1.5 text-sm text-[#4B554E] max-w-2xl">
            Manage product listings within your Seller plan allowance, fulfil paid orders within
            the 10-day SLA, and track direct vs. referral-generated revenue.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EFEFE9] rounded-lg shrink-0 self-start">
          <button
            type="button"
            onClick={() => setSubTab('operations')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'operations' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            Fulfilment &amp; Listings
          </button>
          <button
            type="button"
            onClick={() => setSubTab('plans')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'plans' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            Seller Plans ({currentPlan.name})
          </button>
        </div>
      </div>

      {subTab === 'operations' ? (
        <div className="space-y-10">
          {/* Seller Aggregate Analytics */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-[#E4E4DE] pb-8">
            <div>
              <p className="text-xs text-[#5C665E]">Eligible Merchandise Revenue</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#111814] tabular-nums">
                {formatKoboToNaira(sellerStats.eligibleMerchandiseKobo)}
              </p>
              <p className="mt-1 text-xs text-[#5C665E]">
                {sellerStats.directOrdersCount} direct · {sellerStats.referralOrdersCount} referral
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">NairaScout 10% Commission</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#111814] tabular-nums">
                {formatKoboToNaira(sellerStats.marketplaceCommissionKobo)}
              </p>
              <p className="mt-1 text-xs text-[#5C665E]">
                Pool share: {formatKoboToNaira(sellerStats.referralPoolGeneratedKobo)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">Net Seller Proceeds (90%)</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#0B6E4F] tabular-nums">
                {formatKoboToNaira(sellerStats.netSellerProceedsKobo)}
              </p>
              <p className="mt-1 text-xs text-[#5C665E]">Separate from Scout wallet</p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">Plan Listing Quotas</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#111814] tabular-nums">
                {sellerStats.activeListingsCount} / {currentPlan.maxActiveListings}
              </p>
              <p className="mt-1 text-xs text-[#5C665E]">
                {sellerStats.monthlyPublicationsUsed} / {currentPlan.monthlyPublications} monthly
                publications
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Order Fulfilment & Commission Release Pipeline */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[#111814]">
                  Order Fulfilment &amp; Commission Release Pipeline
                </h2>
                <p className="text-xs text-[#5C665E]">
                  Confirming delivery transitions linked Scout commissions from Pending to
                  Available in the immutable ledger. Disputes place them On Hold; refunds create
                  Reversed entries.
                </p>
              </div>

              <div className="bg-white border border-[#E4E4DE] rounded-xl divide-y divide-[#ECECE6]">
                {snapshot.orders.map((order) => (
                  <div key={order.id} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#0B6E4F]">
                          {order.id} ·{' '}
                          {order.attributionType === 'referral_card'
                            ? `Referral-Generated (${order.referralEventId})`
                            : 'Direct Marketplace'}
                        </p>
                        <h3 className="mt-1 font-display text-base font-semibold text-[#111814]">
                          {order.productTitle} (×{order.quantity})
                        </h3>
                        <p className="text-xs text-[#5C665E]">
                          Seller: {order.sellerName} · Merchandise:{' '}
                          <span className="font-mono text-[#111814]">
                            {formatKoboToNaira(order.eligibleMerchandiseKobo)}
                          </span>{' '}
                          · Pool:{' '}
                          <span className="font-mono text-[#111814]">
                            {formatKoboToNaira(order.commissionSnapshot.referralPoolKobo)}
                          </span>
                        </p>
                      </div>

                      <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#F3F3EF] text-[#111814]">
                        {order.fulfilmentStatus}
                      </span>
                    </div>

                    {order.fulfilmentStatus !== 'Delivered' &&
                      order.fulfilmentStatus !== 'Refunded' && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F2F2EC]">
                          {order.fulfilmentStatus === 'Paid' && (
                            <button
                              type="button"
                              onClick={() => onAdvanceOrder(order.id, 'Processing')}
                              className="px-3 py-1.5 text-xs font-medium bg-[#F3F3EF] hover:bg-[#E4E4DC] rounded-md text-[#111814] cursor-pointer"
                            >
                              Mark Processing
                            </button>
                          )}
                          {(order.fulfilmentStatus === 'Paid' ||
                            order.fulfilmentStatus === 'Processing') && (
                            <button
                              type="button"
                              onClick={() => onAdvanceOrder(order.id, 'Dispatched')}
                              className="px-3 py-1.5 text-xs font-medium bg-[#F3F3EF] hover:bg-[#E4E4DC] rounded-md text-[#111814] cursor-pointer"
                            >
                              Mark Dispatched
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onAdvanceOrder(order.id, 'Delivered')}
                            className="px-3 py-1.5 text-xs font-semibold bg-[#0B6E4F] hover:bg-[#09583F] rounded-md text-white cursor-pointer"
                          >
                            Confirm Delivery (Release Commission)
                          </button>
                          {order.fulfilmentStatus !== 'Disputed' && (
                            <button
                              type="button"
                              onClick={() => onAdvanceOrder(order.id, 'Disputed')}
                              className="px-3 py-1.5 text-xs font-medium border border-[#E5CFA3] text-[#B45309] rounded-md hover:bg-[#FFFBEB] cursor-pointer"
                            >
                              Hold (Dispute)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onAdvanceOrder(order.id, 'Refunded')}
                            className="px-3 py-1.5 text-xs font-medium border border-[#E8D0D0] text-[#B91C1C] rounded-md hover:bg-[#FEF2F2] cursor-pointer"
                          >
                            Refund &amp; Reverse
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>

            {/* Publish Listing Form */}
            <div className="lg:col-span-5 bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-4 self-start">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#111814]">
                  Publish Product Listing
                </h2>
              </div>
              <p className="text-xs text-[#5C665E]">
                Active plan: <strong>{currentPlan.name}</strong> ({sellerStats.activeListingsCount}{' '}
                of {currentPlan.maxActiveListings} active slots used · 10-day duration).
              </p>

              <form onSubmit={handleCreate} className="space-y-3.5">
                <div>
                  <label htmlFor="lst-title" className="block text-xs font-medium text-[#4B554E] mb-1">
                    Product Name
                  </label>
                  <input
                    id="lst-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Abeokuta Adire Cotton Cushion Set"
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lst-cat" className="block text-xs font-medium text-[#4B554E] mb-1">
                      Category
                    </label>
                    <select
                      id="lst-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white focus:outline-none focus:border-[#0B6E4F]"
                    >
                      <option value="Home & Craft">Home &amp; Craft</option>
                      <option value="Kitchen & Pantry">Kitchen &amp; Pantry</option>
                      <option value="Audio & Tech">Audio &amp; Tech</option>
                      <option value="Beauty & Botanicals">Beauty &amp; Botanicals</option>
                      <option value="Fashion & Leather">Fashion &amp; Leather</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lst-stock" className="block text-xs font-medium text-[#4B554E] mb-1">
                      Quantity
                    </label>
                    <input
                      id="lst-stock"
                      type="number"
                      min={1}
                      required
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lst-price" className="block text-xs font-medium text-[#4B554E] mb-1">
                      Unit Price (₦)
                    </label>
                    <input
                      id="lst-price"
                      type="number"
                      min={500}
                      required
                      value={priceNaira}
                      onChange={(e) => setPriceNaira(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                    />
                  </div>
                  <div>
                    <label htmlFor="lst-deliv" className="block text-xs font-medium text-[#4B554E] mb-1">
                      Delivery Fee (₦)
                    </label>
                    <input
                      id="lst-deliv"
                      type="number"
                      min={0}
                      required
                      value={deliveryFeeNaira}
                      onChange={(e) => setDeliveryFeeNaira(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lst-desc" className="block text-xs font-medium text-[#4B554E] mb-1">
                    Description
                  </label>
                  <textarea
                    id="lst-desc"
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Material details, sizing, and fulfilment notes..."
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 cursor-pointer"
                >
                  {submitting ? 'Publishing...' : 'Publish Listing to Marketplace'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Seller Subscription Plans Comparison */
        <div className="space-y-6">
          <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 flex items-start gap-3">
            <Store className="w-5 h-5 text-[#0B6E4F] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-[#4B554E]">
              Seller subscriptions purchase Seller listing, video, and operational capacity.
              Subscriptions are strictly separate from the referral commission programme and never
              create or increase a Scout’s referral commission entitlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(['starter', 'traction', 'growth', 'sprawl'] as SellerPlanId[]).map((planId) => {
              const plan = SELLER_PLANS[planId];
              const isCurrent = snapshot.activeScout.sellerPlan === planId;
              return (
                <div
                  key={planId}
                  className={`bg-white rounded-xl p-6 flex flex-col justify-between gap-6 border ${
                    isCurrent ? 'border-[#0B6E4F]' : 'border-[#E4E4DE]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl font-bold text-[#111814]">
                        {plan.name}
                      </h3>
                      {isCurrent && (
                        <span className="text-xs font-semibold text-[#0B6E4F]">Current</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#5C665E] min-h-[32px]">{plan.tagline}</p>

                    <p className="mt-4 font-mono text-2xl font-bold text-[#111814] tabular-nums">
                      {plan.monthlyPriceKobo === 0
                        ? 'Free'
                        : `${formatWholeNaira(plan.monthlyPriceKobo)}/mo`}
                    </p>

                    <ul className="mt-5 pt-4 border-t border-[#ECECE6] space-y-2 text-xs text-[#3B443E]">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0B6E4F] shrink-0" />
                        <span>{plan.maxActiveListings} active product listings</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0B6E4F] shrink-0" />
                        <span>{plan.monthlyPublications} monthly publications</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0B6E4F] shrink-0" />
                        <span>{plan.maxCategories} product categories</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0B6E4F] shrink-0" />
                        <span>{plan.listingDurationDays}-day listing duration · 6 images</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0B6E4F] shrink-0" />
                        <span>Video: {plan.videoQuota}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0B6E4F] shrink-0" />
                        <span>{plan.analyticsLevel} analytics &amp; order tools</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0B6E4F] shrink-0" />
                        <span>
                          Promotions: {plan.promotionalPlacements ? 'Included' : 'No'} · Team:{' '}
                          {plan.sellerTeamAccounts ? 'Yes' : 'No'}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => onSelectPlan(planId)}
                    className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[#F3F3EF] text-[#5C665E] cursor-default'
                        : 'bg-[#111814] text-white hover:bg-[#26332B]'
                    }`}
                  >
                    {isCurrent ? 'Active Plan' : `Switch to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
