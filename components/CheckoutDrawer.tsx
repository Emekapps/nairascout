'use client';

import { useState } from 'react';
import { CheckCircle2, Mail, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import type {
  MarketplaceOrder,
  NairaScoutSnapshot,
  ProductListing,
  ProductReferralEvent,
} from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';
import ProductImage from './ProductImage';

interface CheckoutDrawerProps {
  authenticated: boolean;
  session: {
    product: ProductListing;
    referralEvent: ProductReferralEvent | null;
  } | null;
  onClose: () => void;
  onOtpAuthenticated: (snapshot: NairaScoutSnapshot) => void;
  onConfirmOrder: (payload: {
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
  }) => Promise<MarketplaceOrder | null>;
}

export default function CheckoutDrawer({
  authenticated,
  session,
  onClose,
  onOtpAuthenticated,
  onConfirmOrder,
}: CheckoutDrawerProps) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<MarketplaceOrder | null>(null);

  const [otpEmail, setOtpEmail] = useState('');
  const [otpDisplayName, setOtpDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  if (!session) return null;

  const { product, referralEvent } = session;
  const isReferral = Boolean(referralEvent);
  const merchTotalKobo = product.priceKobo * quantity;
  const totalChargedKobo = merchTotalKobo + product.deliveryFeeKobo;
  const supabaseConfigured = isSupabaseBrowserConfigured();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setOtpError('Supabase Auth is not configured.');
      return;
    }

    setOtpBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail.trim(),
        options: {
          shouldCreateUser: true,
          data: otpDisplayName.trim() ? { display_name: otpDisplayName.trim() } : undefined,
        },
      });
      if (error) {
        setOtpError(error.message);
      } else {
        setOtpInfo(`6-digit OTP code sent to ${otpEmail.trim()}.`);
        setOtpStep('code');
      }
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setOtpError('Supabase Auth is not configured.');
      return;
    }

    setOtpBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: otpEmail.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (error) {
        setOtpError(error.message);
        return;
      }

      const res = await fetch('/api/auth/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({
          displayName: otpDisplayName.trim() || undefined,
          referralEventId: referralEvent?.id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Could not provision account in PostgreSQL.');
      } else if (data.snapshot) {
        onOtpAuthenticated(data.snapshot);
      }
    } finally {
      setOtpBusy(false);
    }
  };

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
    setOtpStep('email');
    setOtpCode('');
    setOtpError(null);
    setOtpInfo(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Checkout Session"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end"
    >
      <div className="bg-card text-card-foreground w-full max-w-lg h-full overflow-y-auto border-l border-border p-6 flex flex-col justify-between gap-6">
        {confirmedOrder ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <span className="font-sans text-xs font-semibold uppercase tracking-wider">
                  Order Confirmed
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetAndClose}
                aria-label="Close receipt"
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h2 className="font-sans text-xl font-bold text-foreground">
                {confirmedOrder.id} — Payment Recorded
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Seller fulfilment SLA: 10 calendar days. Commissions remain Pending until delivery
                confirmation and dispute checks pass.
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-2xl p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attribution Classification</span>
                <span className="font-numeric font-semibold text-foreground">
                  {confirmedOrder.attributionType === 'referral_card'
                    ? `Referral (${confirmedOrder.referralEventId})`
                    : 'Direct Marketplace'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Eligible Merchandise</span>
                <span className="font-numeric font-medium tabular-nums">
                  {formatKoboToNaira(confirmedOrder.eligibleMerchandiseKobo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery (Excluded from pool)</span>
                <span className="font-numeric font-medium tabular-nums">
                  {formatKoboToNaira(confirmedOrder.deliveryFeeKobo)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-bold">
                <span>Total Paid</span>
                <span className="font-numeric tabular-nums">
                  {formatKoboToNaira(confirmedOrder.totalChargedKobo)}
                </span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-2.5 text-xs">
              <p className="font-sans font-semibold text-foreground">
                Server-Side Commission Snapshot ({confirmedOrder.commissionSnapshot.ruleVersion})
              </p>
              <p className="text-muted-foreground">
                Schedule: {confirmedOrder.commissionSnapshot.scheduleName}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <p className="text-muted-foreground">10% Marketplace Fee</p>
                  <p className="font-numeric font-semibold text-foreground tabular-nums">
                    {formatKoboToNaira(confirmedOrder.commissionSnapshot.marketplaceCommissionKobo)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">20% Referral Pool</p>
                  <p className="font-numeric font-semibold text-success tabular-nums">
                    {formatKoboToNaira(confirmedOrder.commissionSnapshot.referralPoolKobo)}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-full py-3 px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
            >
              Done &amp; Return to Workspace
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-sans text-xl font-bold text-foreground">Checkout Session</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isReferral
                      ? `Attributed to Referral Card ${referralEvent?.id}`
                      : 'Direct Marketplace Listing Purchase'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  aria-label="Close checkout"
                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Attribution Banner */}
              <div
                className={`p-4 rounded-2xl border text-xs space-y-1 ${
                  isReferral
                    ? 'bg-accent border-primary-border/40 text-accent-foreground'
                    : 'bg-muted/60 border-border text-muted-foreground'
                }`}
              >
                <p className="font-sans font-semibold">
                  {isReferral
                    ? `Referral-Card Attribution Active (${referralEvent?.id})`
                    : 'Direct Marketplace Purchase (₦0 Referral Pool)'}
                </p>
                <p>
                  {isReferral
                    ? `Referred by @${referralEvent?.senderHandle}. Attribution is preserved across Email OTP verification and checkout.`
                    : 'Checkout was initiated from the general marketplace feed, so no referral commission will be generated.'}
                </p>
              </div>

              {/* Product Item */}
              <div className="flex gap-4 items-center">
                <div className="w-24 h-20 rounded-xl overflow-hidden shrink-0">
                  <ProductImage
                    src={product.imageUrl}
                    alt={product.title}
                    category={product.category}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans text-base font-semibold text-foreground truncate">
                    {product.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">Seller: {product.sellerName}</p>
                  <p className="mt-1 font-numeric text-sm font-bold text-foreground tabular-nums">
                    {formatKoboToNaira(product.priceKobo)} each
                  </p>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between py-3 border-y border-border">
                <span className="text-sm font-medium text-foreground">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="w-9 h-9 flex items-center justify-center border border-border rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-numeric text-sm font-semibold w-6 text-center tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    aria-label="Increase quantity"
                    className="w-9 h-9 flex items-center justify-center border border-border rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Email OTP Gate via @supabase/ssr */}
              {!authenticated && (
                <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-foreground" aria-hidden="true" />
                    <p className="text-xs font-semibold text-foreground">
                      Quick Email OTP Verification to Complete Order
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Verify your email via Supabase Auth to provision your free Scout identity while
                    preserving{' '}
                    {isReferral ? `referral card ${referralEvent?.id}` : 'this checkout session'}.
                  </p>

                  {!supabaseConfigured && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg">
                      Supabase Auth is not configured in environment variables yet.
                    </p>
                  )}

                  {otpError && (
                    <p className="text-xs text-destructive font-medium">{otpError}</p>
                  )}

                  {otpInfo && (
                    <p className="text-xs text-success font-medium">{otpInfo}</p>
                  )}

                  {otpStep === 'email' ? (
                    <form onSubmit={handleRequestOtp} className="space-y-2.5">
                      <input
                        type="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="you@example.com"
                        aria-label="Email address for OTP"
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground"
                      />
                      <input
                        type="text"
                        value={otpDisplayName}
                        onChange={(e) => setOtpDisplayName(e.target.value)}
                        placeholder="Your full name (for new accounts)"
                        aria-label="Full name"
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground"
                      />
                      <button
                        type="submit"
                        disabled={otpBusy || !supabaseConfigured}
                        className="w-full py-2.5 px-3 text-xs font-semibold text-commerce-foreground bg-commerce rounded-xl disabled:opacity-50 cursor-pointer"
                      >
                        {otpBusy ? 'Sending OTP...' : 'Send Email Verification Code'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-2.5">
                      <input
                        type="text"
                        required
                        maxLength={8}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        aria-label="OTP code"
                        className="w-full px-3 py-2 font-numeric text-sm bg-background border border-input rounded-xl text-foreground tabular-nums"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={otpBusy}
                          className="flex-1 py-2.5 px-3 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl cursor-pointer"
                        >
                          {otpBusy ? 'Verifying...' : 'Verify & Continue'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpStep('email');
                            setOtpInfo(null);
                          }}
                          className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-xl cursor-pointer"
                        >
                          Change Email
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Eligible Merchandise Subtotal</span>
                  <span className="font-numeric tabular-nums">
                    {formatKoboToNaira(merchTotalKobo)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Charge (Excluded from commission)</span>
                  <span className="font-numeric tabular-nums">
                    {formatKoboToNaira(product.deliveryFeeKobo)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-border text-base font-bold text-foreground">
                  <span>Total Due</span>
                  <span className="font-numeric tabular-nums">
                    {formatKoboToNaira(totalChargedKobo)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                <span>
                  10-day Seller fulfilment window · Commission calculations executed strictly
                  server-side
                </span>
              </div>
              <button
                type="button"
                disabled={submitting || !authenticated}
                onClick={handleCheckout}
                className="w-full h-11 px-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-commerce-foreground bg-commerce rounded-xl hover:bg-commerce/90 disabled:opacity-45 cursor-pointer"
              >
                {!authenticated
                  ? 'Verify Email OTP Above to Place Order'
                  : submitting
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
