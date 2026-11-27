import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
  AncestorNode,
  CommissionBreakdown,
  COMMISSION_RULE_VERSION,
  calculateThirteenGenerationCommissions,
  selectCommissionSchedule,
  validateAncestryRelationship,
} from './commission-engine';
import {
  ALL_PLATFORM_ADMIN_ROLES,
  AccountStatus,
  ActiveRestrictionDTO,
  AdminRole,
  AuthorizationError,
  CapabilityCode,
  MAX_SELLER_TEAM_SEATS,
  ProfileVisibility,
  PublicScoutProfileDTO,
  RestrictionScope,
  SELLER_PLAN_ENTITLEMENTS,
  SELLER_TEAM_ROLE_PERMISSIONS,
  SPRAWL_MAX_TEAM_SEATS,
  SellerStatus,
  SellerTeamRole,
  SubscriptionPlan,
  SubscriptionStatus,
  UserAuthContext,
  VerificationStatus,
  WITHDRAWAL_COOLDOWN_HOURS,
  assertAccountOperational,
  assertActiveAccount,
  assertAdminRole,
  assertCanManageSellerDrafts,
  assertCanManageSellerTeam,
  assertCanParticipateAsScout,
  assertCanPublishListing,
  assertCanReviewVerification,
  assertCapabilityNotRestricted,
  assertIndependentAppealsOfficer,
  assertIndependentRecoveryOfficers,
  assertMakerCheckerDistinct,
  assertRecentReauthentication,
  assertReferralBatchValid,
  assertWithdrawalNotInCooldown,
  normalizeAdminRole,
  normalizeTeamRole,
  toPublicScoutProfileDTO,
} from './auth/rbac';
import {
  InvalidTransitionError,
  normalizeAccountStatus,
  normalizeSellerStatus,
  normalizeSubscriptionStatus,
  normalizeVerificationStatus,
  transitions,
} from './auth/transitions';
import { loadDbAuthContext, SupabaseSessionIdentity } from './auth/session';
import { formatPostgresError, getDb, isPostgresConfigured, NairaScoutDb, requireDb } from './db';
import {
  abuseReports,
  accountRecoveryRequests,
  auditLogs,
  capabilityRestrictions,
  dataRetentionSchedule,
  governanceAppeals,
  helpArticles,
  listingCategories,
  makerCheckerRequests,
  nigerianStates,
  platformAdminRoles,
  platformPolicies,
  referralAncestry,
  scoutProfiles,
  scoutsListContacts,
  scoutsListInvitations,
  sellerProfiles,
  sellerTeamMembers,
  SellerTeamPermissions,
  userBlocks,
  users,
  verificationRecords,
  withdrawalRequests,
} from './db/schema';
import {
  commissionLedgerEntries,
  ensureCommerceTables,
  marketplaceOrders,
  notifications,
  productListings,
  productReferralEvents,
  supportCases,
} from './db/commerce-schema';

const SCOUT_BIO_MAX_LENGTH = 250;
const RESERVED_IMPERSONATION_TERMS = [
  'admin',
  'administrator',
  'nairascout',
  'support',
  'helpdesk',
  'moderator',
  'superadmin',
  'trustandsafety',
  'trust_safety',
  'compliance',
  'official',
  'staff',
  'verifier',
  'finance_officer',
];

function containsReservedImpersonationTerm(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  for (const term of RESERVED_IMPERSONATION_TERMS) {
    if (normalized.includes(term.replace(/_/g, '')) || value.toLowerCase().includes(term)) {
      return term;
    }
  }
  return null;
}
import {
  ListingVideoLink,
  MAX_LISTING_IMAGES,
  parseAndNormalizeVideoLink,
  sanitizeListingImageUrls,
  sanitizeStoredVideoLinks,
} from './media/video-links';
import {
  DEFAULT_LISTING_CATEGORIES_SEED,
  NIGERIAN_STATES_SEED,
  slugifyCategoryName,
} from './constants/nigeria-and-categories';
import {
  DEFAULT_HELP_ARTICLES_SEED,
  DEFAULT_PLATFORM_POLICIES_SEED,
  HELP_ARTICLE_CATEGORIES,
  HELP_AUDIENCE_ROLES,
  type HelpArticleCategory,
  type HelpAudienceRole,
} from './constants/foundation-content';
import {
  SELLER_PLANS,
  SellerPlanId,
  SellerPlanSpec,
  planEnumToId,
  planIdToEnum,
} from './seller-plans';
import { createSupabaseAdminClient, isSupabaseConfigured } from './supabase/server';

export { SELLER_PLANS, planEnumToId, planIdToEnum };
export type { SellerPlanId, SellerPlanSpec };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(val: string | null | undefined): val is string {
  return Boolean(val && UUID_REGEX.test(val.trim()));
}

function getExpiryDays(): number {
  const raw = Number(process.env.SCOUTS_LIST_INVITATION_EXPIRY_DAYS || '14');
  return Number.isFinite(raw) && raw > 0 ? raw : 14;
}

export type VerificationCategory =
  | 'CONTACT'
  | 'IDENTITY'
  | 'BUSINESS'
  | 'SELLER'
  | 'PAYOUT_BANK';

export type InvitationPolicy = 'EVERYONE' | 'CONTACTS_ONLY' | 'NOBODY';

export interface SellerProfileRecord {
  id: string;
  ownerUserId: string;
  sellerType: 'INDIVIDUAL' | 'BUSINESS';
  sellerName: string;
  logoUrl?: string | null;
  description: string | null;
  businessCategory: string | null;
  businessRegNumber: string | null;
  businessAddress: string | null;
  businessContactEmail: string | null;
  businessContactPhone: string | null;
  sellerStatus: SellerStatus;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  termsAcceptedAt: string;
  createdAt: string;
}

export interface SellerTeamMemberRecord {
  id: string;
  sellerProfileId: string;
  userId: string;
  role: SellerTeamRole;
  permissions: SellerTeamPermissions;
  status: 'INVITED' | 'ACTIVE' | 'REVOKED';
  invitedBy: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export type MakerCheckerActionType =
  | 'COMMISSION_ADJUSTMENT'
  | 'WALLET_CORRECTION'
  | 'EXCEPTIONAL_PAYOUT'
  | 'REFUND_EXCEPTION'
  | 'ROLE_ASSIGNMENT'
  | 'ANCESTRY_OVERRIDE'
  | 'CRITICAL_CONFIG';

export interface MakerCheckerRequestDTO {
  id: string;
  actionType: MakerCheckerActionType;
  targetUserId: string;
  targetHandle: string;
  targetEntityId: string | null;
  payload: Record<string, unknown>;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  makerId: string;
  makerHandle: string;
  checkerId: string | null;
  checkerHandle: string | null;
  checkerNotes: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type AppealTargetType = 'VERIFICATION' | 'RESTRICTION' | 'SUSPENSION' | 'DISPUTE';
export type GovernanceReasonCategory =
  | 'GENERAL'
  | 'FRAUD_INVESTIGATION'
  | 'SPAM_ABUSE'
  | 'DISPUTE';

export interface GovernanceAppealDTO {
  id: string;
  appellantUserId: string;
  appellantHandle: string;
  targetType: AppealTargetType;
  targetRecordId: string;
  originalReviewerId: string | null;
  originalReviewerHandle: string | null;
  appealReason: string;
  evidencePaths: string[];
  status: 'OPEN' | 'UNDER_REVIEW' | 'UPHELD' | 'OVERTURNED';
  appealsOfficerId: string | null;
  appealsOfficerHandle: string | null;
  decisionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ClosureAssessmentDTO {
  openBuyerOrdersCount: number;
  openSellerOrdersCount: number;
  disputedOrdersCount: number;
  activeListingsCount: number;
  pendingWalletKobo: number;
  availableWalletKobo: number;
  canCloseFullAccount: boolean;
  blockingReason: string | null;
}

export interface VerificationRecord {
  id: string;
  userId: string;
  sellerProfileId: string | null;
  category: VerificationCategory;
  status: VerificationStatus;
  evidencePaths: string[];
  reviewerNotes: string | null;
  reviewedBy: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface ProductVariantOption {
  id: string;
  label: string;
  imageUrl?: string;
}

export interface ProductListing {
  id: string;
  productId: string;
  title: string;
  description: string;
  category: string;
  priceKobo: number;
  deliveryFeeKobo: number;
  stock: number;
  sellerScoutId: string;
  sellerProfileId: string;
  sellerName: string;
  sellerLogoUrl?: string | null;
  sellerCity: string;
  hasActiveSellerBadge: boolean;
  isSellerVerified: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'EXPIRED';
  imageSeed: string;
  imageUrl: string;
  imageUrls: string[];
  videoLinks: ListingVideoLink[];
  daysRemaining: number;
  specifications: string[];
  returnPolicy: string;
  warranty: string;
  impressions: number;
  referralShares: number;
  unitsSold?: number;
  variants?: ProductVariantOption[];
}

export interface ScoutsListContact {
  contactId: string;
  ownerUserId: string;
  scoutId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  city: string;
  addedAt: string;
  blocked: boolean;
  hasActiveSellerBadge: boolean;
  isSellerVerified: boolean;
}

export interface ScoutsListInvitation {
  id: string;
  senderId: string;
  recipientId: string;
  direction: 'incoming' | 'outgoing';
  otherScoutId: string;
  otherHandle: string;
  otherDisplayName: string;
  otherAvatarUrl?: string | null;
  otherCity: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface AbuseReportRecord {
  id: string;
  reporterId: string;
  reporterHandle: string;
  reportedUserId: string;
  reportedHandle: string;
  referralEventId: string | null;
  reason: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorHandle: string;
  affectedUserId: string;
  affectedHandle: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

export interface ProductReferralEvent {
  id: string;
  productListingId: string;
  senderScoutId: string;
  senderHandle: string;
  senderDisplayName: string;
  recipientScoutId: string;
  recipientHandle: string;
  recipientDisplayName: string;
  note: string;
  ancestryPathSignature: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'converted';
}

export type OrderFulfilmentStatus =
  | 'Paid'
  | 'Processing'
  | 'Dispatched'
  | 'Delivered'
  | 'Disputed'
  | 'Refunded';

export interface MarketplaceOrder {
  id: string;
  buyerScoutId: string;
  buyerDisplayName: string;
  productListingId: string;
  productTitle: string;
  sellerScoutId: string;
  sellerName: string;
  quantity: number;
  eligibleMerchandiseKobo: number;
  deliveryFeeKobo: number;
  totalChargedKobo: number;
  attributionType: 'direct' | 'referral_card';
  referralEventId: string | null;
  fulfilmentStatus: OrderFulfilmentStatus;
  fulfilmentDeadline: string;
  createdAt: string;
  commissionSnapshot: CommissionBreakdown;
}

export type LedgerEntryStatus = 'Pending' | 'Available' | 'On Hold' | 'Paid' | 'Reversed';

export interface LedgerEntry {
  id: string;
  reference: string;
  orderId: string;
  referralEventId: string | null;
  beneficiaryScoutId: string;
  generation: number;
  fractionLabel: string;
  amountKobo: number;
  status: LedgerEntryStatus;
  ruleVersion: string;
  description: string;
  createdAt: string;
  linkedToReference?: string;
}

export interface DownstreamGenerationStat {
  generation: number;
  scoutCount: number;
  eligibleCount: number;
  sampleHandles: string[];
  scheduleFractionAtFullDepth: string;
}

export interface SupportCase {
  id: string;
  userId: string;
  topic: 'attribution' | 'commission' | 'payout' | 'fulfilment' | 'abuse';
  subject: string;
  details: string;
  status: 'Open' | 'Under Review' | 'Resolved';
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  createdAt: string;
  isRead: boolean;
  read: boolean;
  readAt?: string | null;
}

export interface WalletSummary {
  pendingKobo: number;
  availableKobo: number;
  onHoldKobo: number;
  paidKobo: number;
  reversedKobo: number;
  minimumPayoutKobo: number;
  nextPayoutDate: string;
  precedingMonthAvailableKobo: number;
  eligibleForNextPayout: boolean;
  pendingWithdrawalKobo?: number;
  withdrawableNowKobo?: number;
}

export interface ActiveScoutDTO {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bio: string | null;
  city: string;
  locationLga?: string | null;
  accountCreatedAt?: string;
  preferredCategories: string[];
  accountStatus: AccountStatus;
  restrictionReason: string | null;
  termsAcceptedAt?: string | null;
  privacyAcknowledgedAt?: string | null;
  emailVerifiedAt?: string | null;
  lastReauthenticatedAt?: string | null;
  withdrawalCooldownUntil?: string | null;
  mfaEnabled: boolean;
  invitePolicy: InvitationPolicy;
  muteReferrals: boolean;
  profileVisibility: ProfileVisibility;
  kycVerified: boolean;
  bankVerified: boolean;
  bankSummary: string;
  isSeller: boolean;
  sellerProfile: SellerProfileRecord | null;
  sellerVerificationStatus: VerificationStatus;
  verifications: VerificationRecord[];
  teamMembers: Array<
    SellerTeamMemberRecord & {
      username: string;
      displayName: string;
      email: string;
    }
  >;
  adminRole: AdminRole | null;
  sellerPlan: SellerPlanId;
  activeRestrictions: ActiveRestrictionDTO[];
  governanceAppeals: GovernanceAppealDTO[];
  closureAssessment: ClosureAssessmentDTO;
}

export interface AccountRecoveryRequestDTO {
  id: string;
  targetUserId: string | null;
  targetHandle: string | null;
  claimedEmail: string;
  claimedUsername: string | null;
  contactEmailForUpdates: string;
  reason: string;
  evidencePaths: string[];
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'RECOMMENDED_APPROVAL' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedByHandle: string | null;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedByHandle: string | null;
  approvalNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface NigerianStateDTO {
  code: string;
  name: string;
  geoZone: string;
}

export interface ListingCategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface PlatformPolicyDTO {
  id: string;
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  version: string;
  effectiveDate: string;
  isPublished: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

export interface HelpArticleDTO {
  id: string;
  slug: string;
  category: HelpArticleCategory;
  title: string;
  summary: string;
  bodyMarkdown: string;
  audienceRole: HelpAudienceRole;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: string;
}

export interface NairaScoutSnapshot {
  authenticated: boolean;
  dbConfigured: boolean;
  supabaseConfigured: boolean;
  activeScout: ActiveScoutDTO | null;
  products: ProductListing[];
  sellerListings: ProductListing[];
  scoutsList: ScoutsListContact[];
  invitations: ScoutsListInvitation[];
  blockedUsers: Array<{ userId: string; username: string; displayName: string; createdAt: string }>;
  referralsInbox: ProductReferralEvent[];
  sentReferrals: ProductReferralEvent[];
  orders: MarketplaceOrder[];
  ledgerEntries: LedgerEntry[];
  wallet: WalletSummary;
  upstreamAncestry: AncestorNode[];
  downstreamGenerations: DownstreamGenerationStat[];
  sellerStats: {
    activeListingsCount: number;
    draftListingsCount: number;
    monthlyPublicationsUsed: number;
    directOrdersCount: number;
    referralOrdersCount: number;
    eligibleMerchandiseKobo: number;
    marketplaceCommissionKobo: number;
    referralPoolGeneratedKobo: number;
    netSellerProceedsKobo: number;
  };
  notifications: PlatformNotification[];
  supportCases: SupportCase[];
  allScoutsDirectory: PublicScoutProfileDTO[];
  states: NigerianStateDTO[];
  categories: ListingCategoryDTO[];
  platformPolicies: PlatformPolicyDTO[];
}

// ============================================================================
// INTERNAL POSTGRESQL HELPERS
// ============================================================================

const globalForFoundationSeed = globalThis as unknown as {
  __nsFoundationSeeded?: Promise<void>;
};

async function ensureTablesReady(db: NairaScoutDb) {
  try {
    await ensureCommerceTables((q) => db.execute(q));
    if (!globalForFoundationSeed.__nsFoundationSeeded) {
      globalForFoundationSeed.__nsFoundationSeeded = (async () => {
        for (const policy of DEFAULT_PLATFORM_POLICIES_SEED) {
          await db
            .insert(platformPolicies)
            .values({
              slug: policy.slug,
              title: policy.title,
              summary: policy.summary,
              contentMarkdown: policy.contentMarkdown,
              version: policy.version,
              effectiveDate: new Date(policy.effectiveDate),
              isPublished: policy.isPublished,
            })
            .onConflictDoNothing({ target: platformPolicies.slug });
        }
        for (const article of DEFAULT_HELP_ARTICLES_SEED) {
          await db
            .insert(helpArticles)
            .values({
              slug: article.slug,
              category: article.category,
              title: article.title,
              summary: article.summary,
              bodyMarkdown: article.bodyMarkdown,
              audienceRole: article.audienceRole,
              sortOrder: article.sortOrder,
              isPublished: article.isPublished,
            })
            .onConflictDoNothing({ target: helpArticles.slug });
        }
      })().catch((seedErr) => {
        globalForFoundationSeed.__nsFoundationSeeded = undefined;
        throw seedErr;
      });
    }
    await globalForFoundationSeed.__nsFoundationSeeded;
  } catch (err) {
    const formatted = formatPostgresError(err);
    console.error('[PostgreSQL DDL Error] ensureCommerceTables failed:', formatted, err);
    throw err;
  }
}

function emptyWallet(): WalletSummary {
  return {
    pendingKobo: 0,
    availableKobo: 0,
    onHoldKobo: 0,
    paidKobo: 0,
    reversedKobo: 0,
    minimumPayoutKobo: 500000,
    nextPayoutDate: '2026-12-15',
    precedingMonthAvailableKobo: 0,
    eligibleForNextPayout: false,
  };
}

function emptyDownstreamStats(): DownstreamGenerationStat[] {
  const fullSchedule = selectCommissionSchedule(13).entries;
  return Array.from({ length: 13 }, (_, idx) => ({
    generation: idx + 1,
    scoutCount: 0,
    eligibleCount: 0,
    sampleHandles: [],
    scheduleFractionAtFullDepth: fullSchedule[idx]?.label ?? '—',
  }));
}

async function computeWalletFromDb(
  db: NairaScoutDb,
  scoutId: string,
  verifRows: Array<typeof verificationRecords.$inferSelect>
): Promise<WalletSummary> {
  const entries = await db
    .select()
    .from(commissionLedgerEntries)
    .where(eq(commissionLedgerEntries.beneficiaryScoutId, scoutId))
    .orderBy(desc(commissionLedgerEntries.createdAt));

  const rootStates = new Map<string, { status: LedgerEntryStatus; amountKobo: number }>();
  for (const entry of [...entries].reverse()) {
    const key = entry.linkedToReference || entry.reference;
    rootStates.set(key, {
      status: entry.status as LedgerEntryStatus,
      amountKobo: entry.amountKobo,
    });
  }

  let pendingKobo = 0;
  let availableKobo = 0;
  let onHoldKobo = 0;
  let paidKobo = 0;
  let reversedKobo = 0;

  for (const state of rootStates.values()) {
    if (state.status === 'Pending') pendingKobo += state.amountKobo;
    else if (state.status === 'Available') availableKobo += state.amountKobo;
    else if (state.status === 'On Hold') onHoldKobo += state.amountKobo;
    else if (state.status === 'Paid') paidKobo += state.amountKobo;
    else if (state.status === 'Reversed') reversedKobo += state.amountKobo;
  }

  const kycOk = verifRows.some(
    (v) => v.category === 'IDENTITY' && normalizeVerificationStatus(v.status) === 'VERIFIED'
  );
  const bankOk = verifRows.some(
    (v) => v.category === 'PAYOUT_BANK' && normalizeVerificationStatus(v.status) === 'VERIFIED'
  );
  const minimumPayoutKobo = 500000;

  let pendingWithdrawalKobo = 0;
  try {
    const wrRows = await db
      .select({ amountKobo: withdrawalRequests.amountKobo, status: withdrawalRequests.status })
      .from(withdrawalRequests)
      .where(
        and(
          eq(withdrawalRequests.userId, scoutId),
          inArray(withdrawalRequests.status, ['PENDING', 'PROCESSING'])
        )
      );
    pendingWithdrawalKobo = wrRows.reduce((s, r) => s + Number(r.amountKobo), 0);
  } catch {
    pendingWithdrawalKobo = 0;
  }
  const withdrawableNowKobo = Math.max(0, availableKobo - pendingWithdrawalKobo);

  return {
    pendingKobo,
    availableKobo,
    onHoldKobo,
    paidKobo,
    reversedKobo,
    minimumPayoutKobo,
    nextPayoutDate: '2026-12-15',
    precedingMonthAvailableKobo: availableKobo,
    eligibleForNextPayout: withdrawableNowKobo >= minimumPayoutKobo && kycOk && bankOk,
    pendingWithdrawalKobo,
    withdrawableNowKobo,
  };
}

async function buildAncestryChainFromDb(
  db: NairaScoutDb,
  scoutId: string
): Promise<AncestorNode[]> {
  const allAncestry = await db.select().from(referralAncestry);
  const allUsers = await db.select().from(users);
  const allScouts = await db.select().from(scoutProfiles);

  const ancestryByScout = new Map(allAncestry.map((a) => [a.scoutUserId, a]));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const scoutMap = new Map(allScouts.map((s) => [s.userId, s]));

  const chain: AncestorNode[] = [];
  const visited = new Set<string>([scoutId]);
  let currentId = ancestryByScout.get(scoutId)?.directReferrerId ?? null;
  let gen = 1;

  while (currentId && gen <= 13 && !visited.has(currentId)) {
    visited.add(currentId);
    const scout = scoutMap.get(currentId);
    const user = userMap.get(currentId);
    if (!scout || !user) break;

    const isEligible = user.accountStatus === 'ACTIVE';
    chain.push({
      generation: gen,
      scoutId: scout.userId,
      handle: scout.username,
      displayName: scout.displayName,
      eligible: isEligible,
      ineligibilityReason: isEligible
        ? undefined
        : `Account status: ${user.accountStatus} (slot retained at ₦0.00)`,
    });

    currentId = ancestryByScout.get(currentId)?.directReferrerId ?? null;
    gen += 1;
  }

  return chain;
}

async function computeDownstreamFromDb(
  db: NairaScoutDb,
  scoutId: string
): Promise<DownstreamGenerationStat[]> {
  const allAncestry = await db.select().from(referralAncestry);
  const allUsers = await db.select().from(users);
  const allScouts = await db.select().from(scoutProfiles);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const scoutMap = new Map(allScouts.map((s) => [s.userId, s]));
  const childrenByParent = new Map<string, string[]>();

  for (const row of allAncestry) {
    if (!row.directReferrerId) continue;
    const list = childrenByParent.get(row.directReferrerId) ?? [];
    list.push(row.scoutUserId);
    childrenByParent.set(row.directReferrerId, list);
  }

  const fullSchedule = selectCommissionSchedule(13).entries;
  const stats: DownstreamGenerationStat[] = [];
  let frontier: string[] = [scoutId];

  for (let gen = 1; gen <= 13; gen++) {
    const nextFrontier: string[] = [];
    for (const parentId of frontier) {
      const children = childrenByParent.get(parentId) ?? [];
      nextFrontier.push(...children);
    }

    const eligible = nextFrontier.filter((id) => userMap.get(id)?.accountStatus === 'ACTIVE');
    const handles =
      gen <= 2
        ? nextFrontier
            .slice(0, 4)
            .map((id) => `@${scoutMap.get(id)?.username ?? 'scout'}`)
        : [];

    stats.push({
      generation: gen,
      scoutCount: nextFrontier.length,
      eligibleCount: eligible.length,
      sampleHandles: handles,
      scheduleFractionAtFullDepth: fullSchedule[gen - 1]?.label ?? '—',
    });

    frontier = nextFrontier;
  }

  return stats;
}

// ============================================================================
// ATOMIC SIGNUP / FIRST-LOGIN PROVISIONING (DRIZZLE POSTGRES TRANSACTION)
// ============================================================================

// NS-ACC-001, NS-ACC-017, NS-AUT-002 & NS-REF-001: Idempotent unified PostgreSQL user provisioning + PENDING_ACTIVATION & CLOSED guards
export async function ensureUserProvisionedInDb(
  identity: SupabaseSessionIdentity,
  input?: {
    displayName?: string;
    username?: string;
    locationState?: string;
    referralEventId?: string | null;
    referralScoutUsername?: string | null;
    termsAccepted?: boolean;
    termsAcceptedAt?: string;
    privacyAcknowledgedAt?: string;
  }
): Promise<{ createdNew: boolean; userId: string; accountStatus: AccountStatus }> {
  const db = requireDb();
  await ensureTablesReady(db);

  const normalizedEmail = identity.email.trim().toLowerCase();
  const isEmailConfirmed = Boolean(identity.emailConfirmedAt);
  const confirmedAtDate = identity.emailConfirmedAt ? new Date(identity.emailConfirmedAt) : null;

  const [existingUser, existingByEmail, existingProfile, existingAncestry] = await Promise.all([
    db
      .select({
        id: users.id,
        accountStatus: users.accountStatus,
        emailVerifiedAt: users.emailVerifiedAt,
        termsAcceptedAt: users.termsAcceptedAt,
      })
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1),
    db
      .select({ id: users.id, accountStatus: users.accountStatus })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1),
    db
      .select({ userId: scoutProfiles.userId })
      .from(scoutProfiles)
      .where(eq(scoutProfiles.userId, identity.userId))
      .limit(1),
    db
      .select({ scoutUserId: referralAncestry.scoutUserId })
      .from(referralAncestry)
      .where(eq(referralAncestry.scoutUserId, identity.userId))
      .limit(1),
  ]);

  // NS-ACC-017: CLOSED accounts can never be silently reactivated via normal login or registration
  const matchedExisting = existingUser[0] ?? existingByEmail[0];
  if (matchedExisting) {
    const currentAccountStatus = normalizeAccountStatus(matchedExisting.accountStatus);
    if (currentAccountStatus === 'CLOSED' || currentAccountStatus === 'CLOSURE_PENDING') {
      throw new AuthorizationError(
        'This account is closed and cannot be reactivated via normal login or registration. Contact a Super Admin for an explicit audited reinstatement.',
        403,
        'ACCOUNT_CLOSED'
      );
    }
  }

  // NS-AUT-002: Promote PENDING_ACTIVATION -> ACTIVE once email is confirmed in Supabase Auth
  if (existingUser.length > 0 && existingProfile.length > 0 && existingAncestry.length > 0) {
    const existingStatus = normalizeAccountStatus(existingUser[0].accountStatus);
    if (existingStatus === 'PENDING_ACTIVATION' && isEmailConfirmed) {
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            accountStatus: 'ACTIVE',
            emailVerifiedAt: confirmedAtDate ?? now,
            updatedAt: now,
          })
          .where(eq(users.id, identity.userId));
        await tx.insert(auditLogs).values({
          actorId: identity.userId,
          affectedUserId: identity.userId,
          action: 'ACCOUNT_ACTIVATED',
          entityType: 'users',
          entityId: identity.userId,
          previousValue: { accountStatus: 'PENDING_ACTIVATION' },
          newValue: { accountStatus: 'ACTIVE', emailVerifiedAt: (confirmedAtDate ?? now).toISOString() },
          reason: 'Email address verified via Supabase Auth OTP/link',
        });
      });
      return { createdNew: false, userId: identity.userId, accountStatus: 'ACTIVE' };
    }
    return { createdNew: false, userId: identity.userId, accountStatus: existingStatus };
  }

