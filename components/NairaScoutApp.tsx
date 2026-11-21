'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import type {
  MarketplaceOrder,
  NairaScoutSnapshot,
  OrderFulfilmentStatus,
  ProductListing,
  ProductReferralEvent,
  SellerPlanId,
  SupportCase,
} from '@/lib/nairascout-store';
import HeaderNav, { NavTab } from './HeaderNav';
import MarketplaceView from './MarketplaceView';
import ReferralsView from './ReferralsView';
import NetworkView from './NetworkView';
import WalletView from './WalletView';
import SellerHubView from './SellerHubView';
import CheckoutDrawer from './CheckoutDrawer';
import ReferProductModal from './ReferProductModal';
import TrustGuideDrawer from './TrustGuideDrawer';

interface NairaScoutAppProps {
  initialSnapshot: NairaScoutSnapshot;
  initialRefEvent?: string | null;
}

export default function NairaScoutApp({
  initialSnapshot,
  initialRefEvent,
}: NairaScoutAppProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<NairaScoutSnapshot>(initialSnapshot);
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>(
    initialRefEvent ? 'referrals' : 'marketplace'
  );
  const [checkoutSession, setCheckoutSession] = useState<{
    product: ProductListing;
    referralEvent: ProductReferralEvent | null;
  } | null>(null);
  const [referModalProduct, setReferModalProduct] = useState<ProductListing | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  const showFeedback = (type: 'ok' | 'err', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const buildHeaders = (): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'NairaScout',
    };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }
    return headers;
  };

  const callJsonApi = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback('err', data.error || 'Action could not be completed.');
      return null;
    }
    if (data.snapshot) {
      setSnapshot(data.snapshot);
    }
    return data;
  };

  const callApi = async (body: Record<string, unknown>) => {
    return callJsonApi('/api/nairascout', body);
  };

  const handleLogout = async () => {
    const data = await callJsonApi('/api/auth/session', { action: 'logout' });
    setBearerToken(null);
    if (data?.snapshot) {
      setSnapshot(data.snapshot);
    }
    setActiveTab('marketplace');
    showFeedback('ok', 'Signed out cleanly.');
    router.refresh();
  };

  const handleConfirmOrder = async (payload: {
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
  }): Promise<MarketplaceOrder | null> => {
    const data = await callApi({ action: 'checkout', ...payload });
    if (!data?.order) return null;
    showFeedback(
      'ok',
      `Order ${data.order.id} placed (${
        data.order.attributionType === 'referral_card' ? 'Referral-Attributed' : 'Direct'
      }).`
    );
    return data.order;
  };

  const handleSendReferral = async (payload: {
    productListingId: string;
    recipientScoutId: string;
    note: string;
  }): Promise<ProductReferralEvent | null> => {
    const data = await callApi({ action: 'refer_product', ...payload });
    if (!data?.event) return null;
    showFeedback('ok', `Referral card ${data.event.id} sent to @${data.event.recipientHandle}.`);
    return data.event;
  };

  const handleAdvanceOrder = async (orderId: string, nextStatus: OrderFulfilmentStatus) => {
    const data = await callApi({ action: 'advance_order', orderId, nextStatus });
    if (data?.order) {
      showFeedback('ok', `Order ${orderId} updated to ${nextStatus}. Ledger updated.`);
    }
  };

  const handleInviteScout = async (targetScoutId: string) => {
    const data = await callApi({ action: 'invite_scout', targetScoutId });
    if (data?.invitation) {
      showFeedback(
        'ok',
        `Scouts List invitation sent to @${data.invitation.otherHandle}.`
      );
    }
  };

  const handleRespondInvite = async (
    invitationId: string,
    decision: 'accept' | 'reject' | 'withdraw'
  ) => {
    const data = await callApi({ action: 'respond_invite', invitationId, decision });
    if (data) {
      showFeedback('ok', `Invitation updated (${decision}).`);
    }
  };

  const handleManageContact = async (payload: {
    contactId?: string;
    targetUserId?: string;
    operation: 'remove' | 'block' | 'unblock';
  }) => {
    const data = await callApi({ action: 'manage_contact', ...payload });
    if (data) {
      showFeedback('ok', 'Scouts List relationship updated.');
    }
  };

  const handleReportAbuse = async (payload: {
    reportedUserId: string;
    reason: string;
    description: string;
  }): Promise<boolean> => {
    const data = await callApi({ action: 'report_abuse', ...payload });
    if (!data?.report) return false;
    showFeedback('ok', `Abuse report ${data.report.id} logged for Trust & Safety review.`);
    return true;
  };

  const handleActivateSeller = async (payload: {
    sellerType: 'INDIVIDUAL' | 'BUSINESS';
    sellerName: string;
    description: string;
    businessCategory: string;
    businessRegNumber?: string;
    businessAddress?: string;
    planId: SellerPlanId;
    evidencePaths: string[];
    termsAccepted: boolean;
  }): Promise<boolean> => {
    const data = await callJsonApi('/api/seller/onboarding', payload);
    if (!data?.seller) return false;
    showFeedback(
      'ok',
      'Seller onboarding submitted. You may create Draft listings while verification is pending.'
    );
    return true;
  };

  const handleCreateDraftListing = async (payload: {
    title: string;
    category: string;
    priceNaira: number;
    deliveryFeeNaira: number;
    stock: number;
    description: string;
  }): Promise<boolean> => {
    const data = await callJsonApi('/api/seller/listings', payload);
    if (!data?.listing) return false;
    showFeedback('ok', `Draft listing "${data.listing.title}" saved.`);
    return true;
  };

  const handlePublishListing = async (listingId: string) => {
    const data = await callJsonApi(`/api/seller/listings/${encodeURIComponent(listingId)}/publish`, {});
    if (data?.listing) {
      showFeedback('ok', `Listing "${data.listing.title}" published to Marketplace.`);
    }
  };

  const handleSelectPlan = async (planId: SellerPlanId) => {
    const data = await callApi({ action: 'update_seller_plan', planId });
    if (data) {
      showFeedback('ok', `Seller plan updated to ${planId}.`);
    }
  };

  const handleManageTeam = async (payload: Record<string, unknown>): Promise<boolean> => {
    const data = await callJsonApi('/api/seller/team', payload);
    if (!data) return false;
    showFeedback('ok', 'Seller team membership updated.');
    return true;
  };

  const handleSubmitSupport = async (payload: {
    topic: SupportCase['topic'];
    subject: string;
    details: string;
  }) => {
    const data = await callApi({ action: 'submit_support', ...payload });
    if (!data?.supportCase) return false;
    showFeedback('ok', `Support case ${data.supportCase.id} logged.`);
    return true;
  };

  const activeInboxCount = snapshot.referralsInbox.filter((r) => r.status === 'active').length;

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenGuide={() => setGuideOpen(true)}
        inboxCount={activeInboxCount}
        authenticated={snapshot.authenticated}
        activeScout={snapshot.activeScout}
        adminBootstrapAvailable={snapshot.adminBootstrapAvailable}
        onLogout={handleLogout}
      />

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`border-b px-4 py-2.5 text-xs font-medium text-center ${
            feedback.type === 'ok'
              ? 'bg-[#F3F8F6] border-[#CBE2D8] text-[#0B6E4F]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'marketplace' && (
            <MarketplaceView
              snapshot={snapshot}
              onStartDirectCheckout={(product) =>
                setCheckoutSession({ product, referralEvent: null })
              }
              onOpenReferModal={(product) => setReferModalProduct(product)}
              onGoToReferrals={() => setActiveTab('referrals')}
            />
          )}

          {activeTab === 'referrals' && (
            <ReferralsView
              snapshot={snapshot}
              onStartReferralCheckout={(product, referralEvent) =>
                setCheckoutSession({ product, referralEvent })
              }
              onOpenReferModal={(product) => setReferModalProduct(product)}
            />
          )}

          {activeTab === 'network' && (
            <NetworkView
              snapshot={snapshot}
              onInviteScout={handleInviteScout}
              onRespondInvite={handleRespondInvite}
              onManageContact={handleManageContact}
              onReportAbuse={handleReportAbuse}
              onOpenReferForProduct={(product) => setReferModalProduct(product)}
            />
          )}

          {activeTab === 'wallet' && <WalletView snapshot={snapshot} />}

          {activeTab === 'seller' && (
            <SellerHubView
              snapshot={snapshot}
              onAdvanceOrder={handleAdvanceOrder}
              onCreateDraftListing={handleCreateDraftListing}
              onPublishListing={handlePublishListing}
              onSelectPlan={handleSelectPlan}
              onActivateSeller={handleActivateSeller}
              onManageTeam={handleManageTeam}
            />
          )}
        </motion.div>
      </main>

      <footer className="border-t border-[#E4E4DE] bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#5C665E]">
          <p>
            NairaScout · Thirteen-generation referral marketing &amp; social commerce. No income
            is guaranteed; commissions arise strictly from genuine qualifying product sales.
          </p>
          <div className="flex items-center gap-5 shrink-0">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="hover:text-[#111814] cursor-pointer"
            >
              Programme Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('network')}
              className="hover:text-[#111814] cursor-pointer"
            >
              Commission Calculator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className="hover:text-[#111814] cursor-pointer"
            >
              Payout Policy
            </button>
          </div>
        </div>
      </footer>

      <CheckoutDrawer
        authenticated={snapshot.authenticated}
        session={checkoutSession}
        onClose={() => setCheckoutSession(null)}
        onOtpAuthenticated={(token, nextSnapshot) => {
          if (token) setBearerToken(token);
          setSnapshot(nextSnapshot);
          showFeedback('ok', 'Email verified. Complete your order below.');
        }}
        onConfirmOrder={handleConfirmOrder}
      />

      <ReferProductModal
        product={referModalProduct}
        snapshot={snapshot}
        onClose={() => setReferModalProduct(null)}
        onSendReferral={handleSendReferral}
      />

      <TrustGuideDrawer
        open={guideOpen}
        snapshot={snapshot}
        onClose={() => setGuideOpen(false)}
        onSubmitSupport={handleSubmitSupport}
      />
    </div>
  );
}
