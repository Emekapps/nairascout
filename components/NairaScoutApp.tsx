'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import type {
  GlobalSearchCategoryHit,
  GlobalSearchPersonHit,
  GlobalSearchProductHit,
  MarketplaceOrder,
  NairaScoutSnapshot,
  OrderFulfilmentStatus,
  ProductListing,
  ProductReferralEvent,
  SellerPlanId,
  SupportCase,
} from '@/lib/nairascout-store';
import { NIGERIAN_STATES_SEED } from '@/lib/constants/nigeria-and-categories';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { NavTab } from './HeaderNav';
import { AppShell } from './layout/AppShell';
import MarketplaceView from './MarketplaceView';
import ReferralsView from './ReferralsView';
import NetworkView from './NetworkView';
import WalletView from './WalletView';
import SellerHubView from './SellerHubView';
import CheckoutDrawer from './CheckoutDrawer';
import ReferProductModal from './ReferProductModal';
import TrustGuideDrawer from './TrustGuideDrawer';
import { MobileSearchView } from './search/MobileSearchView';
import { LocationPickerSheet } from './location/LocationPickerSheet';

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
  const [activeTab, setActiveTab] = useState<NavTab>(
    initialRefEvent ? 'referrals' : 'marketplace'
  );
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [marketplaceCategoryFilter, setMarketplaceCategoryFilter] = useState<string>('All');
  const [selectedProductIdFromSearch, setSelectedProductIdFromSearch] = useState<string | null>(null);
  const [networkSubTab, setNetworkSubTab] = useState<'explorer' | 'scouts_list' | 'simulator'>(
    'explorer'
  );
  const [networkScoutSearch, setNetworkScoutSearch] = useState('');
  const [checkoutSession, setCheckoutSession] = useState<{
    product: ProductListing;
    referralEvent: ProductReferralEvent | null;
  } | null>(null);
  const [referModalProduct, setReferModalProduct] = useState<ProductListing | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  const availableStates = useMemo(() => {
    const dbStates =
      snapshot.states && snapshot.states.length > 0
        ? snapshot.states.map((s) => s.name)
        : NIGERIAN_STATES_SEED.map((s) => s.name);
    const productCities = snapshot.products.map((p) => p.sellerCity).filter(Boolean);
    return Array.from(new Set([...dbStates, ...productCities]));
  }, [snapshot.states, snapshot.products]);

  const handleSelectSearchProduct = (product: GlobalSearchProductHit) => {
    setSelectedProductIdFromSearch(product.id);
    setMarketplaceCategoryFilter('All');
    setGlobalSearchQuery('');
    setActiveTab('marketplace');
  };

  const handleSelectSearchCategory = (cat: GlobalSearchCategoryHit) => {
    setSelectedProductIdFromSearch(null);
    setMarketplaceCategoryFilter(cat.name);
    setGlobalSearchQuery('');
    setActiveTab('marketplace');
  };

  const handleSelectSearchPerson = (person: GlobalSearchPersonHit) => {
    setSelectedProductIdFromSearch(null);
    if (!snapshot.authenticated && person.isSeller && person.sellerName) {
      setMarketplaceCategoryFilter('All');
      setGlobalSearchQuery(person.sellerName);
      setActiveTab('marketplace');
    } else {
      setGlobalSearchQuery('');
      setNetworkSubTab('scouts_list');
      setNetworkScoutSearch(person.username);
      setActiveTab('network');
    }
  };

  const showFeedback = (type: 'ok' | 'err', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const callJsonApi = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'NairaScout',
      },
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
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    const data = await callJsonApi('/api/auth/session', { action: 'logout' });
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
    recipientScoutIds: string[];
    note: string;
  }): Promise<ProductReferralEvent[] | null> => {
    const data = await callApi({ action: 'refer_product', ...payload });
    const events: ProductReferralEvent[] = Array.isArray(data?.events)
      ? data.events
      : data?.event
        ? [data.event]
        : [];
    if (events.length === 0) return null;
    showFeedback(
      'ok',
      events.length === 1
        ? `Referral card ${events[0].id} sent to @${events[0].recipientHandle}.`
        : `${events.length} referral cards dispatched across your Scouts List.`
    );
    return events;
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
    logoUrl?: string | null;
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

  const banners = (
    <>
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`border-b px-4 py-2.5 text-xs font-medium text-center ${
            feedback.type === 'ok'
              ? 'bg-accent border-border text-accent-foreground'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {snapshot.activeScout?.activeRestrictions &&
        snapshot.activeScout.activeRestrictions.some((r) => r.status === 'ACTIVE') && (
          <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 text-xs text-destructive text-center">
            Active capability restriction(s):{' '}
            <span className="font-sans font-semibold">
              {snapshot.activeScout.activeRestrictions
                .filter((r) => r.status === 'ACTIVE')
                .map((r) => r.capabilityCode)
                .join(', ')}
            </span>{' '}
            — Unrelated account features remain operational.{' '}
            <a href="/settings" className="underline font-semibold">
              Review &amp; Appeal
            </a>
          </div>
        )}

      {(!snapshot.dbConfigured || !snapshot.supabaseConfigured) && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 text-center">
          Live database and authentication require environment configuration:{' '}
          {!snapshot.dbConfigured && <span className="font-sans font-semibold">DATABASE_URL </span>}
          {!snapshot.supabaseConfigured && (
            <span className="font-sans font-semibold">
              NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY
            </span>
          )}
        </div>
      )}
    </>
  );

  const footer = (
    <footer className="border-t border-border bg-card/70 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground">
        <p>
          NairaScout · Thirteen-generation referral marketing &amp; social commerce. No income is
          guaranteed; commissions arise strictly from genuine qualifying product sales.
        </p>
        <div className="flex items-center gap-5 shrink-0">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Programme Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('network')}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Commission Calculator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Payout Policy
          </button>
        </div>
      </div>
    </footer>
  );

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenGuide={() => setGuideOpen(true)}
        inboxCount={activeInboxCount}
        notifications={snapshot.notifications}
        authenticated={snapshot.authenticated}
        activeScout={snapshot.activeScout}
        onLogout={handleLogout}
        searchQuery={globalSearchQuery}
        selectedLocation={locationFilter}
        onSearchChange={(q) => setGlobalSearchQuery(q)}
        onSearchSubmit={() => {
          setSelectedProductIdFromSearch(null);
          setActiveTab('marketplace');
        }}
        onOpenLocationPicker={() => setLocationSheetOpen(true)}
        onOpenMobileSearch={() => setMobileSearchOpen(true)}
        onSelectSearchProduct={handleSelectSearchProduct}
        onSelectSearchCategory={handleSelectSearchCategory}
        onSelectSearchPerson={handleSelectSearchPerson}
        banners={banners}
        footer={footer}
      >
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'marketplace' && (
            <MarketplaceView
              snapshot={snapshot}
              externalSearchQuery={globalSearchQuery}
              onExternalSearchChange={setGlobalSearchQuery}
              externalLocationFilter={locationFilter}
              onExternalLocationChange={setLocationFilter}
              externalCategoryFilter={marketplaceCategoryFilter}
              onExternalCategoryChange={setMarketplaceCategoryFilter}
              externalSelectedProductId={selectedProductIdFromSearch}
              onClearExternalProduct={() => setSelectedProductIdFromSearch(null)}
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
              externalSubTab={networkSubTab}
              onExternalSubTabChange={setNetworkSubTab}
              externalScoutSearch={networkScoutSearch}
              onExternalScoutSearchChange={setNetworkScoutSearch}
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
              onLogoUpdated={setSnapshot}
            />
          )}
        </motion.div>
      </AppShell>

      <CheckoutDrawer
        authenticated={snapshot.authenticated}
        session={checkoutSession}
        onClose={() => setCheckoutSession(null)}
        onOtpAuthenticated={(nextSnapshot) => {
          setSnapshot(nextSnapshot);
          showFeedback('ok', 'Email verified. Complete your order below.');
        }}
        onConfirmOrder={handleConfirmOrder}
      />

      <ReferProductModal
        key={referModalProduct?.id ?? 'closed'}
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

      <MobileSearchView
        open={mobileSearchOpen}
        searchQuery={globalSearchQuery}
        selectedLocation={locationFilter}
        onSearchChange={setGlobalSearchQuery}
        onSearchSubmit={() => {
          setSelectedProductIdFromSearch(null);
          setActiveTab('marketplace');
        }}
        onOpenLocationPicker={() => setLocationSheetOpen(true)}
        onSelectProduct={handleSelectSearchProduct}
        onSelectCategory={handleSelectSearchCategory}
        onSelectPerson={handleSelectSearchPerson}
        onClose={() => setMobileSearchOpen(false)}
      />

      <LocationPickerSheet
        open={locationSheetOpen}
        selectedLocation={locationFilter}
        states={availableStates}
        onSelectLocation={(loc) => {
          setLocationFilter(loc);
          if (!mobileSearchOpen) {
            setActiveTab('marketplace');
          }
        }}
        onClose={() => setLocationSheetOpen(false)}
      />
    </>
  );
}