  const normalizedPhone = identity.phone?.trim() ? identity.phone.trim() : null;
  const meta = identity.userMetadata || {};
  const parseConsentDate = (raw: unknown): Date | null => {
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };
  const nowConsent = new Date();
  const termsAcceptedAt =
    parseConsentDate(input?.termsAcceptedAt) ??
    parseConsentDate(meta.terms_accepted_at) ??
    (input?.termsAccepted ? nowConsent : null);
  const privacyAcknowledgedAt =
    parseConsentDate(input?.privacyAcknowledgedAt) ??
    parseConsentDate(meta.privacy_acknowledged_at) ??
    (input?.termsAccepted ? nowConsent : null);
  const initialStatus: AccountStatus = isEmailConfirmed ? 'ACTIVE' : 'PENDING_ACTIVATION';

  const rawDisplayName =
    input?.displayName?.trim() ||
    (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    normalizedEmail.split('@')[0];

  const baseUsernameRaw =
    input?.username?.trim() ||
    (typeof meta.username === 'string' && meta.username.trim()) ||
    normalizedEmail.split('@')[0];
  const baseSlug =
    baseUsernameRaw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '') || 'scout';

  const locationState =
    input?.locationState?.trim() ||
    (typeof meta.location_state === 'string' && meta.location_state.trim()) ||
    'Lagos';

  try {
    const created = await db.transaction(async (tx) => {
      let anyCreated = false;

      // 1. Idempotent insert into public.users
      let userRow = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, identity.userId))
        .limit(1);

      if (userRow.length === 0) {
        await tx
          .insert(users)
          .values({
            id: identity.userId,
            email: normalizedEmail,
            phone: normalizedPhone,
            accountStatus: initialStatus,
            termsAcceptedAt,
            privacyAcknowledgedAt,
            emailVerifiedAt: isEmailConfirmed ? confirmedAtDate ?? nowConsent : null,
          })
          .onConflictDoNothing();

        userRow = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, identity.userId))
          .limit(1);

        if (userRow.length === 0 && normalizedPhone !== null) {
          await tx
            .insert(users)
            .values({
              id: identity.userId,
              email: normalizedEmail,
              phone: null,
              accountStatus: initialStatus,
              termsAcceptedAt,
              privacyAcknowledgedAt,
              emailVerifiedAt: isEmailConfirmed ? confirmedAtDate ?? nowConsent : null,
            })
            .onConflictDoNothing();

          userRow = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, identity.userId))
            .limit(1);
        }

        if (userRow.length === 0) {
          const emailConflict = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);
          if (emailConflict.length > 0) {
            throw new AuthorizationError(
              `Email ${normalizedEmail} is already registered in public.users under user ID ${emailConflict[0].id} (current Auth ID: ${identity.userId}).`,
              409,
              'USER_EMAIL_ID_MISMATCH'
            );
          }
          throw new Error(`Failed to verify or insert public.users row for ${identity.userId}.`);
        }

        anyCreated = true;
      }

      // 2. Idempotent insert into public.scout_profiles
      let profileRow = await tx
        .select({ userId: scoutProfiles.userId, username: scoutProfiles.username })
        .from(scoutProfiles)
        .where(eq(scoutProfiles.userId, identity.userId))
        .limit(1);

      let resolvedUsername = profileRow[0]?.username ?? baseSlug;

      if (profileRow.length === 0) {
        let candidate = baseSlug;
        let suffix = 1;
        while (true) {
          const taken = await tx
            .select({ userId: scoutProfiles.userId })
            .from(scoutProfiles)
            .where(eq(scoutProfiles.username, candidate))
            .limit(1);
          if (taken.length === 0) break;
          candidate = `${baseSlug}_${suffix++}`;
        }

        await tx
          .insert(scoutProfiles)
          .values({
            userId: identity.userId,
            username: candidate,
            displayName: rawDisplayName,
            locationState,
            preferredCategories: [],
            invitationPolicy: 'EVERYONE',
            muteReferrals: false,
            profileVisibility: 'PRIVATE',
          })
          .onConflictDoNothing();

        profileRow = await tx
          .select({ userId: scoutProfiles.userId, username: scoutProfiles.username })
          .from(scoutProfiles)
          .where(eq(scoutProfiles.userId, identity.userId))
          .limit(1);

        if (profileRow.length === 0) {
          const fallbackUsername = `${baseSlug}_${identity.userId.replace(/-/g, '').slice(0, 8)}`;
          await tx
            .insert(scoutProfiles)
            .values({
              userId: identity.userId,
              username: fallbackUsername,
              displayName: rawDisplayName,
              locationState,
              preferredCategories: [],
              invitationPolicy: 'EVERYONE',
              muteReferrals: false,
              profileVisibility: 'PRIVATE',
            })
            .onConflictDoNothing();

          profileRow = await tx
            .select({ userId: scoutProfiles.userId, username: scoutProfiles.username })
            .from(scoutProfiles)
            .where(eq(scoutProfiles.userId, identity.userId))
            .limit(1);
        }

        resolvedUsername = profileRow[0]?.username ?? candidate;
        anyCreated = true;
      }

      // 3. Idempotent insert into public.referral_ancestry (permanent)
      const ancestryRow = await tx
        .select({ scoutUserId: referralAncestry.scoutUserId })
        .from(referralAncestry)
        .where(eq(referralAncestry.scoutUserId, identity.userId))
        .limit(1);

      let directReferrerId: string | null = null;
      let attributionSource: 'REFERRAL_CARD' | 'REFERRAL_LINK' | 'ORGANIC' = 'ORGANIC';
      let resolvedEventId: string | null = null;

      if (ancestryRow.length === 0) {
        if (isUuid(input?.referralEventId)) {
          const evRows = await tx
            .select()
            .from(productReferralEvents)
            .where(eq(productReferralEvents.id, input!.referralEventId!))
            .limit(1);
          const ev = evRows[0];
          if (ev && ev.senderScoutId !== identity.userId) {
            directReferrerId = ev.senderScoutId;
            attributionSource = 'REFERRAL_CARD';
            resolvedEventId = ev.id;
          }
        }

        if (!directReferrerId && input?.referralScoutUsername?.trim()) {
          const refSlug = input.referralScoutUsername.trim().toLowerCase();
          const refRows = await tx
            .select({ userId: scoutProfiles.userId })
            .from(scoutProfiles)
            .where(eq(scoutProfiles.username, refSlug))
            .limit(1);
          if (refRows[0] && refRows[0].userId !== identity.userId) {
            directReferrerId = refRows[0].userId;
            attributionSource = 'REFERRAL_LINK';
          }
        }

        await tx
          .insert(referralAncestry)
          .values({
            scoutUserId: identity.userId,
            directReferrerId,
            attributionSource,
            referralEventId: resolvedEventId,
          })
          .onConflictDoNothing();

        anyCreated = true;
      }

      // 4. Idempotent initial CONTACT verification (verified via Supabase Auth)
      const existingContactVerif = await tx
        .select({ id: verificationRecords.id })
        .from(verificationRecords)
        .where(
          and(
            eq(verificationRecords.userId, identity.userId),
            eq(verificationRecords.category, 'CONTACT')
          )
        )
        .limit(1);

      if (existingContactVerif.length === 0) {
        await tx
          .insert(verificationRecords)
          .values({
            userId: identity.userId,
            category: 'CONTACT',
            status: 'VERIFIED',
            evidencePaths: [],
            reviewerNotes: 'Verified via Supabase Auth',
            submittedAt: new Date(),
            reviewedAt: new Date(),
          })
          .onConflictDoNothing();
      }

      // 5. Audit log entry in public.audit_logs (if newly provisioned or missing)
      if (anyCreated) {
        await tx
          .insert(auditLogs)
          .values({
            actorId: identity.userId,
            affectedUserId: identity.userId,
            action: 'USER_PROVISIONED',
            entityType: 'users',
            entityId: identity.userId,
            newValue: {
              email: normalizedEmail,
              username: resolvedUsername,
              attributionSource,
              directReferrerId,
              referralEventId: resolvedEventId,
            },
            reason: 'Atomic Scout identity provisioned via Supabase Auth',
          })
          .onConflictDoNothing();

        // 6. Welcome notification
        await tx
          .insert(notifications)
          .values({
            userId: identity.userId,
            category: 'TRUST',
            title: 'Free Scout Account Provisioned',
            body: directReferrerId
              ? `Your permanent referral ancestry (${attributionSource}) is locked. You can refer products or activate Seller capabilities anytime.`
              : 'Welcome to NairaScout. Browse the marketplace, connect on Scouts List, or activate Seller capabilities anytime.',
            actionUrl: '/',
            isRead: false,
          })
          .onConflictDoNothing();
      }

      return anyCreated;
    });

    return { createdNew: created, userId: identity.userId, accountStatus: initialStatus };
  } catch (err) {
    const formatted = formatPostgresError(err);
    console.error('[ensureUserProvisionedInDb] Transaction failed:', formatted, err);
    throw err;
  }
}

// ============================================================================
// SNAPSHOT BUILDER (100% POSTGRESQL VIA DRIZZLE ORM)
// ============================================================================

export async function getNigerianStates(): Promise<NigerianStateDTO[]> {
  const db = getDb();
  if (!db) {
    return NIGERIAN_STATES_SEED.map((s) => ({ ...s }));
  }
  await ensureTablesReady(db);
  const rows = await db
    .select()
    .from(nigerianStates)
    .orderBy(asc(nigerianStates.name));

  if (rows.length === 0) {
    return NIGERIAN_STATES_SEED.map((s) => ({ ...s }));
  }
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    geoZone: r.geoZone,
  }));
}

export async function getListingCategories(options?: {
  includeInactive?: boolean;
}): Promise<ListingCategoryDTO[]> {
  const includeInactive = options?.includeInactive === true;
  const db = getDb();
  if (!db) {
    return DEFAULT_LISTING_CATEGORIES_SEED.map((c, idx) => ({
      id: `default-${idx + 1}`,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      isActive: c.isActive ?? true,
      sortOrder: c.sortOrder,
      createdAt: new Date(0).toISOString(),
    }));
  }
  await ensureTablesReady(db);
  const rows = includeInactive
    ? await db
        .select()
        .from(listingCategories)
        .orderBy(asc(listingCategories.sortOrder), asc(listingCategories.name))
    : await db
        .select()
        .from(listingCategories)
        .where(eq(listingCategories.isActive, true))
        .orderBy(asc(listingCategories.sortOrder), asc(listingCategories.name));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function checkUsernameAvailability(rawUsername: string): Promise<{
  available: boolean;
  normalized: string;
  reason?: string;
}> {
  const trimmed = rawUsername.trim().toLowerCase();
  if (!trimmed) {
    return { available: false, normalized: '', reason: 'Enter a username.' };
  }
  if (!/^[a-z0-9_]{3,24}$/.test(trimmed)) {
    return {
      available: false,
      normalized: trimmed,
      reason: 'Use 3–24 lowercase letters, numbers, or underscores.',
    };
  }
  const db = getDb();
  if (!db) {
    return { available: true, normalized: trimmed };
  }
  const existing = await db
    .select({ userId: scoutProfiles.userId })
    .from(scoutProfiles)
    .where(eq(scoutProfiles.username, trimmed))
    .limit(1);

  if (existing.length > 0) {
    return { available: false, normalized: trimmed, reason: 'This username is already taken.' };
  }
  return { available: true, normalized: trimmed };
}

export async function getNairaScoutSnapshot(
  viewerUserId: string | null,
  referralEventQuery?: string | null
): Promise<NairaScoutSnapshot> {
  const dbConfigured = isPostgresConfigured();
  const supabaseConfigured = isSupabaseConfigured();

  const db = getDb();
  if (!db) {
    return {
      authenticated: false,
      dbConfigured,
      supabaseConfigured,
      activeScout: null,
      products: [],
      sellerListings: [],
      scoutsList: [],
      invitations: [],
      blockedUsers: [],
      referralsInbox: [],
      sentReferrals: [],
      orders: [],
      ledgerEntries: [],
      wallet: emptyWallet(),
      upstreamAncestry: [],
      downstreamGenerations: emptyDownstreamStats(),
      sellerStats: {
        activeListingsCount: 0,
        draftListingsCount: 0,
        monthlyPublicationsUsed: 0,
        directOrdersCount: 0,
        referralOrdersCount: 0,
        eligibleMerchandiseKobo: 0,
        marketplaceCommissionKobo: 0,
        referralPoolGeneratedKobo: 0,
        netSellerProceedsKobo: 0,
      },
      notifications: [],
      supportCases: [],
      allScoutsDirectory: [],
      states: NIGERIAN_STATES_SEED.map((s) => ({ ...s })),
      categories: DEFAULT_LISTING_CATEGORIES_SEED.map((c, idx) => ({
        id: `default-${idx + 1}`,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        isActive: true,
        sortOrder: c.sortOrder,
        createdAt: new Date(0).toISOString(),
      })),
      platformPolicies: DEFAULT_PLATFORM_POLICIES_SEED.map((p, idx) => ({
        id: `seed-policy-${idx + 1}`,
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        contentMarkdown: p.contentMarkdown,
        version: p.version,
        effectiveDate: p.effectiveDate,
        isPublished: p.isPublished,
        updatedBy: null,
        updatedAt: p.effectiveDate,
      })),
    };
  }

  await ensureTablesReady(db);

  const [statesList, activeCategoriesList, publishedPoliciesList] = await Promise.all([
    getNigerianStates(),
    getListingCategories({ includeInactive: false }),
    getPublishedPlatformPolicies(),
  ]);

  const allSellers = await db.select().from(sellerProfiles);
  const sellerById = new Map(allSellers.map((s) => [s.id, s]));
  const allVerifs = await db.select().from(verificationRecords);

  const getSellerFlags = (sellerProfileId: string) => {
    const sp = sellerById.get(sellerProfileId);
    const sellerVerif = allVerifs.find(
      (v) => v.sellerProfileId === sellerProfileId && v.category === 'SELLER'
    );
    return {
      sellerLogoUrl: sp?.logoUrl ?? null,
      hasActiveSellerBadge: normalizeSellerStatus(sp?.sellerStatus) === 'ACTIVE',
      isSellerVerified: normalizeVerificationStatus(sellerVerif?.status) === 'VERIFIED',
    };
  };

  const extractProductVariants = (
    specifications: string[] | null | undefined,
    imageUrls: string[]
  ): ProductVariantOption[] => {
    if (!Array.isArray(specifications)) return [];
    for (const rawSpec of specifications) {
      const match = rawSpec.match(
        /^(?:options?|variants?|sizes?|colou?rs?|editions?|styles?)\s*[:\-]\s*(.+)$/i
      );
      if (!match) continue;
      const parts = match[1]
        .split(/[|,/;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        return parts.slice(0, 6).map((label, idx) => ({
          id: `opt-${idx + 1}`,
          label,
          imageUrl: imageUrls[idx] ?? imageUrls[0],
        }));
      }
    }
    return [];
  };

  const [publishedRows, orderCountsRows] = await Promise.all([
    db
      .select()
      .from(productListings)
      .where(eq(productListings.status, 'PUBLISHED'))
      .orderBy(desc(productListings.createdAt)),
    db
      .select({
        productListingId: marketplaceOrders.productListingId,
        quantity: marketplaceOrders.quantity,
        fulfilmentStatus: marketplaceOrders.fulfilmentStatus,
      })
      .from(marketplaceOrders),
  ]);

  const unitsSoldByListingId = new Map<string, number>();
  for (const row of orderCountsRows) {
    if (row.fulfilmentStatus !== 'Refunded') {
      unitsSoldByListingId.set(
        row.productListingId,
        (unitsSoldByListingId.get(row.productListingId) ?? 0) + Number(row.quantity || 0)
      );
    }
  }

  const publishedProducts: ProductListing[] = publishedRows.map((p) => {
    const flags = getSellerFlags(p.sellerProfileId);
    const cleanedImages = sanitizeListingImageUrls(p.imageUrls);
    const resolvedImages = cleanedImages.length > 0 ? cleanedImages : p.imageUrl ? [p.imageUrl] : [];
    const cleanedVideos = sanitizeStoredVideoLinks(p.videoLinks);
    return {
      id: p.id,
      productId: p.productId,
      title: p.title,
      description: p.description,
      category: p.category,
      priceKobo: Number(p.priceKobo),
      deliveryFeeKobo: Number(p.deliveryFeeKobo),
      stock: p.stock,
      sellerScoutId: p.sellerScoutId,
      sellerProfileId: p.sellerProfileId,
      sellerName: p.sellerName,
      sellerCity: p.sellerCity,
      ...flags,
      status: p.status as ProductListing['status'],
      imageSeed: p.imageSeed,
      imageUrl: resolvedImages[0] || p.imageUrl,
      imageUrls: resolvedImages,
      videoLinks: cleanedVideos,
      daysRemaining: p.daysRemaining,
      specifications: p.specifications,
      returnPolicy: p.returnPolicy,
      warranty: p.warranty,
      impressions: p.impressions,
      referralShares: p.referralShares,
      unitsSold: unitsSoldByListingId.get(p.id) ?? 0,
      variants: extractProductVariants(p.specifications, resolvedImages),
    };
  });

  const allScouts = await db.select().from(scoutProfiles);
  const allUsers = await db.select().from(users);
  const scoutByUserId = new Map(allScouts.map((s) => [s.userId, s]));
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  const mapReferralEvent = (r: typeof productReferralEvents.$inferSelect): ProductReferralEvent => {
    const sender = scoutByUserId.get(r.senderScoutId);
    const recipient = scoutByUserId.get(r.recipientScoutId);
    const isExpired = r.status === 'active' && r.expiresAt.getTime() < Date.now();
    return {
      id: r.id,
      productListingId: r.productListingId,
      senderScoutId: r.senderScoutId,
      senderHandle: sender?.username || 'scout',
      senderDisplayName: sender?.displayName || 'Scout',
      recipientScoutId: r.recipientScoutId,
      recipientHandle: recipient?.username || 'scout',
      recipientDisplayName: recipient?.displayName || 'Scout',
      note: r.note,
      ancestryPathSignature: r.ancestryPathSignature,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      status: (isExpired ? 'expired' : r.status) as ProductReferralEvent['status'],
    };
  };

  if (!viewerUserId) {
    let guestRefInbox: ProductReferralEvent[] = [];
    if (isUuid(referralEventQuery)) {
      const rows = await db
        .select()
        .from(productReferralEvents)
        .where(eq(productReferralEvents.id, referralEventQuery))
        .limit(1);
      guestRefInbox = rows.map(mapReferralEvent);
    }

    return {
      authenticated: false,
      dbConfigured,
      supabaseConfigured,
      activeScout: null,
      products: publishedProducts,
      sellerListings: [],
      scoutsList: [],
      invitations: [],
      blockedUsers: [],
      referralsInbox: guestRefInbox,
      sentReferrals: [],
      orders: [],
      ledgerEntries: [],
      wallet: emptyWallet(),
      upstreamAncestry: [],
      downstreamGenerations: emptyDownstreamStats(),
      sellerStats: {
        activeListingsCount: 0,
        draftListingsCount: 0,
        monthlyPublicationsUsed: 0,
        directOrdersCount: 0,
        referralOrdersCount: 0,
        eligibleMerchandiseKobo: 0,
        marketplaceCommissionKobo: 0,
        referralPoolGeneratedKobo: 0,
        netSellerProceedsKobo: 0,
      },
      notifications: [],
      supportCases: [],
      allScoutsDirectory: [],
      states: statesList,
      categories: activeCategoriesList,
      platformPolicies: publishedPoliciesList,
    };
  }

  const viewerUser = userById.get(viewerUserId);
  const viewerScout = scoutByUserId.get(viewerUserId);
  const authCtx = await loadDbAuthContext(viewerUserId);

  if (
    !viewerUser ||
    !viewerScout ||
    !authCtx ||
    authCtx.accountStatus === 'CLOSED' ||
    authCtx.accountStatus === 'CLOSURE_PENDING'
  ) {
    return getNairaScoutSnapshot(null, referralEventQuery);
  }

  const myVerifs = allVerifs
    .filter((v) => v.userId === viewerUserId)
    .map((v) => ({
      id: v.id,
      userId: v.userId,
      sellerProfileId: v.sellerProfileId,
      category: v.category as VerificationCategory,
      status: normalizeVerificationStatus(v.status),
      evidencePaths: v.evidencePaths,
      reviewerNotes: v.reviewerNotes,
      reviewedBy: v.reviewedBy,
      submittedAt: v.submittedAt?.toISOString() ?? null,
      reviewedAt: v.reviewedAt?.toISOString() ?? null,
    }));

  const sellerProfileRow = authCtx.seller ? sellerById.get(authCtx.seller.sellerProfileId) ?? null : null;
  const sellerProfile: SellerProfileRecord | null = sellerProfileRow
    ? {
        id: sellerProfileRow.id,
        ownerUserId: sellerProfileRow.ownerUserId,
        sellerType: sellerProfileRow.sellerType,
        sellerName: sellerProfileRow.sellerName,
        logoUrl: sellerProfileRow.logoUrl ?? null,
        description: sellerProfileRow.description,
        businessCategory: sellerProfileRow.businessCategory,
        businessRegNumber: sellerProfileRow.businessRegNumber,
        businessAddress: sellerProfileRow.businessAddress,
        businessContactEmail: sellerProfileRow.businessContactEmail,
        businessContactPhone: sellerProfileRow.businessContactPhone,
        sellerStatus: normalizeSellerStatus(sellerProfileRow.sellerStatus),
        subscriptionPlan: sellerProfileRow.subscriptionPlan as SubscriptionPlan,
        subscriptionStatus: normalizeSubscriptionStatus(sellerProfileRow.subscriptionStatus),
        termsAcceptedAt: sellerProfileRow.termsAcceptedAt.toISOString(),
        createdAt: sellerProfileRow.createdAt.toISOString(),
      }
    : null;

  const sellerListingRows = sellerProfile
    ? await db
        .select()
        .from(productListings)
        .where(eq(productListings.sellerProfileId, sellerProfile.id))
        .orderBy(desc(productListings.createdAt))
    : [];

  const sellerListings: ProductListing[] = sellerListingRows.map((p) => {
    const cleanedImages = sanitizeListingImageUrls(p.imageUrls);
    const resolvedImages = cleanedImages.length > 0 ? cleanedImages : p.imageUrl ? [p.imageUrl] : [];
    const cleanedVideos = sanitizeStoredVideoLinks(p.videoLinks);
    return {
      id: p.id,
      productId: p.productId,
      title: p.title,
      description: p.description,
      category: p.category,
      priceKobo: Number(p.priceKobo),
      deliveryFeeKobo: Number(p.deliveryFeeKobo),
      stock: p.stock,
      sellerScoutId: p.sellerScoutId,
      sellerProfileId: p.sellerProfileId,
      sellerName: p.sellerName,
      sellerCity: p.sellerCity,
      ...getSellerFlags(p.sellerProfileId),
      status: p.status as ProductListing['status'],
      imageSeed: p.imageSeed,
      imageUrl: resolvedImages[0] || p.imageUrl,
      imageUrls: resolvedImages,
      videoLinks: cleanedVideos,
      daysRemaining: p.daysRemaining,
      specifications: p.specifications,
      returnPolicy: p.returnPolicy,
      warranty: p.warranty,
      impressions: p.impressions,
      referralShares: p.referralShares,
      unitsSold: unitsSoldByListingId.get(p.id) ?? 0,
      variants: extractProductVariants(p.specifications, resolvedImages),
    };
  });

  const teamRows = sellerProfile
    ? await db
        .select()
        .from(sellerTeamMembers)
        .where(eq(sellerTeamMembers.sellerProfileId, sellerProfile.id))
    : [];

  const teamMembers = teamRows
    .filter((m) => m.status !== 'REVOKED')
    .map((m) => ({
      id: m.id,
      sellerProfileId: m.sellerProfileId,
      userId: m.userId,
      role: normalizeTeamRole(m.role),
      permissions: m.permissions,
      status: m.status,
      invitedBy: m.invitedBy,
      createdAt: m.createdAt.toISOString(),
      revokedAt: m.revokedAt?.toISOString() ?? null,
      username: scoutByUserId.get(m.userId)?.username || 'member',
      displayName: scoutByUserId.get(m.userId)?.displayName || 'Team Member',
      email: userById.get(m.userId)?.email || '',
    }));

  const kycVerified = myVerifs.some((v) => v.category === 'IDENTITY' && v.status === 'VERIFIED');
  const bankVerified = myVerifs.some((v) => v.category === 'PAYOUT_BANK' && v.status === 'VERIFIED');
  const payoutBankRec = myVerifs.find((v) => v.category === 'PAYOUT_BANK');

  let myAppeals: GovernanceAppealDTO[] = [];
  try {
    const appealRows = await db
      .select()
      .from(governanceAppeals)
      .where(eq(governanceAppeals.appellantUserId, viewerUserId))
      .orderBy(desc(governanceAppeals.createdAt));
    myAppeals = appealRows.map((a) => ({
      id: a.id,
      appellantUserId: a.appellantUserId,
      appellantHandle: viewerScout.username,
      targetType: a.targetType as AppealTargetType,
      targetRecordId: a.targetRecordId,
      originalReviewerId: a.originalReviewerId,
      originalReviewerHandle: a.originalReviewerId
        ? scoutByUserId.get(a.originalReviewerId)?.username || 'officer'
        : null,
      appealReason: a.appealReason,
      evidencePaths: a.evidencePaths,
      status: a.status as GovernanceAppealDTO['status'],
      appealsOfficerId: a.appealsOfficerId,
      appealsOfficerHandle: a.appealsOfficerId
        ? scoutByUserId.get(a.appealsOfficerId)?.username || 'appeals_officer'
        : null,
      decisionNotes: a.decisionNotes,
      createdAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    }));
  } catch {
    myAppeals = [];
  }

  const viewerWallet = await computeWalletFromDb(
    db,
    viewerUserId,
    allVerifs.filter((v) => v.userId === viewerUserId)
  );

  // Quick obligation pre-check (orders queried cleanly below as well)
  const viewerOrdersForAssessment = await db
    .select()
    .from(marketplaceOrders)
    .where(
      or(
        eq(marketplaceOrders.buyerScoutId, viewerUserId),
        eq(marketplaceOrders.sellerScoutId, viewerUserId)
      )
    );
  const openBuyerOrdersCount = viewerOrdersForAssessment.filter(
    (o) =>
      o.buyerScoutId === viewerUserId &&
      o.fulfilmentStatus !== 'Delivered' &&
      o.fulfilmentStatus !== 'Refunded'
  ).length;
  const openSellerOrdersCount = viewerOrdersForAssessment.filter(
    (o) =>
      o.sellerScoutId === viewerUserId &&
      o.fulfilmentStatus !== 'Delivered' &&
      o.fulfilmentStatus !== 'Refunded'
  ).length;
  const disputedOrdersCount = viewerOrdersForAssessment.filter(
    (o) => o.fulfilmentStatus === 'Disputed'
  ).length;
  const activePublishedCount = sellerListings.filter((l) => l.status === 'PUBLISHED').length;

  let closureBlockingReason: string | null = null;
  if (disputedOrdersCount > 0) {
    closureBlockingReason = `${disputedOrdersCount} disputed order(s) must reach resolution before closing your full account.`;
  } else if (openSellerOrdersCount > 0) {
    closureBlockingReason = `${openSellerOrdersCount} open Seller order(s) must be delivered or refunded before full account closure.`;
  }

  const activeScout: ActiveScoutDTO = {
    id: viewerUser.id,
    email: viewerUser.email,
    handle: viewerScout.username,
    displayName: viewerScout.displayName,
    avatarUrl: viewerScout.avatarUrl ?? null,
    bio: viewerScout.bio,
    city: viewerScout.locationState || 'Lagos',
    locationLga: viewerScout.locationLga ?? null,
    accountCreatedAt: viewerUser.createdAt.toISOString(),
    preferredCategories: viewerScout.preferredCategories,
    accountStatus: normalizeAccountStatus(viewerUser.accountStatus),
    restrictionReason: viewerUser.restrictionReason,
    termsAcceptedAt: viewerUser.termsAcceptedAt?.toISOString() ?? null,
    privacyAcknowledgedAt: viewerUser.privacyAcknowledgedAt?.toISOString() ?? null,
    emailVerifiedAt: viewerUser.emailVerifiedAt?.toISOString() ?? null,
    lastReauthenticatedAt: viewerUser.lastReauthenticatedAt?.toISOString() ?? null,
    withdrawalCooldownUntil: viewerUser.withdrawalCooldownUntil?.toISOString() ?? null,
    mfaEnabled: Boolean(viewerUser.mfaEnabled),
    invitePolicy: viewerScout.invitationPolicy as InvitationPolicy,
    muteReferrals: viewerScout.muteReferrals,
    profileVisibility:
      viewerScout.profileVisibility === 'PUBLIC'
        ? 'PUBLIC'
        : viewerScout.profileVisibility === 'NETWORK_ONLY'
          ? 'NETWORK_ONLY'
          : 'PRIVATE',
    kycVerified,
    bankVerified,
    bankSummary: payoutBankRec?.reviewerNotes || (bankVerified ? 'Verified Naira Account' : 'Not submitted'),
    isSeller: Boolean(sellerProfile),
    sellerProfile,
    sellerVerificationStatus: authCtx.seller?.sellerVerificationStatus ?? 'NOT_STARTED',
    verifications: myVerifs,
    teamMembers,
    adminRole: authCtx.adminRole ?? null,
    sellerPlan: sellerProfile ? planEnumToId(sellerProfile.subscriptionPlan) : 'starter',
    activeRestrictions: authCtx.activeRestrictions,
    governanceAppeals: myAppeals,
    closureAssessment: {
      openBuyerOrdersCount,
      openSellerOrdersCount,
      disputedOrdersCount,
      activeListingsCount: activePublishedCount,
      pendingWalletKobo: viewerWallet.pendingKobo,
      availableWalletKobo: viewerWallet.availableKobo,
      canCloseFullAccount: closureBlockingReason === null,
      blockingReason: closureBlockingReason,
    },
  };

  // Blocks
  const blockRows = await db
    .select()
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, viewerUserId), eq(userBlocks.blockedId, viewerUserId)));

  const blockedSet = new Set<string>();
  const myBlocks = [];
  for (const b of blockRows) {
    if (b.blockerId === viewerUserId) {
      blockedSet.add(b.blockedId);
      const bs = scoutByUserId.get(b.blockedId);
      myBlocks.push({
        userId: b.blockedId,
        username: bs?.username || 'user',
        displayName: bs?.displayName || 'Blocked User',
        createdAt: b.createdAt.toISOString(),
      });
    } else {
      blockedSet.add(b.blockerId);
    }
  }

  // Contacts
  const contactRows = await db
    .select()
    .from(scoutsListContacts)
    .where(eq(scoutsListContacts.ownerUserId, viewerUserId))
    .orderBy(desc(scoutsListContacts.createdAt));

  const myContacts: ScoutsListContact[] = contactRows.map((c) => {
    const cs = scoutByUserId.get(c.contactUserId);
    const seller = allSellers.find((sp) => sp.ownerUserId === c.contactUserId);
    const flags = seller
      ? getSellerFlags(seller.id)
      : { hasActiveSellerBadge: false, isSellerVerified: false };
    return {
      contactId: c.id,
      ownerUserId: c.ownerUserId,
      scoutId: c.contactUserId,
      handle: cs?.username || 'scout',
      displayName: cs?.displayName || 'Scout',
      avatarUrl: cs?.avatarUrl ?? null,
      city: cs?.locationState || 'Nigeria',
      addedAt: c.createdAt.toISOString().slice(0, 10),
      blocked: blockedSet.has(c.contactUserId),
      ...flags,
    };
  });

  // Invitations
  const inviteRows = await db
    .select()
    .from(scoutsListInvitations)
    .where(
      or(
        eq(scoutsListInvitations.senderId, viewerUserId),
        eq(scoutsListInvitations.recipientId, viewerUserId)
      )
    )
    .orderBy(desc(scoutsListInvitations.createdAt));

  const myInvitations: ScoutsListInvitation[] = inviteRows.map((i) => {
    const isIncoming = i.recipientId === viewerUserId;
    const otherId = isIncoming ? i.senderId : i.recipientId;
    const os = scoutByUserId.get(otherId);
    const expired = i.status === 'PENDING' && i.expiresAt.getTime() < Date.now();
    return {
      id: i.id,
      senderId: i.senderId,
      recipientId: i.recipientId,
      direction: isIncoming ? 'incoming' : 'outgoing',
      otherScoutId: otherId,
      otherHandle: os?.username || 'scout',
      otherDisplayName: os?.displayName || 'Scout',
      otherAvatarUrl: os?.avatarUrl ?? null,
      otherCity: os?.locationState || 'Nigeria',
      status: (expired ? 'expired' : i.status.toLowerCase()) as ScoutsListInvitation['status'],
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString().slice(0, 10),
    };
  });

  // Referral Events
  const refRows = await db
    .select()
    .from(productReferralEvents)
    .orderBy(desc(productReferralEvents.createdAt));

  const referralsInbox = refRows
    .filter(
      (r) =>
        (r.recipientScoutId === viewerUserId || r.id === referralEventQuery) &&
        !blockedSet.has(r.senderScoutId)
    )
    .map(mapReferralEvent);

  const sentReferrals = refRows
    .filter((r) => r.senderScoutId === viewerUserId)
    .map(mapReferralEvent);

  // Orders & Ledger
  const allOrders = await db
    .select()
    .from(marketplaceOrders)
    .orderBy(desc(marketplaceOrders.createdAt));

  const visibleOrders: MarketplaceOrder[] = allOrders
    .filter(
      (o) =>
        o.buyerScoutId === viewerUserId ||
        o.sellerScoutId === viewerUserId ||
        o.commissionSnapshot.allocations.some((a) => a.scoutId === viewerUserId)
    )
    .map((o) => ({
      id: o.id,
      buyerScoutId: o.buyerScoutId,
      buyerDisplayName: o.buyerDisplayName,
      productListingId: o.productListingId,
      productTitle: o.productTitle,
      sellerScoutId: o.sellerScoutId,
      sellerName: o.sellerName,
      quantity: o.quantity,
      eligibleMerchandiseKobo: Number(o.eligibleMerchandiseKobo),
      deliveryFeeKobo: Number(o.deliveryFeeKobo),
      totalChargedKobo: Number(o.totalChargedKobo),
      attributionType: o.attributionType as 'direct' | 'referral_card',
      referralEventId: o.referralEventId,
      fulfilmentStatus: o.fulfilmentStatus as OrderFulfilmentStatus,
      fulfilmentDeadline: o.fulfilmentDeadline.toISOString().slice(0, 10),
      createdAt: o.createdAt.toISOString().slice(0, 10),
      commissionSnapshot: o.commissionSnapshot,
    }));

  const ledgerRows = await db
    .select()
    .from(commissionLedgerEntries)
    .where(eq(commissionLedgerEntries.beneficiaryScoutId, viewerUserId))
    .orderBy(desc(commissionLedgerEntries.createdAt));

  const ledgerEntries: LedgerEntry[] = ledgerRows.map((l) => ({
    id: l.id,
    reference: l.reference,
    orderId: l.orderId,
    referralEventId: l.referralEventId,
    beneficiaryScoutId: l.beneficiaryScoutId,
    generation: l.generation,
    fractionLabel: l.fractionLabel,
    amountKobo: Number(l.amountKobo),
    status: l.status as LedgerEntryStatus,
    ruleVersion: l.ruleVersion,
    description: l.description,
    createdAt: l.createdAt.toISOString().slice(0, 10),
    linkedToReference: l.linkedToReference ?? undefined,
  }));

  const sellerOrders = allOrders.filter(
    (o) => o.sellerScoutId === viewerUserId && o.fulfilmentStatus !== 'Refunded'
  );
  const eligibleMerchandiseKobo = sellerOrders.reduce(
    (sum, o) => sum + Number(o.eligibleMerchandiseKobo),
    0
  );
  const marketplaceCommissionKobo = sellerOrders.reduce(
    (sum, o) => sum + o.commissionSnapshot.marketplaceCommissionKobo,
    0
  );
  const referralPoolGeneratedKobo = sellerOrders.reduce(
    (sum, o) => sum + o.commissionSnapshot.referralPoolKobo,
    0
  );

  // Sanitized Directory Search (PostgreSQL only; Private-by-Default NS-SCT-015)
  const allContactsRows = await db.select().from(scoutsListContacts);
  const myContactIds = new Set(myContacts.map((c) => c.scoutId));
  const allScoutsDirectory: PublicScoutProfileDTO[] = allScouts
    .filter((s) => {
      if (s.userId === viewerUserId) return false;
      const u = userById.get(s.userId);
      if (!u || u.accountStatus === 'CLOSED' || u.accountStatus === 'SUSPENDED') return false;
      if (blockedSet.has(s.userId)) return false;
      return true;
    })
    .map((s) => {
      const seller = allSellers.find((sp) => sp.ownerUserId === s.userId);
      const sellerVerif = seller
        ? allVerifs.find((v) => v.sellerProfileId === seller.id && v.category === 'SELLER')
        : undefined;
      const workingWithCount = allContactsRows.filter(
        (c) => c.ownerUserId === s.userId || c.contactUserId === s.userId
      ).length;
      const totalSoldUnits = allOrders
        .filter((o) => o.sellerScoutId === s.userId && o.fulfilmentStatus !== 'Refunded')
        .reduce((sum, o) => sum + o.quantity, 0);

      return toPublicScoutProfileDTO({
        userId: s.userId,
        username: s.username,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        bio: s.bio,
        locationState: s.locationState,
        locationLga: s.locationLga ?? null,
        preferredCategories: s.preferredCategories,
        profileVisibility: s.profileVisibility,
        isViewerContact: myContactIds.has(s.userId),
        sellerStatus: seller ? normalizeSellerStatus(seller.sellerStatus) : null,
        sellerVerificationStatus: sellerVerif
          ? normalizeVerificationStatus(sellerVerif.status)
          : null,
        workingWithCount,
        totalSoldUnits,
      });
    });

  const notifRows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, viewerUserId))
    .orderBy(desc(notifications.createdAt));

  const supportRows = await db
    .select()
    .from(supportCases)
    .where(eq(supportCases.userId, viewerUserId))
    .orderBy(desc(supportCases.createdAt));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyPublicationsUsed = sellerListingRows.filter(
    (l) => l.publishedAt && l.publishedAt >= monthStart
  ).length;

  return {
    authenticated: true,
    dbConfigured,
    supabaseConfigured,
    activeScout,
    products: publishedProducts,
    sellerListings,
    scoutsList: myContacts,
    invitations: myInvitations,
    blockedUsers: myBlocks,
    referralsInbox,
    sentReferrals,
    orders: visibleOrders,
    ledgerEntries,
    wallet: viewerWallet,
    upstreamAncestry: await buildAncestryChainFromDb(db, viewerUserId),
    downstreamGenerations: await computeDownstreamFromDb(db, viewerUserId),
    sellerStats: {
      activeListingsCount: sellerListings.filter((l) => l.status === 'PUBLISHED').length,
      draftListingsCount: sellerListings.filter((l) => l.status === 'DRAFT').length,
      monthlyPublicationsUsed,
      directOrdersCount: sellerOrders.filter((o) => o.attributionType === 'direct').length,
      referralOrdersCount: sellerOrders.filter((o) => o.attributionType === 'referral_card').length,
      eligibleMerchandiseKobo,
      marketplaceCommissionKobo,
      referralPoolGeneratedKobo,
      netSellerProceedsKobo: eligibleMerchandiseKobo - marketplaceCommissionKobo,
    },
    notifications: notifRows.map((n) => ({
      id: n.id,
      userId: n.userId,
      category: n.category,
      title: n.title,
      body: n.body,
      actionUrl: n.actionUrl ?? null,
      createdAt: n.createdAt.toISOString(),
      isRead: n.isRead,
      read: n.isRead,
      readAt: n.readAt?.toISOString() ?? null,
    })),
    supportCases: supportRows.map((c) => ({
      id: c.id,
      userId: c.userId,
      topic: c.topic as SupportCase['topic'],
      subject: c.subject,
      details: c.details,
      status: c.status as SupportCase['status'],
      createdAt: c.createdAt.toISOString(),
    })),
    allScoutsDirectory,
    states: statesList,
    categories: activeCategoriesList,
    platformPolicies: publishedPoliciesList,
  };
}

