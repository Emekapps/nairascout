import { and, desc, eq, inArray, or } from 'drizzle-orm';
import {
  AncestorNode,
  CommissionBreakdown,
  COMMISSION_RULE_VERSION,
  calculateThirteenGenerationCommissions,
  selectCommissionSchedule,
  validateAncestryRelationship,
} from './commission-engine';
import {
  AccountStatus,
  AdminRole,
  AuthorizationError,
  PublicScoutProfileDTO,
  SellerStatus,
  SubscriptionPlan,
  UserAuthContext,
  VerificationStatus,
  assertActiveAccount,
  assertAdminRole,
  assertCanManageSellerDrafts,
  assertCanManageSellerTeam,
  assertCanParticipateAsScout,
  assertCanPublishListing,
  toPublicScoutProfileDTO,
} from './auth/rbac';
import { loadDbAuthContext, SupabaseSessionIdentity } from './auth/session';
import { getDb, isPostgresConfigured, NairaScoutDb, requireDb } from './db';
import {
  abuseReports,
  auditLogs,
  platformAdminRoles,
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
} from './db/schema';
import {
  commissionLedgerEntries,
  ensureCommerceTables,
  marketplaceOrders,
  platformNotifications,
  productListings,
  productReferralEvents,
  supportCases,
} from './db/commerce-schema';
import {
  SELLER_PLANS,
  SellerPlanId,
  SellerPlanSpec,
  planEnumToId,
  planIdToEnum,
} from './seller-plans';
import { isSupabaseConfigured } from './supabase/server';

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
  description: string | null;
  businessCategory: string | null;
  businessRegNumber: string | null;
  businessAddress: string | null;
  businessContactEmail: string | null;
  businessContactPhone: string | null;
  sellerStatus: SellerStatus;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  termsAcceptedAt: string;
  createdAt: string;
}

export interface SellerTeamMemberRecord {
  id: string;
  sellerProfileId: string;
  userId: string;
  role: 'BUSINESS_OWNER' | 'BUSINESS_ADMIN' | 'TEAM_MEMBER';
  permissions: SellerTeamPermissions;
  status: 'INVITED' | 'ACTIVE' | 'REVOKED';
  invitedBy: string | null;
  createdAt: string;
  revokedAt: string | null;
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
  sellerCity: string;
  hasActiveSellerBadge: boolean;
  isSellerVerified: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'EXPIRED';
  imageSeed: string;
  imageUrl: string;
  daysRemaining: number;
  specifications: string[];
  returnPolicy: string;
  warranty: string;
  impressions: number;
  referralShares: number;
}

export interface ScoutsListContact {
  contactId: string;
  ownerUserId: string;
  scoutId: string;
  handle: string;
  displayName: string;
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
  category: 'referral' | 'order' | 'commission' | 'payout' | 'trust';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
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
}

export interface ActiveScoutDTO {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string | null;
  city: string;
  preferredCategories: string[];
  accountStatus: AccountStatus;
  restrictionReason: string | null;
  invitePolicy: InvitationPolicy;
  muteReferrals: boolean;
  profileVisibility: 'PUBLIC' | 'NETWORK_ONLY';
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
}

// ============================================================================
// INTERNAL POSTGRESQL HELPERS
// ============================================================================

