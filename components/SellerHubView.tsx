'use client';

// NS-UI-310 & NS-UI-317: Dedicated Seller Setup, Seller Hub, Listings & Order Fulfilment Views
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  PackagePlus,
  ShieldCheck,
  Store,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  NairaScoutSnapshot,
  OrderFulfilmentStatus,
  SellerPlanId,
} from '@/lib/nairascout-store';
import { SELLER_PLANS, SELLER_TEAM_ROLE_LABELS } from '@/lib/seller-plans';
import { DEFAULT_LISTING_CATEGORIES_SEED } from '@/lib/constants/nigeria-and-categories';
import { formatKoboToNaira, formatWholeNaira } from '@/lib/commission-engine';
import { UserAvatar } from './shared/UserAvatar';
import { UserIdentityRow } from './shared/UserIdentityRow';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';
import type { SellerTeamPermissions } from '@/lib/db/schema';
import {
  ALL_SELLER_TEAM_ROLES,
  SELLER_TEAM_ROLE_PERMISSIONS,
  SPRAWL_MAX_TEAM_SEATS,
  type SellerTeamRole,
} from '@/lib/auth/rbac';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type SellerViewMode = 'all' | 'setup' | 'hub' | 'listings' | 'orders';

interface SellerHubViewProps {
  snapshot: NairaScoutSnapshot;
  viewMode?: SellerViewMode;
  onAdvanceOrder: (orderId: string, nextStatus: OrderFulfilmentStatus) => Promise<void>;
  onPublishListing: (listingId: string) => Promise<void>;
  onSelectPlan: (planId: SellerPlanId) => Promise<void>;
  onActivateSeller: (payload: {
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
  }) => Promise<boolean>;
  onManageTeam: (payload: Record<string, unknown>) => Promise<boolean>;
  onLogoUpdated?: (nextSnapshot: NairaScoutSnapshot) => void;
}