// ============================================================================
// SERVER-ENFORCED TRANSACTIONAL ACTIONS (100% DRIZZLE POSTGRESQL)
// ============================================================================

// NS-COM-001 & NS-ORD-001: Order checkout with integer kobo 13-generation ledger attribution & 10-day SLA
export async function createOrderFromCheckout(
  actorUserId: string,
  input: {
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
  }
): Promise<MarketplaceOrder> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);
  assertCapabilityNotRestricted(ctx, 'INITIATE_PURCHASE');

  const buyerRows = await db
    .select()
    .from(scoutProfiles)
    .where(eq(scoutProfiles.userId, actorUserId))
    .limit(1);
  const buyerScout = buyerRows[0];
  if (!buyerScout) {
    throw new AuthorizationError('Scout profile not provisioned.', 400, 'SCOUT_NOT_FOUND');
  }

  return db.transaction(async (tx) => {
    const listingRows = await tx
      .select()
      .from(productListings)
      .where(
        and(
          eq(productListings.id, input.productListingId),
          eq(productListings.status, 'PUBLISHED')
        )
      )
      .limit(1);
    const product = listingRows[0];
    if (!product) {
      throw new AuthorizationError('Published product listing not found.', 404, 'LISTING_NOT_FOUND');
    }

    const qty = Math.max(1, Math.min(product.stock, Math.floor(input.quantity || 1)));
    if (product.stock < qty) {
      throw new AuthorizationError('Insufficient product inventory.', 400, 'OUT_OF_STOCK');
    }

    let validReferralEventId: string | null = null;
    if (input.referralEventId) {
      if (!isUuid(input.referralEventId)) {
        throw new AuthorizationError('Invalid referral event identifier.', 400, 'INVALID_REFERRAL_CARD');
      }
      const evRows = await tx
        .select()
        .from(productReferralEvents)
        .where(eq(productReferralEvents.id, input.referralEventId))
        .limit(1);
      const refEvent = evRows[0];
      if (
        !refEvent ||
        refEvent.productListingId !== product.id ||
        refEvent.status === 'expired' ||
        refEvent.expiresAt.getTime() < Date.now()
      ) {
        throw new AuthorizationError(
          'Referral card is invalid or expired for this product.',
          400,
          'INVALID_REFERRAL_CARD'
        );
      }
      validReferralEventId = refEvent.id;
      await tx
        .update(productReferralEvents)
        .set({
          status: 'converted',
          deliveredAt: refEvent.deliveredAt ?? refEvent.createdAt,
          openedAt: refEvent.openedAt ?? new Date(),
        })
        .where(eq(productReferralEvents.id, refEvent.id));
    }

    await tx
      .update(productListings)
      .set({ stock: product.stock - qty })
      .where(eq(productListings.id, product.id));

    const eligibleMerchandiseKobo = Number(product.priceKobo) * qty;
    const deliveryFeeKobo = Number(product.deliveryFeeKobo);
    const totalChargedKobo = eligibleMerchandiseKobo + deliveryFeeKobo;
    const isReferral = Boolean(validReferralEventId);

    const sellerAncestry = isReferral
      ? await buildAncestryChainFromDb(db, product.sellerScoutId)
      : [];
    const breakdown = calculateThirteenGenerationCommissions(
      eligibleMerchandiseKobo,
      sellerAncestry,
      isReferral
    );

    const orderId = `ORD-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 89)}`;
    const now = new Date();
    const deadline = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    await tx.insert(marketplaceOrders).values({
      id: orderId,
      buyerScoutId: actorUserId,
      buyerDisplayName: buyerScout.displayName,
      productListingId: product.id,
      productTitle: product.title,
      sellerScoutId: product.sellerScoutId,
      sellerName: product.sellerName,
      quantity: qty,
      eligibleMerchandiseKobo,
      deliveryFeeKobo,
      totalChargedKobo,
      attributionType: isReferral ? 'referral_card' : 'direct',
      referralEventId: validReferralEventId,
      fulfilmentStatus: 'Paid',
      fulfilmentDeadline: deadline,
      commissionSnapshot: breakdown,
    });

    for (const alloc of breakdown.allocations) {
      if (!alloc.eligible || alloc.amountKobo <= 0) continue;
      const refCode = `LED-${orderId}-G${alloc.generation}`;
      await tx.insert(commissionLedgerEntries).values({
        reference: refCode,
        orderId,
        referralEventId: validReferralEventId,
        beneficiaryScoutId: alloc.scoutId,
        generation: alloc.generation,
        fractionLabel: alloc.fractionLabel,
        amountKobo: alloc.amountKobo,
        status: 'Pending',
        ruleVersion: COMMISSION_RULE_VERSION,
        description: `Gen ${alloc.generation} (${alloc.fractionLabel}) pending on ${orderId} (${product.title})`,
      });
    }

    await tx.insert(notifications).values({
      userId: actorUserId,
      category: 'ORDER',
      title: `Order ${orderId} confirmed (${isReferral ? 'Referral-Attributed' : 'Direct'})`,
      body: isReferral
        ? `Referral event preserved. Pending commissions calculated across Seller ancestry (${breakdown.actualAncestryDepth} generations).`
        : 'Direct marketplace checkout completed. No referral commission generated.',
      actionUrl: '/?tab=wallet',
      isRead: false,
    });

    return {
      id: orderId,
      buyerScoutId: actorUserId,
      buyerDisplayName: buyerScout.displayName,
      productListingId: product.id,
      productTitle: product.title,
      sellerScoutId: product.sellerScoutId,
      sellerName: product.sellerName,
      quantity: qty,
      eligibleMerchandiseKobo,
      deliveryFeeKobo,
      totalChargedKobo,
      attributionType: isReferral ? 'referral_card' : 'direct',
      referralEventId: validReferralEventId,
      fulfilmentStatus: 'Paid',
      fulfilmentDeadline: deadline.toISOString().slice(0, 10),
      createdAt: now.toISOString().slice(0, 10),
      commissionSnapshot: breakdown,
    };
  });
}

export async function advanceOrderStatus(
  actorUserId: string,
  input: { orderId: string; nextStatus: OrderFulfilmentStatus }
): Promise<MarketplaceOrder> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertActiveAccount(ctx);

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(marketplaceOrders)
      .where(eq(marketplaceOrders.id, input.orderId))
      .limit(1);
    const order = rows[0];
    if (!order) {
      throw new AuthorizationError('Order not found.', 404, 'ORDER_NOT_FOUND');
    }

    let isOrderSeller = order.sellerScoutId === actorUserId;
    if (!isOrderSeller && ctx.seller && ctx.seller.permissions.canManageOrders) {
      const sellerRows = await tx
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.id, ctx.seller.sellerProfileId))
        .limit(1);
      if (sellerRows[0]?.ownerUserId === order.sellerScoutId) {
        isOrderSeller = true;
      }
    }
    const isOrderBuyer = order.buyerScoutId === actorUserId;

    if (!isOrderSeller && !isOrderBuyer && !ctx.adminRole) {
      throw new AuthorizationError('You are not authorized to update this order.', 403, 'FORBIDDEN');
    }
    if (order.fulfilmentStatus === 'Refunded') {
      throw new AuthorizationError('Refunded orders are terminal.', 400, 'ORDER_TERMINAL');
    }

    await tx
      .update(marketplaceOrders)
      .set({ fulfilmentStatus: input.nextStatus })
      .where(eq(marketplaceOrders.id, order.id));

    let newLedgerStatus: LedgerEntryStatus | null = null;
    let reasonLabel = '';
    if (input.nextStatus === 'Delivered') {
      newLedgerStatus = 'Available';
      reasonLabel = 'Delivery confirmed · commission released to Available';
    } else if (input.nextStatus === 'Disputed') {
      newLedgerStatus = 'On Hold';
      reasonLabel = 'Delivery dispute opened · commission placed On Hold';
    } else if (input.nextStatus === 'Refunded') {
      newLedgerStatus = 'Reversed';
      reasonLabel = 'Order refunded · commission reversed';
    }

    if (newLedgerStatus) {
      const rootEntries = await tx
        .select()
        .from(commissionLedgerEntries)
        .where(eq(commissionLedgerEntries.orderId, order.id));

      for (const root of rootEntries.filter((l) => !l.linkedToReference)) {
        await tx.insert(commissionLedgerEntries).values({
          reference: `${root.reference}-${newLedgerStatus.slice(0, 3).toUpperCase()}`,
          orderId: order.id,
          referralEventId: root.referralEventId,
          beneficiaryScoutId: root.beneficiaryScoutId,
          generation: root.generation,
          fractionLabel: root.fractionLabel,
          amountKobo: Number(root.amountKobo),
          status: newLedgerStatus,
          ruleVersion: COMMISSION_RULE_VERSION,
          description: `${reasonLabel} (${root.reference})`,
          linkedToReference: root.reference,
        });
      }
    }

    return {
      id: order.id,
      buyerScoutId: order.buyerScoutId,
      buyerDisplayName: order.buyerDisplayName,
      productListingId: order.productListingId,
      productTitle: order.productTitle,
      sellerScoutId: order.sellerScoutId,
      sellerName: order.sellerName,
      quantity: order.quantity,
      eligibleMerchandiseKobo: Number(order.eligibleMerchandiseKobo),
      deliveryFeeKobo: Number(order.deliveryFeeKobo),
      totalChargedKobo: Number(order.totalChargedKobo),
      attributionType: order.attributionType as 'direct' | 'referral_card',
      referralEventId: order.referralEventId,
      fulfilmentStatus: input.nextStatus,
      fulfilmentDeadline: order.fulfilmentDeadline.toISOString().slice(0, 10),
      createdAt: order.createdAt.toISOString().slice(0, 10),
      commissionSnapshot: order.commissionSnapshot,
    };
  });
}

// NS-REF-002: Batch product referral creation (1..20 Scouts List recipients, block/mute filtering)
export async function createReferralBatchForActor(
  actorUserId: string,
  input: {
    productListingId: string;
    recipientScoutIds: string[];
    note: string;
  }
): Promise<ProductReferralEvent[]> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanParticipateAsScout(ctx);

  // Enforce 1..20 batch boundary upfront before touching DB
  const requestedIds = assertReferralBatchValid(actorUserId, input.recipientScoutIds);
  for (const rid of requestedIds) {
    if (!isUuid(rid)) {
      throw new AuthorizationError('Recipient Scout not found.', 404, 'RECIPIENT_NOT_FOUND');
    }
  }

  const listingRows = await db
    .select()
    .from(productListings)
    .where(
      and(
        eq(productListings.id, input.productListingId),
        eq(productListings.status, 'PUBLISHED')
      )
    )
    .limit(1);
  const product = listingRows[0];
  if (!product) {
    throw new AuthorizationError('Published product listing not found.', 404, 'LISTING_NOT_FOUND');
  }

  const scoutRows = await db
    .select()
    .from(scoutProfiles)
    .where(inArray(scoutProfiles.userId, [actorUserId, ...requestedIds]));
  const sender = scoutRows.find((s) => s.userId === actorUserId);
  if (!sender) {
    throw new AuthorizationError('Sender Scout profile not found.', 404, 'SENDER_NOT_FOUND');
  }

  const recipientUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, requestedIds));
  const recipientUserMap = new Map(recipientUsers.map((u) => [u.id, u]));
  const recipientScoutMap = new Map(scoutRows.map((s) => [s.userId, s]));

  const blockRows = await db
    .select()
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, sender.userId), eq(userBlocks.blockedId, sender.userId)));
  const blockedPairUserIds = new Set<string>();
  for (const b of blockRows) {
    blockedPairUserIds.add(b.blockerId === sender.userId ? b.blockedId : b.blockerId);
  }

  const mutedRecipientIds = new Set<string>();
  for (const rid of requestedIds) {
    const recUser = recipientUserMap.get(rid);
    const recScout = recipientScoutMap.get(rid);
    if (!recUser || !recScout || recUser.accountStatus === 'CLOSED') {
      if (requestedIds.length === 1) {
        throw new AuthorizationError('Recipient Scout not found.', 404, 'RECIPIENT_NOT_FOUND');
      }
      blockedPairUserIds.add(rid);
    } else if (recScout.muteReferrals) {
      mutedRecipientIds.add(rid);
    }
  }

  const validRecipientIds = assertReferralBatchValid(actorUserId, requestedIds, {
    blockedPairUserIds,
    mutedRecipientIds,
  });

  const allAnc = await db.select().from(referralAncestry);
  const ancestryMap: Record<string, string | null> = {};
  for (const row of allAnc) ancestryMap[row.scoutUserId] = row.directReferrerId;

  const existingListingRefs = await db
    .select()
    .from(productReferralEvents)
    .where(
      and(
        eq(productReferralEvents.productListingId, product.id),
        eq(productReferralEvents.status, 'active')
      )
    );

  const createdEvents: ProductReferralEvent[] = [];
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const noteText = input.note.trim() || `Recommended ${product.title} on NairaScout.`;

  await db.transaction(async (tx) => {
    for (const rid of validRecipientIds) {
      const recipient = recipientScoutMap.get(rid)!;
      const ancestryCheck = validateAncestryRelationship(recipient.userId, sender.userId, ancestryMap);
      const hasReverse = existingListingRefs.some(
        (r) => r.senderScoutId === recipient.userId && r.recipientScoutId === sender.userId
      );
      if (hasReverse && !ancestryCheck.valid) {
        if (validRecipientIds.length === 1) {
          throw new AuthorizationError('Circular product referral path rejected.', 400, 'CIRCULAR_PATH');
        }
        continue;
      }

      const pathSignature = `${sender.username}->${recipient.username}`;
      const dup = existingListingRefs.find((r) => r.ancestryPathSignature === pathSignature);
      if (dup) {
        if (validRecipientIds.length === 1) {
          throw new AuthorizationError(
            `Active referral ${dup.id} already exists for @${recipient.username} on this listing.`,
            409,
            'DUPLICATE_REFERRAL'
          );
        }
        continue;
      }

      const [inserted] = await tx
        .insert(productReferralEvents)
        .values({
          productListingId: product.id,
          senderScoutId: sender.userId,
          recipientScoutId: recipient.userId,
          note: noteText,
          ancestryPathSignature: pathSignature,
          status: 'active',
          expiresAt,
          deliveredAt: new Date(),
        })
        .returning();

      createdEvents.push({
        id: inserted.id,
        productListingId: inserted.productListingId,
        senderScoutId: sender.userId,
        senderHandle: sender.username,
        senderDisplayName: sender.displayName,
        recipientScoutId: recipient.userId,
        recipientHandle: recipient.username,
        recipientDisplayName: recipient.displayName,
        note: inserted.note,
        ancestryPathSignature: inserted.ancestryPathSignature,
        createdAt: inserted.createdAt.toISOString(),
        expiresAt: inserted.expiresAt.toISOString(),
        status: 'active',
      });
    }

    if (createdEvents.length === 0) {
      throw new AuthorizationError(
        'No new referral cards could be created (duplicate active referrals or circular paths).',
        409,
        'DUPLICATE_REFERRAL'
      );
    }

    await tx
      .update(productListings)
      .set({ referralShares: product.referralShares + createdEvents.length })
      .where(eq(productListings.id, product.id));
  });

  return createdEvents;
}

