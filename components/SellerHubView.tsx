'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
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
  MAX_SELLER_TEAM_SEATS,
  SELLER_TEAM_ROLE_PERMISSIONS,
  type SellerTeamRole,
} from '@/lib/auth/rbac';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface SellerHubViewProps {
  snapshot: NairaScoutSnapshot;
  onAdvanceOrder: (orderId: string, nextStatus: OrderFulfilmentStatus) => Promise<void>;
  onCreateDraftListing: (payload: {
    title: string;
    category: string;
    priceNaira: number;
    deliveryFeeNaira: number;
    stock: number;
    description: string;
  }) => Promise<boolean>;
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
  onAdvanceOrder,
  onCreateDraftListing,
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

  // Draft listing form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [priceNaira, setPriceNaira] = useState('18500');
  const [deliveryFeeNaira, setDeliveryFeeNaira] = useState('2500');
  const [stock, setStock] = useState('10');
  const [description, setDescription] = useState('');
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

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 snap-x text-xs font-medium">
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
              className={`whitespace-nowrap shrink-0 snap-start rounded-full px-3.5 py-2 cursor-pointer transition-colors ${
                wizardStep === s.step
                  ? 'bg-primary text-primary-foreground border border-primary-border font-semibold'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
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
                  size="xl"
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
    (m) => m.role !== 'BUSINESS_OWNER'
  ).length;

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    const ok = await onCreateDraftListing({
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            <UserAvatar
              avatarUrl={sellerProfile.logoUrl}
              displayName={sellerProfile.sellerName}
              username={scout.handle}
              size="lg"
            />
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
              title="Change Business Photo"
              aria-label="Change Business Photo"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted shadow-xs cursor-pointer"
            >
              {logoBusy ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="w-3 h-3" aria-hidden="true" />
              )}
            </button>
          </div>
          <div>
            <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {sellerProfile.sellerName} ({sellerProfile.sellerType})
              </span>
              <span className="px-2 py-0.5 rounded-md bg-muted font-sans font-semibold text-foreground">
                Seller: {sellerProfile.sellerStatus}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-sans font-semibold ${
                  scout.sellerVerificationStatus === 'VERIFIED'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                Verification: {scout.sellerVerificationStatus}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-card border border-border font-sans text-muted-foreground">
                Plan: {currentPlan.name} ({sellerProfile.subscriptionStatus})
              </span>
              <Link
                href="/settings/closure"
                className="text-xs font-medium text-muted-foreground hover:text-destructive underline ml-1"
              >
                Close Seller Capabilities
              </Link>
            </div>
            {logoFeedback && (
              <p
                className={`mt-1.5 text-xs font-medium ${
                  logoFeedback.type === 'ok' ? 'text-success' : 'text-destructive'
                }`}
              >
                {logoFeedback.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl shrink-0 self-start overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('operations')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'operations'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Drafts, Listings &amp; Orders
          </button>
          <button
            type="button"
            onClick={() => setSubTab('plans')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'plans'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Plans ({currentPlan.name})
          </button>
          {sellerProfile.sellerType === 'BUSINESS' && (
            <button
              type="button"
              onClick={() => setSubTab('team')}
              className={`inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'team'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              Team
            </button>
          )}
        </div>
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

      {subTab === 'operations' && (
        <div className="space-y-10">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-border pb-8">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <p className="text-xs text-muted-foreground">Eligible Merchandise Revenue</p>
              <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                {formatKoboToNaira(sellerStats.eligibleMerchandiseKobo)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {sellerStats.directOrdersCount} direct · {sellerStats.referralOrdersCount} referral
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <p className="text-xs text-muted-foreground">NairaScout 10% Commission</p>
              <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                {formatKoboToNaira(sellerStats.marketplaceCommissionKobo)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pool share: {formatKoboToNaira(sellerStats.referralPoolGeneratedKobo)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <p className="text-xs text-muted-foreground">Net Seller Proceeds (90%)</p>
              <p className="mt-1 font-numeric text-2xl font-bold text-success tabular-nums">
                {formatKoboToNaira(sellerStats.netSellerProceedsKobo)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Separate from Scout wallet</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <p className="text-xs text-muted-foreground">Listings &amp; Publications</p>
              <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                {sellerStats.activeListingsCount} / {currentPlan.maxActiveListings}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {sellerStats.draftListingsCount} drafts · {sellerStats.monthlyPublicationsUsed} /{' '}
                {currentPlan.monthlyPublications} monthly pubs
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-8">
              {/* Seller Listings */}
              <section className="space-y-3">
                <h2 className="font-sans text-lg font-bold text-foreground">
                  Your Listings ({snapshot.sellerListings.length})
                </h2>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {snapshot.sellerListings.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">
                      No listings yet. Create a Draft listing on the right.
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
                            {formatWholeNaira(lst.priceKobo)} · {lst.stock} in stock
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

              {/* Orders & Fulfilment */}
              <section className="space-y-3">
                <div>
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Order Fulfilment &amp; Commission Release Pipeline
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Confirming delivery transitions linked Scout commissions from Pending to
                    Available in the immutable ledger.
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

                        {order.fulfilmentStatus !== 'Delivered' &&
                          order.fulfilmentStatus !== 'Refunded' && (
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
            </div>

            {/* Create Listing Form */}
            <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-4 self-start">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-foreground" aria-hidden="true" />
                <h2 className="font-sans text-base font-bold text-foreground">
                  Create Listing
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Drafts can be created anytime during onboarding. Publishing consumes a monthly
                publication slot and requires Seller verification approval.
              </p>

              <form onSubmit={handleCreateDraft} className="space-y-4">
                <div>
                  <label htmlFor="lst-title" className="block text-xs font-medium text-muted-foreground mb-1">
                    Product Name
                  </label>
                  <input
                    id="lst-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Abeokuta Adire Cotton Cushion Set"
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lst-cat" className="block text-xs font-medium text-muted-foreground mb-1">
                      Category
                    </label>
                    <select
                      id="lst-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:border-ring"
                    >
                      {activeCategoryNames.map((catName) => (
                        <option key={catName} value={catName}>
                          {catName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lst-stock" className="block text-xs font-medium text-muted-foreground mb-1">
                      Quantity
                    </label>
                    <input
                      id="lst-stock"
                      type="number"
                      min={1}
                      required
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lst-price" className="block text-xs font-medium text-muted-foreground mb-1">
                      Unit Price (₦)
                    </label>
                    <input
                      id="lst-price"
                      type="number"
                      min={500}
                      required
                      value={priceNaira}
                      onChange={(e) => setPriceNaira(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="lst-deliv" className="block text-xs font-medium text-muted-foreground mb-1">
                      Delivery Fee (₦)
                    </label>
                    <input
                      id="lst-deliv"
                      type="number"
                      min={0}
                      required
                      value={deliveryFeeNaira}
                      onChange={(e) => setDeliveryFeeNaira(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lst-desc" className="block text-xs font-medium text-muted-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    id="lst-desc"
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Material details, sizing, and fulfilment notes..."
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-commerce-foreground bg-commerce rounded-xl hover:bg-commerce/90 disabled:opacity-45 cursor-pointer"
                >
                  {submitting ? 'Saving Draft...' : 'Save Draft'}
                </button>
              </form>
            </div>
          </div>
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
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                        <span>{plan.maxActiveListings} active product listings</span>
                      </li>
                      <li className="flex items-center gap-2 text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                        <span>{plan.monthlyPublications} monthly publications</span>
                      </li>
                      <li className="flex items-center gap-2 text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                        <span>{plan.maxCategories} product categories</span>
                      </li>
                      <li
                        className={`flex items-center gap-2 ${
                          plan.videoQuota === 'None' ? 'text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {plan.videoQuota === 'None' ? (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden="true" />
                        ) : (
                          <CheckCircle2
                            className="h-4 w-4 text-emerald-500 shrink-0"
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
                            className="h-4 w-4 text-emerald-500 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden="true" />
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
                            className="h-4 w-4 text-emerald-500 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden="true" />
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
                  <span className="font-numeric font-semibold text-foreground tabular-nums">
                    {delegatedSeatsUsed} / {MAX_SELLER_TEAM_SEATS} delegated seats used
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
                  <span className="font-numeric text-xs text-muted-foreground tabular-nums">
                    {delegatedSeatsUsed}/{MAX_SELLER_TEAM_SEATS}
                  </span>
                </div>
                <form onSubmit={handleInviteTeam} className="space-y-3">
                  <input
                    type="email"
                    required
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="Registered Scout email..."
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                  />
                  <select
                    value={memberRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as Exclude<SellerTeamRole, 'BUSINESS_OWNER'>;
                      setMemberRole(nextRole);
                      setMemberPerms(SELLER_TEAM_ROLE_PERMISSIONS[nextRole]);
                    }}
                    className="w-full pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                  >
                    {(
                      [
                        'BUSINESS_ADMIN',
                        'PRODUCT_MANAGER',
                        'ORDER_MANAGER',
                        'FINANCE_MANAGER',
                        'ANALYST_VIEWER',
                      ] as Exclude<SellerTeamRole, 'BUSINESS_OWNER'>[]
                    ).map((roleKey) => (
                      <option key={roleKey} value={roleKey}>
                        {SELLER_TEAM_ROLE_LABELS[roleKey].label}
                      </option>
                    ))}
                  </select>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {(
                      [
                        ['canManageListings', 'Manage Listings'],
                        ['canManageOrders', 'Manage Orders'],
                        ['canViewAnalytics', 'View Analytics'],
                        ['canManageBilling', 'Manage Billing'],
                        ['canManageTeam', 'Manage Team'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memberPerms[key]}
                          onChange={(e) =>
                            setMemberPerms((p) => ({ ...p, [key]: e.target.checked }))
                          }
                          className="accent-foreground"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || delegatedSeatsUsed >= MAX_SELLER_TEAM_SEATS}
                    className="w-full py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
                  >
                    {delegatedSeatsUsed >= MAX_SELLER_TEAM_SEATS
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
  );
}
