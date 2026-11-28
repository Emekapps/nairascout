'use client';

// NS-UI-310: Shared Dedicated Page Shell for Standalone App Router Routes
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
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
import {
  NAIRASCOUT_EARNINGS_DISCLAIMER,
  NAIRASCOUT_TAGLINE,
} from '@/lib/constants/foundation-content';
import { NIGERIAN_STATES_SEED } from '@/lib/constants/nigeria-and-categories';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { AppShell } from './layout/AppShell';
import ReferralsView from './ReferralsView';
import NetworkView from './NetworkView';
import WalletView from './WalletView';
import SellerHubView from './SellerHubView';
import PrivacySettingsView from './settings/PrivacySettingsView';
import CheckoutDrawer from './CheckoutDrawer';
import ReferProductModal from './ReferProductModal';
import TrustGuideDrawer from './TrustGuideDrawer';
import { MobileSearchView } from './search/MobileSearchView';
import { LocationPickerSheet } from './location/LocationPickerSheet';

export type DedicatedAppSection =
  | 'referrals-inbox'
  | 'referrals-sent'
  | 'network-scouts'
  | 'network-ancestry'
  | 'network-calculator'
  | 'wallet'
  | 'wallet-ledger'
  | 'seller-hub'
  | 'seller-listings'
  | 'seller-orders'
  | 'seller-setup'
  | 'privacy-settings';

interface DedicatedAppViewProps {
  initialSnapshot: NairaScoutSnapshot;
  section: DedicatedAppSection;
}