export async function createReferralEventForActor(
  actorUserId: string,
  input: {
    productListingId: string;
    recipientScoutId: string;
    note: string;
  }
): Promise<ProductReferralEvent> {
  const events = await createReferralBatchForActor(actorUserId, {
    productListingId: input.productListingId,
    recipientScoutIds: input.recipientScoutId ? [input.recipientScoutId] : [],
    note: input.note,
  });
  return events[0]!;
}

export async function inviteToScoutsListForActor(
  actorUserId: string,
  targetScoutId: string
): Promise<ScoutsListInvitation> {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanParticipateAsScout(ctx);

  if (!isUuid(targetScoutId)) {
    throw new AuthorizationError('Scout not found.', 404, 'SCOUT_NOT_FOUND');
  }
  if (targetScoutId === actorUserId) {
    throw new AuthorizationError('You cannot invite yourself to your Scouts List.', 400, 'SELF_INVITE');
  }

  const targetUserRows = await db.select().from(users).where(eq(users.id, targetScoutId)).limit(1);
  const targetScoutRows = await db
    .select()
    .from(scoutProfiles)
    .where(eq(scoutProfiles.userId, targetScoutId))
    .limit(1);

  const targetUser = targetUserRows[0];
  const target = targetScoutRows[0];
  if (!targetUser || !target || targetUser.accountStatus === 'CLOSED') {
    throw new AuthorizationError('Scout not found.', 404, 'SCOUT_NOT_FOUND');
  }

  const blockRows = await db
    .select()
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, actorUserId), eq(userBlocks.blockedId, targetScoutId)),
        and(eq(userBlocks.blockerId, targetScoutId), eq(userBlocks.blockedId, actorUserId))
      )
    )
    .limit(1);
  if (blockRows.length > 0) {
    throw new AuthorizationError('Cannot invite a blocked user.', 403, 'USER_BLOCKED');
  }

  if (target.invitationPolicy === 'NOBODY') {
    throw new AuthorizationError(
      `@${target.username} does not accept Scouts List invitations (policy: NOBODY).`,
      403,
      'INVITE_POLICY_NOBODY'
    );
  }
  if (target.invitationPolicy === 'CONTACTS_ONLY') {
    const actorContacts = await db
      .select({ contactUserId: scoutsListContacts.contactUserId })
      .from(scoutsListContacts)
      .where(eq(scoutsListContacts.ownerUserId, actorUserId));
    const targetContacts = await db
      .select({ contactUserId: scoutsListContacts.contactUserId })
      .from(scoutsListContacts)
      .where(eq(scoutsListContacts.ownerUserId, targetScoutId));
    const actorSet = new Set(actorContacts.map((c) => c.contactUserId));
    const sharesMutual = targetContacts.some((c) => actorSet.has(c.contactUserId));
    if (!sharesMutual) {
      throw new AuthorizationError(
        `@${target.username} only accepts invitations from mutual contacts (CONTACTS_ONLY).`,
        403,
        'INVITE_POLICY_CONTACTS_ONLY'
      );
    }
  }

  const existingContact = await db
    .select()
    .from(scoutsListContacts)
    .where(
      and(
        eq(scoutsListContacts.ownerUserId, actorUserId),
        eq(scoutsListContacts.contactUserId, targetScoutId)
      )
    )
    .limit(1);
  if (existingContact.length > 0) {
    throw new AuthorizationError(`@${target.username} is already in your Scouts List.`, 409, 'ALREADY_CONTACT');
  }

  const pendingDup = await db
    .select()
    .from(scoutsListInvitations)
    .where(
      and(
        eq(scoutsListInvitations.status, 'PENDING'),
        or(
          and(
            eq(scoutsListInvitations.senderId, actorUserId),
            eq(scoutsListInvitations.recipientId, targetScoutId)
          ),
          and(
            eq(scoutsListInvitations.senderId, targetScoutId),
            eq(scoutsListInvitations.recipientId, actorUserId)
          )
        )
      )
    )
    .limit(1);
  if (pendingDup.length > 0) {
    throw new AuthorizationError(
      `A pending Scouts List invitation already exists with @${target.username}.`,
      409,
      'DUPLICATE_INVITE'
    );
  }

  const expiresAt = new Date(Date.now() + getExpiryDays() * 24 * 60 * 60 * 1000);
  const [inv] = await db
    .insert(scoutsListInvitations)
    .values({
      senderId: actorUserId,
      recipientId: targetScoutId,
      status: 'PENDING',
      expiresAt,
    })
    .returning();

  return {
    id: inv.id,
    senderId: inv.senderId,
    recipientId: inv.recipientId,
    direction: 'outgoing',
    otherScoutId: target.userId,
    otherHandle: target.username,
    otherDisplayName: target.displayName,
    otherCity: target.locationState || 'Nigeria',
    status: 'pending',
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString().slice(0, 10),
  };
}

export async function respondToInvitationForActor(
  actorUserId: string,
  input: { invitationId: string; decision: 'accept' | 'reject' | 'withdraw' }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanParticipateAsScout(ctx);

  if (!isUuid(input.invitationId)) {
    throw new AuthorizationError('Invitation not found.', 404, 'INVITE_NOT_FOUND');
  }

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(scoutsListInvitations)
      .where(eq(scoutsListInvitations.id, input.invitationId))
      .limit(1);
    const inv = rows[0];
    if (!inv || inv.status !== 'PENDING') {
      throw new AuthorizationError('Pending invitation not found.', 404, 'INVITE_NOT_FOUND');
    }

    if (input.decision === 'withdraw') {
      if (inv.senderId !== actorUserId) {
        throw new AuthorizationError('Only the sender can withdraw an invitation.', 403, 'FORBIDDEN');
      }
      await tx
        .update(scoutsListInvitations)
        .set({ status: 'WITHDRAWN', respondedAt: new Date() })
        .where(eq(scoutsListInvitations.id, inv.id));
      return;
    }

    if (inv.recipientId !== actorUserId) {
      throw new AuthorizationError('Only the recipient can accept or reject an invitation.', 403, 'FORBIDDEN');
    }

    if (input.decision === 'reject') {
      await tx
        .update(scoutsListInvitations)
        .set({ status: 'REJECTED', respondedAt: new Date() })
        .where(eq(scoutsListInvitations.id, inv.id));
      return;
    }

    await tx
      .update(scoutsListInvitations)
      .set({ status: 'ACCEPTED', respondedAt: new Date() })
      .where(eq(scoutsListInvitations.id, inv.id));

    await tx
      .insert(scoutsListContacts)
      .values([
        {
          ownerUserId: inv.senderId,
          contactUserId: inv.recipientId,
          sourceInvitationId: inv.id,
        },
        {
          ownerUserId: inv.recipientId,
          contactUserId: inv.senderId,
          sourceInvitationId: inv.id,
        },
      ])
      .onConflictDoNothing();
  });
}

export async function manageRelationshipForActor(
  actorUserId: string,
  input: {
    contactId?: string;
    targetUserId?: string;
    operation: 'remove' | 'block' | 'unblock';
  }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertActiveAccount(ctx);

  await db.transaction(async (tx) => {
    if (input.operation === 'remove' && isUuid(input.contactId)) {
      await tx
        .delete(scoutsListContacts)
        .where(
          and(
            eq(scoutsListContacts.id, input.contactId),
            eq(scoutsListContacts.ownerUserId, actorUserId)
          )
        );
      return;
    }

    let targetId = input.targetUserId;
    if (!targetId && isUuid(input.contactId)) {
      const cRows = await tx
        .select()
        .from(scoutsListContacts)
        .where(
          and(
            eq(scoutsListContacts.id, input.contactId),
            eq(scoutsListContacts.ownerUserId, actorUserId)
          )
        )
        .limit(1);
      targetId = cRows[0]?.contactUserId;
    }

    if (!isUuid(targetId) || targetId === actorUserId) {
      throw new AuthorizationError('Valid target user is required.', 400, 'INVALID_TARGET');
    }

    if (input.operation === 'block') {
      await tx
        .insert(userBlocks)
        .values({ blockerId: actorUserId, blockedId: targetId })
        .onConflictDoNothing();

      await tx
        .delete(scoutsListContacts)
        .where(
          or(
            and(
              eq(scoutsListContacts.ownerUserId, actorUserId),
              eq(scoutsListContacts.contactUserId, targetId)
            ),
            and(
              eq(scoutsListContacts.ownerUserId, targetId),
              eq(scoutsListContacts.contactUserId, actorUserId)
            )
          )
        );

      await tx
        .update(scoutsListInvitations)
        .set({ status: 'WITHDRAWN', respondedAt: new Date() })
        .where(
          and(
            eq(scoutsListInvitations.status, 'PENDING'),
            or(
              and(
                eq(scoutsListInvitations.senderId, actorUserId),
                eq(scoutsListInvitations.recipientId, targetId)
              ),
              and(
                eq(scoutsListInvitations.senderId, targetId),
                eq(scoutsListInvitations.recipientId, actorUserId)
              )
            )
          )
        );
    } else if (input.operation === 'unblock') {
      await tx
        .delete(userBlocks)
        .where(
          and(
            eq(userBlocks.blockerId, actorUserId),
            eq(userBlocks.blockedId, targetId)
          )
        );
    }
  });
}

export async function reportAbuseForActor(
  actorUserId: string,
  input: {
    reportedUserId: string;
    referralEventId?: string | null;
    reason: string;
    description: string;
  }
): Promise<AbuseReportRecord> {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertActiveAccount(ctx);

  if (!isUuid(input.reportedUserId) || input.reportedUserId === actorUserId) {
    throw new AuthorizationError('Valid reported user ID is required.', 400, 'INVALID_TARGET');
  }

  const [rep] = await db
    .insert(abuseReports)
    .values({
      reporterId: actorUserId,
      reportedUserId: input.reportedUserId,
      referralEventId: isUuid(input.referralEventId) ? input.referralEventId : null,
      reason: input.reason.trim() || 'Abuse report',
      description: input.description.trim(),
      status: 'OPEN',
    })
    .returning();

  const scoutRows = await db
    .select()
    .from(scoutProfiles)
    .where(inArray(scoutProfiles.userId, [actorUserId, input.reportedUserId]));

  return {
    id: rep.id,
    reporterId: rep.reporterId,
    reporterHandle: scoutRows.find((s) => s.userId === actorUserId)?.username || 'user',
    reportedUserId: rep.reportedUserId,
    reportedHandle: scoutRows.find((s) => s.userId === input.reportedUserId)?.username || 'user',
    referralEventId: rep.referralEventId,
    reason: rep.reason,
    description: rep.description,
    status: rep.status,
    resolvedBy: rep.resolvedBy,
    createdAt: rep.createdAt.toISOString(),
    resolvedAt: rep.resolvedAt?.toISOString() ?? null,
  };
}

// ============================================================================
// SELLER ONBOARDING, DRAFTS, VERIFICATION GATE & TEAM MANAGEMENT
// ============================================================================

// NS-SEL-001 & NS-VER-001: Seller capability activation & SELLER verification initiation
export async function activateSellerOnboarding(
  actorUserId: string,
  input: {
    sellerType: 'INDIVIDUAL' | 'BUSINESS';
    sellerName: string;
    logoUrl?: string | null;
    description: string;
    businessCategory: string;
    businessRegNumber?: string;
    businessAddress?: string;
    businessContactEmail?: string;
    businessContactPhone?: string;
    planId: SellerPlanId;
    evidencePaths: string[];
    termsAccepted: boolean;
  }
): Promise<SellerProfileRecord> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  if (!input.termsAccepted) {
    throw new AuthorizationError('You must accept the Seller Terms to proceed.', 400, 'TERMS_REQUIRED');
  }
  if (ctx.seller) {
    throw new AuthorizationError('Seller capabilities are already activated on this account.', 409, 'SELLER_EXISTS');
  }

  const cleanLogoUrl =
    typeof input.logoUrl === 'string' &&
    (input.logoUrl.startsWith('https://') || input.logoUrl.startsWith('http://'))
      ? input.logoUrl.trim()
      : null;

  const cleanPaths =
    input.evidencePaths.length > 0
      ? input.evidencePaths
      : [`verification-docs/${actorUserId}/seller-kyc-${Date.now()}.pdf`];
  const now = new Date();

  return db.transaction(async (tx) => {
    const [seller] = await tx
      .insert(sellerProfiles)
      .values({
        ownerUserId: actorUserId,
        sellerType: input.sellerType,
        sellerName: input.sellerName.trim(),
        logoUrl: cleanLogoUrl,
        description: input.description.trim() || null,
        businessCategory: input.businessCategory,
        businessRegNumber:
          input.sellerType === 'BUSINESS' ? input.businessRegNumber?.trim() || null : null,
        businessAddress: input.businessAddress?.trim() || null,
        businessContactEmail: input.businessContactEmail?.trim() || ctx.email,
        businessContactPhone: input.businessContactPhone?.trim() || null,
        sellerStatus: 'ACTIVATION_PENDING',
        subscriptionPlan: planIdToEnum(input.planId),
        subscriptionStatus: 'ACTIVE',
        termsAcceptedAt: now,
      })
      .returning();

    await tx.insert(sellerTeamMembers).values({
      sellerProfileId: seller.id,
      userId: actorUserId,
      role: 'BUSINESS_OWNER',
      permissions: SELLER_TEAM_ROLE_PERMISSIONS.BUSINESS_OWNER,
      status: 'ACTIVE',
    });

    await tx.insert(verificationRecords).values({
      userId: actorUserId,
      sellerProfileId: seller.id,
      category: 'SELLER',
      status: 'SUBMITTED',
      evidencePaths: cleanPaths,
      submittedAt: now,
    });

    await tx.insert(verificationRecords).values({
      userId: actorUserId,
      category: 'IDENTITY',
      status: 'SUBMITTED',
      evidencePaths: cleanPaths,
      submittedAt: now,
    });

    if (input.sellerType === 'BUSINESS') {
      await tx.insert(verificationRecords).values({
        userId: actorUserId,
        sellerProfileId: seller.id,
        category: 'BUSINESS',
        status: 'SUBMITTED',
        evidencePaths: cleanPaths,
        submittedAt: now,
      });
    }

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'SELLER_ONBOARDING_SUBMITTED',
      entityType: 'seller_profiles',
      entityId: seller.id,
      newValue: {
        sellerType: seller.sellerType,
        sellerStatus: 'ACTIVATION_PENDING',
        subscriptionPlan: seller.subscriptionPlan,
      },
    });

    return {
      id: seller.id,
      ownerUserId: seller.ownerUserId,
      sellerType: seller.sellerType,
      sellerName: seller.sellerName,
      logoUrl: seller.logoUrl ?? null,
      description: seller.description,
      businessCategory: seller.businessCategory,
      businessRegNumber: seller.businessRegNumber,
      businessAddress: seller.businessAddress,
      businessContactEmail: seller.businessContactEmail,
      businessContactPhone: seller.businessContactPhone,
      sellerStatus: normalizeSellerStatus(seller.sellerStatus),
      subscriptionPlan: seller.subscriptionPlan as SubscriptionPlan,
      subscriptionStatus: normalizeSubscriptionStatus(seller.subscriptionStatus),
      termsAcceptedAt: seller.termsAcceptedAt.toISOString(),
      createdAt: seller.createdAt.toISOString(),
    };
  });
}

// NS-SEL-002 & NS-SEL-006: Create Seller draft product listing with multi-image and plan-capped video links
export async function createSellerDraftListing(
  actorUserId: string,
  input: {
    title: string;
    category: string;
    priceNaira: number;
    deliveryFeeNaira: number;
    stock: number;
    description: string;
    imageUrls?: string[];
    videoLinks?: Array<string | { url: string; platform?: string }>;
  }
): Promise<ProductListing> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanManageSellerDrafts(ctx);

  const title = input.title.trim();
  const description = input.description.trim();
  const category = input.category.trim();
  if (!title) {
    throw new AuthorizationError('Product Name is required.', 400, 'TITLE_REQUIRED');
  }
  if (!category) {
    throw new AuthorizationError('Category is required.', 400, 'CATEGORY_REQUIRED');
  }
  if (!description) {
    throw new AuthorizationError('Description is required.', 400, 'DESCRIPTION_REQUIRED');
  }

  const sellerRows = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, ctx!.seller!.sellerProfileId))
    .limit(1);
  const seller = sellerRows[0]!;
  const ownerScoutRows = await db
    .select()
    .from(scoutProfiles)
    .where(eq(scoutProfiles.userId, seller.ownerUserId))
    .limit(1);
  const ownerScout = ownerScoutRows[0];

  const planSpec = SELLER_PLANS[planEnumToId(seller.subscriptionPlan as SubscriptionPlan)];
  const planEntitlements = SELLER_PLAN_ENTITLEMENTS[seller.subscriptionPlan as SubscriptionPlan];

  const rawImageInputs = Array.isArray(input.imageUrls) ? input.imageUrls : [];
  if (rawImageInputs.length > MAX_LISTING_IMAGES) {
    throw new AuthorizationError(
      `A maximum of ${MAX_LISTING_IMAGES} images can be attached to a listing.`,
      400,
      'IMAGE_LIMIT_EXCEEDED'
    );
  }
  const cleanedImages = sanitizeListingImageUrls(rawImageInputs);

  const rawVideoEntries = (Array.isArray(input.videoLinks) ? input.videoLinks : [])
    .map((v) => (typeof v === 'string' ? v.trim() : typeof v?.url === 'string' ? v.url.trim() : ''))
    .filter(Boolean);

  if (rawVideoEntries.length > planEntitlements.maxVideosPerListing) {
    throw new AuthorizationError(
      planEntitlements.maxVideosPerListing === 0
        ? `Your ${planSpec.name} plan does not include product video links. Upgrade to Traction, Growth, or Sprawl to attach videos.`
        : `Your ${planSpec.name} plan allows up to ${planEntitlements.maxVideosPerListing} video link(s) per listing.`,
      403,
      'VIDEO_QUOTA_EXCEEDED'
    );
  }

  const validatedVideos: ListingVideoLink[] = [];
  for (const rawUrl of rawVideoEntries) {
    const parsed = parseAndNormalizeVideoLink(rawUrl);
    if (!parsed) {
      throw new AuthorizationError(
        `Invalid video link "${rawUrl}". Only valid YouTube or TikTok URLs are permitted.`,
        400,
        'INVALID_VIDEO_URL'
      );
    }
    validatedVideos.push(parsed);
  }

  const suffix = `${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;
  const id = `LST-${suffix}`;
  const productId = `PRD-${suffix}`;
  const seed = `nairascout-item-${suffix}`;
  const fallbackImageUrl = `https://picsum.photos/seed/${seed}/800/600`;
  const resolvedImages = cleanedImages.length > 0 ? cleanedImages : [fallbackImageUrl];

  const [inserted] = await db
    .insert(productListings)
    .values({
      id,
      productId,
      title,
      description,
      category,
      priceKobo: Math.round(Math.max(500, input.priceNaira) * 100),
      deliveryFeeKobo: Math.round(Math.max(0, input.deliveryFeeNaira) * 100),
      stock: Math.max(1, Math.round(input.stock)),
      sellerScoutId: seller.ownerUserId,
      sellerProfileId: seller.id,
      sellerName: seller.sellerName,
      sellerCity: ownerScout?.locationState || 'Lagos',
      status: 'DRAFT',
      imageSeed: seed,
      imageUrl: resolvedImages[0],
      imageUrls: resolvedImages,
      videoLinks: validatedVideos,
      daysRemaining: planSpec.listingDurationDays,
      specifications: ['Seller draft listing', '10-day publication duration once published'],
      returnPolicy: 'Standard 7-day NairaScout return terms',
      warranty: 'Seller fulfilment guarantee',
    })
    .returning();

  return {
    id: inserted.id,
    productId: inserted.productId,
    title: inserted.title,
    description: inserted.description,
    category: inserted.category,
    priceKobo: Number(inserted.priceKobo),
    deliveryFeeKobo: Number(inserted.deliveryFeeKobo),
    stock: inserted.stock,
    sellerScoutId: inserted.sellerScoutId,
    sellerProfileId: inserted.sellerProfileId,
    sellerName: inserted.sellerName,
    sellerLogoUrl: seller.logoUrl ?? null,
    sellerCity: inserted.sellerCity,
    hasActiveSellerBadge: normalizeSellerStatus(seller.sellerStatus) === 'ACTIVE',
    isSellerVerified: normalizeVerificationStatus(ctx!.seller!.sellerVerificationStatus) === 'VERIFIED',
    status: 'DRAFT',
    imageSeed: inserted.imageSeed,
    imageUrl: inserted.imageUrl,
    imageUrls: sanitizeListingImageUrls(inserted.imageUrls),
    videoLinks: sanitizeStoredVideoLinks(inserted.videoLinks),
    daysRemaining: inserted.daysRemaining,
    specifications: inserted.specifications,
    returnPolicy: inserted.returnPolicy,
    warranty: inserted.warranty,
    impressions: inserted.impressions,
    referralShares: inserted.referralShares,
  };
}

// NS-SEL-003 & NS-VER-002: Publish Seller listing (enforces SELLER VERIFIED gate & subscription caps)
export async function publishSellerListingById(
  actorUserId: string,
  listingId: string
): Promise<ProductListing> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  const sellerProfileId = ctx?.seller?.sellerProfileId;

  const listingRows = await db
    .select()
    .from(productListings)
    .where(eq(productListings.id, listingId))
    .limit(1);
  const listing = listingRows[0];
  if (!listing) {
    throw new AuthorizationError('Listing not found.', 404, 'LISTING_NOT_FOUND');
  }
  if (sellerProfileId && listing.sellerProfileId !== sellerProfileId) {
    throw new AuthorizationError('You do not own this listing.', 403, 'FORBIDDEN');
  }

  const sellerListings = await db
    .select()
    .from(productListings)
    .where(eq(productListings.sellerProfileId, listing.sellerProfileId));

  const activePublished = sellerListings.filter((p) => p.status === 'PUBLISHED');
  const distinctCats = new Set(activePublished.map((p) => p.category));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const pubsUsed = sellerListings.filter(
    (l) => l.publishedAt && l.publishedAt >= monthStart
  ).length;

  assertCanPublishListing(ctx, {
    currentActiveListings: activePublished.length,
    publicationsThisMonth: pubsUsed,
    distinctCategoriesUsed: distinctCats.size,
    isNewCategory: !distinctCats.has(listing.category),
  });

  if (listing.status !== 'PUBLISHED') {
    await db
      .update(productListings)
      .set({ status: 'PUBLISHED', publishedAt: new Date() })
      .where(eq(productListings.id, listing.id));
  }

  const cleanedImages = sanitizeListingImageUrls(listing.imageUrls);
  const resolvedImages = cleanedImages.length > 0 ? cleanedImages : listing.imageUrl ? [listing.imageUrl] : [];
  const sellerRows = await db
    .select({ logoUrl: sellerProfiles.logoUrl })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, listing.sellerProfileId))
    .limit(1);

  return {
    id: listing.id,
    productId: listing.productId,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    priceKobo: Number(listing.priceKobo),
    deliveryFeeKobo: Number(listing.deliveryFeeKobo),
    stock: listing.stock,
    sellerScoutId: listing.sellerScoutId,
    sellerProfileId: listing.sellerProfileId,
    sellerName: listing.sellerName,
    sellerLogoUrl: sellerRows[0]?.logoUrl ?? null,
    sellerCity: listing.sellerCity,
    hasActiveSellerBadge: true,
    isSellerVerified: true,
    status: 'PUBLISHED',
    imageSeed: listing.imageSeed,
    imageUrl: resolvedImages[0] || listing.imageUrl,
    imageUrls: resolvedImages,
    videoLinks: sanitizeStoredVideoLinks(listing.videoLinks),
    daysRemaining: listing.daysRemaining,
    specifications: listing.specifications,
    returnPolicy: listing.returnPolicy,
    warranty: listing.warranty,
    impressions: listing.impressions,
    referralShares: listing.referralShares,
  };
}

export async function upgradeSellerPlanForActor(actorUserId: string, planId: SellerPlanId) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);
  if (!ctx.seller) {
    throw new AuthorizationError('Activate Seller capabilities first.', 403, 'NOT_A_SELLER');
  }
  if (!ctx.seller.permissions.canManageBilling && ctx.seller.role !== 'BUSINESS_OWNER') {
    throw new AuthorizationError('Billing permission required.', 403, 'FORBIDDEN');
  }

  const nextPlan = planIdToEnum(planId);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.id, ctx.seller!.sellerProfileId))
      .limit(1);
    const seller = rows[0]!;
    const prevPlan = seller.subscriptionPlan;
    const prevSubStatus = normalizeSubscriptionStatus(seller.subscriptionStatus);
    if (prevSubStatus !== 'ACTIVE') {
      try {
        transitions.subscription(prevSubStatus, 'ACTIVE');
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
        }
        throw err;
      }
    }

    await tx
      .update(sellerProfiles)
      .set({
        subscriptionPlan: nextPlan,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.id, seller.id));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: seller.ownerUserId,
      action: 'SELLER_SUBSCRIPTION_UPDATED',
      entityType: 'seller_profiles',
      entityId: seller.id,
      previousValue: { subscriptionPlan: prevPlan, subscriptionStatus: prevSubStatus },
      newValue: { subscriptionPlan: nextPlan, subscriptionStatus: 'ACTIVE' },
    });
  });
}