async function ensureTablesReady(db: NairaScoutDb) {
  await ensureCommerceTables((q) => db.execute(q));
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

  const kycOk = verifRows.some((v) => v.category === 'IDENTITY' && v.status === 'APPROVED');
  const bankOk = verifRows.some((v) => v.category === 'PAYOUT_BANK' && v.status === 'APPROVED');
  const minimumPayoutKobo = 500000;

  return {
    pendingKobo,
    availableKobo,
    onHoldKobo,
    paidKobo,
    reversedKobo,
    minimumPayoutKobo,
    nextPayoutDate: '2026-12-15',
    precedingMonthAvailableKobo: availableKobo,
    eligibleForNextPayout: availableKobo >= minimumPayoutKobo && kycOk && bankOk,
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

export async function ensureUserProvisionedInDb(
  identity: SupabaseSessionIdentity,
  input?: {
    displayName?: string;
    username?: string;
    locationState?: string;
    referralEventId?: string | null;
    referralScoutUsername?: string | null;
  }
): Promise<{ createdNew: boolean; userId: string }> {
  const db = requireDb();
  await ensureTablesReady(db);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, identity.userId))
    .limit(1);

  if (existing.length > 0) {
    return { createdNew: false, userId: identity.userId };
  }

  const meta = identity.userMetadata || {};
  const rawDisplayName =
    input?.displayName?.trim() ||
    (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    identity.email.split('@')[0];

  const baseUsernameRaw =
    input?.username?.trim() ||
    (typeof meta.username === 'string' && meta.username.trim()) ||
    identity.email.split('@')[0];
  const baseSlug =
    baseUsernameRaw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '') || 'scout';

  const locationState =
    input?.locationState?.trim() ||
    (typeof meta.location_state === 'string' && meta.location_state.trim()) ||
    'Lagos';

  const created = await db.transaction(async (tx) => {
    const insideCheck = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1);
    if (insideCheck.length > 0) {
      return false;
    }

    // Resolve unique username safely
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

    // Resolve referral attribution cleanly without self-referral
    let directReferrerId: string | null = null;
    let attributionSource: 'REFERRAL_CARD' | 'REFERRAL_LINK' | 'ORGANIC' = 'ORGANIC';
    let resolvedEventId: string | null = null;

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

    // 1. Insert public.users
    await tx.insert(users).values({
      id: identity.userId,
      email: identity.email.toLowerCase(),
      phone: identity.phone,
      accountStatus: 'ACTIVE',
    });

    // 2. Insert public.scout_profiles
    await tx.insert(scoutProfiles).values({
      userId: identity.userId,
      username: candidate,
      displayName: rawDisplayName,
      locationState,
      preferredCategories: [],
      invitationPolicy: 'EVERYONE',
      muteReferrals: false,
      profileVisibility: 'PUBLIC',
    });

    // 3. Insert public.referral_ancestry (permanent)
    await tx.insert(referralAncestry).values({
      scoutUserId: identity.userId,
      directReferrerId,
      attributionSource,
      referralEventId: resolvedEventId,
    });

    // 4. Insert initial CONTACT verification (verified via Supabase Auth)
    await tx.insert(verificationRecords).values({
      userId: identity.userId,
      category: 'CONTACT',
      status: 'APPROVED',
      evidencePaths: [],
      reviewerNotes: 'Verified via Supabase Auth',
      submittedAt: new Date(),
      reviewedAt: new Date(),
    });

    // 5. Insert audit log entry in public.audit_logs
    await tx.insert(auditLogs).values({
      actorId: identity.userId,
      affectedUserId: identity.userId,
      action: 'USER_PROVISIONED',
      entityType: 'users',
      entityId: identity.userId,
      newValue: {
        email: identity.email.toLowerCase(),
        username: candidate,
        attributionSource,
        directReferrerId,
        referralEventId: resolvedEventId,
      },
      reason: 'Atomic Scout identity provisioned via Supabase Auth',
    });

    // 6. Welcome notification
    await tx.insert(platformNotifications).values({
      userId: identity.userId,
      category: 'trust',
      title: 'Free Scout Account Provisioned',
      body: directReferrerId
        ? `Your permanent referral ancestry (${attributionSource}) is locked. You can refer products or activate Seller capabilities anytime.`
        : 'Welcome to NairaScout. Browse the marketplace, connect on Scouts List, or activate Seller capabilities anytime.',
    });

    return true;
  });

  return { createdNew: created, userId: identity.userId };
}