export default function DedicatedAppView({
  initialSnapshot,
  section,
}: DedicatedAppViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<NairaScoutSnapshot>(initialSnapshot);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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

  const showFeedback = (type: 'ok' | 'err', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const invalidateScoutQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['scout-activity'] });
    void queryClient.invalidateQueries({ queryKey: ['scout-commissions'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet-ledger'] });
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
    router.push('/');
    router.refresh();
  };

  const handleSelectSearchProduct = (product: GlobalSearchProductHit) => {
    setGlobalSearchQuery('');
    router.push(`/products/${encodeURIComponent(product.id)}`);
  };

  const handleSelectSearchCategory = (cat: GlobalSearchCategoryHit) => {
    setGlobalSearchQuery('');
    router.push(`/?category=${encodeURIComponent(cat.name)}`);
  };

  const handleSelectSearchPerson = (person: GlobalSearchPersonHit) => {
    setGlobalSearchQuery('');
    if (!snapshot.authenticated && person.isSeller && person.sellerName) {
      router.push(`/?q=${encodeURIComponent(person.sellerName)}`);
    } else {
      router.push('/network/scouts');
    }
  };

  const handleConfirmOrder = async (payload: {
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
  }): Promise<MarketplaceOrder | null> => {
    const data = await callApi({ action: 'checkout', ...payload });
    if (!data?.order) return null;
    invalidateScoutQueries();
    showFeedback(
      'ok',
      data.order.attributionType === 'referral_card'
        ? `Order ${data.order.id} placed with Referral-Card Attribution.`
        : `Direct order ${data.order.id} placed (0% Scout commission).`
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
    invalidateScoutQueries();
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
      invalidateScoutQueries();
      showFeedback('ok', `Order ${orderId} updated to ${nextStatus}.`);
    }
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
      showFeedback('ok', `Seller plan switched to ${planId.toUpperCase()}.`);
    }
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

  const handleManageTeam = async (payload: Record<string, unknown>): Promise<boolean> => {
    const data = await callJsonApi('/api/seller/team', payload);
    if (!data) return false;
    showFeedback('ok', 'Business Seller team updated.');
    return true;
  };

  const handleInviteScout = async (targetScoutId: string) => {
    const data = await callApi({ action: 'invite_scout', targetScoutId });
    if (data) {
      showFeedback('ok', 'Scouts List invitation sent.');
    }
  };

  const handleRespondInvite = async (
    invitationId: string,
    decision: 'accept' | 'reject' | 'withdraw'
  ) => {
    const data = await callApi({ action: 'respond_invite', invitationId, decision });
    if (data) {
      showFeedback('ok', `Invitation ${decision}ed.`);
    }
  };

  const handleManageContact = async (payload: {
    contactId?: string;
    targetUserId?: string;
    operation: 'remove' | 'block' | 'unblock';
  }) => {
    const data = await callApi({ action: 'manage_contact', ...payload });
    if (data) {
      showFeedback('ok', `Relationship updated (${payload.operation}).`);
    }
  };

  const handleReportAbuse = async (payload: {
    reportedUserId: string;
    reason: string;
    description: string;
  }) => {
    const data = await callApi({ action: 'report_abuse', ...payload });
    if (!data) return false;
    showFeedback('ok', 'Abuse report logged for Trust & Safety review.');
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

      {snapshot.activeScout?.accountStatus === 'PENDING_ACTIVATION' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200 text-center">
          Email confirmation required (<strong>PENDING_ACTIVATION</strong>) before creating
          referrals, publishing listings, or making purchases.{' '}
          <Link
            href={`/auth/verify-email?email=${encodeURIComponent(snapshot.activeScout.email)}`}
            className="underline font-semibold"
          >
            Verify Email Address Now
          </Link>
        </div>
      )}
    </>
  );

  const footer = (
    <footer className="border-t border-border bg-card/70 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="space-y-1 max-w-2xl">
          <p className="font-semibold text-foreground">
            NairaScout · {NAIRASCOUT_TAGLINE}
          </p>
          <p>{NAIRASCOUT_EARNINGS_DISCLAIMER}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 shrink-0">
          <Link
            href="/programme-rules?policy=programme-rules"
            className="hover:text-foreground transition-colors"
          >
            Programme Rules
          </Link>
          <Link href="/network/calculator" className="hover:text-foreground transition-colors">
            Commission Calculator
          </Link>
          <Link
            href="/programme-rules?policy=payout-policy"
            className="hover:text-foreground transition-colors"
          >
            Payout Policy
          </Link>
          <Link href="/help" className="hover:text-foreground transition-colors">
            Help Centre
          </Link>
        </div>
      </div>
    </footer>
  );

  return (
    <>
      <AppShell
        onOpenGuide={() => setGuideOpen(true)}
        inboxCount={activeInboxCount}
        totalEarningsKobo={
          (snapshot.wallet.availableKobo ?? 0) +
          (snapshot.wallet.pendingKobo ?? 0) +
          (snapshot.wallet.paidKobo ?? 0)
        }
        notifications={snapshot.notifications}
        authenticated={snapshot.authenticated}
        activeScout={snapshot.activeScout}
        onLogout={handleLogout}
        searchQuery={globalSearchQuery}
        selectedLocation={locationFilter}
        onSearchChange={setGlobalSearchQuery}
        onSearchSubmit={() => {
          const q = globalSearchQuery.trim();
          router.push(q ? `/?q=${encodeURIComponent(q)}` : '/');
        }}
        onOpenLocationPicker={() => setLocationSheetOpen(true)}
        onOpenMobileSearch={() => setMobileSearchOpen(true)}
        onSelectSearchProduct={handleSelectSearchProduct}
        onSelectSearchCategory={handleSelectSearchCategory}
        onSelectSearchPerson={handleSelectSearchPerson}
        banners={banners}
        footer={footer}
      >
        <div className="space-y-5">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </Link>
          </div>

          {section === 'referrals-inbox' && (
            <ReferralsView
              snapshot={snapshot}
              viewMode="inbox"
              onStartReferralCheckout={(product, referralEvent) =>
                setCheckoutSession({ product, referralEvent })
              }
              onOpenReferModal={(product) => setReferModalProduct(product)}
            />
          )}

          {section === 'referrals-sent' && (
            <ReferralsView
              snapshot={snapshot}
              viewMode="sent"
              onStartReferralCheckout={(product, referralEvent) =>
                setCheckoutSession({ product, referralEvent })
              }
              onOpenReferModal={(product) => setReferModalProduct(product)}
            />
          )}

          {(section === 'network-scouts' ||
            section === 'network-ancestry' ||
            section === 'network-calculator') && (
            <NetworkView
              snapshot={snapshot}
              viewMode={
                section === 'network-scouts'
                  ? 'scouts'
                  : section === 'network-ancestry'
                    ? 'ancestry'
                    : 'calculator'
              }
              externalScoutSearch={networkScoutSearch}
              onExternalScoutSearchChange={setNetworkScoutSearch}
              onInviteScout={handleInviteScout}
              onRespondInvite={handleRespondInvite}
              onManageContact={handleManageContact}
              onReportAbuse={handleReportAbuse}
              onOpenReferForProduct={(product) => setReferModalProduct(product)}
            />
          )}

          {section === 'wallet' && (
            <WalletView
              snapshot={snapshot}
              viewMode="wallet"
              onSnapshotUpdated={setSnapshot}
            />
          )}

          {section === 'wallet-ledger' && (
            <WalletView
              snapshot={snapshot}
              viewMode="ledger"
              onSnapshotUpdated={setSnapshot}
            />
          )}

          {(section === 'seller-hub' ||
            section === 'seller-listings' ||
            section === 'seller-orders' ||
            section === 'seller-setup') && (
            <SellerHubView
              snapshot={snapshot}
              viewMode={
                section === 'seller-hub'
                  ? 'hub'
                  : section === 'seller-listings'
                    ? 'listings'
                    : section === 'seller-orders'
                      ? 'orders'
                      : 'setup'
              }
              onAdvanceOrder={handleAdvanceOrder}
              onPublishListing={handlePublishListing}
              onSelectPlan={handleSelectPlan}
              onActivateSeller={handleActivateSeller}
              onManageTeam={handleManageTeam}
              onLogoUpdated={setSnapshot}
            />
          )}

          {section === 'privacy-settings' && (
            <PrivacySettingsView
              snapshot={snapshot}
              onSnapshotUpdated={setSnapshot}
            />
          )}
        </div>
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
          const q = globalSearchQuery.trim();
          router.push(q ? `/?q=${encodeURIComponent(q)}` : '/');
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
        }}
        onClose={() => setLocationSheetOpen(false)}
      />
    </>
  );
}