// NS-ACC-014 & NS-SEL-004: Seller team seat management (Business Seller + Sprawl plan, strict max 5 active/invited seats)
export async function manageSellerTeamForActor(
  actorUserId: string,
  input:
    | {
        operation: 'invite';
        memberEmail: string;
        role: SellerTeamRole;
        permissions?: Partial<SellerTeamPermissions>;
      }
    | { operation: 'revoke'; memberId: string }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanManageSellerTeam(ctx, { operation: input.operation });

  const sellerId = ctx!.seller!.sellerProfileId;

  if (input.operation === 'revoke') {
    if (!isUuid(input.memberId)) {
      throw new AuthorizationError('Team member not found.', 404, 'MEMBER_NOT_FOUND');
    }
    const rows = await db
      .select()
      .from(sellerTeamMembers)
      .where(
        and(
          eq(sellerTeamMembers.id, input.memberId),
          eq(sellerTeamMembers.sellerProfileId, sellerId)
        )
      )
      .limit(1);
    const target = rows[0];
    if (!target) {
      throw new AuthorizationError('Team member not found.', 404, 'MEMBER_NOT_FOUND');
    }
    if (target.role === 'BUSINESS_OWNER') {
      throw new AuthorizationError('Cannot revoke the Business Owner.', 400, 'OWNER_IMMUTABLE');
    }
    await db
      .update(sellerTeamMembers)
      .set({ status: 'REVOKED', revokedAt: new Date() })
      .where(eq(sellerTeamMembers.id, target.id));

    await db.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: target.userId,
      action: 'SELLER_TEAM_MEMBER_REVOKED',
      entityType: 'seller_team_members',
      entityId: target.id,
      previousValue: { status: target.status, role: target.role },
      newValue: { status: 'REVOKED' },
      reason: 'Seller team seat revoked; Seller privileges cleared on next server request',
    });
    return;
  }

  const normalizedRole = normalizeTeamRole(input.role);
  if (normalizedRole === 'BUSINESS_OWNER') {
    throw new AuthorizationError(
      'Business ownership cannot be assigned through team invitations.',
      403,
      'OWNER_TRANSFER_RESTRICTED'
    );
  }

  // NS-ACC-014: Enforce Sprawl Plan Max 5 Team Seats (ACTIVE or INVITED members excluding primary owner)
  const currentMembers = await db
    .select()
    .from(sellerTeamMembers)
    .where(eq(sellerTeamMembers.sellerProfileId, sellerId));
  const activeOrInvitedSeats = currentMembers.filter(
    (m) => (m.status === 'ACTIVE' || m.status === 'INVITED') && m.role !== 'BUSINESS_OWNER'
  ).length;
  assertCanManageSellerTeam(ctx, {
    operation: 'invite',
    activeOrInvitedSeats,
  });

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, input.memberEmail.trim().toLowerCase()))
    .limit(1);
  const memberUser = userRows[0];
  if (!memberUser) {
    throw new AuthorizationError(
      'Invited user must have a registered NairaScout account first.',
      404,
      'USER_NOT_FOUND'
    );
  }

  const targetStatus = normalizeAccountStatus(memberUser.accountStatus);
  if (targetStatus === 'CLOSED' || targetStatus === 'CLOSURE_PENDING' || targetStatus === 'SUSPENDED') {
    throw new AuthorizationError(
      `Invited user account is ${targetStatus} and cannot hold a Seller team seat.`,
      403,
      'TARGET_ACCOUNT_NOT_ELIGIBLE'
    );
  }

  const existing = currentMembers.find(
    (m) => m.userId === memberUser.id && (m.status === 'ACTIVE' || m.status === 'INVITED')
  );
  if (existing) {
    throw new AuthorizationError(
      'User already occupies an active or invited team seat.',
      409,
      'ALREADY_MEMBER'
    );
  }

  const defaultPerms = SELLER_TEAM_ROLE_PERMISSIONS[normalizedRole];
  const mergedPerms: SellerTeamPermissions = {
    canManageListings: input.permissions?.canManageListings ?? defaultPerms.canManageListings,
    canManageOrders: input.permissions?.canManageOrders ?? defaultPerms.canManageOrders,
    canViewAnalytics: input.permissions?.canViewAnalytics ?? defaultPerms.canViewAnalytics,
    canManageBilling:
      normalizedRole === 'BUSINESS_ADMIN' ||
      normalizedRole === 'FINANCE_MANAGER' ||
      normalizedRole === 'PRODUCT_MANAGER' ||
      normalizedRole === 'ORDER_MANAGER' ||
      normalizedRole === 'ANALYST_VIEWER'
        ? false
        : (input.permissions?.canManageBilling ?? defaultPerms.canManageBilling),
    canManageTeam: input.permissions?.canManageTeam ?? defaultPerms.canManageTeam,
  };

  const [created] = await db
    .insert(sellerTeamMembers)
    .values({
      sellerProfileId: sellerId,
      userId: memberUser.id,
      role: normalizedRole,
      permissions: mergedPerms,
      status: 'ACTIVE',
      invitedBy: actorUserId,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorId: actorUserId,
    affectedUserId: memberUser.id,
    action: 'SELLER_TEAM_MEMBER_ADDED',
    entityType: 'seller_team_members',
    entityId: created.id,
    newValue: {
      role: normalizedRole,
      permissions: mergedPerms,
      seatsUsed: activeOrInvitedSeats + 1,
      seatCap: SPRAWL_MAX_TEAM_SEATS,
    },
  });
}

// ============================================================================
// SETTINGS, PRIVACY, VERIFICATION SUBMISSIONS, APPEALS & TWO-TRACK CLOSURE
// ============================================================================

// NS-SCT-010, NS-SCT-015: Profile & Privacy update with 250-char bio cap, LGA, anti-impersonation check, and PRIVATE default
export async function updateProfileAndPrivacy(
  actorUserId: string,
  input: {
    displayName?: string;
    username?: string;
    bio?: string;
    locationState?: string;
    locationLga?: string | null;
    preferredCategories?: string[];
    invitationPolicy?: InvitationPolicy;
    muteReferrals?: boolean;
    profileVisibility?: ProfileVisibility;
  }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  const rows = await db
    .select()
    .from(scoutProfiles)
    .where(eq(scoutProfiles.userId, actorUserId))
    .limit(1);
  const scout = rows[0];
  if (!scout) {
    throw new AuthorizationError('Scout profile not found.', 404, 'NOT_FOUND');
  }

  let nextDisplayName = scout.displayName;
  if (input.displayName !== undefined) {
    const trimmed = input.displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new AuthorizationError(
        'Display Name must be between 2 and 60 characters.',
        400,
        'INVALID_DISPLAY_NAME'
      );
    }
    const reservedHit = containsReservedImpersonationTerm(trimmed);
    if (reservedHit && !ctx.adminRole) {
      throw new AuthorizationError(
        `Display Name cannot contain reserved platform term "${reservedHit}".`,
        400,
        'IMPERSONATION_BLOCKED'
      );
    }
    nextDisplayName = trimmed;
  }

  let nextUsername = scout.username;
  if (input.username !== undefined && input.username.trim().toLowerCase() !== scout.username.toLowerCase()) {
    const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      throw new AuthorizationError(
        'Username must be 3–30 URL-safe characters (letters, numbers, underscores).',
        400,
        'INVALID_USERNAME'
      );
    }
    const reservedHit = containsReservedImpersonationTerm(cleanUsername);
    if (reservedHit && !ctx.adminRole) {
      throw new AuthorizationError(
        `Username cannot contain reserved platform term "${reservedHit}".`,
        400,
        'IMPERSONATION_BLOCKED'
      );
    }
    const conflict = await db
      .select({ userId: scoutProfiles.userId })
      .from(scoutProfiles)
      .where(eq(scoutProfiles.username, cleanUsername))
      .limit(1);
    if (conflict[0] && conflict[0].userId !== actorUserId) {
      throw new AuthorizationError('Username is already taken.', 409, 'USERNAME_TAKEN');
    }
    nextUsername = cleanUsername;
  }

  let nextBio = scout.bio;
  if (input.bio !== undefined) {
    const trimmedBio = input.bio.trim();
    if (trimmedBio.length > SCOUT_BIO_MAX_LENGTH) {
      throw new AuthorizationError(
        `Short biography must be ${SCOUT_BIO_MAX_LENGTH} characters or fewer.`,
        400,
        'BIO_TOO_LONG'
      );
    }
    nextBio = trimmedBio || null;
  }

  const nextVisibility: ProfileVisibility =
    input.profileVisibility === 'PUBLIC' ||
    input.profileVisibility === 'NETWORK_ONLY' ||
    input.profileVisibility === 'PRIVATE'
      ? input.profileVisibility
      : scout.profileVisibility === 'PUBLIC'
        ? 'PUBLIC'
        : scout.profileVisibility === 'NETWORK_ONLY'
          ? 'NETWORK_ONLY'
          : 'PRIVATE';

  const nextLga =
    input.locationLga !== undefined
      ? (input.locationLga ?? '').trim() || null
      : scout.locationLga;

  await db.transaction(async (tx) => {
    await tx
      .update(scoutProfiles)
      .set({
        username: nextUsername,
        displayName: nextDisplayName,
        bio: nextBio,
        locationState:
          input.locationState !== undefined
            ? input.locationState.trim() || scout.locationState
            : scout.locationState,
        locationLga: nextLga,
        preferredCategories:
          input.preferredCategories !== undefined
            ? input.preferredCategories
            : scout.preferredCategories,
        invitationPolicy: input.invitationPolicy ?? scout.invitationPolicy,
        muteReferrals:
          input.muteReferrals !== undefined ? input.muteReferrals : scout.muteReferrals,
        profileVisibility: nextVisibility,
        updatedAt: new Date(),
      })
      .where(eq(scoutProfiles.userId, actorUserId));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'PROFILE_UPDATED',
      entityType: 'scout_profile',
      entityId: actorUserId,
      previousValue: {
        displayName: scout.displayName,
        username: scout.username,
        locationState: scout.locationState,
        locationLga: scout.locationLga,
        profileVisibility: scout.profileVisibility,
      },
      newValue: {
        displayName: nextDisplayName,
        username: nextUsername,
        locationState:
          input.locationState !== undefined
            ? input.locationState.trim() || scout.locationState
            : scout.locationState,
        locationLga: nextLga,
        profileVisibility: nextVisibility,
      },
      reason: 'Scout updated profile or privacy preferences',
    });
  });
}

export async function updateScoutAvatarForActor(
  actorUserId: string,
  nextAvatarUrl: string | null
): Promise<{ previousAvatarUrl: string | null }> {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        userId: scoutProfiles.userId,
        avatarUrl: scoutProfiles.avatarUrl,
      })
      .from(scoutProfiles)
      .where(eq(scoutProfiles.userId, actorUserId))
      .limit(1);

    const scout = rows[0];
    if (!scout) {
      throw new AuthorizationError('Scout profile not found.', 404, 'NOT_FOUND');
    }

    const previousAvatarUrl = scout.avatarUrl ?? null;

    await tx
      .update(scoutProfiles)
      .set({
        avatarUrl: nextAvatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(scoutProfiles.userId, actorUserId));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: nextAvatarUrl ? 'AVATAR_UPDATED' : 'AVATAR_REMOVED',
      entityType: 'scout_profile',
      entityId: actorUserId,
      previousValue: { avatarUrl: previousAvatarUrl },
      newValue: { avatarUrl: nextAvatarUrl },
      reason: nextAvatarUrl
        ? 'User uploaded profile avatar to Supabase Storage avatars bucket'
        : 'User removed profile avatar',
    });

    return { previousAvatarUrl };
  });
}

export async function updateSellerLogoForActor(
  actorUserId: string,
  nextLogoUrl: string | null
): Promise<{ hasSellerProfile: boolean; previousLogoUrl: string | null }> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: sellerProfiles.id,
        logoUrl: sellerProfiles.logoUrl,
      })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.ownerUserId, actorUserId))
      .limit(1);

    const seller = rows[0];
    if (!seller) {
      return { hasSellerProfile: false, previousLogoUrl: null };
    }

    const previousLogoUrl = seller.logoUrl ?? null;

    await tx
      .update(sellerProfiles)
      .set({
        logoUrl: nextLogoUrl,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.id, seller.id));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: nextLogoUrl ? 'SELLER_LOGO_UPDATED' : 'SELLER_LOGO_REMOVED',
      entityType: 'seller_profiles',
      entityId: seller.id,
      previousValue: { logoUrl: previousLogoUrl },
      newValue: { logoUrl: nextLogoUrl },
      reason: nextLogoUrl
        ? 'Seller uploaded business profile photo to Supabase Storage seller-logos bucket'
        : 'Seller removed business profile photo',
    });

    return { hasSellerProfile: true, previousLogoUrl };
  });
}

export async function submitVerificationEvidence(
  actorUserId: string,
  input: {
    category: VerificationCategory;
    evidencePaths: string[];
    bankSummary?: string;
  }
): Promise<VerificationRecord> {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  if (input.category === 'PAYOUT_BANK') {
    // NS-AUT-007: Block payout bank destination updates during 24-hour post-recovery cooling-off lock
    assertWithdrawalNotInCooldown(ctx);
    // NS-AUT-005: Require fresh reauthentication within 10 minutes before adding/editing payout bank destination
    assertRecentReauthentication(ctx);
  }

  const sellerId =
    input.category === 'SELLER' || input.category === 'BUSINESS'
      ? ctx.seller?.sellerProfileId ?? null
      : null;

  const cleanPaths =
    input.evidencePaths.length > 0
      ? input.evidencePaths
      : [`verification-docs/${actorUserId}/${input.category.toLowerCase()}-${Date.now()}.pdf`];
  const now = new Date();

  const existing = await db
    .select()
    .from(verificationRecords)
    .where(
      and(
        eq(verificationRecords.userId, actorUserId),
        eq(verificationRecords.category, input.category)
      )
    )
    .limit(1);

  if (existing[0]) {
    const prevNormalized = normalizeVerificationStatus(existing[0].status);
    if (prevNormalized !== 'SUBMITTED') {
      try {
        transitions.verification(prevNormalized, 'SUBMITTED');
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
        }
        throw err;
      }
    }

    const [updated] = await db
      .update(verificationRecords)
      .set({
        status: 'SUBMITTED',
        evidencePaths: cleanPaths,
        submittedAt: now,
        reviewerNotes:
          input.category === 'PAYOUT_BANK' && input.bankSummary?.trim()
            ? input.bankSummary.trim()
            : null,
        updatedAt: now,
      })
      .where(eq(verificationRecords.id, existing[0].id))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId,
      sellerProfileId: updated.sellerProfileId,
      category: updated.category as VerificationCategory,
      status: normalizeVerificationStatus(updated.status),
      evidencePaths: updated.evidencePaths,
      reviewerNotes: updated.reviewerNotes,
      reviewedBy: updated.reviewedBy,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    };
  }

  const [created] = await db
    .insert(verificationRecords)
    .values({
      userId: actorUserId,
      sellerProfileId: sellerId,
      category: input.category,
      status: 'SUBMITTED',
      evidencePaths: cleanPaths,
      reviewerNotes:
        input.category === 'PAYOUT_BANK' && input.bankSummary?.trim()
          ? input.bankSummary.trim()
          : null,
      submittedAt: now,
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    sellerProfileId: created.sellerProfileId,
    category: created.category as VerificationCategory,
    status: normalizeVerificationStatus(created.status),
    evidencePaths: created.evidencePaths,
    reviewerNotes: created.reviewerNotes,
    reviewedBy: created.reviewedBy,
    submittedAt: created.submittedAt?.toISOString() ?? null,
    reviewedAt: created.reviewedAt?.toISOString() ?? null,
  };
}

/**
 * Two-Track Closure Track 1: Close Seller Capabilities Only.
 * Preserves Scout account (`users.accountStatus = 'ACTIVE'`), Scouts List,
 * permanent referral ancestry, and Scout referral wallet/commissions intact.
 */
// NS-ACC-005 & NS-SEL-006: Voluntary Seller-only closure (preserves Scout identity & ancestry)
export async function closeSellerCapabilityVoluntarily(actorUserId: string, reason?: string) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);
  if (!ctx.seller) {
    throw new AuthorizationError('No Seller profile found on this account.', 404, 'NOT_A_SELLER');
  }
  if (ctx.seller.role !== 'BUSINESS_OWNER') {
    throw new AuthorizationError(
      'Only the Business Owner can close Seller capabilities.',
      403,
      'OWNER_REQUIRED'
    );
  }

  const closureReason = reason?.trim() || 'Voluntary Seller capability closure';

  await db.transaction(async (tx) => {
    const sellerRows = await tx
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.id, ctx.seller!.sellerProfileId))
      .limit(1);
    const seller = sellerRows[0];
    if (!seller) {
      throw new AuthorizationError('Seller profile not found.', 404, 'NOT_A_SELLER');
    }

    const prevStatus = normalizeSellerStatus(seller.sellerStatus);
    try {
      transitions.seller(prevStatus, 'CLOSURE_PENDING');
      transitions.seller('CLOSURE_PENDING', 'CLOSED');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
      }
      throw err;
    }

    const sellerOrders = await tx
      .select()
      .from(marketplaceOrders)
      .where(eq(marketplaceOrders.sellerScoutId, seller.ownerUserId));
    const unresolvedOrders = sellerOrders.filter(
      (o) => o.fulfilmentStatus !== 'Delivered' && o.fulfilmentStatus !== 'Refunded'
    );
    if (unresolvedOrders.length > 0) {
      throw new AuthorizationError(
        `Cannot close Seller capabilities while ${unresolvedOrders.length} Seller order(s) remain unfulfilled or disputed.`,
        409,
        'OPEN_SELLER_OBLIGATIONS'
      );
    }

    await tx
      .update(sellerProfiles)
      .set({ sellerStatus: 'CLOSURE_PENDING', updatedAt: new Date() })
      .where(eq(sellerProfiles.id, seller.id));

    await tx
      .update(productListings)
      .set({ status: 'EXPIRED' })
      .where(
        and(
          eq(productListings.sellerProfileId, seller.id),
          inArray(productListings.status, ['PUBLISHED', 'DRAFT'])
        )
      );

    await tx
      .update(sellerProfiles)
      .set({ sellerStatus: 'CLOSED', updatedAt: new Date() })
      .where(eq(sellerProfiles.id, seller.id));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: seller.ownerUserId,
      action: 'SELLER_CAPABILITY_CLOSED',
      entityType: 'seller_profiles',
      entityId: seller.id,
      previousValue: { sellerStatus: prevStatus },
      newValue: {
        sellerStatus: 'CLOSED',
        scoutAccountPreserved: true,
        listingsExpired: true,
      },
      reason: closureReason,
    });

    await tx.insert(notifications).values({
      userId: seller.ownerUserId,
      category: 'TRUST',
      title: 'Seller Capabilities Closed (Scout Account Active)',
      body: 'Your Seller storefront and listings have been closed. Your Scout browsing, Scouts List, referrals, and wallet remain active.',
      actionUrl: '/?tab=seller',
      isRead: false,
    });
  });
}

/**
 * Two-Track Closure Track 2: Full NairaScout Account Closure.
 * Assesses obligations -> transitions Account CLOSURE_PENDING -> CLOSED,
 * closes any Seller capabilities, revokes sessions, while preserving users,
 * referral_ancestry, product_referral_events, orders, and ledger records.
 */
// NS-ACC-005 & NS-GOV-001: Voluntary account closure (retains immutable ancestry, orders, ledger & audit logs)
export async function closeAccountVoluntarily(actorUserId: string, reason?: string) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  const closureReason = reason?.trim() || 'Voluntary full account closure';

  await db.transaction(async (tx) => {
    const userRows = await tx.select().from(users).where(eq(users.id, actorUserId)).limit(1);
    const user = userRows[0];
    if (!user) {
      throw new AuthorizationError('User account not found.', 404, 'USER_NOT_FOUND');
    }

    const prevStatus = normalizeAccountStatus(user.accountStatus);
    try {
      transitions.account(prevStatus, 'CLOSURE_PENDING');
      transitions.account('CLOSURE_PENDING', 'CLOSED');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
      }
      throw err;
    }

    const userOrders = await tx
      .select()
      .from(marketplaceOrders)
      .where(
        or(
          eq(marketplaceOrders.buyerScoutId, actorUserId),
          eq(marketplaceOrders.sellerScoutId, actorUserId)
        )
      );
    const disputedOrders = userOrders.filter((o) => o.fulfilmentStatus === 'Disputed');
    const openSellerOrders = userOrders.filter(
      (o) =>
        o.sellerScoutId === actorUserId &&
        o.fulfilmentStatus !== 'Delivered' &&
        o.fulfilmentStatus !== 'Refunded'
    );
    if (disputedOrders.length > 0 || openSellerOrders.length > 0) {
      throw new AuthorizationError(
        `Account closure paused at obligation check: resolve ${disputedOrders.length} disputed order(s) and ${openSellerOrders.length} open Seller order(s) first.`,
        409,
        'OPEN_OBLIGATIONS_EXIST'
      );
    }

    // Step 1: Enter CLOSURE_PENDING
    await tx
      .update(users)
      .set({
        accountStatus: 'CLOSURE_PENDING',
        restrictionReason: closureReason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actorUserId));

    // Close owned Seller profile if not already closed
    const ownedSellerRows = await tx
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.ownerUserId, actorUserId))
      .limit(1);
    if (ownedSellerRows[0]) {
      const sellerNorm = normalizeSellerStatus(ownedSellerRows[0].sellerStatus);
      if (sellerNorm !== 'CLOSED') {
        await tx
          .update(sellerProfiles)
          .set({ sellerStatus: 'CLOSED', updatedAt: new Date() })
          .where(eq(sellerProfiles.id, ownedSellerRows[0].id));
      }
    }

    // Pause active/draft Seller listings without deleting any financial or referral rows
    await tx
      .update(productListings)
      .set({ status: 'EXPIRED' })
      .where(
        and(
          eq(productListings.sellerScoutId, actorUserId),
          inArray(productListings.status, ['PUBLISHED', 'DRAFT'])
        )
      );

    // Revoke active Seller team memberships
    await tx
      .update(sellerTeamMembers)
      .set({ status: 'REVOKED', revokedAt: new Date() })
      .where(eq(sellerTeamMembers.userId, actorUserId));

    // Step 2: Finalize CLOSED while preserving users, referral_ancestry, events, orders, ledger
    await tx
      .update(users)
      .set({
        accountStatus: 'CLOSED',
        closedAt: new Date(),
        restrictionReason: closureReason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actorUserId));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'ACCOUNT_CLOSED_VOLUNTARY',
      entityType: 'users',
      entityId: actorUserId,
      previousValue: { accountStatus: prevStatus },
      newValue: {
        accountStatus: 'CLOSURE_PENDING -> CLOSED',
        historicalRecordsPreserved: true,
      },
      reason: closureReason,
    });
  });
}

export async function submitGovernanceAppealForActor(
  actorUserId: string,
  input: {
    targetType: AppealTargetType;
    targetRecordId: string;
    appealReason: string;
    evidencePaths?: string[];
  }
): Promise<GovernanceAppealDTO> {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  if (!ctx || ctx.accountStatus === 'CLOSED') {
    throw new AuthorizationError('Authentication required on a non-closed account.', 403, 'FORBIDDEN');
  }
  if (!input.appealReason.trim()) {
    throw new AuthorizationError('Appeal reason is required.', 400, 'REASON_REQUIRED');
  }
  if (!isUuid(input.targetRecordId)) {
    throw new AuthorizationError('Valid target record UUID is required.', 400, 'INVALID_TARGET');
  }

  let originalReviewerId: string | null = null;
  if (input.targetType === 'VERIFICATION') {
    const vRows = await db
      .select()
      .from(verificationRecords)
      .where(eq(verificationRecords.id, input.targetRecordId))
      .limit(1);
    if (!vRows[0] || vRows[0].userId !== actorUserId) {
      throw new AuthorizationError('Verification record not found for your account.', 404, 'NOT_FOUND');
    }
    originalReviewerId = vRows[0].reviewedBy;
  } else if (input.targetType === 'RESTRICTION') {
    const rRows = await db
      .select()
      .from(capabilityRestrictions)
      .where(eq(capabilityRestrictions.id, input.targetRecordId))
      .limit(1);
    if (!rRows[0] || rRows[0].userId !== actorUserId) {
      throw new AuthorizationError('Restriction record not found for your account.', 404, 'NOT_FOUND');
    }
    originalReviewerId = rRows[0].imposedBy;
  }

  const [created] = await db
    .insert(governanceAppeals)
    .values({
      appellantUserId: actorUserId,
      targetType: input.targetType,
      targetRecordId: input.targetRecordId,
      originalReviewerId,
      appealReason: input.appealReason.trim(),
      evidencePaths: Array.isArray(input.evidencePaths) ? input.evidencePaths : [],
      status: 'OPEN',
    })
    .returning();

  await db.insert(auditLogs).values({
    actorId: actorUserId,
    affectedUserId: actorUserId,
    action: 'GOVERNANCE_APPEAL_SUBMITTED',
    entityType: 'governance_appeals',
    entityId: created.id,
    newValue: { targetType: input.targetType, targetRecordId: input.targetRecordId },
    reason: input.appealReason.trim(),
  });

  const scoutRows = await db
    .select()
    .from(scoutProfiles)
    .where(eq(scoutProfiles.userId, actorUserId))
    .limit(1);

  return {
    id: created.id,
    appellantUserId: created.appellantUserId,
    appellantHandle: scoutRows[0]?.username || 'scout',
    targetType: created.targetType as AppealTargetType,
    targetRecordId: created.targetRecordId,
    originalReviewerId: created.originalReviewerId,
    originalReviewerHandle: null,
    appealReason: created.appealReason,
    evidencePaths: created.evidencePaths,
    status: 'OPEN',
    appealsOfficerId: null,
    appealsOfficerHandle: null,
    decisionNotes: null,
    createdAt: created.createdAt.toISOString(),
    resolvedAt: null,
  };
}

// ============================================================================
// ADMIN GOVERNANCE, MAKER-CHECKER & APPEALS CONSOLE (100% POSTGRESQL)
// ============================================================================