// ============================================================================
// SNAPSHOT BUILDER (100% POSTGRESQL VIA DRIZZLE ORM)
// ============================================================================

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
    };
  }

  await ensureTablesReady(db);

  const allSellers = await db.select().from(sellerProfiles);
  const sellerById = new Map(allSellers.map((s) => [s.id, s]));
  const allVerifs = await db.select().from(verificationRecords);

  const getSellerFlags = (sellerProfileId: string) => {
    const sp = sellerById.get(sellerProfileId);
    const sellerVerif = allVerifs.find(
      (v) => v.sellerProfileId === sellerProfileId && v.category === 'SELLER'
    );
    return {
      hasActiveSellerBadge: sp?.sellerStatus === 'ACTIVE',
      isSellerVerified: sellerVerif?.status === 'APPROVED',
    };
  };

  const publishedRows = await db
    .select()
    .from(productListings)
    .where(eq(productListings.status, 'PUBLISHED'))
    .orderBy(desc(productListings.createdAt));

  const publishedProducts: ProductListing[] = publishedRows.map((p) => {
    const flags = getSellerFlags(p.sellerProfileId);
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
      imageUrl: p.imageUrl,
      daysRemaining: p.daysRemaining,
      specifications: p.specifications,
      returnPolicy: p.returnPolicy,
      warranty: p.warranty,
      impressions: p.impressions,
      referralShares: p.referralShares,
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
    };
  }

  const viewerUser = userById.get(viewerUserId);
  const viewerScout = scoutByUserId.get(viewerUserId);
  const authCtx = await loadDbAuthContext(viewerUserId);

  if (!viewerUser || !viewerScout || !authCtx) {
    return getNairaScoutSnapshot(null, referralEventQuery);
  }

  const myVerifs = allVerifs
    .filter((v) => v.userId === viewerUserId)
    .map((v) => ({
      id: v.id,
      userId: v.userId,
      sellerProfileId: v.sellerProfileId,
      category: v.category as VerificationCategory,
      status: v.status as VerificationStatus,
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
        description: sellerProfileRow.description,
        businessCategory: sellerProfileRow.businessCategory,
        businessRegNumber: sellerProfileRow.businessRegNumber,
        businessAddress: sellerProfileRow.businessAddress,
        businessContactEmail: sellerProfileRow.businessContactEmail,
        businessContactPhone: sellerProfileRow.businessContactPhone,
        sellerStatus: sellerProfileRow.sellerStatus as SellerStatus,
        subscriptionPlan: sellerProfileRow.subscriptionPlan as SubscriptionPlan,
        subscriptionStatus: sellerProfileRow.subscriptionStatus,
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

  const sellerListings: ProductListing[] = sellerListingRows.map((p) => ({
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
    imageUrl: p.imageUrl,
    daysRemaining: p.daysRemaining,
    specifications: p.specifications,
    returnPolicy: p.returnPolicy,
    warranty: p.warranty,
    impressions: p.impressions,
    referralShares: p.referralShares,
  }));

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
      role: m.role,
      permissions: m.permissions,
      status: m.status,
      invitedBy: m.invitedBy,
      createdAt: m.createdAt.toISOString(),
      revokedAt: m.revokedAt?.toISOString() ?? null,
      username: scoutByUserId.get(m.userId)?.username || 'member',
      displayName: scoutByUserId.get(m.userId)?.displayName || 'Team Member',
      email: userById.get(m.userId)?.email || '',
    }));

  const kycVerified = myVerifs.some((v) => v.category === 'IDENTITY' && v.status === 'APPROVED');
  const bankVerified = myVerifs.some((v) => v.category === 'PAYOUT_BANK' && v.status === 'APPROVED');
  const payoutBankRec = myVerifs.find((v) => v.category === 'PAYOUT_BANK');

  const activeScout: ActiveScoutDTO = {
    id: viewerUser.id,
    email: viewerUser.email,
    handle: viewerScout.username,
    displayName: viewerScout.displayName,
    bio: viewerScout.bio,
    city: viewerScout.locationState || 'Lagos',
    preferredCategories: viewerScout.preferredCategories,
    accountStatus: viewerUser.accountStatus as AccountStatus,
    restrictionReason: viewerUser.restrictionReason,
    invitePolicy: viewerScout.invitationPolicy as InvitationPolicy,
    muteReferrals: viewerScout.muteReferrals,
    profileVisibility: (viewerScout.profileVisibility === 'NETWORK_ONLY'
      ? 'NETWORK_ONLY'
      : 'PUBLIC'),
    kycVerified,
    bankVerified,
    bankSummary: payoutBankRec?.reviewerNotes || (bankVerified ? 'Verified Naira Account' : 'Not submitted'),
    isSeller: Boolean(sellerProfile),
    sellerProfile,
    sellerVerificationStatus: authCtx.seller?.sellerVerificationStatus ?? 'NOT_SUBMITTED',
    verifications: myVerifs,
    teamMembers,
    adminRole: authCtx.adminRole ?? null,
    sellerPlan: sellerProfile ? planEnumToId(sellerProfile.subscriptionPlan) : 'starter',
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

  // Sanitized Directory Search (PostgreSQL only)
  const allContactsRows = await db.select().from(scoutsListContacts);
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
        sellerStatus: (seller?.sellerStatus as SellerStatus | undefined) ?? null,
        sellerVerificationStatus: (sellerVerif?.status as VerificationStatus | undefined) ?? null,
        workingWithCount,
        totalSoldUnits,
      });
    });

  const notifRows = await db
    .select()
    .from(platformNotifications)
    .where(eq(platformNotifications.userId, viewerUserId))
    .orderBy(desc(platformNotifications.createdAt));

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
    wallet: await computeWalletFromDb(
      db,
      viewerUserId,
      allVerifs.filter((v) => v.userId === viewerUserId)
    ),
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
      category: n.category as PlatformNotification['category'],
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      read: n.read,
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
  };
}

