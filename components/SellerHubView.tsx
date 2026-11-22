'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  Lock,
  PackagePlus,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import type {
  NairaScoutSnapshot,
  OrderFulfilmentStatus,
  SellerPlanId,
} from '@/lib/nairascout-store';
import { SELLER_PLANS, SELLER_TEAM_ROLE_LABELS } from '@/lib/seller-plans';
import { formatKoboToNaira, formatWholeNaira } from '@/lib/commission-engine';
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
    description: string;
    businessCategory: string;
    businessRegNumber?: string;
    businessAddress?: string;
    planId: SellerPlanId;
    evidencePaths: string[];
    termsAccepted: boolean;
  }) => Promise<boolean>;
  onManageTeam: (payload: Record<string, unknown>) => Promise<boolean>;
}

export default function SellerHubView({
  snapshot,
  onAdvanceOrder,
  onCreateDraftListing,
  onPublishListing,
  onSelectPlan,
  onActivateSeller,
  onManageTeam,
}: SellerHubViewProps) {
  const [subTab, setSubTab] = useState<'operations' | 'plans' | 'team'>('operations');

  // Draft listing form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Kitchen & Pantry');
  const [priceNaira, setPriceNaira] = useState('18500');
  const [deliveryFeeNaira, setDeliveryFeeNaira] = useState('2500');
  const [stock, setStock] = useState('10');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Onboarding wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [sellerType, setSellerType] = useState<'INDIVIDUAL' | 'BUSINESS'>('INDIVIDUAL');
  const [sellerName, setSellerName] = useState('');
  const [sellerDesc, setSellerDesc] = useState('');
  const [bizCat, setBizCat] = useState('Home & Craft');
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

  if (!snapshot.authenticated || !snapshot.activeScout) {
    return (
      <div className="bg-white border border-[#E4E4DE] rounded-xl p-10 text-center space-y-3">
        <Store className="w-8 h-8 text-[#0B6E4F] mx-auto" aria-hidden="true" />
        <h1 className="font-display text-2xl font-bold text-[#111814]">
          Seller Capabilities Attach to Your Scout Identity
        </h1>
        <p className="text-sm text-[#5C665E] max-w-lg mx-auto">
          Sign in or register for a free Scout account first, then activate Individual or Business
          Seller capabilities under the same primary identity.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="px-4 py-2 text-xs font-semibold text-[#111814] border border-[#D8D8D0] rounded-lg"
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
        <div className="border-b border-[#E4E4DE] pb-5">
          <h1 className="font-display text-3xl font-bold text-[#111814]">
            Activate Seller Capabilities
          </h1>
          <p className="mt-1.5 text-sm text-[#4B554E]">
            Attached to your primary identity (@{scout.handle}). You may create draft listings
            immediately, while public publishing requires Seller verification approval.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium">
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
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                wizardStep === s.step
                  ? 'bg-[#111814] text-white'
                  : 'bg-[#F0F0EA] text-[#5C665E]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleCompleteWizard}
          className="bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-5"
        >
          {wizardStep === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-[#111814]">
                Step 1: Choose Seller Type
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSellerType('INDIVIDUAL')}
                  className={`p-4 text-left rounded-xl border cursor-pointer ${
                    sellerType === 'INDIVIDUAL'
                      ? 'border-[#0B6E4F] bg-[#F3F8F6]'
                      : 'border-[#E4E4DE]'
                  }`}
                >
                  <p className="font-display font-bold text-[#111814]">Individual Seller</p>
                  <p className="text-xs text-[#5C665E] mt-1">
                    For sole merchants and independent artisans selling under verified personal KYC.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSellerType('BUSINESS')}
                  className={`p-4 text-left rounded-xl border cursor-pointer ${
                    sellerType === 'BUSINESS'
                      ? 'border-[#0B6E4F] bg-[#F3F8F6]'
                      : 'border-[#E4E4DE]'
                  }`}
                >
                  <p className="font-display font-bold text-[#111814]">Business Seller</p>
                  <p className="text-xs text-[#5C665E] mt-1">
                    For registered CAC entities with business verification and Sprawl team accounts.
                  </p>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
              >
                Continue to Profile Details
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-[#111814]">
                Step 2: Seller &amp; Business Details
              </h2>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Storefront / Seller Name
                </label>
                <input
                  type="text"
                  required
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="e.g., Lagos Botanical Studio"
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4B554E] mb-1">
                    Primary Category
                  </label>
                  <select
                    value={bizCat}
                    onChange={(e) => setBizCat(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white"
                  >
                    <option value="Home & Craft">Home &amp; Craft</option>
                    <option value="Kitchen & Pantry">Kitchen &amp; Pantry</option>
                    <option value="Audio & Tech">Audio &amp; Tech</option>
                    <option value="Beauty & Botanicals">Beauty &amp; Botanicals</option>
                    <option value="Fashion & Leather">Fashion &amp; Leather</option>
                  </select>
                </div>
                {sellerType === 'BUSINESS' && (
                  <div>
                    <label className="block text-xs font-medium text-[#4B554E] mb-1">
                      CAC Registration Number
                    </label>
                    <input
                      type="text"
                      value={bizReg}
                      onChange={(e) => setBizReg(e.target.value)}
                      placeholder="RC-123456 or BN-..."
                      className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Business / Fulfilment Address
                </label>
                <input
                  type="text"
                  value={bizAddr}
                  onChange={(e) => setBizAddr(e.target.value)}
                  placeholder="Street, City, State"
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={sellerDesc}
                  onChange={(e) => setSellerDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
              >
                Continue to Verification Docs
              </button>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-[#111814]">
                Step 3: Upload Verification Documents
              </h2>
              <p className="text-xs text-[#5C665E]">
                Stored securely in private bucket <span className="font-mono">verification-docs</span>{' '}
                and inspected via short-lived 60s signed URLs by Verification Officers.
              </p>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
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
                  className="block w-full text-xs text-[#4B554E] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#F3F3EF] file:font-semibold"
                />
                <p className="mt-1 text-xs font-mono text-[#0B6E4F]">
                  Target object: verification-docs/{scout.id}/{docFilename}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep(4)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
              >
                Continue to Plan Selection
              </button>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-[#111814]">
                Step 4: Select Initial Plan &amp; Accept Seller Terms
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['starter', 'traction', 'growth', 'sprawl'] as SellerPlanId[]).map((pid) => {
                  const p = SELLER_PLANS[pid];
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setWizardPlan(pid)}
                      className={`p-3 text-left rounded-lg border cursor-pointer ${
                        wizardPlan === pid ? 'border-[#0B6E4F] bg-[#F3F8F6]' : 'border-[#E4E4DE]'
                      }`}
                    >
                      <p className="text-xs font-bold text-[#111814]">{p.name}</p>
                      <p className="font-mono text-xs text-[#0B6E4F] mt-1">
                        {p.monthlyPriceKobo === 0 ? 'Free' : `${formatWholeNaira(p.monthlyPriceKobo)}/mo`}
                      </p>
                    </button>
                  );
                })}
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#4B554E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 accent-[#0B6E4F]"
                />
                <span>
                  I accept NairaScout Seller Terms, the 10-day fulfilment SLA, and the 10%
                  marketplace commission schedule (separate from Scout referral commissions).
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting || !termsAccepted}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 cursor-pointer"
              >
                {submitting ? 'Activating Seller Profile...' : 'Submit Onboarding & Activate Seller'}
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E4DE] pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#111814]">
            Seller Operations &amp; Subscriptions
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#4B554E]">
              {sellerProfile.sellerName} ({sellerProfile.sellerType})
            </span>
            <span className="px-2 py-0.5 rounded bg-[#F0F0EA] font-mono font-semibold text-[#111814]">
              Seller: {sellerProfile.sellerStatus}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-semibold ${
                scout.sellerVerificationStatus === 'VERIFIED'
                  ? 'bg-[#F3F8F6] text-[#0B6E4F]'
                  : 'bg-[#FFFBEB] text-[#B45309]'
              }`}
            >
              Verification: {scout.sellerVerificationStatus}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#FAFAF8] border border-[#E4E4DE] font-mono text-[#5C665E]">
              Plan: {currentPlan.name} ({sellerProfile.subscriptionStatus})
            </span>
            <Link
              href="/settings/closure"
              className="text-xs font-medium text-[#5C665E] hover:text-[#B91C1C] underline ml-1"
            >
              Close Seller Capabilities
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EFEFE9] rounded-lg shrink-0 self-start">
          <button
            type="button"
            onClick={() => setSubTab('operations')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'operations' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            Drafts, Listings &amp; Orders
          </button>
          <button
            type="button"
            onClick={() => setSubTab('plans')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'plans' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            Plans ({currentPlan.name})
          </button>
          {sellerProfile.sellerType === 'BUSINESS' && (
            <button
              type="button"
              onClick={() => setSubTab('team')}
              className={`inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'team' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
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
        <div className="bg-[#FFFBEB] border border-[#E5CFA3] rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-[#78350F] space-y-1">
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
              <p className="text-xs text-[#5C665E]">Listings &amp; Publications</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#111814] tabular-nums">
                {sellerStats.activeListingsCount} / {currentPlan.maxActiveListings}
              </p>
              <p className="mt-1 text-xs text-[#5C665E]">
                {sellerStats.draftListingsCount} drafts · {sellerStats.monthlyPublicationsUsed} /{' '}
                {currentPlan.monthlyPublications} monthly pubs
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-8">
              {/* Seller Listings (Drafts vs Published) */}
              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-[#111814]">
                  Your Listings ({snapshot.sellerListings.length})
                </h2>
                <div className="bg-white border border-[#E4E4DE] rounded-xl divide-y divide-[#ECECE6]">
                  {snapshot.sellerListings.length === 0 ? (
                    <div className="p-6 text-sm text-[#5C665E]">
                      No listings yet. Create a Draft listing on the right.
                    </div>
                  ) : (
                    snapshot.sellerListings.map((lst) => (
                      <div
                        key={lst.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-mono text-xs text-[#5C665E]">
                            {lst.id} · {lst.category} ·{' '}
                            <span
                              className={
                                lst.status === 'PUBLISHED'
                                  ? 'text-[#0B6E4F] font-semibold'
                                  : 'text-[#B45309] font-semibold'
                              }
                            >
                              {lst.status}
                            </span>
                          </p>
                          <p className="font-display text-sm font-semibold text-[#111814] mt-0.5">
                            {lst.title}
                          </p>
                          <p className="font-mono text-xs text-[#4B554E] mt-0.5">
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
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-45 shrink-0 cursor-pointer"
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
                  <h2 className="font-display text-xl font-bold text-[#111814]">
                    Order Fulfilment &amp; Commission Release Pipeline
                  </h2>
                  <p className="text-xs text-[#5C665E]">
                    Confirming delivery transitions linked Scout commissions from Pending to
                    Available in the immutable ledger.
                  </p>
                </div>

                <div className="bg-white border border-[#E4E4DE] rounded-xl divide-y divide-[#ECECE6]">
                  {snapshot.orders.length === 0 ? (
                    <div className="p-6 text-sm text-[#5C665E]">No orders yet.</div>
                  ) : (
                    snapshot.orders.map((order) => (
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
                    ))
                  )}
                </div>
              </section>
            </div>

            {/* Create Draft Listing Form */}
            <div className="lg:col-span-5 bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-4 self-start">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#111814]">
                  Create Draft Listing
                </h2>
              </div>
              <p className="text-xs text-[#5C665E]">
                Drafts can be created anytime during onboarding. Publishing consumes a monthly
                publication slot and requires Seller verification approval.
              </p>

              <form onSubmit={handleCreateDraft} className="space-y-3.5">
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
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#111814] rounded-lg hover:bg-[#26332B] disabled:opacity-45 cursor-pointer"
                >
                  {submitting ? 'Saving Draft...' : 'Save as Draft Listing'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {subTab === 'plans' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 flex items-start gap-3">
            <Store className="w-5 h-5 text-[#0B6E4F] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-[#4B554E]">
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
                  className={`bg-white rounded-xl p-6 flex flex-col justify-between gap-6 border ${
                    isCurrent ? 'border-[#0B6E4F]' : 'border-[#E4E4DE]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl font-bold text-[#111814]">{plan.name}</h3>
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
                        <span>Video: {plan.videoQuota}</span>
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

      {subTab === 'team' && (
        <div className="space-y-6">
          {!currentPlan.sellerTeamAccounts ? (
            <div className="bg-white border border-[#E4E4DE] rounded-xl p-8 space-y-3">
              <div className="flex items-center gap-2 text-[#B45309]">
                <Lock className="w-5 h-5" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#111814]">
                  Seller Team Accounts Require the Sprawl Plan
                </h2>
              </div>
              <p className="text-sm text-[#4B554E]">
                Business Sellers on the Sprawl plan (₦250,000/mo) can delegate listing, order, and
                analytics permissions to team members while keeping primary Scout identities
                separate.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('plans')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
              >
                View Sprawl Plan Entitlements
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 bg-white border border-[#E4E4DE] rounded-xl divide-y divide-[#ECECE6]">
                <div className="p-4 flex items-center justify-between text-xs bg-[#FAFAF8]">
                  <span className="font-semibold text-[#111814]">Active Team Members</span>
                  <span className="font-mono font-semibold text-[#0B6E4F]">
                    {delegatedSeatsUsed} / {MAX_SELLER_TEAM_SEATS} delegated seats used
                  </span>
                </div>
                {scout.teamMembers.map((m) => (
                  <div key={m.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#111814]">
                        {m.displayName}{' '}
                        <span className="font-mono text-xs text-[#5C665E]">@{m.username}</span>
                      </p>
                      <p className="text-xs text-[#5C665E]">
                        {SELLER_TEAM_ROLE_LABELS[m.role]?.label || m.role} ({m.role}) · {m.email}
                      </p>
                    </div>
                    {m.role !== 'BUSINESS_OWNER' && (
                      <button
                        type="button"
                        onClick={() => onManageTeam({ operation: 'revoke', memberId: m.id })}
                        className="px-3 py-1.5 text-xs font-medium text-[#B91C1C] border border-[#E8D0D0] rounded-md cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="lg:col-span-5 bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-[#111814]">
                    Add Business Team Member
                  </h3>
                  <span className="font-mono text-xs text-[#5C665E]">
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
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                  />
                  <select
                    value={memberRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as Exclude<SellerTeamRole, 'BUSINESS_OWNER'>;
                      setMemberRole(nextRole);
                      setMemberPerms(SELLER_TEAM_ROLE_PERMISSIONS[nextRole]);
                    }}
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white"
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
                  <div className="space-y-1.5 text-xs text-[#4B554E]">
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
                          className="accent-[#0B6E4F]"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || delegatedSeatsUsed >= MAX_SELLER_TEAM_SEATS}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg disabled:opacity-45 cursor-pointer"
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