export async function getAdminConsoleSnapshot(actorUserId: string) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ALL_PLATFORM_ADMIN_ROLES);

  const allVerifs = await db
    .select()
    .from(verificationRecords)
    .orderBy(desc(verificationRecords.createdAt));
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const allScouts = await db.select().from(scoutProfiles);
  const allSellers = await db.select().from(sellerProfiles);
  const allAncestry = await db.select().from(referralAncestry);
  const allAdmins = await db.select().from(platformAdminRoles);
  const allAbuse = await db.select().from(abuseReports).orderBy(desc(abuseReports.createdAt));
  const allAudit = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  const allLedger = await db.select().from(commissionLedgerEntries);

  let allRestrictions: Array<typeof capabilityRestrictions.$inferSelect> = [];
  let allMakerChecker: Array<typeof makerCheckerRequests.$inferSelect> = [];
  let allAppeals: Array<typeof governanceAppeals.$inferSelect> = [];
  let allRecoveries: Array<typeof accountRecoveryRequests.$inferSelect> = [];

  try {
    allRestrictions = await db
      .select()
      .from(capabilityRestrictions)
      .orderBy(desc(capabilityRestrictions.createdAt));
    allMakerChecker = await db
      .select()
      .from(makerCheckerRequests)
      .orderBy(desc(makerCheckerRequests.createdAt));
    allAppeals = await db
      .select()
      .from(governanceAppeals)
      .orderBy(desc(governanceAppeals.createdAt));
    allRecoveries = await db
      .select()
      .from(accountRecoveryRequests)
      .orderBy(desc(accountRecoveryRequests.createdAt));
  } catch {
    // Graceful if Section 9 or Module 4 tables unavailable in test env
  }

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const scoutMap = new Map(allScouts.map((s) => [s.userId, s]));
  const sellerById = new Map(allSellers.map((s) => [s.id, s]));
  const sellerByOwner = new Map(allSellers.map((s) => [s.ownerUserId, s]));
  const ancestrySet = new Set(allAncestry.map((a) => a.scoutUserId));
  const adminMap = new Map(allAdmins.map((a) => [a.userId, normalizeAdminRole(a.adminRole)]));

  const verificationQueue = allVerifs.map((v) => {
    const scout = scoutMap.get(v.userId);
    const seller = v.sellerProfileId ? sellerById.get(v.sellerProfileId) : null;
    return {
      id: v.id,
      userId: v.userId,
      sellerProfileId: v.sellerProfileId,
      category: v.category as VerificationCategory,
      status: normalizeVerificationStatus(v.status),
      evidencePaths: v.evidencePaths,
      reviewerNotes: v.reviewerNotes,
      reviewedBy: v.reviewedBy,
      submittedAt: v.submittedAt?.toISOString() ?? null,
      reviewedAt: v.reviewedAt?.toISOString() ?? null,
      username: scout?.username || 'unknown',
      displayName: scout?.displayName || 'Unknown User',
      avatarUrl: scout?.avatarUrl ?? null,
      email: userMap.get(v.userId)?.email || '',
      sellerName: seller?.sellerName || null,
      sellerType: seller?.sellerType || null,
      sellerStatus: seller ? normalizeSellerStatus(seller.sellerStatus) : null,
      sellerOwnerUserId: seller?.ownerUserId ?? v.userId,
    };
  });

  const managedUsers = allUsers.map((u) => {
    const scout = scoutMap.get(u.id);
    const seller = sellerByOwner.get(u.id) ?? null;
    const ledgerCount = allLedger.filter((l) => l.beneficiaryScoutId === u.id).length;
    return {
      userId: u.id,
      email: u.email,
      username: scout?.username || '',
      displayName: scout?.displayName || '',
      avatarUrl: scout?.avatarUrl ?? null,
      accountStatus: normalizeAccountStatus(u.accountStatus),
      restrictionReason: u.restrictionReason,
      closedAt: u.closedAt?.toISOString() ?? null,
      sellerProfileId: seller?.id || null,
      sellerName: seller?.sellerName || null,
      sellerStatus: seller ? normalizeSellerStatus(seller.sellerStatus) : null,
      subscriptionPlan: seller?.subscriptionPlan || null,
      subscriptionStatus: seller ? normalizeSubscriptionStatus(seller.subscriptionStatus) : null,
      adminRole: adminMap.get(u.id) ?? null,
      hasPermanentAncestry: ancestrySet.has(u.id),
      ledgerEntriesCount: ledgerCount,
    };
  });

  return {
    adminUserId: actorUserId,
    adminRole: ctx!.adminRole ?? null,
    verifications: verificationQueue,
    users: managedUsers,
    restrictions: allRestrictions.map((r) => ({
      id: r.id,
      userId: r.userId,
      userHandle: scoutMap.get(r.userId)?.username || 'user',
      scope: r.scope as RestrictionScope,
      capabilityCode: r.capabilityCode as CapabilityCode,
      resourceId: r.resourceId,
      reason: r.reason,
      status: r.status as 'ACTIVE' | 'LIFTED',
      imposedBy: r.imposedBy,
      imposedByHandle: scoutMap.get(r.imposedBy)?.username || 'admin',
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      liftedAt: r.liftedAt?.toISOString() ?? null,
    })),
    makerCheckerRequests: allMakerChecker.map((m) => ({
      id: m.id,
      actionType: m.actionType as MakerCheckerActionType,
      targetUserId: m.targetUserId,
      targetHandle: scoutMap.get(m.targetUserId)?.username || 'user',
      targetEntityId: m.targetEntityId,
      payload: m.payload,
      reason: m.reason,
      status: m.status as MakerCheckerRequestDTO['status'],
      makerId: m.makerId,
      makerHandle: scoutMap.get(m.makerId)?.username || 'maker',
      checkerId: m.checkerId,
      checkerHandle: m.checkerId ? scoutMap.get(m.checkerId)?.username || 'checker' : null,
      checkerNotes: m.checkerNotes,
      createdAt: m.createdAt.toISOString(),
      decidedAt: m.decidedAt?.toISOString() ?? null,
    })),
    governanceAppeals: allAppeals.map((a) => ({
      id: a.id,
      appellantUserId: a.appellantUserId,
      appellantHandle: scoutMap.get(a.appellantUserId)?.username || 'user',
      targetType: a.targetType as AppealTargetType,
      targetRecordId: a.targetRecordId,
      originalReviewerId: a.originalReviewerId,
      originalReviewerHandle: a.originalReviewerId
        ? scoutMap.get(a.originalReviewerId)?.username || 'officer'
        : null,
      appealReason: a.appealReason,
      evidencePaths: a.evidencePaths,
      status: a.status as GovernanceAppealDTO['status'],
      appealsOfficerId: a.appealsOfficerId,
      appealsOfficerHandle: a.appealsOfficerId
        ? scoutMap.get(a.appealsOfficerId)?.username || 'appeals_officer'
        : null,
      decisionNotes: a.decisionNotes,
      createdAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    })),
    abuseReports: allAbuse.map((r) => ({
      id: r.id,
      reporterId: r.reporterId,
      reporterHandle: scoutMap.get(r.reporterId)?.username || 'user',
      reportedUserId: r.reportedUserId,
      reportedHandle: scoutMap.get(r.reportedUserId)?.username || 'user',
      referralEventId: r.referralEventId,
      reason: r.reason,
      description: r.description,
      status: r.status,
      resolvedBy: r.resolvedBy,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    })),
    auditLogs: allAudit.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      actorHandle: l.actorId ? scoutMap.get(l.actorId)?.username || 'admin' : 'system',
      affectedUserId: l.affectedUserId,
      affectedHandle: scoutMap.get(l.affectedUserId)?.username || 'user',
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      previousValue: (l.previousValue as Record<string, unknown> | null) ?? null,
      newValue: (l.newValue as Record<string, unknown> | null) ?? null,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
    })),
    categories: await getListingCategories({ includeInactive: true }),
    policies:
      ctx!.adminRole === 'SUPER_ADMIN' || ctx!.adminRole === 'PLATFORM_ADMIN'
        ? await getAllPlatformPoliciesForAdmin(db)
        : [],
    helpArticles:
      ctx!.adminRole === 'SUPER_ADMIN' || ctx!.adminRole === 'PLATFORM_ADMIN'
        ? await getAllHelpArticlesForAdmin(db)
        : [],
    recoveryRequests:
      ctx!.adminRole === 'SUPER_ADMIN' ||
      ctx!.adminRole === 'SUPPORT_OFFICER' ||
      ctx!.adminRole === 'TRUST_AND_SAFETY' ||
      ctx!.adminRole === 'ANALYST_VIEWER'
        ? allRecoveries.map((r) => ({
            id: r.id,
            targetUserId: r.targetUserId ?? null,
            targetHandle: r.targetUserId ? scoutMap.get(r.targetUserId)?.username || null : null,
            claimedEmail: r.claimedEmail,
            claimedUsername: r.claimedUsername ?? null,
            contactEmailForUpdates: r.contactEmailForUpdates,
            reason: r.reason,
            evidencePaths: r.evidencePaths,
            status: r.status as AccountRecoveryRequestDTO['status'],
            reviewedBy: r.reviewedBy ?? null,
            reviewedByHandle: r.reviewedBy ? scoutMap.get(r.reviewedBy)?.username || 'officer' : null,
            reviewerNotes: r.reviewerNotes ?? null,
            reviewedAt: r.reviewedAt?.toISOString() ?? null,
            approvedBy: r.approvedBy ?? null,
            approvedByHandle: r.approvedBy ? scoutMap.get(r.approvedBy)?.username || 'officer' : null,
            approvalNotes: r.approvalNotes ?? null,
            approvedAt: r.approvedAt?.toISOString() ?? null,
            createdAt: r.createdAt.toISOString(),
          }))
        : [],
  };
}

// NS-VER-003 & NS-GOV-001: Verification officer review with separation-of-duties and immutable audit trail
export async function adminReviewVerification(
  actorUserId: string,
  input: {
    verificationId: string;
    decision: 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'ACTION_REQUIRED' | 'APPROVED';
    reviewerNotes: string;
  }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['VERIFICATION_OFFICER', 'PLATFORM_ADMIN']);

  const canonicalDecision = normalizeVerificationStatus(input.decision);
  if (
    canonicalDecision !== 'UNDER_REVIEW' &&
    canonicalDecision !== 'VERIFIED' &&
    canonicalDecision !== 'REJECTED' &&
    canonicalDecision !== 'ACTION_REQUIRED'
  ) {
    throw new AuthorizationError('Unsupported verification decision.', 400, 'INVALID_DECISION');
  }

  if (!input.reviewerNotes.trim() && canonicalDecision !== 'UNDER_REVIEW') {
    throw new AuthorizationError('Mandatory reviewer notes are required.', 400, 'NOTES_REQUIRED');
  }
  if (!isUuid(input.verificationId)) {
    throw new AuthorizationError('Verification record not found.', 404, 'VERIFICATION_NOT_FOUND');
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(verificationRecords)
      .where(eq(verificationRecords.id, input.verificationId))
      .limit(1);
    const verif = rows[0];
    if (!verif) {
      throw new AuthorizationError('Verification record not found.', 404, 'VERIFICATION_NOT_FOUND');
    }

    let targetOwnerId = verif.userId;
    let sellerRow: typeof sellerProfiles.$inferSelect | undefined;
    if (verif.sellerProfileId) {
      const sRows = await tx
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.id, verif.sellerProfileId))
        .limit(1);
      sellerRow = sRows[0];
      if (sellerRow) {
        targetOwnerId = sellerRow.ownerUserId;
      }
    }

    // Separation of duties: prevent officers from reviewing/approving own Seller or KYC application
    assertCanReviewVerification(actorUserId, verif.userId);
    assertCanReviewVerification(actorUserId, targetOwnerId);

    const prevStatus = normalizeVerificationStatus(verif.status);
    try {
      if (prevStatus === 'SUBMITTED' && canonicalDecision !== 'UNDER_REVIEW') {
        transitions.verification('SUBMITTED', 'UNDER_REVIEW');
        transitions.verification('UNDER_REVIEW', canonicalDecision);
      } else {
        transitions.verification(prevStatus, canonicalDecision);
      }
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
      }
      throw err;
    }

    const now = new Date();
    const notes =
      input.reviewerNotes.trim() ||
      (canonicalDecision === 'UNDER_REVIEW' ? 'Claimed for Verification Officer review' : '');

    const [updated] = await tx
      .update(verificationRecords)
      .set({
        status: canonicalDecision,
        reviewerNotes: notes,
        reviewedBy: actorUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(verificationRecords.id, verif.id))
      .returning();

    if (verif.category === 'SELLER' && sellerRow && canonicalDecision === 'VERIFIED') {
      const prevSellerStatus = normalizeSellerStatus(sellerRow.sellerStatus);
      if (prevSellerStatus === 'ACTIVATION_PENDING') {
        transitions.seller(prevSellerStatus, 'ACTIVE');
        await tx
          .update(sellerProfiles)
          .set({ sellerStatus: 'ACTIVE', updatedAt: now })
          .where(eq(sellerProfiles.id, sellerRow.id));
      }
    }

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: verif.userId,
      action: `VERIFICATION_${canonicalDecision}`,
      entityType: 'verification_records',
      entityId: verif.id,
      previousValue: { status: prevStatus, category: verif.category },
      newValue: { status: canonicalDecision, category: verif.category },
      reason: notes,
    });

    await tx.insert(notifications).values({
      userId: verif.userId,
      category: 'TRUST',
      title: `${verif.category} verification ${canonicalDecision}`,
      body: notes,
      actionUrl: '/settings',
      isRead: false,
    });

    return updated;
  });
}

// NS-ACC-016: Transactional helper to place all currently PENDING commissions for a user ON_HOLD
// Preserves all existing ledger rows and permanent referral_ancestry intact (append-only).
type DbTransactionClient = Parameters<Parameters<NairaScoutDb['transaction']>[0]>[0];

async function placeUserPendingCommissionsOnHoldTx(
  tx: DbTransactionClient,
  targetUserId: string,
  descriptionPrefix: string
): Promise<{
  heldEntriesCount: number;
  heldTotalKobo: number;
  heldReferences: string[];
}> {
  const allEntries = await tx
    .select()
    .from(commissionLedgerEntries)
    .where(eq(commissionLedgerEntries.beneficiaryScoutId, targetUserId))
    .orderBy(asc(commissionLedgerEntries.createdAt));

  const latestByChain = new Map<
    string,
    { root: typeof commissionLedgerEntries.$inferSelect; latestStatus: string }
  >();

  for (const entry of allEntries) {
    const chainKey = entry.linkedToReference || entry.reference;
    const existing = latestByChain.get(chainKey);
    if (!existing) {
      latestByChain.set(chainKey, { root: entry, latestStatus: entry.status });
    } else {
      existing.latestStatus = entry.status;
    }
  }

  const pendingRoots = Array.from(latestByChain.values())
    .filter((item) => item.latestStatus === 'Pending')
    .map((item) => item.root);

  let heldTotalKobo = 0;
  const heldReferences: string[] = [];

  for (const root of pendingRoots) {
    const amountKobo = Number(root.amountKobo);
    heldTotalKobo += amountKobo;
    heldReferences.push(root.reference);
    await tx.insert(commissionLedgerEntries).values({
      reference: `${root.reference}-HOLD`,
      orderId: root.orderId,
      referralEventId: root.referralEventId,
      beneficiaryScoutId: root.beneficiaryScoutId,
      generation: root.generation,
      fractionLabel: root.fractionLabel,
      amountKobo,
      status: 'On Hold',
      ruleVersion: COMMISSION_RULE_VERSION,
      description: `${descriptionPrefix} (${root.reference})`,
      linkedToReference: root.reference,
    });
  }

  return {
    heldEntriesCount: pendingRoots.length,
    heldTotalKobo,
    heldReferences,
  };
}

// NS-GOV-002 & NS-ACC-016: Granular capability restriction impose/lift with automatic ON_HOLD on FRAUD_INVESTIGATION
export async function adminManageRestriction(
  actorUserId: string,
  input:
    | {
        operation: 'IMPOSE';
        targetUserId: string;
        scope: RestrictionScope;
        capabilityCode: CapabilityCode;
        reasonCategory?: GovernanceReasonCategory;
        reason: string;
        expiresInDays?: number | null;
      }
    | {
        operation: 'LIFT';
        restrictionId: string;
        reason: string;
      }
) {
  const db = requireDb();
  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['TRUST_AND_SAFETY', 'PLATFORM_ADMIN']);

  if (!input.reason.trim()) {
    throw new AuthorizationError('Documented governance reason is required.', 400, 'REASON_REQUIRED');
  }
  const reason = input.reason.trim();

  if (input.operation === 'LIFT') {
    if (!isUuid(input.restrictionId)) {
      throw new AuthorizationError('Restriction record not found.', 404, 'NOT_FOUND');
    }
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(capabilityRestrictions)
        .where(eq(capabilityRestrictions.id, input.restrictionId))
        .limit(1);
      const existing = rows[0];
      if (!existing || existing.status === 'LIFTED') {
        throw new AuthorizationError('Active restriction not found.', 404, 'NOT_FOUND');
      }
      await tx
        .update(capabilityRestrictions)
        .set({ status: 'LIFTED', liftedAt: new Date(), liftedBy: actorUserId })
        .where(eq(capabilityRestrictions.id, existing.id));

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: existing.userId,
        action: 'CAPABILITY_RESTRICTION_LIFTED',
        entityType: 'capability_restrictions',
        entityId: existing.id,
        previousValue: { status: 'ACTIVE', capabilityCode: existing.capabilityCode },
        newValue: { status: 'LIFTED' },
        reason,
      });
    });
    return;
  }

  if (!isUuid(input.targetUserId)) {
    throw new AuthorizationError('Target user not found.', 404, 'USER_NOT_FOUND');
  }

  const reasonCategory: GovernanceReasonCategory = input.reasonCategory ?? 'GENERAL';

  await db.transaction(async (tx) => {
    const expiresAt =
      input.expiresInDays && input.expiresInDays > 0
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const [created] = await tx
      .insert(capabilityRestrictions)
      .values({
        userId: input.targetUserId,
        scope: input.scope,
        capabilityCode: input.capabilityCode,
        reason,
        status: 'ACTIVE',
        imposedBy: actorUserId,
        expiresAt,
      })
      .returning();

    let holdResult = {
      heldEntriesCount: 0,
      heldTotalKobo: 0,
      heldReferences: [] as string[],
    };

    if (reasonCategory === 'FRAUD_INVESTIGATION') {
      holdResult = await placeUserPendingCommissionsOnHoldTx(
        tx,
        input.targetUserId,
        `Fraud investigation hold: ${reason}`
      );
    }

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: input.targetUserId,
      action: 'CAPABILITY_RESTRICTION_IMPOSED',
      entityType: 'capability_restrictions',
      entityId: created.id,
      previousValue: { restrictionActive: false },
      newValue: {
        scope: input.scope,
        capabilityCode: input.capabilityCode,
        reasonCategory,
        heldCommissionsCount: holdResult.heldEntriesCount,
        heldCommissionsKobo: holdResult.heldTotalKobo,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      reason,
    });

    await tx.insert(notifications).values({
      userId: input.targetUserId,
      category: 'TRUST',
      title: `Capability Restricted: ${input.capabilityCode}`,
      body:
        holdResult.heldEntriesCount > 0
          ? `${reason}. ${holdResult.heldEntriesCount} pending commission entry(s) have been placed On Hold pending review. You may submit an independent appeal from Account Settings.`
          : `${reason}. You may submit an independent appeal from Account Settings if you believe this is in error.`,
      actionUrl: '/settings',
      isRead: false,
    });
  });
}

// NS-GOV-002 & NS-ACC-016: Account/Seller/Subscription governance status enforcement & fraud ON_HOLD placement
export async function adminApplyUserAction(
  actorUserId: string,
  input: {
    targetUserId: string;
    actionType:
      | 'SET_ACCOUNT_STATUS'
      | 'SET_SELLER_STATUS'
      | 'SET_SUBSCRIPTION_STATUS'
      | 'HOLD_PENDING_COMMISSIONS'
      | 'RESOLVE_ABUSE_REPORT';
    accountStatus?: AccountStatus;
    sellerStatus?: SellerStatus;
    subscriptionStatus?: SubscriptionStatus;
    reasonCategory?: GovernanceReasonCategory;
    abuseReportId?: string;
    abuseResolution?: 'RESOLVED' | 'DISMISSED';
    reason: string;
  }
) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, [
    'PLATFORM_ADMIN',
    'TRUST_AND_SAFETY',
    'FINANCE_OFFICER',
    'OPERATIONS_MANAGER',
  ]);

  if (!input.reason.trim()) {
    throw new AuthorizationError(
      'Documented reason is required for admin governance actions.',
      400,
      'REASON_REQUIRED'
    );
  }
  if (!isUuid(input.targetUserId)) {
    throw new AuthorizationError('Target user not found.', 404, 'USER_NOT_FOUND');
  }

  const reason = input.reason.trim();
  const reasonCategory: GovernanceReasonCategory = input.reasonCategory ?? 'GENERAL';

  await db.transaction(async (tx) => {
    const userRows = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.targetUserId))
      .limit(1);
    const targetUser = userRows[0];
    if (!targetUser) {
      throw new AuthorizationError('Target user not found.', 404, 'USER_NOT_FOUND');
    }

    if (input.actionType === 'SET_ACCOUNT_STATUS' && input.accountStatus) {
      if (input.accountStatus === 'SUSPENDED' || reasonCategory === 'FRAUD_INVESTIGATION') {
        assertAdminRole(ctx, ['TRUST_AND_SAFETY', 'PLATFORM_ADMIN']);
      }

      const prev = normalizeAccountStatus(targetUser.accountStatus);
      try {
        transitions.account(prev, input.accountStatus);
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
        }
        throw err;
      }

      await tx
        .update(users)
        .set({
          accountStatus: input.accountStatus,
          restrictionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUser.id));

      // NS-ACC-016: Automatically place PENDING commissions ON_HOLD on account suspension or fraud investigation
      let holdResult = {
        heldEntriesCount: 0,
        heldTotalKobo: 0,
        heldReferences: [] as string[],
      };
      if (input.accountStatus === 'SUSPENDED' || reasonCategory === 'FRAUD_INVESTIGATION') {
        holdResult = await placeUserPendingCommissionsOnHoldTx(
          tx,
          targetUser.id,
          `Fraud/suspension hold: ${reason}`
        );
      }

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: targetUser.id,
        action: 'ADMIN_ACCOUNT_STATUS_CHANGED',
        entityType: 'users',
        entityId: targetUser.id,
        previousValue: { accountStatus: prev },
        newValue: {
          accountStatus: input.accountStatus,
          reasonCategory,
          heldCommissionsCount: holdResult.heldEntriesCount,
          heldCommissionsKobo: holdResult.heldTotalKobo,
        },
        reason,
      });

      if (holdResult.heldEntriesCount > 0) {
        await tx.insert(notifications).values({
          userId: targetUser.id,
          category: 'TRUST',
          title: 'Account Suspended · Pending Commissions Placed On Hold',
          body: `${reason}. ${holdResult.heldEntriesCount} pending commission entry(s) were placed On Hold while your account is under review.`,
          actionUrl: '/?tab=wallet',
          isRead: false,
        });
      }
    }

    if (input.actionType === 'SET_SELLER_STATUS' && input.sellerStatus) {
      const sellerRows = await tx
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.ownerUserId, targetUser.id))
        .limit(1);
      const seller = sellerRows[0];
      if (!seller) {
        throw new AuthorizationError('Target user has no Seller profile.', 400, 'NO_SELLER_PROFILE');
      }
      const prev = normalizeSellerStatus(seller.sellerStatus);
      try {
        transitions.seller(prev, input.sellerStatus);
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
        }
        throw err;
      }

      await tx
        .update(sellerProfiles)
        .set({ sellerStatus: input.sellerStatus, updatedAt: new Date() })
        .where(eq(sellerProfiles.id, seller.id));

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: targetUser.id,
        action: 'ADMIN_SELLER_STATUS_CHANGED',
        entityType: 'seller_profiles',
        entityId: seller.id,
        previousValue: { sellerStatus: prev },
        newValue: { sellerStatus: input.sellerStatus, scoutAccountUnaffected: true },
        reason,
      });
    }

    if (input.actionType === 'SET_SUBSCRIPTION_STATUS' && input.subscriptionStatus) {
      const sellerRows = await tx
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.ownerUserId, targetUser.id))
        .limit(1);
      const seller = sellerRows[0];
      if (!seller) {
        throw new AuthorizationError('Target user has no Seller profile.', 400, 'NO_SELLER_PROFILE');
      }

      const prevSub = normalizeSubscriptionStatus(seller.subscriptionStatus);
      try {
        transitions.subscription(prevSub, input.subscriptionStatus);
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          throw new AuthorizationError(err.message, 409, 'INVALID_STATUS_TRANSITION');
        }
        throw err;
      }

      const nextExpiresAt =
        input.subscriptionStatus === 'GRACE_PERIOD'
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : seller.subscriptionExpiresAt;

      await tx
        .update(sellerProfiles)
        .set({
          subscriptionStatus: input.subscriptionStatus,
          subscriptionExpiresAt: nextExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(sellerProfiles.id, seller.id));

      // Downgrade rule: When subscription becomes EXPIRED, suspend excess active listings above STARTER cap (1) without deleting
      let suspendedCount = 0;
      if (input.subscriptionStatus === 'EXPIRED') {
        const published = await tx
          .select()
          .from(productListings)
          .where(
            and(
              eq(productListings.sellerProfileId, seller.id),
              eq(productListings.status, 'PUBLISHED')
            )
          )
          .orderBy(desc(productListings.createdAt));
        const starterMaxActive = SELLER_PLANS.starter.maxActiveListings;
        if (published.length > starterMaxActive) {
          const excessIds = published.slice(starterMaxActive).map((l) => l.id);
          await tx
            .update(productListings)
            .set({ status: 'EXPIRED' })
            .where(inArray(productListings.id, excessIds));
          suspendedCount = excessIds.length;
        }
      }

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: targetUser.id,
        action: 'ADMIN_SUBSCRIPTION_STATUS_CHANGED',
        entityType: 'seller_profiles',
        entityId: seller.id,
        previousValue: { subscriptionStatus: prevSub },
        newValue: {
          subscriptionStatus: input.subscriptionStatus,
          excessListingsSuspended: suspendedCount,
        },
        reason,
      });
    }

    if (input.actionType === 'HOLD_PENDING_COMMISSIONS') {
      assertAdminRole(ctx, ['TRUST_AND_SAFETY', 'FINANCE_OFFICER']);
      const holdResult = await placeUserPendingCommissionsOnHoldTx(
        tx,
        targetUser.id,
        `Trust & Safety hold: ${reason}`
      );

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: targetUser.id,
        action: 'ADMIN_COMMISSIONS_PLACED_ON_HOLD',
        entityType: 'commission_ledger_entries',
        entityId: null,
        previousValue: { status: 'Pending' },
        newValue: {
          status: 'On Hold',
          heldEntriesCount: holdResult.heldEntriesCount,
          heldTotalKobo: holdResult.heldTotalKobo,
        },
        reason,
      });
    }

    if (input.actionType === 'RESOLVE_ABUSE_REPORT' && isUuid(input.abuseReportId)) {
      const nextStatus = input.abuseResolution || 'RESOLVED';
      await tx
        .update(abuseReports)
        .set({
          status: nextStatus,
          resolvedBy: actorUserId,
          resolvedAt: new Date(),
        })
        .where(eq(abuseReports.id, input.abuseReportId));

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: targetUser.id,
        action: `ABUSE_REPORT_${nextStatus}`,
        entityType: 'abuse_reports',
        entityId: input.abuseReportId,
        newValue: { reportId: input.abuseReportId, status: nextStatus },
        reason,
      });
    }
  });
}