// ============================================================================
// SERVER-ENFORCED TRANSACTIONAL ACTIONS (100% DRIZZLE POSTGRESQL)
// ============================================================================

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
  assertActiveAccount(ctx);

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
        .set({ status: 'converted' })
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

    await tx.insert(platformNotifications).values({
      userId: actorUserId,
      category: 'order',
      title: `Order ${orderId} confirmed (${isReferral ? 'Referral-Attributed' : 'Direct'})`,
      body: isReferral
        ? `Referral event preserved. Pending commissions calculated across Seller ancestry (${breakdown.actualAncestryDepth} generations).`
        : 'Direct marketplace checkout completed. No referral commission generated.',
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

export async function createReferralEventForActor(
  actorUserId: string,
  input: {
    productListingId: string;
    recipientScoutId: string;
    note: string;
  }
): Promise<ProductReferralEvent> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanParticipateAsScout(ctx);

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

  if (!isUuid(input.recipientScoutId)) {
    throw new AuthorizationError('Recipient Scout not found.', 404, 'RECIPIENT_NOT_FOUND');
  }

  const scoutRows = await db
    .select()
    .from(scoutProfiles)
    .where(inArray(scoutProfiles.userId, [actorUserId, input.recipientScoutId]));
  const sender = scoutRows.find((s) => s.userId === actorUserId);
  const recipient = scoutRows.find((s) => s.userId === input.recipientScoutId);

  const recipientUserRows = await db
    .select()
    .from(users)
    .where(eq(users.id, input.recipientScoutId))
    .limit(1);
  const recipientUser = recipientUserRows[0];

  if (!sender || !recipient || !recipientUser || recipientUser.accountStatus === 'CLOSED') {
    throw new AuthorizationError('Recipient Scout not found.', 404, 'RECIPIENT_NOT_FOUND');
  }
  if (recipient.userId === sender.userId) {
    throw new AuthorizationError('Self-referrals are prohibited.', 400, 'SELF_REFERRAL');
  }

  const blockRows = await db
    .select()
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, sender.userId), eq(userBlocks.blockedId, recipient.userId)),
        and(eq(userBlocks.blockerId, recipient.userId), eq(userBlocks.blockedId, sender.userId))
      )
    )
    .limit(1);
  if (blockRows.length > 0) {
    throw new AuthorizationError(
      'Cannot send product referral due to a block between accounts.',
      403,
      'USER_BLOCKED'
    );
  }
  if (recipient.muteReferrals) {
    throw new AuthorizationError(
      `@${recipient.username} has muted incoming product referrals.`,
      403,
      'REFERRALS_MUTED'
    );
  }

  const allAnc = await db.select().from(referralAncestry);
  const ancestryMap: Record<string, string | null> = {};
  for (const row of allAnc) ancestryMap[row.scoutUserId] = row.directReferrerId;
  const ancestryCheck = validateAncestryRelationship(recipient.userId, sender.userId, ancestryMap);

  const existingReverse = await db
    .select()
    .from(productReferralEvents)
    .where(
      and(
        eq(productReferralEvents.productListingId, product.id),
        eq(productReferralEvents.senderScoutId, recipient.userId),
        eq(productReferralEvents.recipientScoutId, sender.userId),
        eq(productReferralEvents.status, 'active')
      )
    )
    .limit(1);
  if (existingReverse.length > 0 && !ancestryCheck.valid) {
    throw new AuthorizationError('Circular product referral path rejected.', 400, 'CIRCULAR_PATH');
  }

  const pathSignature = `${sender.username}->${recipient.username}`;
  const dup = await db
    .select()
    .from(productReferralEvents)
    .where(
      and(
        eq(productReferralEvents.productListingId, product.id),
        eq(productReferralEvents.ancestryPathSignature, pathSignature),
        eq(productReferralEvents.status, 'active')
      )
    )
    .limit(1);
  if (dup[0]) {
    throw new AuthorizationError(
      `Active referral ${dup[0].id} already exists for @${recipient.username} on this listing.`,
      409,
      'DUPLICATE_REFERRAL'
    );
  }

  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const [inserted] = await db
    .insert(productReferralEvents)
    .values({
      productListingId: product.id,
      senderScoutId: sender.userId,
      recipientScoutId: recipient.userId,
      note: input.note.trim() || `Recommended ${product.title} on NairaScout.`,
      ancestryPathSignature: pathSignature,
      status: 'active',
      expiresAt,
    })
    .returning();

  await db
    .update(productListings)
    .set({ referralShares: product.referralShares + 1 })
    .where(eq(productListings.id, product.id));

  return {
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
  };
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

