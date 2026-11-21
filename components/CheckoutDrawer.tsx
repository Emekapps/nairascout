'use client';

import { useState } from 'react';
import { CheckCircle2, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import type {
  MarketplaceOrder,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import ProductImage from './ProductImage';

interface CheckoutDrawerProps {
  session: {
    product: ProductListing;
    referralEvent: ProductReferralEvent | null;
  } | null;
  onClose: () => void;
  onConfirmOrder: (payload: {
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
  }) => Promise<MarketplaceOrder | null>;
}

export default function CheckoutDrawer({
  session,
  onClose,
  onConfirmOrder,
}: CheckoutDrawerProps) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<MarketplaceOrder | null>(null);

  if (!session) return null;

  const { product, referralEvent } = session;
  const isReferral = Boolean(referralEvent);
  const merchTotalKobo = product.priceKobo * quantity;
  const totalChargedKobo = merchTotalKobo + product.deliveryFeeKobo;

  const handleCheckout = async () => {
    setSubmitting(true);
    const order = await onConfirmOrder({
      productListingId: product.id,
      quantity,
      referralEventId: referralEvent?.id ?? null,
    });
    if (order) {
      setConfirmedOrder(order);
    }
    setSubmitting(false);
  };

  const handleResetAndClose = () => {
    setConfirmedOrder(null);
    setQuantity(1);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Checkout Session"
      className="fixed inset-0 z-50 bg-black/45 flex justify-end"
    >
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto border-l border-[#E4E4DE] p-6 flex flex-col justify-between gap-6">
        {confirmedOrder ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-[#0B6E4F]">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Order Confirmed
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetAndClose}
                aria-label="Close receipt"
                className="p-1 text-[#5C665E] hover:text-[#111814] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h2 className="font-display text-2xl font-bold text-[#111814]">
                {confirmedOrder.id} — Payment Recorded
              </h2>
              <p className="mt-1 text-sm text-[#4B554E]">
                Seller fulfilment SLA: 10 calendar days. Commissions remain Pending until delivery
                confirmation and dispute checks pass.
              </p>
            </div>

            <div className="bg-[#FAFAF8] border border-[#E4E4DE] rounded-xl p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5C665E]">Attribution Classification</span>
                <span className="font-semibold text-[#111814]">
                  {confirmedOrder.attributionType === 'referral_card'
                    ? `Referral-Generated (${confirmedOrder.referralEventId})`
                    : 'Direct Marketplace'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C665E]">Eligible Merchandise</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatKoboToNaira(confirmedOrder.eligibleMerchandiseKobo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C665E]">Delivery (Excluded from pool)</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatKoboToNaira(confirmedOrder.deliveryFeeKobo)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E4E4DE] font-semibold">
                <span>Total Paid</span>
                <span className="font-mono tabular-nums">
                  {formatKoboToNaira(confirmedOrder.totalChargedKobo)}
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-2.5 text-xs">
              <p className="font-semibold text-[#111814]">
                Server-Side Commission Snapshot ({confirmedOrder.commissionSnapshot.ruleVersion})
              </p>
              <p className="text-[#4B554E]">
                Schedule: {confirmedOrder.commissionSnapshot.scheduleName}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <p className="text-[#5C665E]">10% Marketplace Fee</p>
                  <p className="font-mono font-semibold text-[#111814] tabular-nums">
                    {formatKoboToNaira(confirmedOrder.commissionSnapshot.marketplaceCommissionKobo)}
                  </p>
                </div>
                <div>
                  <p className="text-[#5C665E]">20% Referral Pool</p>
                  <p className="font-mono font-semibold text-[#0B6E4F] tabular-nums">
                    {formatKoboToNaira(confirmedOrder.commissionSnapshot.referralPoolKobo)}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#111814] rounded-lg hover:bg-[#26332B] cursor-pointer"
            >
              Done &amp; Return to Workspace
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#ECECE6] pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#111814]">
                    Checkout Session
                  </h2>
                  <p className="text-xs text-[#5C665E] mt-0.5">
                    {isReferral
                      ? `Attributed to Referral Card ${referralEvent?.id}`
                      : 'Direct Marketplace Listing Purchase'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  aria-label="Close checkout"
                  className="p-1 text-[#5C665E] hover:text-[#111814] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Attribution Banner */}
              <div
                className={`p-4 rounded-xl border text-xs space-y-1 ${
                  isReferral
                    ? 'bg-[#F3F8F6] border-[#CBE2D8] text-[#0B6E4F]'
                    : 'bg-[#F5F5F0] border-[#E4E4DE] text-[#4B554E]'
                }`}
              >
                <p className="font-semibold">
                  {isReferral
                    ? `Referral-Card Attribution Active (${referralEvent?.id})`
                    : 'Direct Marketplace Purchase (₦0 Referral Pool)'}
                </p>
                <p>
                  {isReferral
                    ? `Referred by @${referralEvent?.senderHandle}. Completing payment anchors the 20% referral pool to Seller ${product.sellerName}'s permanent referral ancestry.`
                    : 'Checkout was initiated from the general marketplace feed, so no referral commission will be generated.'}
                </p>
              </div>

              {/* Product Item */}
              <div className="flex gap-4 items-center">
                <div className="w-24 h-20 rounded-lg overflow-hidden shrink-0">
                  <ProductImage
                    src={product.imageUrl}
                    alt={product.title}
                    category={product.category}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-semibold text-[#111814] truncate">
                    {product.title}
                  </h3>
                  <p className="text-xs text-[#5C665E]">Seller: {product.sellerName}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[#111814] tabular-nums">
                    {formatKoboToNaira(product.priceKobo)} each
                  </p>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between py-3 border-y border-[#ECECE6]">
                <span className="text-sm font-medium text-[#111814]">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="w-8 h-8 flex items-center justify-center border border-[#D8D8D0] rounded-md hover:bg-[#F3F3EF] cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-sm font-semibold w-6 text-center tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    aria-label="Increase quantity"
                    className="w-8 h-8 flex items-center justify-center border border-[#D8D8D0] rounded-md hover:bg-[#F3F3EF] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-[#4B554E]">
                  <span>Eligible Merchandise Subtotal</span>
                  <span className="font-mono tabular-nums">{formatKoboToNaira(merchTotalKobo)}</span>
                </div>
                <div className="flex justify-between text-[#4B554E]">
                  <span>Delivery Charge (Excluded from commission)</span>
                  <span className="font-mono tabular-nums">
                    {formatKoboToNaira(product.deliveryFeeKobo)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[#E4E4DE] text-base font-bold text-[#111814]">
                  <span>Total Due</span>
                  <span className="font-mono tabular-nums">
                    {formatKoboToNaira(totalChargedKobo)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#ECECE6]">
              <div className="flex items-center gap-2 text-xs text-[#5C665E]">
                <ShieldCheck className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                <span>
                  10-day Seller fulfilment window · Commission calculations executed strictly
                  server-side
                </span>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCheckout}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 cursor-pointer"
              >
                {submitting
                  ? 'Processing Order...'
                  : `Complete Order · ${formatKoboToNaira(totalChargedKobo)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