export default function SellerHubView({
  snapshot,
  viewMode = 'all',
  onAdvanceOrder,
  onPublishListing,
  onSelectPlan,
  onActivateSeller,
  onManageTeam,
  onLogoUpdated,
}: SellerHubViewProps) {
  const [subTab, setSubTab] = useState<'operations' | 'plans' | 'team'>('operations');

  const activeCategoryNames =
    snapshot.categories && snapshot.categories.length > 0
      ? snapshot.categories.filter((c) => c.isActive).map((c) => c.name)
      : DEFAULT_LISTING_CATEGORIES_SEED.map((c) => c.name);
  const defaultCategory = activeCategoryNames[0] || 'Fashion & Apparel';

  const [submitting, setSubmitting] = useState(false);

  // Onboarding wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [sellerType, setSellerType] = useState<'INDIVIDUAL' | 'BUSINESS'>('INDIVIDUAL');
  const [sellerName, setSellerName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(
    snapshot.activeScout?.sellerProfile?.logoUrl ?? null
  );
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState<{
    type: 'ok' | 'err';
    message: string;
  } | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const activeLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [sellerDesc, setSellerDesc] = useState('');
  const [bizCat, setBizCat] = useState(defaultCategory);
  const [bizReg, setBizReg] = useState('');
  const [bizAddr, setBizAddr] = useState('');
  const [docFilename, setDocFilename] = useState('gov-id-nin.pdf');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [wizardPlan, setWizardPlan] = useState<SellerPlanId>('starter');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Team invite state
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<Exclude<SellerTeamRole, 'BUSINESS_OWNER'>>(
    'PRODUCT_MANAGER'
  );
  const [memberPerms, setMemberPerms] = useState<SellerTeamPermissions>(
    SELLER_TEAM_ROLE_PERMISSIONS.PRODUCT_MANAGER
  );

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setLogoFeedback({ type: 'err', message: 'Use JPG, PNG, or WebP images only.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoFeedback({ type: 'err', message: 'Image must be 5 MB or smaller.' });
      return;
    }

    setLogoBusy(true);
    setLogoFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/seller/logo', {
        method: 'POST',
        headers: { 'X-Requested-With': 'NairaScout' },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setLogoFeedback({
          type: 'err',
          message: data.error || 'Could not upload business profile photo.',
        });
        return;
      }
      setLogoUrl(data.logoUrl ?? null);
      if (data.snapshot && onLogoUpdated) {
        onLogoUpdated(data.snapshot);
      }
      setLogoFeedback({ type: 'ok', message: 'Business profile photo updated.' });
    } catch {
      setLogoFeedback({ type: 'err', message: 'Network error uploading business photo.' });
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoBusy(true);
    setLogoFeedback(null);
    try {
      const res = await fetch('/api/seller/logo', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ logoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLogoFeedback({
          type: 'err',
          message: data.error || 'Could not remove business profile photo.',
        });
        return;
      }
      setLogoUrl(null);
      if (data.snapshot && onLogoUpdated) {
        onLogoUpdated(data.snapshot);
      }
      setLogoFeedback({ type: 'ok', message: 'Business profile photo removed.' });
    } catch {
      setLogoFeedback({ type: 'err', message: 'Network error removing business photo.' });
    } finally {
      setLogoBusy(false);
    }
  };

  if (!snapshot.authenticated || !snapshot.activeScout) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
        <Store className="w-8 h-8 text-foreground mx-auto" aria-hidden="true" />
        <h1 className="font-sans text-xl md:text-2xl font-bold text-foreground">
          Seller Capabilities Attach to Your Scout Identity
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Sign in or register for a free Scout account first, then activate Individual or Business
          Seller capabilities under the same primary identity.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="px-4 py-2 text-xs font-semibold text-foreground border border-border rounded-xl hover:bg-muted"
          >
            Create Scout Account
          </Link>
        </div>
      </div>
    );
  }

  const scout = snapshot.activeScout;

  // Seller Activation Wizard when user has no SellerProfile yet
  if (!scout.sellerProfile) {
    const handleCompleteWizard = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      let targetPath = `verification-docs/${scout.id}/${docFilename || 'kyc.pdf'}`;
      const supabase = createSupabaseBrowserClient();
      if (docFile && supabase) {
        const objectKey = `${scout.id}/${Date.now()}-${docFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('verification-docs')
          .upload(objectKey, docFile, { upsert: true });
        if (!uploadErr) {
          targetPath = `verification-docs/${objectKey}`;
        }
      }
      await onActivateSeller({
        sellerType,
        sellerName: sellerName || `${scout.displayName} Store`,
        logoUrl,
        description: sellerDesc,
        businessCategory: bizCat,
        businessRegNumber: bizReg,
        businessAddress: bizAddr,
        planId: wizardPlan,
        evidencePaths: [targetPath],
        termsAccepted,
      });
      setSubmitting(false);
    };

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="border-b border-border pb-5">
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Seller Setup
          </h1>
        </div>

        <DismissibleNoticePanel
          storageKey="nairascout_seller_setup_notice_v1"
          title="Activate Seller Capabilities"
          description={`Attached to your account (@${scout.handle}). You may start creating your product listings and saving them as drafts. But publishing requires Seller verification approval.`}
          ariaLabel="Activate Seller Capabilities Notice"
        />

        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1 text-xs font-medium">
          <div className="flex items-center gap-2 w-max">
            {[
              { step: 1, label: '1. Seller Type' },
              { step: 2, label: '2. Business Profile' },
              { step: 3, label: '3. Verification Docs' },
              { step: 4, label: '4. Plan & Terms' },
            ].map((s) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setWizardStep(s.step as 1 | 2 | 3 | 4)}
                className={`whitespace-nowrap shrink-0 rounded-full px-3.5 py-2 cursor-pointer transition-colors border ${
                  wizardStep === s.step
                    ? 'bg-[#2E5339] text-[#FFFFFF] border-[#2E5339] dark:bg-[#3A6B49] dark:text-[#FFFFFF] dark:border-[#3A6B49] font-semibold'
                    : 'bg-card text-foreground border-border hover:opacity-90'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleCompleteWizard}
          className="bg-card border border-border rounded-2xl p-6 space-y-5"
        >
          {wizardStep === 1 && (
            <div className="space-y-4">
              <h2 className="font-sans text-lg font-bold text-foreground">
                Step 1: Choose Seller Type
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSellerType('INDIVIDUAL')}
                  className={`p-4 text-left rounded-2xl border cursor-pointer transition-colors ${
                    sellerType === 'INDIVIDUAL'
                      ? 'border-foreground bg-accent'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <p className="font-sans font-bold text-foreground">Individual Seller</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    For sole merchants and independent artisans selling under verified personal KYC.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSellerType('BUSINESS')}
                  className={`p-4 text-left rounded-2xl border cursor-pointer transition-colors ${
                    sellerType === 'BUSINESS'
                      ? 'border-foreground bg-accent'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <p className="font-sans font-bold text-foreground">Business Seller</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    For registered CAC entities with business verification and Sprawl team accounts.
                  </p>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-5 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
              >
                Continue to Profile Details
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <h2 className="font-sans text-lg font-bold text-foreground">
                Step 2: Seller &amp; Business Details
              </h2>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border bg-muted/40">
                <UserAvatar
                  avatarUrl={logoUrl}
                  displayName={sellerName || scout.displayName}
                  username={scout.handle}
                  size="logo"
                  shape="rounded-square"
                />
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="font-sans text-sm font-semibold text-foreground">
                      Business Profile Photo / Store Logo
                    </p>
                    <p className="font-sans text-xs text-muted-foreground">
                      JPG, PNG, or WebP up to 5 MB. Shown on your storefront and product cards.
                    </p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoFileChange}
                    className="sr-only"
                    aria-label="Upload business profile photo"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={logoBusy}
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    >
                      {logoBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {logoBusy
                        ? 'Uploading...'
                        : logoUrl
                          ? 'Change Business Photo'
                          : 'Upload Business Photo'}
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        disabled={logoBusy}
                        onClick={handleRemoveLogo}
                        className="px-3.5 py-2 text-xs font-semibold text-destructive border border-destructive/30 rounded-xl hover:bg-destructive/10 disabled:opacity-50 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {logoFeedback && (
                    <p
                      className={`text-xs font-medium ${
                        logoFeedback.type === 'ok' ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {logoFeedback.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Storefront / Seller Name
                </label>
                <input
                  type="text"
                  required
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="e.g., Lagos Botanical Studio"
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Primary Category
                  </label>
                  <select
                    value={bizCat}
                    onChange={(e) => setBizCat(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                  >
                    {activeCategoryNames.map((catName) => (
                      <option key={catName} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </select>
                </div>
                {sellerType === 'BUSINESS' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      CAC Registration Number
                    </label>
                    <input
                      type="text"
                      value={bizReg}
                      onChange={(e) => setBizReg(e.target.value)}
                      placeholder="RC-123456 or BN-..."
                      className="w-full px-3 py-2 text-sm font-sans bg-background text-foreground border border-input rounded-xl"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Business / Fulfilment Address
                </label>
                <input
                  type="text"
                  value={bizAddr}
                  onChange={(e) => setBizAddr(e.target.value)}
                  placeholder="Street, City, State"
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={sellerDesc}
                  onChange={(e) => setSellerDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="px-5 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
              >
                Continue to Verification Docs
              </button>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <h2 className="font-sans text-lg font-bold text-foreground">
                Step 3: Upload Verification Documents
              </h2>
              <p className="text-xs text-muted-foreground">
                Stored securely in encrypted verification storage and inspected via short-lived
                signed links by Verification Officers.
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Select Government ID / CAC Certificate File
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setDocFile(f);
                      setDocFilename(f.name);
                    }
                  }}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-secondary-foreground file:font-semibold"
                />
                <p className="mt-1 text-xs font-sans text-success">
                  {docFile
                    ? `Document ready for submission (${docFilename})`
                    : 'Upload Government ID or CAC Certificate (PDF, JPG, PNG)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep(4)}
                className="px-5 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
              >
                Continue to Plan Selection
              </button>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4">
              <h2 className="font-sans text-lg font-bold text-foreground">
                Step 4: Select Plan
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['starter', 'traction', 'growth', 'sprawl'] as SellerPlanId[]).map((pid) => {
                  const p = SELLER_PLANS[pid];
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setWizardPlan(pid)}
                      className={`p-3 text-left rounded-xl border cursor-pointer ${
                        wizardPlan === pid ? 'border-foreground bg-accent' : 'border-border bg-background'
                      }`}
                    >
                      <p className="text-xs font-bold text-foreground">{p.name}</p>
                      <p className="font-numeric text-xs text-success mt-1 tabular-nums">
                        {p.monthlyPriceKobo === 0 ? 'Free' : `${formatWholeNaira(p.monthlyPriceKobo)}/mo`}
                      </p>
                    </button>
                  );
                })}
              </div>

              <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 accent-foreground"
                />
                <span>
                  I accept NairaScout Seller Terms, the 10-day fulfilment SLA, and the 10%
                  marketplace commission schedule (separate from Scout referral commissions).
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting || !termsAccepted}
                className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
              >
                {submitting ? 'Activating Seller Role...' : 'Submit & Activate Seller Role'}
              </button>
            </div>
          )}
        </form>
      </div>
    );
  }

  const currentPlan = SELLER_PLANS[scout.sellerPlan];
  const { sellerStats } = snapshot;
  const sellerProfile = scout.sellerProfile;
  const publishRestriction = scout.activeRestrictions?.find(
    (r) => r.status === 'ACTIVE' && r.capabilityCode === 'PUBLISH_LISTING'
  );
  const canPublishNow =
    sellerProfile.sellerStatus === 'ACTIVE' &&
    scout.sellerVerificationStatus === 'VERIFIED' &&
    !publishRestriction;
  const delegatedSeatsUsed = scout.teamMembers.filter(
    (m) => (m.status === 'ACTIVE' || m.status === 'INVITED') && m.role !== 'BUSINESS_OWNER'
  ).length;

  const handleInviteTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setSubmitting(true);
    const ok = await onManageTeam({
      operation: 'invite',
      memberEmail,
      role: memberRole,
      permissions: memberPerms,
    });
    if (ok) setMemberEmail('');
    setSubmitting(false);
  };

  // Dedicated Seller Setup status page when user already submitted Seller activation
  if (viewMode === 'setup') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="border-b border-border pb-5">
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Seller Setup &amp; Verification Status
          </h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={sellerProfile.logoUrl}
                displayName={sellerProfile.sellerName}
                username={scout.handle}
                size="logo"
                shape="rounded-square"
              />
              {sellerProfile.sellerStatus === 'ACTIVE' && (
                <span
                  title="Seller Active"
                  aria-label="Seller Active"
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] border-2 border-card"
                />
              )}
            </div>
            <div>
              <p className="font-sans text-lg font-bold text-foreground">
                {sellerProfile.sellerName}
              </p>
              <p className="text-xs text-muted-foreground">
                Seller Status: {sellerProfile.sellerStatus} · Verification:{' '}
                {scout.sellerVerificationStatus}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {canPublishNow
              ? 'Your Seller storefront is verified and active. Manage your storefront, listings, and order fulfilment from Seller Hub.'
              : 'Your Seller application is recorded. You can create and save Draft listings now; public publishing unlocks as soon as a Verification Officer marks your Seller verification as VERIFIED.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {canPublishNow ? (
              <Link
                href="/seller/hub"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#2E5339] text-[#FFFFFF] dark:bg-[#3A6B49] hover:opacity-90"
              >
                Open Seller Hub →
              </Link>
            ) : (
              <Link
                href="/seller/listings/new"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#2E5339] text-[#FFFFFF] dark:bg-[#3A6B49] hover:opacity-90"
              >
                Create Draft Listing
              </Link>
            )}
            <Link
              href="/settings?tab=verification"
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted"
            >
              Review Verification Records
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showProfileAndStats = viewMode === 'all' || viewMode === 'hub';
  const showListingsSection = viewMode === 'all' || viewMode === 'listings';
  const showOrdersSection = viewMode === 'all' || viewMode === 'orders';

  const pageHeading =
    viewMode === 'listings'
      ? 'Listings'
      : viewMode === 'orders'
        ? 'Order Fulfilment'
        : 'Seller Hub';

  const listingsSectionNode = (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-bold text-foreground">
            Your Listings ({snapshot.sellerListings.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sellerStats.activeListingsCount} / {currentPlan.maxActiveListings} active ·{' '}
            {sellerStats.draftListingsCount} drafts · {sellerStats.monthlyPublicationsUsed} /{' '}
            {currentPlan.monthlyPublications} monthly publications
          </p>
        </div>
        {canPublishNow ? (
          <Link
            href="/seller/listings/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#2E5339] text-white dark:bg-[#3A6B49] hover:opacity-90 transition-opacity"
          >
            <PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />
            Create Listing
          </Link>
        ) : (
          <Link
            href="/seller/listings/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />
            Create Draft
          </Link>
        )}
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {snapshot.sellerListings.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No listings yet. Create a product draft using the Create Listing wizard.
          </div>
        ) : (
          snapshot.sellerListings.map((lst) => (
            <div
              key={lst.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <p className="font-sans text-xs text-muted-foreground">
                  {lst.id} · {lst.category} ·{' '}
                  <span
                    className={
                      lst.status === 'PUBLISHED'
                        ? 'text-success font-semibold'
                        : 'text-amber-600 dark:text-amber-400 font-semibold'
                    }
                  >
                    {lst.status}
                  </span>
                </p>
                <p className="font-sans text-sm font-semibold text-foreground mt-0.5">
                  {lst.title}
                </p>
                <p className="font-numeric text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {formatWholeNaira(lst.priceKobo)} · {lst.stock} in stock ·{' '}
                  {lst.imageUrls?.length || 1} image{(lst.imageUrls?.length || 1) === 1 ? '' : 's'}
                  {lst.videoLinks && lst.videoLinks.length > 0
                    ? ` · ${lst.videoLinks.length} video${lst.videoLinks.length === 1 ? '' : 's'}`
                    : ''}
                </p>
              </div>

              {lst.status === 'DRAFT' && (
                <button
                  type="button"
                  disabled={!canPublishNow}
                  title={
                    canPublishNow
                      ? 'Publish listing to Marketplace'
                      : 'SELLER verification must be VERIFIED and Seller status ACTIVE before publishing'
                  }
                  onClick={() => onPublishListing(lst.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 shrink-0 cursor-pointer"
                >
                  {canPublishNow ? (
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  Publish Listing
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );

  const ordersSectionNode = (
    <section className="space-y-4">
      <div>
        <h2 className="font-sans text-lg font-bold text-foreground">
          Order Fulfilment &amp; Commission Release Pipeline
        </h2>
        <p className="text-xs text-muted-foreground">
          Confirming delivery transitions linked Scout commissions from Pending to Available in the
          immutable ledger.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {snapshot.orders.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No orders yet.</div>
        ) : (
          snapshot.orders.map((order) => (
            <div key={order.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-sans text-xs font-semibold text-success">
                    {order.id} ·{' '}
                    {order.attributionType === 'referral_card'
                      ? `Referral-Generated (${order.referralEventId})`
                      : 'Direct Marketplace'}
                  </p>
                  <h3 className="mt-1 font-sans text-base font-semibold text-foreground">
                    {order.productTitle} (×{order.quantity})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Seller: {order.sellerName} · Merchandise:{' '}
                    <span className="font-numeric text-foreground tabular-nums">
                      {formatKoboToNaira(order.eligibleMerchandiseKobo)}
                    </span>
                  </p>
                </div>

                <span className="font-sans text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground">
                  {order.fulfilmentStatus}
                </span>
              </div>

              {order.fulfilmentStatus !== 'Delivered' && order.fulfilmentStatus !== 'Refunded' && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  {order.fulfilmentStatus === 'Paid' && (
                    <button
                      type="button"
                      onClick={() => onAdvanceOrder(order.id, 'Processing')}
                      className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-muted rounded-lg text-secondary-foreground cursor-pointer"
                    >
                      Mark Processing
                    </button>
                  )}
                  {(order.fulfilmentStatus === 'Paid' ||
                    order.fulfilmentStatus === 'Processing') && (
                    <button
                      type="button"
                      onClick={() => onAdvanceOrder(order.id, 'Dispatched')}
                      className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-muted rounded-lg text-secondary-foreground cursor-pointer"
                    >
                      Mark Dispatched
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAdvanceOrder(order.id, 'Delivered')}
                    className="px-3 py-1.5 text-xs font-semibold bg-primary border border-primary-border hover:bg-primary/90 rounded-lg text-primary-foreground cursor-pointer"
                  >
                    Confirm Delivery (Release Commission)
                  </button>
                  {order.fulfilmentStatus !== 'Disputed' && (
                    <button
                      type="button"
                      onClick={() => onAdvanceOrder(order.id, 'Disputed')}
                      className="px-3 py-1.5 text-xs font-medium border border-amber-500/40 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-500/10 cursor-pointer"
                    >
                      Hold (Dispute)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAdvanceOrder(order.id, 'Refunded')}
                    className="px-3 py-1.5 text-xs font-medium border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 cursor-pointer"
                  >
                    Refund &amp; Reverse
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
          {pageHeading}
        </h1>
        {viewMode !== 'all' && viewMode !== 'hub' && (
          <Link
            href="/seller/hub"
            className="text-xs font-semibold text-[#2E5339] dark:text-[#6E9470] hover:underline"
          >
            ← Back to Seller Hub
          </Link>
        )}
      </div>

      {/* Mandatory Verification & Lifecycle Gate Banner */}
      {!canPublishNow && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle
            className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold">
              Seller Publish Gate Active (Seller: {sellerProfile.sellerStatus} · Verification:{' '}
              {scout.sellerVerificationStatus})
            </p>
            <p>
              {publishRestriction
                ? `Publishing is currently restricted (${publishRestriction.reason}). Draft creation and Scout referral functions remain available.`
                : sellerProfile.sellerStatus === 'CLOSED'
                  ? 'Seller capabilities are closed. Your Scout identity, referral links, and commission wallet remain active.'
                  : 'You can create and edit Draft listings now, while public publishing is blocked (HTTP 403) until a Verification Officer marks your SELLER verification record as VERIFIED.'}
            </p>
          </div>
        </div>
      )}

      {showProfileAndStats && (
        <div className="space-y-6">
          {/* Seller Hub Profile Card with Medium Emerald (#10B981) Active Dot (NS-UI-317) */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="relative shrink-0">
                  <UserAvatar
                    avatarUrl={sellerProfile.logoUrl}
                    displayName={sellerProfile.sellerName}
                    username={scout.handle}
                    size="logo"
                    shape="rounded-square"
                  />
                  {sellerProfile.sellerStatus === 'ACTIVE' && (
                    <span
                      title="Seller Active"
                      aria-label="Seller Active"
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] border-2 border-card"
                    />
                  )}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <p className="font-sans text-base md:text-lg font-bold text-foreground">
                    {sellerProfile.sellerName}{' '}
                    <span className="text-xs font-medium text-muted-foreground">
                      ({sellerProfile.sellerType})
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#F7F5F0] dark:bg-muted border border-border font-sans text-xs font-semibold text-foreground">
                      Seller: {sellerProfile.sellerStatus}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-sans text-xs font-semibold border ${
                        scout.sellerVerificationStatus === 'VERIFIED'
                          ? 'bg-[#F2F6F2] border-[#5C7C5D]/30 text-[#5C7C5D] dark:bg-[#1F2E24] dark:text-[#6E9470] dark:border-[#6E9470]/40'
                          : 'bg-[#C88A2B]/12 border-[#C88A2B]/30 text-[#6B4214] dark:text-[#E0A13B]'
                      }`}
                    >
                      Verification: {scout.sellerVerificationStatus}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-card text-muted-foreground border border-border font-sans text-xs font-medium">
                      Plan: {currentPlan.name} ({sellerProfile.subscriptionStatus})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  ref={activeLogoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoFileChange}
                  className="sr-only"
                  aria-label="Update business profile photo"
                />
                <button
                  type="button"
                  disabled={logoBusy}
                  onClick={() => activeLogoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
                >
                  {logoBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  Change Logo
                </button>
                <Link
                  href="/settings/closure"
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Close Seller Capabilities
                </Link>
              </div>
            </div>

            {logoFeedback && (
              <p
                className={`text-xs font-medium ${
                  logoFeedback.type === 'ok' ? 'text-success' : 'text-destructive'
                }`}
              >
                {logoFeedback.message}
              </p>
            )}

            {/* Inline Hub Toggle Pills (Overview / Plan / Team) */}
            <div className="pt-2 border-t border-border -mx-1 px-1 overflow-x-auto no-scrollbar scrollbar-none">
              <div className="flex items-center gap-1.5 p-1 bg-[#F7F5F0] dark:bg-[#222925] border border-border rounded-xl w-max">
                <button
                  type="button"
                  onClick={() => setSubTab('operations')}
                  className={`px-3.5 py-2 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                    subTab === 'operations'
                      ? 'bg-[#2E5339] text-[#FFFFFF] border-[#2E5339] dark:bg-[#3A6B49] dark:text-[#FFFFFF] dark:border-[#3A6B49] font-semibold shadow-sm'
                      : 'bg-card text-foreground border-border font-medium hover:opacity-90'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('plans')}
                  className={`px-3.5 py-2 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                    subTab === 'plans'
                      ? 'bg-[#2E5339] text-[#FFFFFF] border-[#2E5339] dark:bg-[#3A6B49] dark:text-[#FFFFFF] dark:border-[#3A6B49] font-semibold shadow-sm'
                      : 'bg-card text-foreground border-border font-medium hover:opacity-90'
                  }`}
                >
                  Plans ({currentPlan.name})
                </button>
                {sellerProfile.sellerType === 'BUSINESS' && (
                  <button
                    type="button"
                    onClick={() => setSubTab('team')}
                    className={`inline-flex items-center gap-1 px-3.5 py-2 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                      subTab === 'team'
                        ? 'bg-[#2E5339] text-[#FFFFFF] border-[#2E5339] dark:bg-[#3A6B49] dark:text-[#FFFFFF] dark:border-[#3A6B49] font-semibold shadow-sm'
                        : 'bg-card text-foreground border-border font-medium hover:opacity-90'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    Team
                  </button>
                )}
              </div>
            </div>
          </div>

          {subTab === 'operations' && (
            <div className="space-y-6">
              {/* Vertically Stacked Stat Cards on /seller/hub (NS-UI-317) */}
              <section
                className={
                  viewMode === 'hub'
                    ? 'grid grid-cols-1 gap-3'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'
                }
              >
                <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <p className="text-xs text-muted-foreground">Eligible Merchandise Revenue</p>
                  <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                    {formatKoboToNaira(sellerStats.eligibleMerchandiseKobo)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sellerStats.directOrdersCount} direct · {sellerStats.referralOrdersCount}{' '}
                    referral
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <p className="text-xs text-muted-foreground">NairaScout 10% Commission</p>
                  <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                    {formatKoboToNaira(sellerStats.marketplaceCommissionKobo)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pool share: {formatKoboToNaira(sellerStats.referralPoolGeneratedKobo)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <p className="text-xs text-muted-foreground">Net Seller Proceeds (90%)</p>
                  <p className="mt-1 font-numeric text-2xl font-bold text-success tabular-nums">
                    {formatKoboToNaira(sellerStats.netSellerProceedsKobo)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Separate from Scout wallet</p>
                </div>

                {viewMode === 'all' && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                    <p className="text-xs text-muted-foreground">Listings &amp; Publications</p>
                    <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                      {sellerStats.activeListingsCount} / {currentPlan.maxActiveListings}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sellerStats.draftListingsCount} drafts · {sellerStats.monthlyPublicationsUsed}{' '}
                      / {currentPlan.monthlyPublications} monthly pubs
                    </p>
                  </div>
                )}
              </section>

              {viewMode === 'hub' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href="/seller/listings"
                    className="rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-sans text-sm font-bold text-foreground">
                        Listings ({snapshot.sellerListings.length})
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sellerStats.activeListingsCount} / {currentPlan.maxActiveListings} active ·{' '}
                        {sellerStats.draftListingsCount} drafts
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#2E5339] dark:text-[#6E9470]">
                      Open →
                    </span>
                  </Link>
                  <Link
                    href="/seller/orders"
                    className="rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-sans text-sm font-bold text-foreground">
                        Order Fulfilment ({snapshot.orders.length})
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dispatch orders &amp; confirm delivery
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#2E5339] dark:text-[#6E9470]">
                      Open →
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {subTab === 'plans' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-3">
                <Store className="w-5 h-5 text-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Seller subscriptions purchase Seller listing, video, and operational capacity.
                  Subscriptions are strictly separate from the referral commission programme.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(['starter', 'traction', 'growth', 'sprawl'] as SellerPlanId[]).map((planId) => {
                  const plan = SELLER_PLANS[planId];
                  const isCurrent = scout.sellerPlan === planId;
                  return (
                    <div
                      key={planId}
                      className={`bg-card rounded-2xl p-6 flex flex-col justify-between gap-6 border ${
                        isCurrent ? 'border-foreground' : 'border-border'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-sans text-lg font-bold text-foreground">{plan.name}</h3>
                          {isCurrent && (
                            <span className="font-sans text-xs font-semibold text-success">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground min-h-[32px]">
                          {plan.tagline}
                        </p>

                        <p className="mt-4 font-numeric text-2xl font-bold text-foreground tabular-nums">
                          {plan.monthlyPriceKobo === 0
                            ? 'Free'
                            : `${formatWholeNaira(plan.monthlyPriceKobo)}/mo`}
                        </p>

                        <ul className="mt-5 pt-4 border-t border-border space-y-2.5 text-xs">
                          <li className="flex items-center gap-2 text-foreground">
                            <CheckCircle2
                              className="h-4 w-4 text-[#5C7C5D] dark:text-[#6E9470] shrink-0"
                              aria-hidden="true"
                            />
                            <span>{plan.maxActiveListings} active product listings</span>
                          </li>
                          <li className="flex items-center gap-2 text-foreground">
                            <CheckCircle2
                              className="h-4 w-4 text-[#5C7C5D] dark:text-[#6E9470] shrink-0"
                              aria-hidden="true"
                            />
                            <span>{plan.monthlyPublications} monthly publications</span>
                          </li>
                          <li className="flex items-center gap-2 text-foreground">
                            <CheckCircle2
                              className="h-4 w-4 text-[#5C7C5D] dark:text-[#6E9470] shrink-0"
                              aria-hidden="true"
                            />
                            <span>{plan.maxCategories} product categories</span>
                          </li>
                          <li
                            className={`flex items-center gap-2 ${
                              plan.videoQuota === 'None' ? 'text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {plan.videoQuota === 'None' ? (
                              <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                            ) : (
                              <CheckCircle2
                                className="h-4 w-4 text-[#5C7C5D] dark:text-[#6E9470] shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span>Video: {plan.videoQuota}</span>
                          </li>
                          <li
                            className={`flex items-center gap-2 ${
                              plan.promotionalPlacements ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {plan.promotionalPlacements ? (
                              <CheckCircle2
                                className="h-4 w-4 text-[#5C7C5D] dark:text-[#6E9470] shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                            )}
                            <span>Promotions</span>
                          </li>
                          <li
                            className={`flex items-center gap-2 ${
                              plan.sellerTeamAccounts ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {plan.sellerTeamAccounts ? (
                              <CheckCircle2
                                className="h-4 w-4 text-[#5C7C5D] dark:text-[#6E9470] shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                            )}
                            <span>
                              {plan.sellerTeamAccounts
                                ? `Team (Up to ${plan.maxTeamSeats} seats)`
                                : 'Team'}
                            </span>
                          </li>
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => onSelectPlan(planId)}
                        className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-muted text-muted-foreground cursor-default'
                            : 'bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90'
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

          {subTab === 'team' && (
            <div className="space-y-6">
              {!currentPlan.sellerTeamAccounts ? (
                <div className="bg-card border border-border rounded-2xl p-8 space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Lock className="w-5 h-5" aria-hidden="true" />
                    <h2 className="font-sans text-lg font-bold text-foreground">
                      Seller Team Accounts Require the Sprawl Plan
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Business Sellers on the Sprawl plan (₦250,000/mo) can delegate listing, order, and
                    analytics permissions to team members while keeping primary Scout identities
                    separate.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubTab('plans')}
                    className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
                  >
                    View Sprawl Plan Entitlements
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                    <div className="p-4 flex items-center justify-between text-xs bg-muted/50">
                      <span className="font-semibold text-foreground">Active Team Members</span>
                      <span className="font-numeric font-semibold text-foreground px-2.5 py-1 rounded-full bg-background border border-border tabular-nums">
                        Seats Used: {delegatedSeatsUsed} / {SPRAWL_MAX_TEAM_SEATS}
                      </span>
                    </div>
                    {scout.teamMembers.map((m) => (
                      <div key={m.id} className="p-4 flex items-center justify-between gap-4">
                        <UserIdentityRow
                          displayName={m.displayName}
                          username={m.username}
                          size="sm"
                          subtitle={`${SELLER_TEAM_ROLE_LABELS[m.role]?.label || m.role} (${m.role}) · ${m.email}`}
                        />
                        {m.role !== 'BUSINESS_OWNER' && (
                          <button
                            type="button"
                            onClick={() => onManageTeam({ operation: 'revoke', memberId: m.id })}
                            className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-lg cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-sans text-base font-bold text-foreground">
                        Add Business Team Member
                      </h3>
                      <span className="font-numeric text-xs font-semibold text-muted-foreground tabular-nums">
                        Seats Used: {delegatedSeatsUsed} / {SPRAWL_MAX_TEAM_SEATS}
                      </span>
                    </div>
                    <form onSubmit={handleInviteTeam} className="space-y-3">
                      <input
                        type="email"
                        required
                        disabled={delegatedSeatsUsed >= SPRAWL_MAX_TEAM_SEATS}
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="Registered Scout email..."
                        className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl disabled:opacity-55"
                      />
                      <div className="relative">
                        <select
                          aria-label="Seller Team Role"
                          disabled={delegatedSeatsUsed >= SPRAWL_MAX_TEAM_SEATS}
                          value={memberRole}
                          onChange={(e) => {
                            const val = e.target.value as SellerTeamRole;
                            if (val === 'BUSINESS_OWNER') return;
                            setMemberRole(val);
                            setMemberPerms(SELLER_TEAM_ROLE_PERMISSIONS[val]);
                          }}
                          className="w-full appearance-none pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground disabled:opacity-55"
                        >
                          {ALL_SELLER_TEAM_ROLES.map((roleKey) => (
                            <option
                              key={roleKey}
                              value={roleKey}
                              disabled={roleKey === 'BUSINESS_OWNER'}
                            >
                              {SELLER_TEAM_ROLE_LABELS[roleKey].label}
                              {roleKey === 'BUSINESS_OWNER' ? ' (Primary Owner Only)' : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {SELLER_TEAM_ROLE_LABELS[memberRole].summary}
                      </p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {(
                          [
                            ['canManageListings', 'Manage Listings'],
                            ['canManageOrders', 'Manage Orders'],
                            ['canViewAnalytics', 'View Analytics / Financial Summaries'],
                            ['canManageBilling', 'Manage Billing (Owner Only)'],
                            ['canManageTeam', 'Manage Team'],
                          ] as const
                        ).map(([key, label]) => {
                          const isBillingLocked = key === 'canManageBilling';
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-2 ${
                                isBillingLocked ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={isBillingLocked || delegatedSeatsUsed >= SPRAWL_MAX_TEAM_SEATS}
                                checked={isBillingLocked ? false : memberPerms[key]}
                                onChange={(e) => {
                                  if (isBillingLocked) return;
                                  setMemberPerms((p) => ({ ...p, [key]: e.target.checked }));
                                }}
                                className="accent-foreground"
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <button
                        type="submit"
                        disabled={submitting || delegatedSeatsUsed >= SPRAWL_MAX_TEAM_SEATS}
                        className="w-full py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
                      >
                        {delegatedSeatsUsed >= SPRAWL_MAX_TEAM_SEATS
                          ? 'Seat Limit Reached (5 / 5)'
                          : 'Add Team Member'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showListingsSection && (subTab === 'operations' || viewMode === 'listings') && listingsSectionNode}
      {showOrdersSection && (subTab === 'operations' || viewMode === 'orders') && ordersSectionNode}
    </div>
  );
}