export async function activateSellerOnboarding(
  actorUserId: string,
  input: {
    sellerType: 'INDIVIDUAL' | 'BUSINESS';
    sellerName: string;
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

  const ctx = await loadDbAuthContext(actorUserId);
  assertActiveAccount(ctx);

  if (!input.termsAccepted) {
    throw new AuthorizationError('You must accept the Seller Terms to proceed.', 400, 'TERMS_REQUIRED');
  }
  if (ctx.seller) {
    throw new AuthorizationError('Seller capabilities are already activated on this account.', 409, 'SELLER_EXISTS');
  }

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
        description: input.description.trim() || null,
        businessCategory: input.businessCategory,
        businessRegNumber:
          input.sellerType === 'BUSINESS' ? input.businessRegNumber?.trim() || null : null,
        businessAddress: input.businessAddress?.trim() || null,
        businessContactEmail: input.businessContactEmail?.trim() || ctx.email,
        businessContactPhone: input.businessContactPhone?.trim() || null,
        sellerStatus: 'ONBOARDING',
        subscriptionPlan: planIdToEnum(input.planId),
        subscriptionStatus: 'ACTIVE',
        termsAcceptedAt: now,
      })
      .returning();

    await tx.insert(sellerTeamMembers).values({
      sellerProfileId: seller.id,
      userId: actorUserId,
      role: 'BUSINESS_OWNER',
      permissions: {
        canManageListings: true,
        canManageOrders: true,
        canViewAnalytics: true,
        canManageBilling: true,
        canManageTeam: true,
      },
      status: 'ACTIVE',
    });

    await tx.insert(verificationRecords).values({
      userId: actorUserId,
      sellerProfileId: seller.id,
      category: 'SELLER',
      status: 'PENDING',
      evidencePaths: cleanPaths,
      submittedAt: now,
    });

    await tx.insert(verificationRecords).values({
      userId: actorUserId,
      category: 'IDENTITY',
      status: 'PENDING',
      evidencePaths: cleanPaths,
      submittedAt: now,
    });

    if (input.sellerType === 'BUSINESS') {
      await tx.insert(verificationRecords).values({
        userId: actorUserId,
        sellerProfileId: seller.id,
        category: 'BUSINESS',
        status: 'PENDING',
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
        sellerStatus: 'ONBOARDING',
        subscriptionPlan: seller.subscriptionPlan,
      },
    });

    return {
      id: seller.id,
      ownerUserId: seller.ownerUserId,
      sellerType: seller.sellerType,
      sellerName: seller.sellerName,
      description: seller.description,
      businessCategory: seller.businessCategory,
      businessRegNumber: seller.businessRegNumber,
      businessAddress: seller.businessAddress,
      businessContactEmail: seller.businessContactEmail,
      businessContactPhone: seller.businessContactPhone,
      sellerStatus: seller.sellerStatus as SellerStatus,
      subscriptionPlan: seller.subscriptionPlan as SubscriptionPlan,
      subscriptionStatus: seller.subscriptionStatus,
      termsAcceptedAt: seller.termsAcceptedAt.toISOString(),
      createdAt: seller.createdAt.toISOString(),
    };
  });
}