// NS-ACC-017: Explicit, audited SUPER_ADMIN-only reinstatement of a CLOSED account (preserving permanent ancestry)
export async function adminReinstateClosedAccount(
  actorUserId: string,
  input: {
    targetUserId: string;
    reason: string;
  }
) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPER_ADMIN']);

  if (!isUuid(input.targetUserId)) {
    throw new AuthorizationError('Target user not found.', 404, 'USER_NOT_FOUND');
  }
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new AuthorizationError(
      'Documented Super Admin reinstatement justification (minimum 5 characters) is required.',
      400,
      'REASON_REQUIRED'
    );
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.targetUserId))
      .limit(1);
    const targetUser = rows[0];
    if (!targetUser) {
      throw new AuthorizationError('Target user not found.', 404, 'USER_NOT_FOUND');
    }

    const prevStatus = normalizeAccountStatus(targetUser.accountStatus);
    if (prevStatus !== 'CLOSED') {
      throw new AuthorizationError(
        `Account reinstatement is only valid for CLOSED accounts (current status: ${prevStatus}).`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const now = new Date();
    const [reinstated] = await tx
      .update(users)
      .set({
        accountStatus: 'ACTIVE',
        closedAt: null,
        restrictionReason: null,
        updatedAt: now,
      })
      .where(eq(users.id, targetUser.id))
      .returning();

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: targetUser.id,
      action: 'ADMIN_ACCOUNT_REINSTATED',
      entityType: 'users',
      entityId: targetUser.id,
      previousValue: {
        accountStatus: prevStatus,
        closedAt: targetUser.closedAt?.toISOString() ?? null,
      },
      newValue: {
        accountStatus: 'ACTIVE',
        reinstatedBySuperAdmin: actorUserId,
        referralAncestryPreserved: true,
      },
      reason,
    });

    await tx.insert(notifications).values({
      userId: targetUser.id,
      category: 'TRUST',
      title: 'NairaScout Account Reinstated',
      body: `Your closed account has been explicitly reinstated to ACTIVE status by Super Admin review: ${reason}`,
      actionUrl: '/settings',
      isRead: false,
    });

    return reinstated;
  });
}

// NS-GOV-003 & NS-REF-004: Maker-Checker request creation (ANCESTRY_OVERRIDE restricted strictly to SUPER_ADMIN)
export async function adminCreateMakerCheckerRequest(
  actorUserId: string,
  input: {
    actionType: MakerCheckerActionType;
    targetUserId: string;
    targetEntityId?: string | null;
    payload: Record<string, unknown>;
    reason: string;
  }
) {
  const db = requireDb();
  const ctx = await loadDbAuthContext(actorUserId);
  if (input.actionType === 'ANCESTRY_OVERRIDE') {
    assertAdminRole(ctx, ['SUPER_ADMIN']);
  } else {
    assertAdminRole(ctx, [
      'FINANCE_OFFICER',
      'PLATFORM_ADMIN',
      'TRUST_AND_SAFETY',
      'OPERATIONS_MANAGER',
    ]);
  }

  if (!isUuid(input.targetUserId)) {
    throw new AuthorizationError('Valid target user UUID is required.', 400, 'INVALID_TARGET');
  }
  if (!input.reason.trim()) {
    throw new AuthorizationError('Maker justification reason is required.', 400, 'REASON_REQUIRED');
  }

  const [created] = await db
    .insert(makerCheckerRequests)
    .values({
      actionType: input.actionType,
      targetUserId: input.targetUserId,
      targetEntityId: isUuid(input.targetEntityId) ? input.targetEntityId : null,
      payload: input.payload || {},
      reason: input.reason.trim(),
      status: 'PENDING',
      makerId: actorUserId,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorId: actorUserId,
    affectedUserId: input.targetUserId,
    action: 'MAKER_CHECKER_REQUEST_CREATED',
    entityType: 'maker_checker_requests',
    entityId: created.id,
    newValue: { actionType: input.actionType, payload: input.payload },
    reason: input.reason.trim(),
  });

  return created;
}

// NS-GOV-003 & NS-REF-004: Dual-control Maker-Checker execution (ANCESTRY_OVERRIDE requires dual SUPER_ADMIN + SET LOCAL)
export async function adminDecideMakerCheckerRequest(
  actorUserId: string,
  input: {
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    checkerNotes: string;
  }
) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['FINANCE_OFFICER', 'PLATFORM_ADMIN', 'TRUST_AND_SAFETY']);

  if (!isUuid(input.requestId)) {
    throw new AuthorizationError('Maker-Checker request not found.', 404, 'NOT_FOUND');
  }
  if (!input.checkerNotes.trim()) {
    throw new AuthorizationError('Checker decision notes are required.', 400, 'NOTES_REQUIRED');
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(makerCheckerRequests)
      .where(eq(makerCheckerRequests.id, input.requestId))
      .limit(1);
    const reqRow = rows[0];
    if (!reqRow || reqRow.status !== 'PENDING') {
      throw new AuthorizationError('Pending Maker-Checker request not found.', 404, 'NOT_FOUND');
    }

    // Strict Dual-Control Check: maker_id !== checker_id
    assertMakerCheckerDistinct(reqRow.makerId, actorUserId);

    // NS-REF-004: Strict dual-approved SUPER_ADMIN authorization for ANCESTRY_OVERRIDE
    if (reqRow.actionType === 'ANCESTRY_OVERRIDE') {
      assertAdminRole(ctx, ['SUPER_ADMIN']);
      const makerRoleRows = await tx
        .select({ adminRole: platformAdminRoles.adminRole })
        .from(platformAdminRoles)
        .where(eq(platformAdminRoles.userId, reqRow.makerId))
        .limit(1);
      if (normalizeAdminRole(makerRoleRows[0]?.adminRole) !== 'SUPER_ADMIN') {
        throw new AuthorizationError(
          'ANCESTRY_OVERRIDE requires dual-approved SUPER_ADMIN Maker-Checker authorization.',
          403,
          'SUPER_ADMIN_DUAL_CONTROL_REQUIRED'
        );
      }
    }

    const now = new Date();
    const notes = input.checkerNotes.trim();

    if (input.decision === 'REJECTED') {
      const [rejected] = await tx
        .update(makerCheckerRequests)
        .set({
          status: 'REJECTED',
          checkerId: actorUserId,
          checkerNotes: notes,
          decidedAt: now,
        })
        .where(eq(makerCheckerRequests.id, reqRow.id))
        .returning();

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: reqRow.targetUserId,
        action: 'MAKER_CHECKER_REJECTED',
        entityType: 'maker_checker_requests',
        entityId: reqRow.id,
        previousValue: { status: 'PENDING' },
        newValue: { status: 'REJECTED' },
        reason: notes,
      });
      return rejected;
    }

    // Execute approved dual-control action atomically
    const payload = reqRow.payload || {};
    if (
      reqRow.actionType === 'COMMISSION_ADJUSTMENT' ||
      reqRow.actionType === 'WALLET_CORRECTION'
    ) {
      const amountNaira = Number(payload.amountNaira || 0);
      const amountKobo = Math.round(amountNaira * 100);
      if (amountKobo !== 0) {
        const ref = `MC-${reqRow.id.slice(0, 8).toUpperCase()}`;
        await tx.insert(commissionLedgerEntries).values({
          reference: ref,
          orderId: String(payload.orderId || ref),
          referralEventId: null,
          beneficiaryScoutId: reqRow.targetUserId,
          generation: 1,
          fractionLabel: 'Dual-Control Adj',
          amountKobo: Math.abs(amountKobo),
          status: amountKobo > 0 ? 'Available' : 'Reversed',
          ruleVersion: COMMISSION_RULE_VERSION,
          description: `Maker-Checker ${reqRow.actionType}: ${reqRow.reason} (${notes})`,
        });
      }
    } else if (reqRow.actionType === 'ROLE_ASSIGNMENT') {
      const assignedRole = String(payload.adminRole || '');
      if (ALL_PLATFORM_ADMIN_ROLES.includes(assignedRole as AdminRole)) {
        await tx
          .insert(platformAdminRoles)
          .values({
            userId: reqRow.targetUserId,
            adminRole: assignedRole as AdminRole,
            assignedBy: actorUserId,
          })
          .onConflictDoUpdate({
            target: platformAdminRoles.userId,
            set: { adminRole: assignedRole as AdminRole, assignedBy: actorUserId },
          });
      }
    } else if (reqRow.actionType === 'ANCESTRY_OVERRIDE') {
      const newDirectReferrerId =
        typeof payload.directReferrerId === 'string' && isUuid(payload.directReferrerId)
          ? payload.directReferrerId
          : null;
      if (newDirectReferrerId === reqRow.targetUserId) {
        throw new AuthorizationError('Self-referral ancestry override rejected.', 400, 'SELF_REFERRAL');
      }

      if (newDirectReferrerId) {
        const allAncestryRows = await tx
          .select({
            scoutUserId: referralAncestry.scoutUserId,
            directReferrerId: referralAncestry.directReferrerId,
          })
          .from(referralAncestry);
        const directReferrerMap: Record<string, string | null> = {};
        for (const row of allAncestryRows) {
          directReferrerMap[row.scoutUserId] = row.directReferrerId;
        }
        const cycleCheck = validateAncestryRelationship(
          reqRow.targetUserId,
          newDirectReferrerId,
          directReferrerMap
        );
        if (!cycleCheck.valid) {
          throw new AuthorizationError(
            cycleCheck.reason || 'Circular referral ancestry rejected.',
            400,
            'CIRCULAR_ANCESTRY'
          );
        }
      }

      // NS-REF-004: Authorize PostgreSQL trg_protect_referral_ancestry strictly inside this transaction
      await tx.execute(sql`SET LOCAL app.allow_ancestry_override = 'true'`);
      await tx
        .update(referralAncestry)
        .set({
          directReferrerId: newDirectReferrerId,
          attributionSource: newDirectReferrerId ? 'MAKER_CHECKER_OVERRIDE' : 'ORGANIC',
        })
        .where(eq(referralAncestry.scoutUserId, reqRow.targetUserId));
    }

    const [executed] = await tx
      .update(makerCheckerRequests)
      .set({
        status: 'EXECUTED',
        checkerId: actorUserId,
        checkerNotes: notes,
        decidedAt: now,
      })
      .where(eq(makerCheckerRequests.id, reqRow.id))
      .returning();

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: reqRow.targetUserId,
      action: `MAKER_CHECKER_EXECUTED_${reqRow.actionType}`,
      entityType: 'maker_checker_requests',
      entityId: reqRow.id,
      previousValue: { status: 'PENDING', makerId: reqRow.makerId },
      newValue: { status: 'EXECUTED', checkerId: actorUserId, payload },
      reason: notes,
    });

    return executed;
  });
}

// NS-ACC-015 & NS-GOV-004: Independent Appeals Officer adjudication (appeals_officer_id !== original_reviewer_id)
export async function adminDecideAppeal(
  actorUserId: string,
  input: {
    appealId: string;
    decision: 'UNDER_REVIEW' | 'UPHELD' | 'OVERTURNED';
    decisionNotes: string;
  }
) {
  const db = requireDb();
  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['APPEALS_OFFICER']);

  if (!isUuid(input.appealId)) {
    throw new AuthorizationError('Appeal record not found.', 404, 'NOT_FOUND');
  }
  if (!input.decisionNotes.trim() && input.decision !== 'UNDER_REVIEW') {
    throw new AuthorizationError('Appeal resolution notes are required.', 400, 'NOTES_REQUIRED');
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(governanceAppeals)
      .where(eq(governanceAppeals.id, input.appealId))
      .limit(1);
    const appeal = rows[0];
    if (!appeal) {
      throw new AuthorizationError('Appeal record not found.', 404, 'NOT_FOUND');
    }
    if (appeal.status === 'UPHELD' || appeal.status === 'OVERTURNED') {
      throw new AuthorizationError(
        `Appeal is already resolved (${appeal.status}).`,
        409,
        'APPEAL_ALREADY_RESOLVED'
      );
    }

    // Independent reviewer enforcement: cannot adjudicate own prior decision or own appeal
    assertIndependentAppealsOfficer(
      actorUserId,
      appeal.originalReviewerId,
      appeal.appellantUserId
    );

    const now = new Date();
    const notes = input.decisionNotes.trim() || 'Marked Under Review by independent Appeals Officer';

    if (input.decision === 'OVERTURNED') {
      if (appeal.targetType === 'RESTRICTION') {
        await tx
          .update(capabilityRestrictions)
          .set({ status: 'LIFTED', liftedAt: now, liftedBy: actorUserId })
          .where(eq(capabilityRestrictions.id, appeal.targetRecordId));
      } else if (appeal.targetType === 'VERIFICATION') {
        await tx
          .update(verificationRecords)
          .set({
            status: 'SUBMITTED',
            reviewerNotes: `Appeal overturned: ${notes}`,
            updatedAt: now,
          })
          .where(eq(verificationRecords.id, appeal.targetRecordId));
      }
    }

    const [updated] = await tx
      .update(governanceAppeals)
      .set({
        status: input.decision,
        appealsOfficerId: actorUserId,
        decisionNotes: notes,
        resolvedAt: input.decision === 'UNDER_REVIEW' ? null : now,
      })
      .where(eq(governanceAppeals.id, appeal.id))
      .returning();

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: appeal.appellantUserId,
      action: `APPEAL_${input.decision}`,
      entityType: 'governance_appeals',
      entityId: appeal.id,
      previousValue: { status: appeal.status },
      newValue: { status: input.decision, targetType: appeal.targetType },
      reason: notes,
    });

    await tx.insert(notifications).values({
      userId: appeal.appellantUserId,
      category: 'TRUST',
      title: `Appeal ${input.decision}`,
      body: notes,
      actionUrl: '/settings',
      isRead: false,
    });

    return updated;
  });
}