export async function createSellerDraftListing(
  actorUserId: string,
  input: {
    title: string;
    category: string;
    priceNaira: number;
    deliveryFeeNaira: number;
    stock: number;
    description: string;
  }
): Promise<ProductListing> {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanManageSellerDrafts(ctx);

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
  const suffix = `${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;
  const id = `LST-${suffix}`;
  const productId = `PRD-${suffix}`;
  const seed = `nairascout-item-${suffix}`;

  const [inserted] = await db
    .insert(productListings)
    .values({
      id,
      productId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priceKobo: Math.round(Math.max(500, input.priceNaira) * 100),
      deliveryFeeKobo: Math.round(Math.max(0, input.deliveryFeeNaira) * 100),
      stock: Math.max(1, Math.round(input.stock)),
      sellerScoutId: seller.ownerUserId,
      sellerProfileId: seller.id,
      sellerName: seller.sellerName,
      sellerCity: ownerScout?.locationState || 'Lagos',
      status: 'DRAFT',
      imageSeed: seed,
      imageUrl: `https://picsum.photos/seed/${seed}/800/600`,
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
    sellerCity: inserted.sellerCity,
    hasActiveSellerBadge: seller.sellerStatus === 'ACTIVE',
    isSellerVerified: ctx!.seller!.sellerVerificationStatus === 'APPROVED',
    status: 'DRAFT',
    imageSeed: inserted.imageSeed,
    imageUrl: inserted.imageUrl,
    daysRemaining: inserted.daysRemaining,
    specifications: inserted.specifications,
    returnPolicy: inserted.returnPolicy,
    warranty: inserted.warranty,
    impressions: inserted.impressions,
    referralShares: inserted.referralShares,
  };
}

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
    sellerCity: listing.sellerCity,
    hasActiveSellerBadge: true,
    isSellerVerified: true,
    status: 'PUBLISHED',
    imageSeed: listing.imageSeed,
    imageUrl: listing.imageUrl,
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
  assertActiveAccount(ctx);
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

    await tx
      .update(sellerProfiles)
      .set({ subscriptionPlan: nextPlan, subscriptionStatus: 'ACTIVE', updatedAt: new Date() })
      .where(eq(sellerProfiles.id, seller.id));

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: seller.ownerUserId,
      action: 'SELLER_SUBSCRIPTION_UPDATED',
      entityType: 'seller_profiles',
      entityId: seller.id,
      previousValue: { subscriptionPlan: prevPlan },
      newValue: { subscriptionPlan: nextPlan },
    });
  });
}

export async function manageSellerTeamForActor(
  actorUserId: string,
  input:
    | {
        operation: 'invite';
        memberEmail: string;
        role: 'BUSINESS_ADMIN' | 'TEAM_MEMBER';
        permissions: SellerTeamPermissions;
      }
    | { operation: 'revoke'; memberId: string }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertCanManageSellerTeam(ctx);

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
    return;
  }

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

  const existing = await db
    .select()
    .from(sellerTeamMembers)
    .where(
      and(
        eq(sellerTeamMembers.sellerProfileId, sellerId),
        eq(sellerTeamMembers.userId, memberUser.id),
        eq(sellerTeamMembers.status, 'ACTIVE')
      )
    )
    .limit(1);
  if (existing.length > 0) {
    throw new AuthorizationError('User is already an active team member.', 409, 'ALREADY_MEMBER');
  }

  await db.insert(sellerTeamMembers).values({
    sellerProfileId: sellerId,
    userId: memberUser.id,
    role: input.role,
    permissions: input.permissions,
    status: 'ACTIVE',
    invitedBy: actorUserId,
  });
}

// ============================================================================
// SETTINGS, PRIVACY, VERIFICATION SUBMISSIONS & VOLUNTARY CLOSURE
// ============================================================================

export async function updateProfileAndPrivacy(
  actorUserId: string,
  input: {
    displayName?: string;
    username?: string;
    bio?: string;
    locationState?: string;
    preferredCategories?: string[];
    invitationPolicy?: InvitationPolicy;
    muteReferrals?: boolean;
    profileVisibility?: 'PUBLIC' | 'NETWORK_ONLY';
  }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertActiveAccount(ctx);

  const rows = await db
    .select()
    .from(scoutProfiles)
    .where(eq(scoutProfiles.userId, actorUserId))
    .limit(1);
  const scout = rows[0];
  if (!scout) {
    throw new AuthorizationError('Scout profile not found.', 404, 'NOT_FOUND');
  }

  let nextUsername = scout.username;
  if (input.username && input.username.trim().toLowerCase() !== scout.username.toLowerCase()) {
    const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
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

  await db
    .update(scoutProfiles)
    .set({
      username: nextUsername,
      displayName: input.displayName !== undefined ? input.displayName.trim() || scout.displayName : scout.displayName,
      bio: input.bio !== undefined ? input.bio.trim() || null : scout.bio,
      locationState:
        input.locationState !== undefined
          ? input.locationState.trim() || scout.locationState
          : scout.locationState,
      preferredCategories:
        input.preferredCategories !== undefined
          ? input.preferredCategories
          : scout.preferredCategories,
      invitationPolicy: input.invitationPolicy ?? scout.invitationPolicy,
      muteReferrals:
        input.muteReferrals !== undefined ? input.muteReferrals : scout.muteReferrals,
      profileVisibility: input.profileVisibility ?? scout.profileVisibility,
      updatedAt: new Date(),
    })
    .where(eq(scoutProfiles.userId, actorUserId));
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
  assertActiveAccount(ctx);

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
    const [updated] = await db
      .update(verificationRecords)
      .set({
        status: 'PENDING',
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
      status: updated.status as VerificationStatus,
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
      status: 'PENDING',
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
    status: created.status as VerificationStatus,
    evidencePaths: created.evidencePaths,
    reviewerNotes: created.reviewerNotes,
    reviewedBy: created.reviewedBy,
    submittedAt: created.submittedAt?.toISOString() ?? null,
    reviewedAt: created.reviewedAt?.toISOString() ?? null,
  };
}

export async function closeAccountVoluntarily(actorUserId: string, reason?: string) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertActiveAccount(ctx);

  const closureReason = reason?.trim() || 'Voluntary account closure';

  await db.transaction(async (tx) => {
    const userRows = await tx.select().from(users).where(eq(users.id, actorUserId)).limit(1);
    const prevStatus = userRows[0]!.accountStatus;

    await tx
      .update(users)
      .set({
        accountStatus: 'CLOSED',
        closedAt: new Date(),
        restrictionReason: closureReason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actorUserId));

    // Pause active Seller listings without deleting users, referral_ancestry, events, or ledger rows
    await tx
      .update(productListings)
      .set({ status: 'EXPIRED' })
      .where(
        and(
          eq(productListings.sellerScoutId, actorUserId),
          eq(productListings.status, 'PUBLISHED')
        )
      );

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: actorUserId,
      action: 'ACCOUNT_CLOSED_VOLUNTARY',
      entityType: 'users',
      entityId: actorUserId,
      previousValue: { accountStatus: prevStatus },
      newValue: { accountStatus: 'CLOSED', historicalRecordsPreserved: true },
      reason: closureReason,
    });
  });
}

// ============================================================================
// ADMIN GOVERNANCE & AUDIT LOGS (100% POSTGRESQL VIA DRIZZLE ORM)
// ============================================================================

export async function getAdminConsoleSnapshot(actorUserId: string) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, [
    'VERIFICATION_OFFICER',
    'TRUST_AND_SAFETY',
    'FINANCE_OPS',
    'SUPPORT_AGENT',
  ]);

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

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const scoutMap = new Map(allScouts.map((s) => [s.userId, s]));
  const sellerById = new Map(allSellers.map((s) => [s.id, s]));
  const sellerByOwner = new Map(allSellers.map((s) => [s.ownerUserId, s]));
  const ancestrySet = new Set(allAncestry.map((a) => a.scoutUserId));
  const adminMap = new Map(allAdmins.map((a) => [a.userId, a.adminRole]));

  const verificationQueue = allVerifs.map((v) => {
    const scout = scoutMap.get(v.userId);
    const seller = v.sellerProfileId ? sellerById.get(v.sellerProfileId) : null;
    return {
      id: v.id,
      userId: v.userId,
      sellerProfileId: v.sellerProfileId,
      category: v.category as VerificationCategory,
      status: v.status as VerificationStatus,
      evidencePaths: v.evidencePaths,
      reviewerNotes: v.reviewerNotes,
      reviewedBy: v.reviewedBy,
      submittedAt: v.submittedAt?.toISOString() ?? null,
      reviewedAt: v.reviewedAt?.toISOString() ?? null,
      username: scout?.username || 'unknown',
      displayName: scout?.displayName || 'Unknown User',
      email: userMap.get(v.userId)?.email || '',
      sellerName: seller?.sellerName || null,
      sellerType: seller?.sellerType || null,
      sellerStatus: (seller?.sellerStatus as SellerStatus | undefined) ?? null,
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
      accountStatus: u.accountStatus as AccountStatus,
      restrictionReason: u.restrictionReason,
      closedAt: u.closedAt?.toISOString() ?? null,
      sellerProfileId: seller?.id || null,
      sellerName: seller?.sellerName || null,
      sellerStatus: (seller?.sellerStatus as SellerStatus | undefined) ?? null,
      subscriptionPlan: seller?.subscriptionPlan || null,
      adminRole: (adminMap.get(u.id) as AdminRole | undefined) ?? null,
      hasPermanentAncestry: ancestrySet.has(u.id),
      ledgerEntriesCount: ledgerCount,
    };
  });

  return {
    adminRole: ctx!.adminRole ?? null,
    verifications: verificationQueue,
    users: managedUsers,
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
  };
}