export async function submitSupportCaseForActor(
  actorUserId: string,
  input: {
    topic: SupportCase['topic'];
    subject: string;
    details: string;
  }
): Promise<SupportCase> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  const id = `SUP-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;
  const [created] = await db
    .insert(supportCases)
    .values({
      id,
      userId: actorUserId,
      topic: input.topic,
      subject: input.subject.trim(),
      details: input.details.trim(),
      status: 'Under Review',
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    topic: created.topic as SupportCase['topic'],
    subject: created.subject,
    details: created.details,
    status: created.status as SupportCase['status'],
    createdAt: created.createdAt.toISOString(),
  };
}

// NS-GOV-005: Admin-managed product listing categories (SUPER_ADMIN)
export async function adminCreateListingCategory(
  actorUserId: string,
  input: {
    name: string;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }
): Promise<ListingCategoryDTO> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPER_ADMIN']);

  const name = input.name.trim();
  if (name.length < 2 || name.length > 64) {
    throw new AuthorizationError(
      'Category name must be between 2 and 64 characters.',
      400,
      'INVALID_CATEGORY_NAME'
    );
  }

  const baseSlug = slugifyCategoryName(name);
  if (!baseSlug) {
    throw new AuthorizationError('Category name must include letters or numbers.', 400, 'INVALID_SLUG');
  }

  const description = input.description?.trim() ? input.description.trim() : null;
  const isActive = input.isActive !== false;
  const sortOrder = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0;

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: listingCategories.id })
      .from(listingCategories)
      .where(or(eq(listingCategories.name, name), eq(listingCategories.slug, baseSlug)))
      .limit(1);

    if (existing.length > 0) {
      throw new AuthorizationError(
        `A listing category named "${name}" already exists.`,
        409,
        'CATEGORY_ALREADY_EXISTS'
      );
    }

    const [created] = await tx
      .insert(listingCategories)
      .values({
        name,
        slug: baseSlug,
        description,
        isActive,
        sortOrder,
        createdBy: actorUserId,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'CREATE_LISTING_CATEGORY',
      entityType: 'listing_category',
      entityId: created.id,
      previousValue: null,
      newValue: {
        name: created.name,
        slug: created.slug,
        isActive: created.isActive,
        sortOrder: created.sortOrder,
      },
      reason: `Super Admin added listing category "${created.name}"`,
    });

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      description: created.description ?? null,
      isActive: created.isActive,
      sortOrder: created.sortOrder,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function adminUpdateListingCategory(
  actorUserId: string,
  input: {
    id: string;
    name?: string;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }
): Promise<ListingCategoryDTO> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPER_ADMIN']);

  if (!isUuid(input.id)) {
    throw new AuthorizationError('Invalid listing category ID.', 400, 'INVALID_CATEGORY_ID');
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(listingCategories)
      .where(eq(listingCategories.id, input.id))
      .limit(1);
    const current = rows[0];
    if (!current) {
      throw new AuthorizationError('Listing category not found.', 404, 'CATEGORY_NOT_FOUND');
    }

    let nextName = current.name;
    let nextSlug = current.slug;
    if (typeof input.name === 'string') {
      const trimmed = input.name.trim();
      if (trimmed.length < 2 || trimmed.length > 64) {
        throw new AuthorizationError(
          'Category name must be between 2 and 64 characters.',
          400,
          'INVALID_CATEGORY_NAME'
        );
      }
      const candidateSlug = slugifyCategoryName(trimmed);
      if (!candidateSlug) {
        throw new AuthorizationError('Category name must include letters or numbers.', 400, 'INVALID_SLUG');
      }
      if (trimmed !== current.name || candidateSlug !== current.slug) {
        const conflict = await tx
          .select({ id: listingCategories.id })
          .from(listingCategories)
          .where(or(eq(listingCategories.name, trimmed), eq(listingCategories.slug, candidateSlug)))
          .limit(1);
        if (conflict[0] && conflict[0].id !== current.id) {
          throw new AuthorizationError(
            `Another category already uses "${trimmed}".`,
            409,
            'CATEGORY_ALREADY_EXISTS'
          );
        }
      }
      nextName = trimmed;
      nextSlug = candidateSlug;
    }

    const nextDescription =
      input.description !== undefined
        ? input.description?.trim() || null
        : current.description;
    const nextIsActive =
      typeof input.isActive === 'boolean' ? input.isActive : current.isActive;
    const nextSortOrder =
      typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
        ? input.sortOrder
        : current.sortOrder;

    const [updated] = await tx
      .update(listingCategories)
      .set({
        name: nextName,
        slug: nextSlug,
        description: nextDescription,
        isActive: nextIsActive,
        sortOrder: nextSortOrder,
      })
      .where(eq(listingCategories.id, current.id))
      .returning();

    const toggledOnly =
      nextName === current.name &&
      nextDescription === current.description &&
      nextSortOrder === current.sortOrder &&
      nextIsActive !== current.isActive;

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: toggledOnly ? 'TOGGLE_LISTING_CATEGORY' : 'UPDATE_LISTING_CATEGORY',
      entityType: 'listing_category',
      entityId: updated.id,
      previousValue: {
        name: current.name,
        slug: current.slug,
        description: current.description,
        isActive: current.isActive,
        sortOrder: current.sortOrder,
      },
      newValue: {
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        isActive: updated.isActive,
        sortOrder: updated.sortOrder,
      },
      reason: toggledOnly
        ? `Super Admin ${updated.isActive ? 'activated' : 'deactivated'} category "${updated.name}"`
        : `Super Admin updated listing category "${updated.name}"`,
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description ?? null,
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
    };
  });
}

export interface GlobalSearchProductHit {
  id: string;
  title: string;
  category: string;
  priceKobo: number;
  imageUrl: string;
  sellerName: string;
  sellerCity: string;
  sellerLogoUrl: string | null;
}

export interface GlobalSearchCategoryHit {
  id: string;
  name: string;
  slug: string;
}

export interface GlobalSearchPersonHit {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  locationState: string | null;
  sellerName: string | null;
  sellerLogoUrl: string | null;
  isSeller: boolean;
  isSellerVerified: boolean;
}

export interface GlobalSearchResponse {
  query: string;
  products: GlobalSearchProductHit[];
  categories: GlobalSearchCategoryHit[];
  people: GlobalSearchPersonHit[];
}

export async function searchGlobalDirectory(
  rawQuery: string,
  viewerUserId: string | null
): Promise<GlobalSearchResponse> {
  const query = rawQuery.trim();
  if (query.length < 3 || !isPostgresConfigured()) {
    return { query, products: [], categories: [], people: [] };
  }

  const db = getDb();
  if (!db) {
    return { query, products: [], categories: [], people: [] };
  }

  await ensureTablesReady(db);
  const pattern = `%${query.replace(/[%_\\]/g, '\\$&')}%`;

  const [matchedProducts, matchedCategories, allScoutsRows, allSellerRows, allUserRows, allVerifsRows] =
    await Promise.all([
      db
        .select()
        .from(productListings)
        .where(
          and(
            eq(productListings.status, 'PUBLISHED'),
            or(
              ilike(productListings.title, pattern),
              ilike(productListings.description, pattern),
              ilike(productListings.category, pattern),
              ilike(productListings.sellerName, pattern)
            )
          )
        )
        .orderBy(desc(productListings.createdAt))
        .limit(5),
      db
        .select({
          id: listingCategories.id,
          name: listingCategories.name,
          slug: listingCategories.slug,
        })
        .from(listingCategories)
        .where(
          and(
            eq(listingCategories.isActive, true),
            or(ilike(listingCategories.name, pattern), ilike(listingCategories.slug, pattern))
          )
        )
        .orderBy(asc(listingCategories.sortOrder), asc(listingCategories.name))
        .limit(5),
      db.select().from(scoutProfiles),
      db.select().from(sellerProfiles),
      db.select({ id: users.id, accountStatus: users.accountStatus }).from(users),
      db
        .select({
          sellerProfileId: verificationRecords.sellerProfileId,
          category: verificationRecords.category,
          status: verificationRecords.status,
        })
        .from(verificationRecords)
        .where(eq(verificationRecords.category, 'SELLER')),
    ]);

  let blockedIds = new Set<string>();
  if (viewerUserId) {
    const blocks = await db
      .select()
      .from(userBlocks)
      .where(or(eq(userBlocks.blockerId, viewerUserId), eq(userBlocks.blockedId, viewerUserId)));
    blockedIds = new Set(
      blocks.map((b) => (b.blockerId === viewerUserId ? b.blockedId : b.blockerId))
    );
  }

  const sellerById = new Map(allSellerRows.map((s) => [s.id, s]));
  const sellerByOwner = new Map(allSellerRows.map((s) => [s.ownerUserId, s]));
  const userStatusById = new Map(allUserRows.map((u) => [u.id, u.accountStatus]));
  const verifiedSellerIds = new Set(
    allVerifsRows
      .filter((v) => v.sellerProfileId && normalizeVerificationStatus(v.status) === 'VERIFIED')
      .map((v) => v.sellerProfileId as string)
  );

  const products: GlobalSearchProductHit[] = matchedProducts.map((p) => {
    const seller = sellerById.get(p.sellerProfileId);
    return {
      id: p.id,
      title: p.title,
      category: p.category,
      priceKobo: Number(p.priceKobo),
      imageUrl: p.imageUrl,
      sellerName: p.sellerName,
      sellerCity: p.sellerCity,
      sellerLogoUrl: seller?.logoUrl ?? null,
    };
  });

  const qLower = query.toLowerCase();
  const people: GlobalSearchPersonHit[] = allScoutsRows
    .filter((s) => {
      if (viewerUserId && s.userId === viewerUserId) return false;
      if (blockedIds.has(s.userId)) return false;
      const status = userStatusById.get(s.userId);
      if (!status || status === 'CLOSED' || status === 'SUSPENDED') return false;
      const seller = sellerByOwner.get(s.userId);
      return (
        s.username.toLowerCase().includes(qLower) ||
        s.displayName.toLowerCase().includes(qLower) ||
        (seller ? seller.sellerName.toLowerCase().includes(qLower) : false)
      );
    })
    .slice(0, 5)
    .map((s) => {
      const seller = sellerByOwner.get(s.userId);
      const sellerActive = Boolean(seller && normalizeSellerStatus(seller.sellerStatus) !== 'CLOSED');
      const dto = toPublicScoutProfileDTO({
        userId: s.userId,
        username: s.username,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        bio: s.bio,
        locationState: s.locationState,
        sellerStatus: seller ? normalizeSellerStatus(seller.sellerStatus) : null,
        sellerVerificationStatus:
          seller && verifiedSellerIds.has(seller.id) ? 'VERIFIED' : null,
        workingWithCount: 0,
        totalSoldUnits: 0,
      });
      return {
        userId: dto.userId,
        username: dto.username,
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        locationState: dto.locationState,
        sellerName: sellerActive && seller ? seller.sellerName : null,
        sellerLogoUrl: sellerActive && seller ? seller.logoUrl ?? null : null,
        isSeller: sellerActive,
        isSellerVerified: Boolean(seller && verifiedSellerIds.has(seller.id)),
      };
    });

  return {
    query,
    products,
    categories: matchedCategories,
    people,
  };
}

// NS-NOT-001 & NS-ACC-017: Fetch notifications and unread count with live accountStatus verification
export async function getNotificationsForActor(actorUserId: string): Promise<{
  notifications: PlatformNotification[];
  unreadCount: number;
}> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, actorUserId))
    .orderBy(desc(notifications.createdAt));

  const mapped: PlatformNotification[] = rows.map((n) => ({
    id: n.id,
    userId: n.userId,
    category: n.category,
    title: n.title,
    body: n.body,
    actionUrl: n.actionUrl ?? null,
    createdAt: n.createdAt.toISOString(),
    isRead: n.isRead,
    read: n.isRead,
    readAt: n.readAt?.toISOString() ?? null,
  }));

  return {
    notifications: mapped,
    unreadCount: mapped.filter((n) => !n.isRead).length,
  };
}

// NS-NOT-001 & NS-ACC-017: Mark single or all notifications as read with live accountStatus verification
export async function markNotificationReadForActor(
  actorUserId: string,
  options: { notificationId?: string; markAll?: boolean }
): Promise<{
  notifications: PlatformNotification[];
  unreadCount: number;
}> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  const now = new Date();
  if (options.markAll) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: now })
      .where(and(eq(notifications.userId, actorUserId), eq(notifications.isRead, false)));
  } else if (options.notificationId && isUuid(options.notificationId)) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(notifications.id, options.notificationId),
          eq(notifications.userId, actorUserId),
          eq(notifications.isRead, false)
        )
      );
  } else {
    throw new AuthorizationError('Valid notification ID or markAll flag is required.', 400, 'INVALID_NOTIFICATION_ID');
  }

  return getNotificationsForActor(actorUserId);
}

// ============================================================================
// PLATFORM POLICIES & HELP CENTRE KNOWLEDGE BASE (NS-FND-003 .. NS-FND-007)
// ============================================================================

const VALID_HELP_CATEGORIES = new Set<string>(HELP_ARTICLE_CATEGORIES.map((c) => c.id));
const VALID_HELP_ROLES = new Set<string>(HELP_AUDIENCE_ROLES.map((r) => r.id));

function mapPolicyRow(row: typeof platformPolicies.$inferSelect): PlatformPolicyDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    contentMarkdown: row.contentMarkdown,
    version: row.version,
    effectiveDate: row.effectiveDate.toISOString(),
    isPublished: row.isPublished,
    updatedBy: row.updatedBy ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapHelpArticleRow(row: typeof helpArticles.$inferSelect): HelpArticleDTO {
  return {
    id: row.id,
    slug: row.slug,
    category: (VALID_HELP_CATEGORIES.has(row.category)
      ? row.category
      : 'GETTING_STARTED') as HelpArticleCategory,
    title: row.title,
    summary: row.summary,
    bodyMarkdown: row.bodyMarkdown,
    audienceRole: (VALID_HELP_ROLES.has(row.audienceRole)
      ? row.audienceRole
      : 'ALL') as HelpAudienceRole,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getAllPlatformPoliciesForAdmin(db: NairaScoutDb): Promise<PlatformPolicyDTO[]> {
  const rows = await db.select().from(platformPolicies).orderBy(asc(platformPolicies.slug));
  return rows.map(mapPolicyRow);
}

async function getAllHelpArticlesForAdmin(db: NairaScoutDb): Promise<HelpArticleDTO[]> {
  const rows = await db
    .select()
    .from(helpArticles)
    .orderBy(asc(helpArticles.sortOrder), asc(helpArticles.title));
  return rows.map(mapHelpArticleRow);
}

// NS-FND-003 & NS-FND-006: Public read of published Platform Policies & Programme Rules
export async function getPublishedPlatformPolicies(slug?: string): Promise<PlatformPolicyDTO[]> {
  const fallback: PlatformPolicyDTO[] = DEFAULT_PLATFORM_POLICIES_SEED.map((p, idx) => ({
    id: `seed-policy-${idx + 1}`,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    contentMarkdown: p.contentMarkdown,
    version: p.version,
    effectiveDate: p.effectiveDate,
    isPublished: p.isPublished,
    updatedBy: null,
    updatedAt: p.effectiveDate,
  })).filter((p) => !slug || p.slug === slug);

  if (!isPostgresConfigured()) return fallback;
  const db = getDb();
  if (!db) return fallback;

  await ensureTablesReady(db);
  const rows = slug
    ? await db
        .select()
        .from(platformPolicies)
        .where(and(eq(platformPolicies.isPublished, true), eq(platformPolicies.slug, slug)))
        .orderBy(asc(platformPolicies.slug))
    : await db
        .select()
        .from(platformPolicies)
        .where(eq(platformPolicies.isPublished, true))
        .orderBy(asc(platformPolicies.slug));

  return rows.length > 0 ? rows.map(mapPolicyRow) : fallback;
}

// NS-FND-004 & NS-FND-005: Public read & keyword search of published Help Centre articles
export async function getPublishedHelpArticles(options?: {
  q?: string;
  category?: string;
}): Promise<HelpArticleDTO[]> {
  const query = (options?.q || '').trim().toLowerCase();
  const category = (options?.category || '').trim().toUpperCase();

  const filterInMemory = (list: HelpArticleDTO[]) =>
    list.filter((article) => {
      const catOk = !category || category === 'ALL' || article.category === category;
      const textOk =
        !query ||
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.bodyMarkdown.toLowerCase().includes(query);
      return catOk && textOk;
    });

  const fallback: HelpArticleDTO[] = DEFAULT_HELP_ARTICLES_SEED.map((a, idx) => ({
    id: `seed-article-${idx + 1}`,
    slug: a.slug,
    category: a.category,
    title: a.title,
    summary: a.summary,
    bodyMarkdown: a.bodyMarkdown,
    audienceRole: a.audienceRole,
    sortOrder: a.sortOrder,
    isPublished: a.isPublished,
    updatedAt: '2026-11-25T00:00:00.000Z',
  }));

  if (!isPostgresConfigured()) return filterInMemory(fallback);
  const db = getDb();
  if (!db) return filterInMemory(fallback);

  await ensureTablesReady(db);

  const whereClauses = [eq(helpArticles.isPublished, true)];
  if (category && category !== 'ALL' && VALID_HELP_CATEGORIES.has(category)) {
    whereClauses.push(eq(helpArticles.category, category));
  }
  if (query) {
    const pattern = `%${query.replace(/[%_\\]/g, '\\$&')}%`;
    const searchClause = or(
      ilike(helpArticles.title, pattern),
      ilike(helpArticles.summary, pattern),
      ilike(helpArticles.bodyMarkdown, pattern)
    );
    if (searchClause) whereClauses.push(searchClause);
  }

  const rows = await db
    .select()
    .from(helpArticles)
    .where(and(...whereClauses))
    .orderBy(asc(helpArticles.sortOrder), asc(helpArticles.title));

  return rows.map(mapHelpArticleRow);
}

// NS-FND-007: Admin content editor snapshot (SUPER_ADMIN & PLATFORM_ADMIN)
export async function getAdminContentSnapshot(actorUserId: string): Promise<{
  policies: PlatformPolicyDTO[];
  helpArticles: HelpArticleDTO[];
}> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPER_ADMIN', 'PLATFORM_ADMIN']);

  const [policies, articles] = await Promise.all([
    getAllPlatformPoliciesForAdmin(db),
    getAllHelpArticlesForAdmin(db),
  ]);

  return { policies, helpArticles: articles };
}

// NS-FND-007: Create or update Platform Policy with version & audit trail
export async function adminUpsertPlatformPolicy(
  actorUserId: string,
  input: {
    id?: string;
    slug: string;
    title: string;
    summary: string;
    contentMarkdown: string;
    version: string;
    effectiveDate?: string;
    isPublished: boolean;
  }
): Promise<PlatformPolicyDTO> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPER_ADMIN', 'PLATFORM_ADMIN']);

  const cleanSlug = slugifyCategoryName(input.slug || input.title);
  const title = (input.title || '').trim();
  const summary = (input.summary || '').trim();
  const contentMarkdown = (input.contentMarkdown || '').trim();
  const version = (input.version || '1.0.0').trim();
  const effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : new Date();

  if (!cleanSlug || title.length < 3 || summary.length < 5 || contentMarkdown.length < 10) {
    throw new AuthorizationError(
      'Policy slug, title, summary, and markdown content are required.',
      400,
      'INVALID_POLICY_PAYLOAD'
    );
  }
  if (Number.isNaN(effectiveDate.getTime())) {
    throw new AuthorizationError('Valid effective date is required.', 400, 'INVALID_EFFECTIVE_DATE');
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    let existing: typeof platformPolicies.$inferSelect | undefined;
    if (input.id && isUuid(input.id)) {
      const rows = await tx
        .select()
        .from(platformPolicies)
        .where(eq(platformPolicies.id, input.id))
        .limit(1);
      existing = rows[0];
    } else {
      const rows = await tx
        .select()
        .from(platformPolicies)
        .where(eq(platformPolicies.slug, cleanSlug))
        .limit(1);
      existing = rows[0];
    }

    if (existing) {
      const [updated] = await tx
        .update(platformPolicies)
        .set({
          slug: cleanSlug,
          title,
          summary,
          contentMarkdown,
          version,
          effectiveDate,
          isPublished: input.isPublished,
          updatedBy: actorUserId,
          updatedAt: now,
        })
        .where(eq(platformPolicies.id, existing.id))
        .returning();

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: actorUserId,
        action: 'UPDATE_PLATFORM_POLICY',
        entityType: 'platform_policy',
        entityId: updated.id,
        previousValue: {
          slug: existing.slug,
          title: existing.title,
          version: existing.version,
          isPublished: existing.isPublished,
        },
        newValue: {
          slug: updated.slug,
          title: updated.title,
          version: updated.version,
          isPublished: updated.isPublished,
        },
        reason: `Admin updated platform policy "${updated.slug}" (v${updated.version})`,
      });

      return mapPolicyRow(updated);
    }

    const [created] = await tx
      .insert(platformPolicies)
      .values({
        slug: cleanSlug,
        title,
        summary,
        contentMarkdown,
        version,
        effectiveDate,
        isPublished: input.isPublished,
        updatedBy: actorUserId,
        updatedAt: now,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'CREATE_PLATFORM_POLICY',
      entityType: 'platform_policy',
      entityId: created.id,
      previousValue: null,
      newValue: {
        slug: created.slug,
        title: created.title,
        version: created.version,
        isPublished: created.isPublished,
      },
      reason: `Admin created platform policy "${created.slug}" (v${created.version})`,
    });

    return mapPolicyRow(created);
  });
}

// NS-FND-007: Create or update Help Centre article with audit trail
export async function adminUpsertHelpArticle(
  actorUserId: string,
  input: {
    id?: string;
    slug: string;
    category: string;
    title: string;
    summary: string;
    bodyMarkdown: string;
    audienceRole: string;
    sortOrder?: number;
    isPublished: boolean;
  }
): Promise<HelpArticleDTO> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPER_ADMIN', 'PLATFORM_ADMIN']);

  const cleanSlug = slugifyCategoryName(input.slug || input.title);
  const category = (input.category || '').trim().toUpperCase();
  const title = (input.title || '').trim();
  const summary = (input.summary || '').trim();
  const bodyMarkdown = (input.bodyMarkdown || '').trim();
  const audienceRole = (input.audienceRole || 'ALL').trim().toUpperCase();
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;

  if (!cleanSlug || title.length < 3 || summary.length < 5 || bodyMarkdown.length < 10) {
    throw new AuthorizationError(
      'Article slug, title, summary, and markdown body are required.',
      400,
      'INVALID_HELP_ARTICLE_PAYLOAD'
    );
  }
  if (!VALID_HELP_CATEGORIES.has(category)) {
    throw new AuthorizationError('Invalid Help Centre article category.', 400, 'INVALID_CATEGORY');
  }
  if (!VALID_HELP_ROLES.has(audienceRole)) {
    throw new AuthorizationError('Invalid audience role.', 400, 'INVALID_AUDIENCE_ROLE');
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    let existing: typeof helpArticles.$inferSelect | undefined;
    if (input.id && isUuid(input.id)) {
      const rows = await tx
        .select()
        .from(helpArticles)
        .where(eq(helpArticles.id, input.id))
        .limit(1);
      existing = rows[0];
    } else {
      const rows = await tx
        .select()
        .from(helpArticles)
        .where(eq(helpArticles.slug, cleanSlug))
        .limit(1);
      existing = rows[0];
    }

    if (existing) {
      const [updated] = await tx
        .update(helpArticles)
        .set({
          slug: cleanSlug,
          category,
          title,
          summary,
          bodyMarkdown,
          audienceRole,
          sortOrder,
          isPublished: input.isPublished,
          updatedAt: now,
        })
        .where(eq(helpArticles.id, existing.id))
        .returning();

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: actorUserId,
        action: 'UPDATE_HELP_ARTICLE',
        entityType: 'help_article',
        entityId: updated.id,
        previousValue: {
          slug: existing.slug,
          category: existing.category,
          title: existing.title,
          isPublished: existing.isPublished,
        },
        newValue: {
          slug: updated.slug,
          category: updated.category,
          title: updated.title,
          isPublished: updated.isPublished,
        },
        reason: `Admin updated help article "${updated.slug}"`,
      });

      return mapHelpArticleRow(updated);
    }

    const [created] = await tx
      .insert(helpArticles)
      .values({
        slug: cleanSlug,
        category,
        title,
        summary,
        bodyMarkdown,
        audienceRole,
        sortOrder,
        isPublished: input.isPublished,
        updatedAt: now,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'CREATE_HELP_ARTICLE',
      entityType: 'help_article',
      entityId: created.id,
      previousValue: null,
      newValue: {
        slug: created.slug,
        category: created.category,
        title: created.title,
        isPublished: created.isPublished,
      },
      reason: `Admin created help article "${created.slug}"`,
    });

    return mapHelpArticleRow(created);
  });
}

// ============================================================================
// MODULE 4 SECURITY EVENTS, REAUTHENTICATION & ACCOUNT RECOVERY (NS-AUT-003..007)
// ============================================================================

// NS-AUT-005: Record fresh reauthentication timestamp (last_reauthenticated_at)
export async function recordUserReauthentication(
  actorUserId: string,
  method: 'PASSWORD' | 'EMAIL_OTP'
): Promise<{ lastReauthenticatedAt: string }> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        lastReauthenticatedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, actorUserId));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'SENSITIVE_ACTION_REAUTHENTICATED',
      entityType: 'users',
      entityId: actorUserId,
      newValue: { method, lastReauthenticatedAt: now.toISOString() },
      reason: `Fresh identity confirmation completed via ${method}`,
    });
  });

  return { lastReauthenticatedAt: now.toISOString() };
}

export type SecurityEventAction =
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_CHANGED'
  | 'OTHER_SESSIONS_REVOKED'
  | 'EMAIL_CHANGE_REQUESTED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED';

// NS-AUT-003, NS-AUT-004, NS-AUT-005 & NS-AUT-006: Audited security lifecycle events
export async function recordSecurityEventForActor(
  actorUserId: string,
  action: SecurityEventAction,
  details?: Record<string, unknown>
): Promise<{ ok: true }> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAccountOperational(ctx);

  if (
    action === 'PASSWORD_CHANGED' ||
    action === 'EMAIL_CHANGE_REQUESTED' ||
    action === 'MFA_DISABLED'
  ) {
    assertRecentReauthentication(ctx);
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    if (action === 'MFA_ENABLED') {
      await tx
        .update(users)
        .set({ mfaEnabled: true, updatedAt: now })
        .where(eq(users.id, actorUserId));
    } else if (action === 'MFA_DISABLED') {
      await tx
        .update(users)
        .set({ mfaEnabled: false, updatedAt: now })
        .where(eq(users.id, actorUserId));
    } else if (action === 'PASSWORD_RESET_COMPLETED' || action === 'PASSWORD_CHANGED') {
      await tx
        .update(users)
        .set({ lastReauthenticatedAt: now, updatedAt: now })
        .where(eq(users.id, actorUserId));
    }

    const notificationCopy: Record<SecurityEventAction, { title: string; body: string }> = {
      PASSWORD_RESET_COMPLETED: {
        title: 'Password Reset Completed',
        body: 'Your account password was reset and all other active sessions were signed out.',
      },
      PASSWORD_CHANGED: {
        title: 'Password Changed',
        body: 'Your account password was updated and all other active devices were signed out.',
      },
      OTHER_SESSIONS_REVOKED: {
        title: 'Other Devices Signed Out',
        body: 'All other active sessions on your NairaScout account were signed out.',
      },
      EMAIL_CHANGE_REQUESTED: {
        title: 'Email Change Requested',
        body: 'A new email verification request was initiated. Your primary email stays unchanged until confirmed.',
      },
      MFA_ENABLED: {
        title: 'Two-Factor Authentication Enabled',
        body: 'TOTP Authenticator 2FA is now active on your NairaScout account.',
      },
      MFA_DISABLED: {
        title: 'Two-Factor Authentication Disabled',
        body: 'TOTP Authenticator 2FA was disabled on your NairaScout account.',
      },
    };

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action,
      entityType: 'users',
      entityId: actorUserId,
      newValue: details ?? {},
      reason: notificationCopy[action].body,
    });

    await tx.insert(notifications).values({
      userId: actorUserId,
      category: 'SECURITY',
      title: notificationCopy[action].title,
      body: notificationCopy[action].body,
      actionUrl: '/settings',
      isRead: false,
    });
  });

  return { ok: true };
}

// NS-AUT-007: Public submission of lost-email account recovery request (anti-enumeration safe)
export async function submitAccountRecoveryRequest(input: {
  claimedEmail: string;
  claimedUsername?: string | null;
  contactEmailForUpdates: string;
  reason: string;
  evidencePaths: string[];
}): Promise<{ id: string; status: 'SUBMITTED' }> {
  const db = requireDb();
  await ensureTablesReady(db);

  const claimedEmail = input.claimedEmail.trim().toLowerCase();
  const claimedUsername = input.claimedUsername?.trim().toLowerCase() || null;
  const contactEmail = input.contactEmailForUpdates.trim().toLowerCase();
  const reason = input.reason.trim();

  if (!claimedEmail || !contactEmail || reason.length < 15) {
    throw new AuthorizationError(
      'Claimed email, reachable contact email, and a detailed reason (minimum 15 chars) are required.',
      400,
      'INVALID_RECOVERY_PAYLOAD'
    );
  }
  if (input.evidencePaths.length === 0) {
    throw new AuthorizationError(
      'Upload government ID or ownership evidence before submitting an account recovery request.',
      400,
      'EVIDENCE_REQUIRED'
    );
  }

  let matchedUserId: string | null = null;
  const byEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, claimedEmail))
    .limit(1);
  if (byEmail[0]) {
    matchedUserId = byEmail[0].id;
  } else if (claimedUsername) {
    const byHandle = await db
      .select({ userId: scoutProfiles.userId })
      .from(scoutProfiles)
      .where(eq(scoutProfiles.username, claimedUsername))
      .limit(1);
    if (byHandle[0]) {
      matchedUserId = byHandle[0].userId;
    }
  }

  const [created] = await db
    .insert(accountRecoveryRequests)
    .values({
      targetUserId: matchedUserId,
      claimedEmail,
      claimedUsername,
      contactEmailForUpdates: contactEmail,
      reason,
      evidencePaths: input.evidencePaths,
      status: 'SUBMITTED',
    })
    .returning();

  return { id: created.id, status: 'SUBMITTED' };
}

// NS-AUT-007: Stage 1 Support/Trust Officer review & recommendation
export async function adminReviewRecoveryRequest(
  actorUserId: string,
  input: {
    requestId: string;
    decision: 'UNDER_REVIEW' | 'RECOMMENDED_APPROVAL' | 'REJECTED';
    reviewerNotes: string;
  }
) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPPORT_OFFICER', 'TRUST_AND_SAFETY']);

  if (!isUuid(input.requestId)) {
    throw new AuthorizationError('Invalid recovery request ID.', 400, 'INVALID_RECOVERY_ID');
  }
  const notes = input.reviewerNotes.trim();
  if (notes.length < 5 && input.decision !== 'UNDER_REVIEW') {
    throw new AuthorizationError(
      'Documented reviewer notes are required before recommending approval or rejecting.',
      400,
      'REVIEWER_NOTES_REQUIRED'
    );
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(accountRecoveryRequests)
      .where(eq(accountRecoveryRequests.id, input.requestId))
      .limit(1);
    const current = rows[0];
    if (!current) {
      throw new AuthorizationError('Recovery request not found.', 404, 'RECOVERY_NOT_FOUND');
    }
    if (current.status === 'APPROVED' || current.status === 'REJECTED') {
      throw new AuthorizationError(
        `Recovery request is already ${current.status}.`,
        409,
        'RECOVERY_ALREADY_DECIDED'
      );
    }

    const now = new Date();
    const [updated] = await tx
      .update(accountRecoveryRequests)
      .set({
        status: input.decision,
        reviewedBy: actorUserId,
        reviewerNotes: notes || 'Review claimed by support officer',
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(accountRecoveryRequests.id, current.id))
      .returning();

    if (current.targetUserId) {
      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: current.targetUserId,
        action: `ACCOUNT_RECOVERY_${input.decision}`,
        entityType: 'account_recovery_requests',
        entityId: current.id,
        previousValue: { status: current.status },
        newValue: { status: input.decision, claimedEmail: current.claimedEmail },
        reason: notes || 'Recovery request review updated',
      });
    }

    return updated;
  });
}

// NS-AUT-007: Stage 2 Distinct Officer Approval -> Email Update, Session Revocation & 24-Hour Cooling-Off Lock
export async function adminApproveRecoveryRequest(
  actorUserId: string,
  input: {
    requestId: string;
    approvalNotes: string;
  }
) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['SUPPORT_OFFICER', 'TRUST_AND_SAFETY']);

  if (!isUuid(input.requestId)) {
    throw new AuthorizationError('Invalid recovery request ID.', 400, 'INVALID_RECOVERY_ID');
  }
  const approvalNotes = input.approvalNotes.trim();
  if (approvalNotes.length < 5) {
    throw new AuthorizationError(
      'Documented approval justification (minimum 5 chars) is required.',
      400,
      'APPROVAL_NOTES_REQUIRED'
    );
  }

  const reqRows = await db
    .select()
    .from(accountRecoveryRequests)
    .where(eq(accountRecoveryRequests.id, input.requestId))
    .limit(1);
  const current = reqRows[0];
  if (!current) {
    throw new AuthorizationError('Recovery request not found.', 404, 'RECOVERY_NOT_FOUND');
  }
  if (current.status === 'APPROVED' || current.status === 'REJECTED') {
    throw new AuthorizationError(
      `Recovery request is already ${current.status}.`,
      409,
      'RECOVERY_ALREADY_DECIDED'
    );
  }
  if (current.status !== 'RECOMMENDED_APPROVAL') {
    throw new AuthorizationError(
      'Recovery request must first be recommended for approval by a reviewing officer.',
      409,
      'RECOVERY_REVIEW_REQUIRED'
    );
  }

  assertIndependentRecoveryOfficers(current.reviewedBy, actorUserId);

  let targetUserId = current.targetUserId;
  if (!targetUserId) {
    const byEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, current.claimedEmail.toLowerCase()))
      .limit(1);
    targetUserId = byEmail[0]?.id ?? null;
  }
  if (!targetUserId && current.claimedUsername) {
    const byHandle = await db
      .select({ userId: scoutProfiles.userId })
      .from(scoutProfiles)
      .where(eq(scoutProfiles.username, current.claimedUsername.toLowerCase()))
      .limit(1);
    targetUserId = byHandle[0]?.userId ?? null;
  }
  if (!targetUserId) {
    throw new AuthorizationError(
      'Could not resolve a matching user account for this recovery request.',
      404,
      'TARGET_USER_NOT_FOUND'
    );
  }

  const targetRows = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  const targetUser = targetRows[0];
  if (!targetUser) {
    throw new AuthorizationError('Target user record does not exist.', 404, 'TARGET_USER_NOT_FOUND');
  }

  const newEmail = current.contactEmailForUpdates.trim().toLowerCase();
  const oldEmail = targetUser.email.trim().toLowerCase();

  const emailTaken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, newEmail))
    .limit(1);
  if (emailTaken[0] && emailTaken[0].id !== targetUserId) {
    throw new AuthorizationError(
      `The update email ${newEmail} is already registered to another NairaScout account.`,
      409,
      'EMAIL_ALREADY_IN_USE'
    );
  }

  const supabaseAdmin = createSupabaseAdminClient();
  if (supabaseAdmin) {
    const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      email: newEmail,
      email_confirm: true,
    });
    if (authUpdateErr) {
      throw new AuthorizationError(
        `Supabase Auth email update failed: ${authUpdateErr.message}`,
        502,
        'SUPABASE_ADMIN_UPDATE_FAILED'
      );
    }
  }

  // Revoke all existing Supabase Auth sessions for target user
  await db
    .execute(sql`DELETE FROM auth.sessions WHERE user_id = ${targetUserId}::uuid`)
    .catch(() => undefined);
  await db
    .execute(sql`DELETE FROM auth.refresh_tokens WHERE user_id = ${targetUserId}::text`)
    .catch(() => undefined);

  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        email: newEmail,
        emailVerifiedAt: now,
        withdrawalCooldownUntil: cooldownUntil,
        lastReauthenticatedAt: null,
        updatedAt: now,
      })
      .where(eq(users.id, targetUserId!));

    const [updated] = await tx
      .update(accountRecoveryRequests)
      .set({
        targetUserId,
        status: 'APPROVED',
        approvedBy: actorUserId,
        approvalNotes,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(accountRecoveryRequests.id, current.id))
      .returning();

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: targetUserId!,
      action: 'ACCOUNT_RECOVERY_APPROVED',
      entityType: 'account_recovery_requests',
      entityId: current.id,
      previousValue: { email: oldEmail, status: current.status },
      newValue: {
        email: newEmail,
        status: 'APPROVED',
        sessionsRevoked: true,
        withdrawalCooldownUntil: cooldownUntil.toISOString(),
        notifiedEmails: [oldEmail, newEmail],
      },
      reason: approvalNotes,
    });

    await tx.insert(notifications).values({
      userId: targetUserId!,
      category: 'SECURITY',
      title: 'Account Recovery Approved (24h Financial Cooling-Off Active)',
      body: `Your account email was updated from ${oldEmail} to ${newEmail}, all prior sessions were signed out, and a 24-hour cooling-off lock applies to withdrawals and payout bank edits until ${cooldownUntil.toUTCString()}. Both addresses were notified.`,
      actionUrl: '/settings',
      isRead: false,
    });

    return {
      request: updated,
      oldEmail,
      newEmail,
      withdrawalCooldownUntil: cooldownUntil.toISOString(),
    };
  });
}

// Keep reference to dataRetentionSchedule exported for schema completeness checks
export async function getDataRetentionScheduleForAdmin(actorUserId: string) {
  const db = requireDb();
  await ensureTablesReady(db);
  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ALL_PLATFORM_ADMIN_ROLES);
  return db.select().from(dataRetentionSchedule).orderBy(asc(dataRetentionSchedule.tableName));
}

// ============================================================================
// MODULE 5: SCOUT STATS, ACTIVITY FEED, CURSOR COMMISSIONS, NOTIF PREFS & WITHDRAWALS
// ============================================================================

// NS-SCT-056: Record first open of a referral event (deduplicated once per event)
export async function markReferralEventOpenedForActor(
  actorUserId: string | null,
  referralEventId: string
): Promise<{ ok: boolean; openedAt: string | null }> {
  const db = requireDb();
  await ensureTablesReady(db);
  if (!isUuid(referralEventId)) {
    return { ok: false, openedAt: null };
  }
  const rows = await db
    .select()
    .from(productReferralEvents)
    .where(eq(productReferralEvents.id, referralEventId))
    .limit(1);
  const ev = rows[0];
  if (!ev) return { ok: false, openedAt: null };
  // Never count sender opening their own referral card as a recipient open
  if (actorUserId && ev.senderScoutId === actorUserId) {
    return { ok: false, openedAt: ev.openedAt?.toISOString() ?? null };
  }
  if (ev.openedAt) {
    return { ok: true, openedAt: ev.openedAt.toISOString() };
  }
  const now = new Date();
  await db
    .update(productReferralEvents)
    .set({
      deliveredAt: ev.deliveredAt ?? ev.createdAt,
      openedAt: now,
    })
    .where(
      and(
        eq(productReferralEvents.id, referralEventId),
        sql`${productReferralEvents.openedAt} IS NULL`
      )
    );
  return { ok: true, openedAt: now.toISOString() };
}

// NS-UI-023: Resolve a referral event ID to its target product listing ID for /r/[referralEventId] routing
export async function getReferralEventDestinationById(
  referralEventId: string
): Promise<{ productListingId: string; senderHandle: string | null } | null> {
  const db = getDb();
  if (!db || !isUuid(referralEventId)) return null;
  await ensureTablesReady(db);
  const rows = await db
    .select({
      productListingId: productReferralEvents.productListingId,
      senderScoutId: productReferralEvents.senderScoutId,
    })
    .from(productReferralEvents)
    .where(eq(productReferralEvents.id, referralEventId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const senderRows = await db
    .select({ username: scoutProfiles.username })
    .from(scoutProfiles)
    .where(eq(scoutProfiles.userId, row.senderScoutId))
    .limit(1);
  return {
    productListingId: row.productListingId,
    senderHandle: senderRows[0]?.username ?? null,
  };
}