export async function adminReviewVerification(
  actorUserId: string,
  input: {
    verificationId: string;
    decision: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED';
    reviewerNotes: string;
  }
) {
  const db = requireDb();

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['VERIFICATION_OFFICER']);

  if (!input.reviewerNotes.trim()) {
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

    const prevStatus = verif.status;
    const now = new Date();
    const notes = input.reviewerNotes.trim();

    const [updated] = await tx
      .update(verificationRecords)
      .set({
        status: input.decision,
        reviewerNotes: notes,
        reviewedBy: actorUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(verificationRecords.id, verif.id))
      .returning();

    if (verif.category === 'SELLER' && verif.sellerProfileId && input.decision === 'APPROVED') {
      await tx
        .update(sellerProfiles)
        .set({ sellerStatus: 'ACTIVE', updatedAt: now })
        .where(
          and(
            eq(sellerProfiles.id, verif.sellerProfileId),
            eq(sellerProfiles.sellerStatus, 'ONBOARDING')
          )
        );
    }

    await tx.insert(auditLogs).values({
      actorId: actorUserId,
      affectedUserId: verif.userId,
      action: `VERIFICATION_${input.decision}`,
      entityType: 'verification_records',
      entityId: verif.id,
      previousValue: { status: prevStatus, category: verif.category },
      newValue: { status: input.decision, category: verif.category },
      reason: notes,
    });

    await tx.insert(platformNotifications).values({
      userId: verif.userId,
      category: 'trust',
      title: `${verif.category} verification ${input.decision}`,
      body: notes,
    });

    return updated;
  });
}

export async function adminApplyUserAction(
  actorUserId: string,
  input: {
    targetUserId: string;
    actionType:
      | 'SET_ACCOUNT_STATUS'
      | 'SET_SELLER_STATUS'
      | 'HOLD_PENDING_COMMISSIONS'
      | 'RESOLVE_ABUSE_REPORT';
    accountStatus?: AccountStatus;
    sellerStatus?: SellerStatus;
    abuseReportId?: string;
    abuseResolution?: 'RESOLVED' | 'DISMISSED';
    reason: string;
  }
) {
  const db = requireDb();
  await ensureTablesReady(db);

  const ctx = await loadDbAuthContext(actorUserId);
  assertAdminRole(ctx, ['TRUST_AND_SAFETY', 'FINANCE_OPS']);

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
      const prev = targetUser.accountStatus;
      await tx
        .update(users)
        .set({
          accountStatus: input.accountStatus,
          restrictionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUser.id));

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: targetUser.id,
        action: 'ADMIN_ACCOUNT_STATUS_CHANGED',
        entityType: 'users',
        entityId: targetUser.id,
        previousValue: { accountStatus: prev },
        newValue: { accountStatus: input.accountStatus },
        reason,
      });
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
      const prev = seller.sellerStatus;
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
        newValue: { sellerStatus: input.sellerStatus },
        reason,
      });
    }

    if (input.actionType === 'HOLD_PENDING_COMMISSIONS') {
      const userEntries = await tx
        .select()
        .from(commissionLedgerEntries)
        .where(
          and(
            eq(commissionLedgerEntries.beneficiaryScoutId, targetUser.id),
            eq(commissionLedgerEntries.status, 'Pending')
          )
        );
      const roots = userEntries.filter((l) => !l.linkedToReference);
      for (const root of roots) {
        await tx.insert(commissionLedgerEntries).values({
          reference: `${root.reference}-HOLD`,
          orderId: root.orderId,
          referralEventId: root.referralEventId,
          beneficiaryScoutId: root.beneficiaryScoutId,
          generation: root.generation,
          fractionLabel: root.fractionLabel,
          amountKobo: Number(root.amountKobo),
          status: 'On Hold',
          ruleVersion: COMMISSION_RULE_VERSION,
          description: `Trust & Safety hold: ${reason} (${root.reference})`,
          linkedToReference: root.reference,
        });
      }

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        affectedUserId: targetUser.id,
        action: 'ADMIN_COMMISSIONS_PLACED_ON_HOLD',
        entityType: 'commission_ledger_entries',
        entityId: null,
        newValue: { heldEntriesCount: roots.length },
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
  assertActiveAccount(ctx);

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
