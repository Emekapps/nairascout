import crypto from 'node:crypto';
import {
  AncestorNode,
  CommissionBreakdown,
  COMMISSION_RULE_VERSION,
  calculateThirteenGenerationCommissions,
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
  assertCanPublishListing,
  assertCanParticipateAsScout,
  toPublicScoutProfileDTO,
} from './auth/rbac';
import { SellerTeamPermissions } from './db/schema';
import { hashPassword, verifyPassword } from './auth/session';

import {
  SELLER_PLANS,
  SellerPlanId,
  SellerPlanSpec,
  planEnumToId,
  planIdToEnum,
} from './seller-plans';
export { SELLER_PLANS, planEnumToId, planIdToEnum };
export type { SellerPlanId, SellerPlanSpec };

export type VerificationCategory =
  | 'CONTACT'
  | 'IDENTITY'
  | 'BUSINESS'
  | 'SELLER'
  | 'PAYOUT_BANK';

export type InvitationPolicy = 'EVERYONE' | 'CONTACTS_ONLY' | 'NOBODY';

export interface UserAccountRecord {
  id: string;
  email: string;
  phone: string | null;
  passwordHash: string | null;
  accountStatus: AccountStatus;
  restrictionReason: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface ScoutProfileRecord {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locationState: string;
  preferredCategories: string[];
  invitationPolicy: InvitationPolicy;
  muteReferrals: boolean;
  profileVisibility: 'PUBLIC' | 'NETWORK_ONLY';
  bankSummary: string;
  eligibleForCommission: boolean;
  ineligibilityReason?: string;
}

export interface ReferralAncestryRecord {
  scoutUserId: string;
  directReferrerId: string | null;
  attributionSource: 'REFERRAL_LINK' | 'REFERRAL_CARD' | 'ORGANIC';
  referralEventId: string | null;
  lockedAt: string;
}

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

export interface UserBlockRecord {
  blockerId: string;
  blockedId: string;
  createdAt: string;
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
  adminBootstrapAvailable: boolean;
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

interface OtpChallenge {
  email: string;
  codeHash: string;
  expiresAt: number;
}

interface InternalStore {
  users: Record<string, UserAccountRecord>;
  scouts: Record<string, ScoutProfileRecord>;
  ancestry: Record<string, ReferralAncestryRecord>;
  sellers: Record<string, SellerProfileRecord>;
  teamMembers: SellerTeamMemberRecord[];
  verifications: VerificationRecord[];
  products: ProductListing[];
  scoutsList: ScoutsListContact[];
  invitations: ScoutsListInvitation[];
  userBlocks: UserBlockRecord[];
  abuseReports: AbuseReportRecord[];
  adminRoles: Record<string, AdminRole>;
  auditLogs: AuditLogRecord[];
  referralEvents: ProductReferralEvent[];
  orders: MarketplaceOrder[];
  ledger: LedgerEntry[];
  notifications: PlatformNotification[];
  supportCases: SupportCase[];
  monthlyPublicationsBySeller: Record<string, number>;
  otpChallenges: Record<string, OtpChallenge>;
  adminClaimed: boolean;
}

function getExpiryDays(): number {
  const raw = Number(process.env.SCOUTS_LIST_INVITATION_EXPIRY_DAYS || '14');
  return Number.isFinite(raw) && raw > 0 ? raw : 14;
}

function createInitialStore(): InternalStore {
  const users: Record<string, UserAccountRecord> = {};
  const scouts: Record<string, ScoutProfileRecord> = {};
  const ancestry: Record<string, ReferralAncestryRecord> = {};

  const seedScout = (params: {
    id: string;
    email: string;
    handle: string;
    displayName: string;
    city: string;
    directReferrerId: string | null;
    eligible?: boolean;
    ineligibilityReason?: string;
    bankSummary: string;
    invitePolicy?: InvitationPolicy;
    joinedAt: string;
  }) => {
    users[params.id] = {
      id: params.id,
      email: params.email,
      phone: null,
      passwordHash: null, // Passwordless OTP / preview sign-in unless registered with password
      accountStatus: 'ACTIVE',
      restrictionReason: null,
      closedAt: null,
      createdAt: `${params.joinedAt}T09:00:00Z`,
    };
    scouts[params.id] = {
      userId: params.id,
      username: params.handle,
      displayName: params.displayName,
      avatarUrl: null,
      bio: `${params.city}-based NairaScout member.`,
      locationState: params.city,
      preferredCategories: ['Home & Craft', 'Audio & Tech'],
      invitationPolicy: params.invitePolicy ?? 'EVERYONE',
      muteReferrals: false,
      profileVisibility: 'PUBLIC',
      bankSummary: params.bankSummary,
      eligibleForCommission: params.eligible ?? true,
      ineligibilityReason: params.ineligibilityReason,
    };
    ancestry[params.id] = {
      scoutUserId: params.id,
      directReferrerId: params.directReferrerId,
      attributionSource: params.directReferrerId ? 'REFERRAL_LINK' : 'ORGANIC',
      referralEventId: null,
      lockedAt: `${params.joinedAt}T09:00:00Z`,
    };
  };

  seedScout({
    id: '10000000-0000-4000-8000-000000000013',
    email: 'chiefo@nairascout.ng',
    handle: 'chiefo_abuja',
    displayName: 'Chief O. Nwosu',
    city: 'Abuja',
    directReferrerId: null,
    bankSummary: 'Zenith Bank · ****4102',
    invitePolicy: 'CONTACTS_ONLY',
    joinedAt: '2025-01-12',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000012',
    email: 'bimpe@nairascout.ng',
    handle: 'bimpe_curates',
    displayName: 'Bimpe Adeyemi',
    city: 'Ibadan',
    directReferrerId: '10000000-0000-4000-8000-000000000013',
    bankSummary: 'GTBank · ****1190',
    joinedAt: '2025-02-03',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000011',
    email: 'musa@nairascout.ng',
    handle: 'musa_kano',
    displayName: 'Musa Danjuma',
    city: 'Kano',
    directReferrerId: '10000000-0000-4000-8000-000000000012',
    eligible: false,
    ineligibilityReason: 'Dormant verification review',
    bankSummary: 'Pending verification',
    invitePolicy: 'CONTACTS_ONLY',
    joinedAt: '2025-02-28',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000010',
    email: 'esther@nairascout.ng',
    handle: 'esther_ph',
    displayName: 'Esther Briggs',
    city: 'Port Harcourt',
    directReferrerId: '10000000-0000-4000-8000-000000000011',
    bankSummary: 'Access Bank · ****8841',
    joinedAt: '2025-03-19',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000009',
    email: 'segun@nairascout.ng',
    handle: 'segun_tech',
    displayName: 'Segun Lawal',
    city: 'Lagos',
    directReferrerId: '10000000-0000-4000-8000-000000000010',
    bankSummary: 'Kuda · ****3019',
    joinedAt: '2025-04-04',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000008',
    email: 'halima@nairascout.ng',
    handle: 'halima_style',
    displayName: 'Halima Bello',
    city: 'Kaduna',
    directReferrerId: '10000000-0000-4000-8000-000000000009',
    bankSummary: 'UBA · ****5520',
    joinedAt: '2025-05-11',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000007',
    email: 'ifeanyi@nairascout.ng',
    handle: 'ifeanyi_enugu',
    displayName: 'Ifeanyi Eze',
    city: 'Enugu',
    directReferrerId: '10000000-0000-4000-8000-000000000008',
    bankSummary: 'Fidelity · ****7412',
    joinedAt: '2025-06-08',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000006',
    email: 'zainab@nairascout.ng',
    handle: 'zainab_home',
    displayName: 'Zainab Yusuf',
    city: 'Abuja',
    directReferrerId: '10000000-0000-4000-8000-000000000007',
    bankSummary: 'Stanbic · ****9204',
    joinedAt: '2025-07-15',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000005',
    email: 'damilola@nairascout.ng',
    handle: 'damilola_vi',
    displayName: 'Damilola Ogunleye',
    city: 'Lagos',
    directReferrerId: '10000000-0000-4000-8000-000000000006',
    bankSummary: 'GTBank · ****6310',
    joinedAt: '2025-08-01',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000004',
    email: 'chidi@nairascout.ng',
    handle: 'chidi_market',
    displayName: 'Chidi Obi',
    city: 'Onitsha',
    directReferrerId: '10000000-0000-4000-8000-000000000005',
    bankSummary: 'Zenith Bank · ****2049',
    joinedAt: '2025-09-10',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000003',
    email: 'folake@nairascout.ng',
    handle: 'folake_lagos',
    displayName: 'Folake Coker',
    city: 'Lagos',
    directReferrerId: '10000000-0000-4000-8000-000000000004',
    bankSummary: 'Access Bank · ****4478',
    joinedAt: '2025-10-05',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000002',
    email: 'kemi@nairascout.ng',
    handle: 'kemi_finds',
    displayName: 'Kemi Balogun',
    city: 'Lagos',
    directReferrerId: '10000000-0000-4000-8000-000000000003',
    bankSummary: 'GTBank · ****8123',
    joinedAt: '2025-11-12',
  });
  seedScout({
    id: '10000000-0000-4000-8000-000000000001',
    email: 'tunde@nairascout.ng',
    handle: 'tunde_ng',
    displayName: 'Tunde Bakare',
    city: 'Lagos',
    directReferrerId: '10000000-0000-4000-8000-000000000002',
    bankSummary: 'GTBank · ****0921',
    joinedAt: '2025-12-01',
  });
  // Primary Scout: Amara Okafor
  const AMARA_ID = '20000000-0000-4000-8000-000000000001';
  seedScout({
    id: AMARA_ID,
    email: 'amara@nairascout.ng',
    handle: 'amara_scout',
    displayName: 'Amara Okafor',
    city: 'Lagos',
    directReferrerId: '10000000-0000-4000-8000-000000000001',
    bankSummary: 'GTBank · ****4829 (Verified Same-Name)',
    joinedAt: '2026-01-14',
  });

  // Downstream Sellers & Scouts
  const ADAEZE_ID = '30000000-0000-4000-8000-000000000001';
  const YEMI_ID = '30000000-0000-4000-8000-000000000002';
  const ZURI_ID = '30000000-0000-4000-8000-000000000003';
  const KANO_ID = '30000000-0000-4000-8000-000000000004';
  const NGOZI_ID = '30000000-0000-4000-8000-000000000005';
  const IBRAHIM_ID = '30000000-0000-4000-8000-000000000006';
  const SOLA_ID = '30000000-0000-4000-8000-000000000007';

  seedScout({
    id: ADAEZE_ID,
    email: 'adaeze@nairascout.ng',
    handle: 'adaeze_atelier',
    displayName: 'Adaeze Crafts & Home',
    city: 'Abuja',
    directReferrerId: AMARA_ID,
    bankSummary: 'Zenith Bank · ****3391',
    joinedAt: '2026-02-02',
  });
  seedScout({
    id: YEMI_ID,
    email: 'yemi@nairascout.ng',
    handle: 'yemi_audio',
    displayName: 'Yemi Adeola',
    city: 'Lagos',
    directReferrerId: ADAEZE_ID,
    bankSummary: 'Access Bank · ****1082',
    joinedAt: '2026-03-11',
  });
  seedScout({
    id: ZURI_ID,
    email: 'zuri@nairascout.ng',
    handle: 'zuri_botanicals',
    displayName: 'Zuri Botanicals',
    city: 'Lagos',
    directReferrerId: YEMI_ID,
    bankSummary: 'Stanbic IBTC · ****7710',
    joinedAt: '2026-04-06',
  });
  seedScout({
    id: KANO_ID,
    email: 'arewa@nairascout.ng',
    handle: 'arewa_leather',
    displayName: 'Arewa Leatherworks',
    city: 'Kano',
    directReferrerId: ZURI_ID,
    bankSummary: 'UBA · ****6620',
    joinedAt: '2026-05-18',
  });
  seedScout({
    id: NGOZI_ID,
    email: 'ngozi@nairascout.ng',
    handle: 'ngozi_kitchen',
    displayName: 'Ngozi Peters',
    city: 'Port Harcourt',
    directReferrerId: AMARA_ID,
    bankSummary: 'Fidelity · ****5122',
    joinedAt: '2026-03-22',
  });
  seedScout({
    id: IBRAHIM_ID,
    email: 'ibrahim@nairascout.ng',
    handle: 'ibrahim_gadgets',
    displayName: 'Ibrahim Sule',
    city: 'Abuja',
    directReferrerId: NGOZI_ID,
    bankSummary: 'GTBank · ****3901',
    joinedAt: '2026-04-29',
  });
  seedScout({
    id: SOLA_ID,
    email: 'sola@nairascout.ng',
    handle: 'sola_style',
    displayName: 'Sola Akinwande',
    city: 'Ibadan',
    directReferrerId: AMARA_ID,
    bankSummary: 'Kuda · ****8902',
    joinedAt: '2026-06-14',
  });

  // Seller Profiles
  const sellers: Record<string, SellerProfileRecord> = {
    '40000000-0000-4000-8000-000000000001': {
      id: '40000000-0000-4000-8000-000000000001',
      ownerUserId: AMARA_ID,
      sellerType: 'INDIVIDUAL',
      sellerName: 'Amara Okafor Roastery',
      description: 'Small-batch single-origin Jos Plateau coffee & pantry craft.',
      businessCategory: 'Kitchen & Pantry',
      businessRegNumber: null,
      businessAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
      businessContactEmail: 'amara@nairascout.ng',
      businessContactPhone: '+234 803 000 0101',
      sellerStatus: 'ACTIVE',
      subscriptionPlan: 'TRACTION',
      subscriptionStatus: 'ACTIVE',
      termsAcceptedAt: '2026-01-20T10:00:00Z',
      createdAt: '2026-01-20T10:00:00Z',
    },
    '40000000-0000-4000-8000-000000000002': {
      id: '40000000-0000-4000-8000-000000000002',
      ownerUserId: ADAEZE_ID,
      sellerType: 'BUSINESS',
      sellerName: 'Adaeze Crafts & Home',
      description: 'Iseyin hand-loomed cotton textiles & homewares.',
      businessCategory: 'Home & Craft',
      businessRegNumber: 'RC-482190',
      businessAddress: 'Wuse II, Abuja',
      businessContactEmail: 'adaeze@nairascout.ng',
      businessContactPhone: '+234 809 000 0202',
      sellerStatus: 'ACTIVE',
      subscriptionPlan: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
      termsAcceptedAt: '2026-02-05T10:00:00Z',
      createdAt: '2026-02-05T10:00:00Z',
    },
    '40000000-0000-4000-8000-000000000003': {
      id: '40000000-0000-4000-8000-000000000003',
      ownerUserId: YEMI_ID,
      sellerType: 'INDIVIDUAL',
      sellerName: 'Yemi Adeola Audio',
      description: 'Wireless commuter audio gear.',
      businessCategory: 'Audio & Tech',
      businessRegNumber: null,
      businessAddress: 'Yaba, Lagos',
      businessContactEmail: 'yemi@nairascout.ng',
      businessContactPhone: null,
      sellerStatus: 'ACTIVE',
      subscriptionPlan: 'TRACTION',
      subscriptionStatus: 'ACTIVE',
      termsAcceptedAt: '2026-03-14T10:00:00Z',
      createdAt: '2026-03-14T10:00:00Z',
    },
    '40000000-0000-4000-8000-000000000004': {
      id: '40000000-0000-4000-8000-000000000004',
      ownerUserId: ZURI_ID,
      sellerType: 'BUSINESS',
      sellerName: 'Zuri Botanicals',
      description: 'NAFDAC-registered cold-pressed botanical skincare.',
      businessCategory: 'Beauty & Botanicals',
      businessRegNumber: 'RC-993011',
      businessAddress: 'Victoria Island, Lagos',
      businessContactEmail: 'zuri@nairascout.ng',
      businessContactPhone: null,
      sellerStatus: 'ACTIVE',
      subscriptionPlan: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
      termsAcceptedAt: '2026-04-08T10:00:00Z',
      createdAt: '2026-04-08T10:00:00Z',
    },
    '40000000-0000-4000-8000-000000000005': {
      id: '40000000-0000-4000-8000-000000000005',
      ownerUserId: KANO_ID,
      sellerType: 'BUSINESS',
      sellerName: 'Arewa Leatherworks',
      description: 'Vegetable-tanned Sokoto leather travel bags.',
      businessCategory: 'Fashion & Leather',
      businessRegNumber: 'RC-774122',
      businessAddress: 'Kano Municipal, Kano',
      businessContactEmail: 'arewa@nairascout.ng',
      businessContactPhone: null,
      sellerStatus: 'ACTIVE',
      subscriptionPlan: 'SPRAWL',
      subscriptionStatus: 'ACTIVE',
      termsAcceptedAt: '2026-05-20T10:00:00Z',
      createdAt: '2026-05-20T10:00:00Z',
    },
    '40000000-0000-4000-8000-000000000006': {
      id: '40000000-0000-4000-8000-000000000006',
      ownerUserId: '10000000-0000-4000-8000-000000000009',
      sellerType: 'INDIVIDUAL',
      sellerName: 'Segun Lawal Tech',
      description: 'Portable LiFePO4 backup power solutions.',
      businessCategory: 'Audio & Tech',
      businessRegNumber: null,
      businessAddress: 'Ikeja, Lagos',
      businessContactEmail: 'segun@nairascout.ng',
      businessContactPhone: null,
      sellerStatus: 'ACTIVE',
      subscriptionPlan: 'TRACTION',
      subscriptionStatus: 'ACTIVE',
      termsAcceptedAt: '2025-04-10T10:00:00Z',
      createdAt: '2025-04-10T10:00:00Z',
    },
    // Pending Seller (onboarding example for verification queue!)
    '40000000-0000-4000-8000-000000000007': {
      id: '40000000-0000-4000-8000-000000000007',
      ownerUserId: NGOZI_ID,
      sellerType: 'BUSINESS',
      sellerName: 'Port Harcourt Spice Collective',
      description: 'Sun-dried riverine spice blends and condiments.',
      businessCategory: 'Kitchen & Pantry',
      businessRegNumber: 'BN-5520194',
      businessAddress: 'GRA Phase 2, Port Harcourt',
      businessContactEmail: 'ngozi@nairascout.ng',
      businessContactPhone: '+234 805 000 0404',
      sellerStatus: 'ONBOARDING',
      subscriptionPlan: 'STARTER',
      subscriptionStatus: 'ACTIVE',
      termsAcceptedAt: '2026-11-18T11:00:00Z',
      createdAt: '2026-11-18T11:00:00Z',
    },
  };

  const fullPerms: SellerTeamPermissions = {
    canManageListings: true,
    canManageOrders: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canManageTeam: true,
  };

  const teamMembers: SellerTeamMemberRecord[] = Object.values(sellers).map((s) => ({
    id: `TM-${s.id.slice(-4)}`,
    sellerProfileId: s.id,
    userId: s.ownerUserId,
    role: 'BUSINESS_OWNER',
    permissions: fullPerms,
    status: 'ACTIVE',
    invitedBy: null,
    createdAt: s.createdAt,
    revokedAt: null,
  }));

  const verifications: VerificationRecord[] = [
    {
      id: 'VER-AMARA-CONTACT',
      userId: AMARA_ID,
      sellerProfileId: null,
      category: 'CONTACT',
      status: 'APPROVED',
      evidencePaths: [],
      reviewerNotes: 'Email verified',
      reviewedBy: null,
      submittedAt: '2026-01-14T09:05:00Z',
      reviewedAt: '2026-01-14T09:05:00Z',
    },
    {
      id: 'VER-AMARA-ID',
      userId: AMARA_ID,
      sellerProfileId: null,
      category: 'IDENTITY',
      status: 'APPROVED',
      evidencePaths: ['verification-docs/amara-nin.pdf'],
      reviewerNotes: 'NIN verified against profile name',
      reviewedBy: null,
      submittedAt: '2026-01-18T12:00:00Z',
      reviewedAt: '2026-01-19T14:00:00Z',
    },
    {
      id: 'VER-AMARA-BANK',
      userId: AMARA_ID,
      sellerProfileId: null,
      category: 'PAYOUT_BANK',
      status: 'APPROVED',
      evidencePaths: [],
      reviewerNotes: 'GTBank same-name match confirmed',
      reviewedBy: null,
      submittedAt: '2026-01-19T15:00:00Z',
      reviewedAt: '2026-01-19T15:05:00Z',
    },
    {
      id: 'VER-AMARA-SELLER',
      userId: AMARA_ID,
      sellerProfileId: '40000000-0000-4000-8000-000000000001',
      category: 'SELLER',
      status: 'APPROVED',
      evidencePaths: ['verification-docs/amara-roastery-address.pdf'],
      reviewerNotes: 'Individual seller onboarding approved',
      reviewedBy: null,
      submittedAt: '2026-01-20T10:05:00Z',
      reviewedAt: '2026-01-21T09:30:00Z',
    },
    // Approved verifications for seeded active sellers
    ...['40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000006'].map(
      (sid, idx) => ({
        id: `VER-SELLER-${idx + 2}`,
        userId: sellers[sid].ownerUserId,
        sellerProfileId: sid,
        category: 'SELLER' as const,
        status: 'APPROVED' as const,
        evidencePaths: [`verification-docs/seller-${idx + 2}-cac.pdf`],
        reviewerNotes: 'Verified business documentation',
        reviewedBy: null,
        submittedAt: sellers[sid].createdAt,
        reviewedAt: sellers[sid].createdAt,
      })
    ),
    // Pending Seller Verification for Ngozi (for Admin Verification Queue!)
    {
      id: 'VER-NGOZI-SELLER',
      userId: NGOZI_ID,
      sellerProfileId: '40000000-0000-4000-8000-000000000007',
      category: 'SELLER',
      status: 'PENDING',
      evidencePaths: [
        'verification-docs/ngozi-cac-bn5520194.pdf',
        'verification-docs/ngozi-gov-id.jpg',
      ],
      reviewerNotes: null,
      reviewedBy: null,
      submittedAt: '2026-11-18T11:10:00Z',
      reviewedAt: null,
    },
  ];

  const products: ProductListing[] = [
    {
      id: 'LST-101',
      productId: 'PRD-101',
      title: 'Hand-Loomed Aso-Oke Throw & Cushion Pair',
      description:
        'Woven in Iseyin with heavyweight unbleached cotton and subtle indigo selvedge stripes. Finished with concealed brass zips.',
      category: 'Home & Craft',
      priceKobo: 4850000,
      deliveryFeeKobo: 350000,
      stock: 14,
      sellerScoutId: ADAEZE_ID,
      sellerProfileId: '40000000-0000-4000-8000-000000000002',
      sellerName: 'Adaeze Crafts & Home',
      sellerCity: 'Abuja',
      hasActiveSellerBadge: true,
      isSellerVerified: true,
      status: 'PUBLISHED',
      imageSeed: 'nairascout-asooke-throw',
      imageUrl: 'https://picsum.photos/seed/nairascout-asooke-throw/800/600',
      daysRemaining: 8,
      specifications: ['100% combed Nigerian cotton', '150cm × 210cm throw + two 45cm covers', 'Cold hand wash'],
      returnPolicy: '7-day unused return window via Seller verification',
      warranty: 'Craftsmanship seam guarantee',
      impressions: 1240,
      referralShares: 38,
    },
    {
      id: 'LST-102',
      productId: 'PRD-102',
      title: 'Lagos Studio Wireless ANC Headphones',
      description:
        'Balanced studio tuning with 42-hour battery life, dual-device Bluetooth 5.4, and USB-C fast charging engineered for commuters.',
      category: 'Audio & Tech',
      priceKobo: 10000000,
      deliveryFeeKobo: 400000,
      stock: 9,
      sellerScoutId: YEMI_ID,
      sellerProfileId: '40000000-0000-4000-8000-000000000003',
      sellerName: 'Yemi Adeola Audio',
      sellerCity: 'Lagos',
      hasActiveSellerBadge: true,
      isSellerVerified: true,
      status: 'PUBLISHED',
      imageSeed: 'nairascout-studio-headphones',
      imageUrl: 'https://picsum.photos/seed/nairascout-studio-headphones/800/600',
      daysRemaining: 9,
      specifications: ['40mm dynamic drivers', 'Hybrid -38dB ANC', 'USB-C 10-min = 5hr charge'],
      returnPolicy: '14-day unopened or DOA replacement',
      warranty: '12-month Lagos service centre warranty',
      impressions: 2180,
      referralShares: 64,
    },
    {
      id: 'LST-103',
      productId: 'PRD-103',
      title: 'Cold-Pressed Shea & Baobab Barrier Serum Set',
      description:
        'Unrefined northern Nigerian shea oil blended with cold-pressed baobab seed and niacinamide for humid and dry climates.',
      category: 'Beauty & Botanicals',
      priceKobo: 2800000,
      deliveryFeeKobo: 250000,
      stock: 27,
      sellerScoutId: ZURI_ID,
      sellerProfileId: '40000000-0000-4000-8000-000000000004',
      sellerName: 'Zuri Botanicals',
      sellerCity: 'Lagos',
      hasActiveSellerBadge: true,
      isSellerVerified: true,
      status: 'PUBLISHED',
      imageSeed: 'nairascout-shea-serum',
      imageUrl: 'https://picsum.photos/seed/nairascout-shea-serum/800/600',
      daysRemaining: 7,
      specifications: ['2 × 50ml amber UV glass bottles', 'NAFDAC registered batch', 'Fragrance-free formula'],
      returnPolicy: 'Unsealed hygiene exclusion; damaged-in-transit replacement',
      warranty: 'Fresh batch guarantee (9 months shelf life)',
      impressions: 1690,
      referralShares: 51,
    },
    {
      id: 'LST-104',
      productId: 'PRD-104',
      title: 'Full-Grain Kano Weekender Duffel Bag',
      description:
        'Vegetable-tanned Sokoto goat and cowhide leather cabin bag with solid brass buckles and waxed canvas lining.',
      category: 'Fashion & Leather',
      priceKobo: 12500000,
      deliveryFeeKobo: 500000,
      stock: 5,
      sellerScoutId: KANO_ID,
      sellerProfileId: '40000000-0000-4000-8000-000000000005',
      sellerName: 'Arewa Leatherworks',
      sellerCity: 'Kano',
      hasActiveSellerBadge: true,
      isSellerVerified: true,
      status: 'PUBLISHED',
      imageSeed: 'nairascout-leather-duffel',
      imageUrl: 'https://picsum.photos/seed/nairascout-leather-duffel/800/600',
      daysRemaining: 6,
      specifications: ['Cabin compliant 52cm × 28cm', 'Detachable padded shoulder strap', 'Dust bag included'],
      returnPolicy: '7-day unused return with original tags',
      warranty: '24-month hardware & stitching warranty',
      impressions: 940,
      referralShares: 29,
    },
    {
      id: 'LST-105',
      productId: 'PRD-105',
      title: 'Jos Highland Single-Origin Espresso Trio (750g)',
      description:
        'Medium-dark washed Arabica roasted weekly on the Jos Plateau with notes of dark cocoa, toasted hazelnut, and dried fig.',
      category: 'Kitchen & Pantry',
      priceKobo: 2250000,
      deliveryFeeKobo: 250000,
      stock: 32,
      sellerScoutId: AMARA_ID,
      sellerProfileId: '40000000-0000-4000-8000-000000000001',
      sellerName: 'Amara Okafor Roastery',
      sellerCity: 'Lagos',
      hasActiveSellerBadge: true,
      isSellerVerified: true,
      status: 'PUBLISHED',
      imageSeed: 'nairascout-jos-coffee',
      imageUrl: 'https://picsum.photos/seed/nairascout-jos-coffee/800/600',
      daysRemaining: 10,
      specifications: ['3 × 250g whole bean valve bags', '1,350m elevation Jos Plateau', 'Roasted within 72h of dispatch'],
      returnPolicy: 'Freshness replacement on seal breach',
      warranty: 'Roast date stamped on every pouch',
      impressions: 615,
      referralShares: 19,
    },
    {
      id: 'LST-106',
      productId: 'PRD-106',
      title: 'Portable 300W LiFePO4 Mini Power Station',
      description:
        'Compact silent backup power for laptops, routers, and studio lights with pure sine-wave AC outlet and 100W USB-C PD.',
      category: 'Audio & Tech',
      priceKobo: 18500000,
      deliveryFeeKobo: 650000,
      stock: 6,
      sellerScoutId: '10000000-0000-4000-8000-000000000009',
      sellerProfileId: '40000000-0000-4000-8000-000000000006',
      sellerName: 'Segun Lawal Tech',
      sellerCity: 'Lagos',
      hasActiveSellerBadge: true,
      isSellerVerified: true,
      status: 'PUBLISHED',
      imageSeed: 'nairascout-power-station',
      imageUrl: 'https://picsum.photos/seed/nairascout-power-station/800/600',
      daysRemaining: 5,
      specifications: ['288Wh LiFePO4 (3,000+ cycles)', '2 × Nigerian 3-pin AC outlets', 'Solar MPPT input ready'],
      returnPolicy: '7-day inspection return',
      warranty: '18-month battery cell warranty',
      impressions: 3120,
      referralShares: 92,
    },
  ];

  const scoutsList: ScoutsListContact[] = [
    {
      contactId: 'CNT-01',
      ownerUserId: AMARA_ID,
      scoutId: NGOZI_ID,
      handle: 'ngozi_kitchen',
      displayName: 'Ngozi Peters',
      city: 'Port Harcourt',
      addedAt: '2026-04-02',
      blocked: false,
      hasActiveSellerBadge: false,
      isSellerVerified: false,
    },
    {
      contactId: 'CNT-02',
      ownerUserId: AMARA_ID,
      scoutId: SOLA_ID,
      handle: 'sola_style',
      displayName: 'Sola Akinwande',
      city: 'Ibadan',
      addedAt: '2026-06-18',
      blocked: false,
      hasActiveSellerBadge: false,
      isSellerVerified: false,
    },
    {
      contactId: 'CNT-03',
      ownerUserId: AMARA_ID,
      scoutId: '10000000-0000-4000-8000-000000000001',
      handle: 'tunde_ng',
      displayName: 'Tunde Bakare',
      city: 'Lagos',
      addedAt: '2026-01-16',
      blocked: false,
      hasActiveSellerBadge: false,
      isSellerVerified: false,
    },
    {
      contactId: 'CNT-04',
      ownerUserId: AMARA_ID,
      scoutId: IBRAHIM_ID,
      handle: 'ibrahim_gadgets',
      displayName: 'Ibrahim Sule',
      city: 'Abuja',
      addedAt: '2026-07-04',
      blocked: false,
      hasActiveSellerBadge: false,
      isSellerVerified: false,
    },
  ];

  const invitations: ScoutsListInvitation[] = [
    {
      id: 'INV-401',
      senderId: '10000000-0000-4000-8000-000000000002',
      recipientId: AMARA_ID,
      direction: 'incoming',
      otherScoutId: '10000000-0000-4000-8000-000000000002',
      otherHandle: 'kemi_finds',
      otherDisplayName: 'Kemi Balogun',
      otherCity: 'Lagos',
      status: 'pending',
      createdAt: '2026-11-19',
      expiresAt: '2026-12-03',
    },
    {
      id: 'INV-402',
      senderId: AMARA_ID,
      recipientId: ZURI_ID,
      direction: 'outgoing',
      otherScoutId: ZURI_ID,
      otherHandle: 'zuri_botanicals',
      otherDisplayName: 'Zuri Botanicals',
      otherCity: 'Lagos',
      status: 'pending',
      createdAt: '2026-11-20',
      expiresAt: '2026-12-04',
    },
  ];

  const referralEvents: ProductReferralEvent[] = [
    {
      id: 'RE-8402-NG',
      productListingId: 'LST-102',
      senderScoutId: '10000000-0000-4000-8000-000000000001',
      senderHandle: 'tunde_ng',
      senderDisplayName: 'Tunde Bakare',
      recipientScoutId: AMARA_ID,
      recipientHandle: 'amara_scout',
      recipientDisplayName: 'Amara Okafor',
      note: 'Tested these on the Lekki-Ikoyi commute — ANC blocks danfo noise cleanly and battery lasts all week.',
      ancestryPathSignature: 'tunde_ng->amara_scout',
      createdAt: '2026-11-18T14:20:00Z',
      expiresAt: '2026-11-28T14:20:00Z',
      status: 'active',
    },
    {
      id: 'RE-8409-NG',
      productListingId: 'LST-104',
      senderScoutId: NGOZI_ID,
      senderHandle: 'ngozi_kitchen',
      senderDisplayName: 'Ngozi Peters',
      recipientScoutId: AMARA_ID,
      recipientHandle: 'amara_scout',
      recipientDisplayName: 'Amara Okafor',
      note: 'Arewa Leatherworks finally restocked the cabin weekender in dark chestnut.',
      ancestryPathSignature: 'ngozi_kitchen->amara_scout',
      createdAt: '2026-11-19T09:15:00Z',
      expiresAt: '2026-11-29T09:15:00Z',
      status: 'active',
    },
    {
      id: 'RE-8415-NG',
      productListingId: 'LST-103',
      senderScoutId: AMARA_ID,
      senderHandle: 'amara_scout',
      senderDisplayName: 'Amara Okafor',
      recipientScoutId: SOLA_ID,
      recipientHandle: 'sola_style',
      recipientDisplayName: 'Sola Akinwande',
      note: 'Sola, this is the unrefined baobab barrier set we spoke about for harmattan.',
      ancestryPathSignature: 'amara_scout->sola_style',
      createdAt: '2026-11-17T11:05:00Z',
      expiresAt: '2026-11-27T11:05:00Z',
      status: 'active',
    },
  ];

  const abuseReports: AbuseReportRecord[] = [
    {
      id: 'ABR-101',
      reporterId: SOLA_ID,
      reporterHandle: 'sola_style',
      reportedUserId: '10000000-0000-4000-8000-000000000011',
      reportedHandle: 'musa_kano',
      referralEventId: null,
      reason: 'Unsolicited repetitive referral messages',
      description: 'Received repeated external link messages outside Scouts List.',
      status: 'OPEN',
      resolvedBy: null,
      createdAt: '2026-11-19T12:00:00Z',
      resolvedAt: null,
    },
  ];

  const auditLogs: AuditLogRecord[] = [
    {
      id: 'AUD-001',
      actorId: null,
      actorHandle: 'system_verification',
      affectedUserId: AMARA_ID,
      affectedHandle: 'amara_scout',
      action: 'SELLER_VERIFICATION_APPROVED',
      entityType: 'verification_records',
      entityId: 'VER-AMARA-SELLER',
      previousValue: { status: 'PENDING' },
      newValue: { status: 'APPROVED', sellerStatus: 'ACTIVE' },
      reason: 'Initial individual seller verification confirmed',
      createdAt: '2026-01-21T09:30:00Z',
    },
  ];

  const store: InternalStore = {
    users,
    scouts,
    ancestry,
    sellers,
    teamMembers,
    verifications,
    products,
    scoutsList,
    invitations,
    userBlocks: [],
    abuseReports,
    adminRoles: {},
    auditLogs,
    referralEvents,
    orders: [],
    ledger: [],
    notifications: [
      {
        id: 'NTF-01',
        userId: AMARA_ID,
        category: 'referral',
        title: 'New product referral from @tunde_ng',
        body: 'Tunde Bakare sent you a referral card for Lagos Studio Wireless ANC Headphones (RE-8402-NG).',
        createdAt: '2026-11-18T14:20:00Z',
        read: false,
      },
      {
        id: 'NTF-02',
        userId: AMARA_ID,
        category: 'payout',
        title: 'Monthly payout cycle schedule',
        body: 'Available commissions earned in November qualify for the December 15 monthly settlement (₦5,000 minimum).',
        createdAt: '2026-11-15T08:00:00Z',
        read: true,
      },
    ],
    supportCases: [],
    monthlyPublicationsBySeller: {
      '40000000-0000-4000-8000-000000000001': 2,
    },
    otpChallenges: {},
    adminClaimed: false,
  };

  seedInitialOrdersAndLedger(store);
  return store;
}

export function buildAncestryForScout(
  scoutId: string,
  store: InternalStore
): AncestorNode[] {
  const result: AncestorNode[] = [];
  const visited = new Set<string>([scoutId]);
  let currentId = store.ancestry[scoutId]?.directReferrerId ?? null;
  let generation = 1;

  while (currentId && generation <= 13) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const scout = store.scouts[currentId];
    const user = store.users[currentId];
    if (!scout || !user) break;
    const isEligible =
      scout.eligibleForCommission &&
      user.accountStatus === 'ACTIVE';

    result.push({
      generation,
      scoutId: user.id,
      handle: scout.username,
      displayName: scout.displayName,
      eligible: isEligible,
      ineligibilityReason: !isEligible
        ? scout.ineligibilityReason || `Account status: ${user.accountStatus}`
        : undefined,
    });
    currentId = store.ancestry[currentId]?.directReferrerId ?? null;
    generation += 1;
  }

  return result;
}

function createOrderRecordAndLedger(
  store: InternalStore,
  params: {
    orderId: string;
    buyerScoutId: string;
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
    fulfilmentStatus: OrderFulfilmentStatus;
    createdAt: string;
    fulfilmentDeadline: string;
    isPaidHistorical?: boolean;
  }
): MarketplaceOrder {
  const product = store.products.find((p) => p.id === params.productListingId)!;
  const buyer = store.scouts[params.buyerScoutId];
  const eligibleMerchandiseKobo = product.priceKobo * params.quantity;
  const deliveryFeeKobo = product.deliveryFeeKobo;
  const totalChargedKobo = eligibleMerchandiseKobo + deliveryFeeKobo;

  const isReferral = Boolean(params.referralEventId);
  const sellerAncestry = buildAncestryForScout(product.sellerScoutId, store);
  const breakdown = calculateThirteenGenerationCommissions(
    eligibleMerchandiseKobo,
    sellerAncestry,
    isReferral
  );

  const order: MarketplaceOrder = {
    id: params.orderId,
    buyerScoutId: params.buyerScoutId,
    buyerDisplayName: buyer?.displayName || 'Verified Guest Buyer',
    productListingId: product.id,
    productTitle: product.title,
    sellerScoutId: product.sellerScoutId,
    sellerName: product.sellerName,
    quantity: params.quantity,
    eligibleMerchandiseKobo,
    deliveryFeeKobo,
    totalChargedKobo,
    attributionType: isReferral ? 'referral_card' : 'direct',
    referralEventId: params.referralEventId,
    fulfilmentStatus: params.fulfilmentStatus,
    fulfilmentDeadline: params.fulfilmentDeadline,
    createdAt: params.createdAt,
    commissionSnapshot: breakdown,
  };

  store.orders.unshift(order);

  const targetStatus: LedgerEntryStatus = params.isPaidHistorical
    ? 'Paid'
    : params.fulfilmentStatus === 'Delivered'
    ? 'Available'
    : params.fulfilmentStatus === 'Disputed'
    ? 'On Hold'
    : 'Pending';

  for (const alloc of breakdown.allocations) {
    if (alloc.amountKobo <= 0 || alloc.scoutId === 'missing') continue;
    const ref = `LDG-${params.orderId}-G${alloc.generation}`;
    store.ledger.unshift({
      id: `${ref}-1`,
      reference: ref,
      orderId: params.orderId,
      referralEventId: params.referralEventId,
      beneficiaryScoutId: alloc.scoutId,
      generation: alloc.generation,
      fractionLabel: alloc.fractionLabel,
      amountKobo: alloc.amountKobo,
      status: targetStatus,
      ruleVersion: breakdown.ruleVersion,
      description: `Gen ${alloc.generation} (${alloc.fractionLabel}) referral allocation · ${product.title}`,
      createdAt: params.createdAt,
    });

    if (params.fulfilmentStatus === 'Refunded') {
      store.ledger.unshift({
        id: `${ref}-REV`,
        reference: `${ref}-REV`,
        orderId: params.orderId,
        referralEventId: params.referralEventId,
        beneficiaryScoutId: alloc.scoutId,
        generation: alloc.generation,
        fractionLabel: alloc.fractionLabel,
        amountKobo: alloc.amountKobo,
        status: 'Reversed',
        ruleVersion: breakdown.ruleVersion,
        description: `Order refunded · reversal of ${ref}`,
        createdAt: params.createdAt,
        linkedToReference: ref,
      });
    }
  }

  return order;
}

function seedInitialOrdersAndLedger(store: InternalStore) {
  const IBRAHIM_ID = '30000000-0000-4000-8000-000000000006';
  const SOLA_ID = '30000000-0000-4000-8000-000000000007';
  const NGOZI_ID = '30000000-0000-4000-8000-000000000005';

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9041',
    buyerScoutId: SOLA_ID,
    productListingId: 'LST-103',
    quantity: 2,
    referralEventId: 'RE-8415-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-10-21T10:30:00Z',
    fulfilmentDeadline: '2026-10-31T10:30:00Z',
    isPaidHistorical: true,
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9118',
    buyerScoutId: IBRAHIM_ID,
    productListingId: 'LST-101',
    quantity: 4,
    referralEventId: 'RE-7710-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-10-28T16:45:00Z',
    fulfilmentDeadline: '2026-11-07T16:45:00Z',
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9154',
    buyerScoutId: '10000000-0000-4000-8000-000000000005',
    productListingId: 'LST-102',
    quantity: 3,
    referralEventId: 'RE-7804-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-11-04T12:10:00Z',
    fulfilmentDeadline: '2026-11-14T12:10:00Z',
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9192',
    buyerScoutId: NGOZI_ID,
    productListingId: 'LST-104',
    quantity: 2,
    referralEventId: 'RE-8011-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-11-12T09:20:00Z',
    fulfilmentDeadline: '2026-11-22T09:20:00Z',
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9204',
    buyerScoutId: SOLA_ID,
    productListingId: 'LST-105',
    quantity: 2,
    referralEventId: null,
    fulfilmentStatus: 'Processing',
    createdAt: '2026-11-19T15:00:00Z',
    fulfilmentDeadline: '2026-11-29T15:00:00Z',
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9210',
    buyerScoutId: IBRAHIM_ID,
    productListingId: 'LST-105',
    quantity: 3,
    referralEventId: 'RE-8390-NG',
    fulfilmentStatus: 'Dispatched',
    createdAt: '2026-11-20T11:30:00Z',
    fulfilmentDeadline: '2026-11-30T11:30:00Z',
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9215',
    buyerScoutId: '10000000-0000-4000-8000-000000000006',
    productListingId: 'LST-101',
    quantity: 2,
    referralEventId: 'RE-8400-NG',
    fulfilmentStatus: 'Paid',
    createdAt: '2026-11-21T08:05:00Z',
    fulfilmentDeadline: '2026-12-01T08:05:00Z',
  });
}

const globalForStore = globalThis as unknown as {
  __nairascoutStoreV2?: InternalStore;
};

export function getStore(): InternalStore {
  if (!globalForStore.__nairascoutStoreV2) {
    globalForStore.__nairascoutStoreV2 = createInitialStore();
  }
  return globalForStore.__nairascoutStoreV2;
}

// ============================================================================
// AUTH CONTEXT & AUTHORIZATION HELPERS
// ============================================================================

export function buildUserAuthContextFromStore(userId: string | null): UserAuthContext | null {
  if (!userId) return null;
  const store = getStore();
  const user = store.users[userId];
  if (!user) return null;

  // Check owned seller profile or active team membership
  let sellerProfile = Object.values(store.sellers).find((s) => s.ownerUserId === userId) ?? null;
  let membership = sellerProfile
    ? store.teamMembers.find(
        (m) => m.sellerProfileId === sellerProfile!.id && m.userId === userId && m.status === 'ACTIVE'
      )
    : undefined;

  if (!sellerProfile) {
    const activeMember = store.teamMembers.find(
      (m) => m.userId === userId && m.status === 'ACTIVE'
    );
    if (activeMember) {
      membership = activeMember;
      sellerProfile = store.sellers[activeMember.sellerProfileId] ?? null;
    }
  }

  let sellerCtx: UserAuthContext['seller'] = null;
  if (sellerProfile) {
    const sellerVerif = store.verifications.find(
      (v) => v.sellerProfileId === sellerProfile!.id && v.category === 'SELLER'
    );
    sellerCtx = {
      sellerProfileId: sellerProfile.id,
      sellerType: sellerProfile.sellerType,
      sellerStatus: sellerProfile.sellerStatus,
      sellerVerificationStatus: sellerVerif?.status ?? 'NOT_SUBMITTED',
      subscriptionPlan: sellerProfile.subscriptionPlan,
      subscriptionStatus: sellerProfile.subscriptionStatus,
      role: membership?.role ?? 'BUSINESS_OWNER',
      permissions: membership?.permissions ?? {
        canManageListings: true,
        canManageOrders: true,
        canViewAnalytics: true,
        canManageBilling: true,
        canManageTeam: true,
      },
    };
  }

  return {
    userId: user.id,
    email: user.email,
    accountStatus: user.accountStatus,
    seller: sellerCtx,
    adminRole: store.adminRoles[userId] ?? null,
  };
}

function recordAuditLog(
  store: InternalStore,
  params: {
    actorId: string | null;
    affectedUserId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    reason?: string | null;
  }
) {
  const actorHandle = params.actorId
    ? store.scouts[params.actorId]?.username || params.actorId
    : 'system';
  const affectedHandle = store.scouts[params.affectedUserId]?.username || params.affectedUserId;

  store.auditLogs.unshift({
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    actorId: params.actorId,
    actorHandle,
    affectedUserId: params.affectedUserId,
    affectedHandle,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    reason: params.reason ?? null,
    createdAt: new Date().toISOString(),
  });
}

function isBlockedBetween(store: InternalStore, userA: string, userB: string): boolean {
  return store.userBlocks.some(
    (b) =>
      (b.blockerId === userA && b.blockedId === userB) ||
      (b.blockerId === userB && b.blockedId === userA)
  );
}

// ============================================================================
// AUTHENTICATION, REGISTRATION, OTP & ADMIN BOOTSTRAP
// ============================================================================

function findUserByEmail(store: InternalStore, email: string): UserAccountRecord | undefined {
  const norm = email.trim().toLowerCase();
  return Object.values(store.users).find((u) => u.email.toLowerCase() === norm);
}

export function registerUserAtomic(input: {
  email: string;
  password?: string;
  displayName: string;
  username?: string;
  locationState?: string;
  referralEventId?: string | null;
  referralScoutUsername?: string | null;
}): { user: UserAccountRecord; scout: ScoutProfileRecord } {
  const store = getStore();
  const normEmail = input.email.trim().toLowerCase();
  if (!normEmail || !normEmail.includes('@')) {
    throw new AuthorizationError('Valid email address required.', 400, 'INVALID_EMAIL');
  }
  const existing = findUserByEmail(store, normEmail);
  if (existing) {
    throw new AuthorizationError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
  }

  const baseHandle = (
    input.username?.trim() ||
    normEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase()
  ).slice(0, 24);
  let handle = baseHandle || `scout_${Math.floor(1000 + Math.random() * 9000)}`;
  let suffix = 1;
  while (Object.values(store.scouts).some((s) => s.username.toLowerCase() === handle.toLowerCase())) {
    handle = `${baseHandle}_${suffix++}`;
  }

  // Resolve referral attribution
  let directReferrerId: string | null = null;
  let attributionSource: ReferralAncestryRecord['attributionSource'] = 'ORGANIC';
  let refEventId: string | null = null;

  if (input.referralEventId) {
    const ev = store.referralEvents.find((r) => r.id === input.referralEventId);
    if (ev) {
      directReferrerId = ev.senderScoutId;
      attributionSource = 'REFERRAL_CARD';
      refEventId = ev.id;
    }
  } else if (input.referralScoutUsername) {
    const refScout = Object.values(store.scouts).find(
      (s) => s.username.toLowerCase() === input.referralScoutUsername!.trim().toLowerCase()
    );
    if (refScout) {
      directReferrerId = refScout.userId;
      attributionSource = 'REFERRAL_LINK';
    }
  }

  const newUserId = crypto.randomUUID();
  if (directReferrerId) {
    const map: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(store.ancestry)) {
      map[k] = v.directReferrerId;
    }
    const check = validateAncestryRelationship(newUserId, directReferrerId, map);
    if (!check.valid) {
      directReferrerId = null;
    }
  }

  const nowIso = new Date().toISOString();
  const user: UserAccountRecord = {
    id: newUserId,
    email: normEmail,
    phone: null,
    passwordHash: input.password ? hashPassword(input.password) : null,
    accountStatus: 'ACTIVE',
    restrictionReason: null,
    closedAt: null,
    createdAt: nowIso,
  };

  const scout: ScoutProfileRecord = {
    userId: newUserId,
    username: handle,
    displayName: input.displayName.trim() || handle,
    avatarUrl: null,
    bio: null,
    locationState: input.locationState?.trim() || 'Lagos',
    preferredCategories: [],
    invitationPolicy: 'EVERYONE',
    muteReferrals: false,
    profileVisibility: 'PUBLIC',
    bankSummary: 'Not linked yet',
    eligibleForCommission: true,
  };

  const ancestryRec: ReferralAncestryRecord = {
    scoutUserId: newUserId,
    directReferrerId,
    attributionSource,
    referralEventId: refEventId,
    lockedAt: nowIso,
  };

  store.users[newUserId] = user;
  store.scouts[newUserId] = scout;
  store.ancestry[newUserId] = ancestryRec;
  store.verifications.unshift({
    id: `VER-${Date.now()}`,
    userId: newUserId,
    sellerProfileId: null,
    category: 'CONTACT',
    status: 'APPROVED',
    evidencePaths: [],
    reviewerNotes: 'Email verified during registration',
    reviewedBy: null,
    submittedAt: nowIso,
    reviewedAt: nowIso,
  });

  recordAuditLog(store, {
    actorId: newUserId,
    affectedUserId: newUserId,
    action: 'USER_REGISTERED_ATOMIC',
    entityType: 'users',
    entityId: newUserId,
    newValue: {
      attributionSource,
      directReferrerId,
      referralEventId: refEventId,
    },
  });

  return { user, scout };
}

export function loginWithPassword(email: string, password: string): UserAccountRecord {
  const store = getStore();
  const user = findUserByEmail(store, email);
  if (!user || !user.passwordHash) {
    throw new AuthorizationError(
      'Invalid credentials. Use Email OTP if your account was created passwordlessly.',
      401,
      'INVALID_CREDENTIALS'
    );
  }
  if (!verifyPassword(password, user.passwordHash)) {
    throw new AuthorizationError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }
  if (user.accountStatus === 'CLOSED') {
    throw new AuthorizationError('This account has been closed.', 403, 'ACCOUNT_CLOSED');
  }
  return user;
}

export function requestEmailOtp(email: string): {
  sent: boolean;
  previewOtpCode: string;
  existingUser: boolean;
} {
  const store = getStore();
  const normEmail = email.trim().toLowerCase();
  if (!normEmail || !normEmail.includes('@')) {
    throw new AuthorizationError('Please enter a valid email address.', 400, 'INVALID_EMAIL');
  }

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = crypto.createHash('sha256').update(`${normEmail}:${code}`).digest('hex');

  store.otpChallenges[normEmail] = {
    email: normEmail,
    codeHash,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };

  return {
    sent: true,
    previewOtpCode: code,
    existingUser: Boolean(findUserByEmail(store, normEmail)),
  };
}

export function verifyEmailOtpAndProvision(input: {
  email: string;
  code: string;
  displayName?: string;
  referralEventId?: string | null;
  referralScoutUsername?: string | null;
}): { user: UserAccountRecord; createdNew: boolean } {
  const store = getStore();
  const normEmail = input.email.trim().toLowerCase();
  const challenge = store.otpChallenges[normEmail];
  if (!challenge || Date.now() > challenge.expiresAt) {
    throw new AuthorizationError('OTP code has expired. Request a new code.', 401, 'OTP_EXPIRED');
  }
  const candidateHash = crypto
    .createHash('sha256')
    .update(`${normEmail}:${input.code.trim()}`)
    .digest('hex');

  if (candidateHash !== challenge.codeHash) {
    throw new AuthorizationError('Invalid 6-digit verification code.', 401, 'OTP_INVALID');
  }

  delete store.otpChallenges[normEmail];

  const existing = findUserByEmail(store, normEmail);
  if (existing) {
    if (existing.accountStatus === 'CLOSED') {
      throw new AuthorizationError('This account has been closed.', 403, 'ACCOUNT_CLOSED');
    }
    return { user: existing, createdNew: false };
  }

  const { user } = registerUserAtomic({
    email: normEmail,
    displayName: input.displayName || normEmail.split('@')[0],
    referralEventId: input.referralEventId,
    referralScoutUsername: input.referralScoutUsername,
  });

  return { user, createdNew: true };
}

export function claimFirstAdmin(input: {
  email: string;
  password: string;
  displayName: string;
}): { user: UserAccountRecord } {
  const store = getStore();
  if (store.adminClaimed) {
    throw new AuthorizationError(
      'Initial Super Admin has already been claimed.',
      403,
      'ADMIN_ALREADY_CLAIMED'
    );
  }
  if (input.password.length < 8) {
    throw new AuthorizationError('Password must be at least 8 characters.', 400, 'WEAK_PASSWORD');
  }

  const normEmail = input.email.trim().toLowerCase();
  let user = findUserByEmail(store, normEmail);
  if (!user) {
    const reg = registerUserAtomic({
      email: normEmail,
      password: input.password,
      displayName: input.displayName || 'Platform Super Admin',
    });
    user = reg.user;
  } else {
    user.passwordHash = hashPassword(input.password);
  }

  store.adminRoles[user.id] = 'SUPER_ADMIN';
  store.adminClaimed = true;

  recordAuditLog(store, {
    actorId: user.id,
    affectedUserId: user.id,
    action: 'ADMIN_ROLE_CLAIMED',
    entityType: 'platform_admin_roles',
    entityId: user.id,
    newValue: { adminRole: 'SUPER_ADMIN' },
    reason: 'First-run Super Admin bootstrap claim',
  });

  return { user };
}

// ============================================================================
// WALLET, DOWNSTREAM STATS & SNAPSHOT PROJECTION
// ============================================================================

function computeWalletSummary(store: InternalStore, scoutId: string | null): WalletSummary {
  if (!scoutId) {
    return {
      pendingKobo: 0,
      availableKobo: 0,
      onHoldKobo: 0,
      paidKobo: 0,
      reversedKobo: 0,
      minimumPayoutKobo: 500000,
      nextPayoutDate: '15 Dec 2026',
      precedingMonthAvailableKobo: 0,
      eligibleForNextPayout: false,
    };
  }

  const scoutEntries = store.ledger.filter((e) => e.beneficiaryScoutId === scoutId);
  const latestByRootRef = new Map<string, LedgerEntry>();
  const chronological = [...scoutEntries].reverse();
  for (const entry of chronological) {
    const rootRef = entry.linkedToReference ?? entry.reference;
    latestByRootRef.set(rootRef, entry);
  }

  let pendingKobo = 0;
  let availableKobo = 0;
  let onHoldKobo = 0;
  let paidKobo = 0;
  let reversedKobo = 0;
  let precedingMonthAvailableKobo = 0;

  for (const entry of latestByRootRef.values()) {
    if (entry.status === 'Pending') pendingKobo += entry.amountKobo;
    if (entry.status === 'Available') {
      availableKobo += entry.amountKobo;
      if (entry.createdAt.startsWith('2026-10')) {
        precedingMonthAvailableKobo += entry.amountKobo;
      }
    }
    if (entry.status === 'On Hold') onHoldKobo += entry.amountKobo;
    if (entry.status === 'Paid') paidKobo += entry.amountKobo;
    if (entry.status === 'Reversed') reversedKobo += entry.amountKobo;
  }

  const minimumPayoutKobo = 500000;
  const verifs = store.verifications.filter((v) => v.userId === scoutId);
  const kycVerified = verifs.some((v) => v.category === 'IDENTITY' && v.status === 'APPROVED');
  const bankVerified = verifs.some((v) => v.category === 'PAYOUT_BANK' && v.status === 'APPROVED');

  return {
    pendingKobo,
    availableKobo,
    onHoldKobo,
    paidKobo,
    reversedKobo,
    minimumPayoutKobo,
    nextPayoutDate: '15 Dec 2026',
    precedingMonthAvailableKobo,
    eligibleForNextPayout: kycVerified && bankVerified && availableKobo >= minimumPayoutKobo,
  };
}

function computeDownstreamGenerations(
  store: InternalStore,
  rootScoutId: string | null
): DownstreamGenerationStat[] {
  const fractions = [
    '1/6',
    '1/10',
    '1/20',
    '1/30',
    '1/40',
    '1/50',
    '1/60',
    '1/70',
    '1/80',
    '1/90',
    '1/100',
    '1/110',
    '1/120',
  ];

  if (!rootScoutId) {
    return fractions.map((f, idx) => ({
      generation: idx + 1,
      scoutCount: 0,
      eligibleCount: 0,
      sampleHandles: [],
      scheduleFractionAtFullDepth: f,
    }));
  }

  const byGen: Record<number, ScoutProfileRecord[]> = {};
  let frontier: string[] = [rootScoutId];
  const visited = new Set<string>([rootScoutId]);

  for (let gen = 1; gen <= 13; gen++) {
    const nextFrontier: string[] = [];
    const members: ScoutProfileRecord[] = [];
    for (const parentId of frontier) {
      for (const anc of Object.values(store.ancestry)) {
        if (anc.directReferrerId === parentId && !visited.has(anc.scoutUserId)) {
          visited.add(anc.scoutUserId);
          const sc = store.scouts[anc.scoutUserId];
          if (sc) {
            members.push(sc);
            nextFrontier.push(anc.scoutUserId);
          }
        }
      }
    }
    byGen[gen] = members;
    frontier = nextFrontier;
  }

  // Only populate realistic sample aggregate depth for the seeded network anchor
  const isSeededAmara = rootScoutId === '20000000-0000-4000-8000-000000000001';
  const baselineCounts = isSeededAmara
    ? [3, 4, 6, 9, 12, 14, 11, 8, 5, 4, 3, 2, 1]
    : Array(13).fill(0);

  return Array.from({ length: 13 }, (_, idx) => {
    const gen = idx + 1;
    const realMembers = byGen[gen] ?? [];
    const count = Math.max(realMembers.length, baselineCounts[idx]);
    const eligibleCount =
      realMembers.length > 0
        ? realMembers.filter(
            (m) =>
              m.eligibleForCommission &&
              store.users[m.userId]?.accountStatus === 'ACTIVE'
          ).length + Math.max(0, count - realMembers.length)
        : count;

    return {
      generation: gen,
      scoutCount: count,
      eligibleCount,
      sampleHandles: realMembers.map((m) => `@${m.username}`),
      scheduleFractionAtFullDepth: fractions[idx],
    };
  });
}

function getSellerPublicFlags(
  store: InternalStore,
  sellerProfileId: string
): { hasActiveSellerBadge: boolean; isSellerVerified: boolean } {
  const seller = store.sellers[sellerProfileId];
  if (!seller) return { hasActiveSellerBadge: false, isSellerVerified: false };
  const sellerVerif = store.verifications.find(
    (v) => v.sellerProfileId === seller.id && v.category === 'SELLER'
  );
  return {
    hasActiveSellerBadge: seller.sellerStatus === 'ACTIVE',
    isSellerVerified: sellerVerif?.status === 'APPROVED',
  };
}

export function getPublicDirectoryForViewer(viewerUserId: string | null): PublicScoutProfileDTO[] {
  const store = getStore();
  return Object.values(store.scouts)
    .filter((s) => {
      if (s.userId === viewerUserId) return false;
      const u = store.users[s.userId];
      if (!u || u.accountStatus === 'CLOSED' || u.accountStatus === 'SUSPENDED') return false;
      if (viewerUserId && isBlockedBetween(store, viewerUserId, s.userId)) return false;
      return true;
    })
    .map((s) => {
      const seller = Object.values(store.sellers).find((sp) => sp.ownerUserId === s.userId);
      const sellerVerif = seller
        ? store.verifications.find(
            (v) => v.sellerProfileId === seller.id && v.category === 'SELLER'
          )
        : undefined;
      const workingWithCount = store.scoutsList.filter(
        (c) => c.ownerUserId === s.userId || c.scoutId === s.userId
      ).length;
      const totalSoldUnits = store.orders
        .filter((o) => o.sellerScoutId === s.userId && o.fulfilmentStatus !== 'Refunded')
        .reduce((sum, o) => sum + o.quantity, 0);

      return toPublicScoutProfileDTO({
        userId: s.userId,
        username: s.username,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        bio: s.bio,
        locationState: s.locationState,
        sellerStatus: seller?.sellerStatus ?? null,
        sellerVerificationStatus: sellerVerif?.status ?? null,
        workingWithCount,
        totalSoldUnits,
      });
    });
}

export function getNairaScoutSnapshot(
  viewerUserId: string | null,
  referralEventQuery?: string | null
): NairaScoutSnapshot {
  const store = getStore();
  const authCtx = buildUserAuthContextFromStore(viewerUserId);
  const viewerUser = viewerUserId ? store.users[viewerUserId] : null;
  const viewerScout = viewerUserId ? store.scouts[viewerUserId] : null;

  const publishedProducts = store.products
    .filter((p) => p.status === 'PUBLISHED')
    .map((p) => {
      const flags = getSellerPublicFlags(store, p.sellerProfileId);
      return { ...p, ...flags };
    });

  if (!viewerUser || !viewerScout || !authCtx) {
    // Public guest view: still resolve any requested referralEvent for ?refEvent=... guest checkout
    const publicRefEvent = referralEventQuery
      ? store.referralEvents.filter((r) => r.id === referralEventQuery)
      : [];

    return {
      authenticated: false,
      adminBootstrapAvailable: !store.adminClaimed,
      activeScout: null,
      products: publishedProducts,
      sellerListings: [],
      scoutsList: [],
      invitations: [],
      blockedUsers: [],
      referralsInbox: publicRefEvent,
      sentReferrals: [],
      orders: [],
      ledgerEntries: [],
      wallet: computeWalletSummary(store, null),
      upstreamAncestry: [],
      downstreamGenerations: computeDownstreamGenerations(store, null),
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
      allScoutsDirectory: getPublicDirectoryForViewer(null),
    };
  }

  const verifications = store.verifications.filter((v) => v.userId === viewerUser.id);
  const sellerProfile = authCtx.seller
    ? store.sellers[authCtx.seller.sellerProfileId] ?? null
    : null;
  const sellerListings = sellerProfile
    ? store.products
        .filter((p) => p.sellerProfileId === sellerProfile.id)
        .map((p) => ({ ...p, ...getSellerPublicFlags(store, p.sellerProfileId) }))
    : [];

  const teamMembers = sellerProfile
    ? store.teamMembers
        .filter((m) => m.sellerProfileId === sellerProfile.id && m.status !== 'REVOKED')
        .map((m) => ({
          ...m,
          username: store.scouts[m.userId]?.username || 'member',
          displayName: store.scouts[m.userId]?.displayName || 'Team Member',
          email: store.users[m.userId]?.email || '',
        }))
    : [];

  const kycVerified = verifications.some(
    (v) => v.category === 'IDENTITY' && v.status === 'APPROVED'
  );
  const bankVerified = verifications.some(
    (v) => v.category === 'PAYOUT_BANK' && v.status === 'APPROVED'
  );

  const activeScout: ActiveScoutDTO = {
    id: viewerUser.id,
    email: viewerUser.email,
    handle: viewerScout.username,
    displayName: viewerScout.displayName,
    bio: viewerScout.bio,
    city: viewerScout.locationState,
    preferredCategories: viewerScout.preferredCategories,
    accountStatus: viewerUser.accountStatus,
    restrictionReason: viewerUser.restrictionReason,
    invitePolicy: viewerScout.invitationPolicy,
    muteReferrals: viewerScout.muteReferrals,
    profileVisibility: viewerScout.profileVisibility,
    kycVerified,
    bankVerified,
    bankSummary: viewerScout.bankSummary,
    isSeller: Boolean(sellerProfile),
    sellerProfile,
    sellerVerificationStatus: authCtx.seller?.sellerVerificationStatus ?? 'NOT_SUBMITTED',
    verifications,
    teamMembers,
    adminRole: authCtx.adminRole ?? null,
    sellerPlan: sellerProfile ? planEnumToId(sellerProfile.subscriptionPlan) : 'starter',
  };

  const myContacts = store.scoutsList
    .filter((c) => c.ownerUserId === viewerUser.id)
    .map((c) => {
      const seller = Object.values(store.sellers).find((sp) => sp.ownerUserId === c.scoutId);
      const flags = seller
        ? getSellerPublicFlags(store, seller.id)
        : { hasActiveSellerBadge: false, isSellerVerified: false };
      return {
        ...c,
        blocked: isBlockedBetween(store, viewerUser.id, c.scoutId),
        ...flags,
      };
    });

  const myInvitations = store.invitations
    .filter((i) => i.senderId === viewerUser.id || i.recipientId === viewerUser.id)
    .map((i) => {
      const isIncoming = i.recipientId === viewerUser.id;
      const otherId = isIncoming ? i.senderId : i.recipientId;
      const otherScout = store.scouts[otherId];
      return {
        ...i,
        direction: (isIncoming ? 'incoming' : 'outgoing') as 'incoming' | 'outgoing',
        otherScoutId: otherId,
        otherHandle: otherScout?.username || i.otherHandle,
        otherDisplayName: otherScout?.displayName || i.otherDisplayName,
        otherCity: otherScout?.locationState || i.otherCity,
      };
    });

  const blockedUsers = store.userBlocks
    .filter((b) => b.blockerId === viewerUser.id)
    .map((b) => ({
      userId: b.blockedId,
      username: store.scouts[b.blockedId]?.username || 'user',
      displayName: store.scouts[b.blockedId]?.displayName || 'Blocked Scout',
      createdAt: b.createdAt,
    }));

  const referralsInbox = store.referralEvents.filter(
    (e) =>
      (e.recipientScoutId === viewerUser.id || e.id === referralEventQuery) &&
      !isBlockedBetween(store, viewerUser.id, e.senderScoutId)
  );
  const sentReferrals = store.referralEvents.filter(
    (e) => e.senderScoutId === viewerUser.id
  );

  const scoutLedgerEntries = store.ledger.filter(
    (entry) => entry.beneficiaryScoutId === viewerUser.id
  );

  const visibleOrders = store.orders.filter(
    (o) =>
      o.buyerScoutId === viewerUser.id ||
      o.sellerScoutId === viewerUser.id ||
      o.commissionSnapshot.allocations.some((a) => a.scoutId === viewerUser.id)
  );

  const sellerOrders = store.orders.filter(
    (o) => o.sellerScoutId === viewerUser.id && o.fulfilmentStatus !== 'Refunded'
  );
  const eligibleMerchandiseKobo = sellerOrders.reduce(
    (sum, o) => sum + o.eligibleMerchandiseKobo,
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

  return {
    authenticated: true,
    adminBootstrapAvailable: !store.adminClaimed,
    activeScout,
    products: publishedProducts,
    sellerListings,
    scoutsList: myContacts,
    invitations: myInvitations,
    blockedUsers,
    referralsInbox,
    sentReferrals,
    orders: visibleOrders,
    ledgerEntries: scoutLedgerEntries,
    wallet: computeWalletSummary(store, viewerUser.id),
    upstreamAncestry: buildAncestryForScout(viewerUser.id, store),
    downstreamGenerations: computeDownstreamGenerations(store, viewerUser.id),
    sellerStats: {
      activeListingsCount: sellerListings.filter((l) => l.status === 'PUBLISHED').length,
      draftListingsCount: sellerListings.filter((l) => l.status === 'DRAFT').length,
      monthlyPublicationsUsed: sellerProfile
        ? store.monthlyPublicationsBySeller[sellerProfile.id] ?? 0
        : 0,
      directOrdersCount: sellerOrders.filter((o) => o.attributionType === 'direct').length,
      referralOrdersCount: sellerOrders.filter((o) => o.attributionType === 'referral_card').length,
      eligibleMerchandiseKobo,
      marketplaceCommissionKobo,
      referralPoolGeneratedKobo,
      netSellerProceedsKobo: eligibleMerchandiseKobo - marketplaceCommissionKobo,
    },
    notifications: store.notifications.filter((n) => n.userId === viewerUser.id),
    supportCases: store.supportCases.filter((c) => c.userId === viewerUser.id),
    allScoutsDirectory: getPublicDirectoryForViewer(viewerUser.id),
  };
}

// ============================================================================
// SERVER-ENFORCED TRANSACTIONAL ACTIONS
// ============================================================================

export function createOrderFromCheckout(
  actorUserId: string,
  input: {
    productListingId: string;
    quantity: number;
    referralEventId: string | null;
  }
): MarketplaceOrder {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  const product = store.products.find(
    (p) => p.id === input.productListingId && p.status === 'PUBLISHED'
  );
  if (!product) {
    throw new AuthorizationError('Published product listing not found.', 404, 'LISTING_NOT_FOUND');
  }

  const qty = Math.max(1, Math.min(product.stock, Math.floor(input.quantity || 1)));
  if (product.stock < qty) {
    throw new AuthorizationError('Insufficient product inventory.', 400, 'OUT_OF_STOCK');
  }

  let validReferralEventId: string | null = null;
  if (input.referralEventId) {
    const refEvent = store.referralEvents.find((r) => r.id === input.referralEventId);
    if (!refEvent || refEvent.productListingId !== product.id || refEvent.status === 'expired') {
      throw new AuthorizationError(
        'Referral card is invalid or expired for this product.',
        400,
        'INVALID_REFERRAL_CARD'
      );
    }
    validReferralEventId = refEvent.id;
    refEvent.status = 'converted';
  }

  product.stock -= qty;
  const orderNumber = 9220 + store.orders.length;
  const now = new Date();
  const deadline = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  const order = createOrderRecordAndLedger(store, {
    orderId: `ORD-${orderNumber}`,
    buyerScoutId: actorUserId,
    productListingId: product.id,
    quantity: qty,
    referralEventId: validReferralEventId,
    fulfilmentStatus: 'Paid',
    createdAt: now.toISOString(),
    fulfilmentDeadline: deadline.toISOString(),
  });

  store.notifications.unshift({
    id: `NTF-${Date.now()}`,
    userId: actorUserId,
    category: 'order',
    title: `Order ${order.id} confirmed (${order.attributionType === 'referral_card' ? 'Referral-Attributed' : 'Direct'})`,
    body:
      order.attributionType === 'referral_card'
        ? `Referral event ${validReferralEventId} preserved. Pending commissions calculated across Seller ancestry (${order.commissionSnapshot.actualAncestryDepth} generations).`
        : 'Direct marketplace checkout completed. No referral commission generated.',
    createdAt: now.toISOString(),
    read: false,
  });

  return order;
}

export function advanceOrderStatus(
  actorUserId: string,
  input: { orderId: string; nextStatus: OrderFulfilmentStatus }
): MarketplaceOrder {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  const order = store.orders.find((o) => o.id === input.orderId);
  if (!order) {
    throw new AuthorizationError('Order not found.', 404, 'ORDER_NOT_FOUND');
  }

  const isOrderSeller =
    order.sellerScoutId === actorUserId ||
    (ctx.seller &&
      store.sellers[ctx.seller.sellerProfileId]?.ownerUserId === order.sellerScoutId &&
      ctx.seller.permissions.canManageOrders);
  const isOrderBuyer = order.buyerScoutId === actorUserId;

  if (!isOrderSeller && !isOrderBuyer && !ctx.adminRole) {
    throw new AuthorizationError('You are not authorized to update this order.', 403, 'FORBIDDEN');
  }

  if (order.fulfilmentStatus === 'Refunded') {
    throw new AuthorizationError('Refunded orders are terminal.', 400, 'ORDER_TERMINAL');
  }

  order.fulfilmentStatus = input.nextStatus;
  const nowIso = new Date().toISOString();

  const orderRootEntries = store.ledger.filter(
    (l) => l.orderId === order.id && !l.linkedToReference
  );

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
    for (const root of orderRootEntries) {
      store.ledger.unshift({
        id: `${root.reference}-${newLedgerStatus}-${Date.now()}`,
        reference: `${root.reference}-${newLedgerStatus.slice(0, 3).toUpperCase()}`,
        orderId: order.id,
        referralEventId: root.referralEventId,
        beneficiaryScoutId: root.beneficiaryScoutId,
        generation: root.generation,
        fractionLabel: root.fractionLabel,
        amountKobo: root.amountKobo,
        status: newLedgerStatus,
        ruleVersion: COMMISSION_RULE_VERSION,
        description: `${reasonLabel} (${root.reference})`,
        createdAt: nowIso,
        linkedToReference: root.reference,
      });
    }
  }

  return order;
}

export function createReferralEventForActor(
  actorUserId: string,
  input: {
    productListingId: string;
    recipientScoutId: string;
    note: string;
  }
): ProductReferralEvent {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertCanParticipateAsScout(ctx);

  const sender = store.scouts[actorUserId];
  const recipientUser = store.users[input.recipientScoutId];
  const recipient = store.scouts[input.recipientScoutId];
  const product = store.products.find(
    (p) => p.id === input.productListingId && p.status === 'PUBLISHED'
  );

  if (!product) {
    throw new AuthorizationError('Published product listing not found.', 404, 'LISTING_NOT_FOUND');
  }
  if (!recipient || !recipientUser || recipientUser.accountStatus === 'CLOSED') {
    throw new AuthorizationError('Recipient Scout not found.', 404, 'RECIPIENT_NOT_FOUND');
  }
  if (recipient.userId === sender.userId) {
    throw new AuthorizationError('Self-referrals are prohibited.', 400, 'SELF_REFERRAL');
  }
  if (isBlockedBetween(store, sender.userId, recipient.userId)) {
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

  const ancestryMap: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(store.ancestry)) {
    ancestryMap[k] = v.directReferrerId;
  }
  const ancestryCheck = validateAncestryRelationship(
    recipient.userId,
    sender.userId,
    ancestryMap
  );
  const existingReverse = store.referralEvents.find(
    (e) =>
      e.productListingId === product.id &&
      e.senderScoutId === recipient.userId &&
      e.recipientScoutId === sender.userId &&
      e.status === 'active'
  );
  if (existingReverse && !ancestryCheck.valid) {
    throw new AuthorizationError('Circular product referral path rejected.', 400, 'CIRCULAR_PATH');
  }

  const pathSignature = `${sender.username}->${recipient.username}`;
  const duplicate = store.referralEvents.find(
    (e) =>
      e.productListingId === product.id &&
      e.ancestryPathSignature === pathSignature &&
      e.status === 'active'
  );
  if (duplicate) {
    throw new AuthorizationError(
      `Active referral ${duplicate.id} already exists for @${recipient.username} on this listing.`,
      409,
      'DUPLICATE_REFERRAL'
    );
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const event: ProductReferralEvent = {
    id: `RE-${Math.floor(8500 + Math.random() * 1400)}-NG`,
    productListingId: product.id,
    senderScoutId: sender.userId,
    senderHandle: sender.username,
    senderDisplayName: sender.displayName,
    recipientScoutId: recipient.userId,
    recipientHandle: recipient.username,
    recipientDisplayName: recipient.displayName,
    note: input.note.trim() || `Recommended ${product.title} on NairaScout.`,
    ancestryPathSignature: pathSignature,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    status: 'active',
  };

  store.referralEvents.unshift(event);
  product.referralShares += 1;

  return event;
}

export function inviteToScoutsListForActor(
  actorUserId: string,
  targetScoutId: string
): ScoutsListInvitation {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertCanParticipateAsScout(ctx);

  const targetUser = store.users[targetScoutId];
  const target = store.scouts[targetScoutId];
  if (!target || !targetUser || targetUser.accountStatus === 'CLOSED') {
    throw new AuthorizationError('Scout not found.', 404, 'SCOUT_NOT_FOUND');
  }
  if (target.userId === actorUserId) {
    throw new AuthorizationError('You cannot invite yourself to your Scouts List.', 400, 'SELF_INVITE');
  }
  if (isBlockedBetween(store, actorUserId, target.userId)) {
    throw new AuthorizationError('Invitation blocked due to user block settings.', 403, 'USER_BLOCKED');
  }
  if (target.invitationPolicy === 'NOBODY') {
    throw new AuthorizationError(
      `@${target.username} does not accept Scouts List invitations.`,
      403,
      'INVITATIONS_DISABLED'
    );
  }
  if (target.invitationPolicy === 'CONTACTS_ONLY') {
    // Check if actor shares a mutual contact with target
    const actorContacts = new Set(
      store.scoutsList.filter((c) => c.ownerUserId === actorUserId).map((c) => c.scoutId)
    );
    const targetContacts = store.scoutsList
      .filter((c) => c.ownerUserId === target.userId)
      .map((c) => c.scoutId);
    const sharesContact = targetContacts.some((id) => actorContacts.has(id));
    if (!sharesContact) {
      throw new AuthorizationError(
        `@${target.username} only accepts invitations from contacts-of-contacts.`,
        403,
        'CONTACTS_ONLY_POLICY'
      );
    }
  }

  if (
    store.scoutsList.some((c) => c.ownerUserId === actorUserId && c.scoutId === target.userId)
  ) {
    throw new AuthorizationError(
      `@${target.username} is already in your Scouts List.`,
      409,
      'ALREADY_CONTACT'
    );
  }

  if (
    store.invitations.some(
      (i) =>
        ((i.senderId === actorUserId && i.recipientId === target.userId) ||
          (i.senderId === target.userId && i.recipientId === actorUserId)) &&
        i.status === 'pending'
    )
  ) {
    throw new AuthorizationError(
      `A pending invitation already exists with @${target.username}.`,
      409,
      'INVITE_PENDING'
    );
  }

  const now = new Date();
  const expires = new Date(now.getTime() + getExpiryDays() * 24 * 60 * 60 * 1000);
  const invitation: ScoutsListInvitation = {
    id: `INV-${Math.floor(500 + Math.random() * 499)}-${Date.now().toString().slice(-3)}`,
    senderId: actorUserId,
    recipientId: target.userId,
    direction: 'outgoing',
    otherScoutId: target.userId,
    otherHandle: target.username,
    otherDisplayName: target.displayName,
    otherCity: target.locationState,
    status: 'pending',
    createdAt: now.toISOString().slice(0, 10),
    expiresAt: expires.toISOString().slice(0, 10),
  };

  store.invitations.unshift(invitation);
  return invitation;
}

export function respondToInvitationForActor(
  actorUserId: string,
  input: { invitationId: string; decision: 'accept' | 'reject' | 'withdraw' }
) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertCanParticipateAsScout(ctx);

  const inv = store.invitations.find((i) => i.id === input.invitationId);
  if (!inv || inv.status !== 'pending') {
    throw new AuthorizationError('Pending invitation not found.', 404, 'INVITE_NOT_FOUND');
  }

  if (input.decision === 'withdraw') {
    if (inv.senderId !== actorUserId) {
      throw new AuthorizationError('Only the sender can withdraw an invitation.', 403, 'FORBIDDEN');
    }
    inv.status = 'withdrawn';
    return;
  }

  if (inv.recipientId !== actorUserId) {
    throw new AuthorizationError('Only the recipient can accept or decline.', 403, 'FORBIDDEN');
  }

  if (input.decision === 'accept') {
    inv.status = 'accepted';
    const sender = store.scouts[inv.senderId];
    const recipient = store.scouts[inv.recipientId];
    const today = new Date().toISOString().slice(0, 10);

    // Bidirectional contact creation
    if (
      !store.scoutsList.some((c) => c.ownerUserId === inv.recipientId && c.scoutId === inv.senderId)
    ) {
      store.scoutsList.unshift({
        contactId: `CNT-${Date.now()}-A`,
        ownerUserId: inv.recipientId,
        scoutId: inv.senderId,
        handle: sender?.username || inv.otherHandle,
        displayName: sender?.displayName || inv.otherDisplayName,
        city: sender?.locationState || inv.otherCity,
        addedAt: today,
        blocked: false,
        hasActiveSellerBadge: false,
        isSellerVerified: false,
      });
    }
    if (
      !store.scoutsList.some((c) => c.ownerUserId === inv.senderId && c.scoutId === inv.recipientId)
    ) {
      store.scoutsList.unshift({
        contactId: `CNT-${Date.now()}-B`,
        ownerUserId: inv.senderId,
        scoutId: inv.recipientId,
        handle: recipient?.username || 'scout',
        displayName: recipient?.displayName || 'Scout',
        city: recipient?.locationState || 'Lagos',
        addedAt: today,
        blocked: false,
        hasActiveSellerBadge: false,
        isSellerVerified: false,
      });
    }
  } else {
    inv.status = 'rejected';
  }
}

export function manageRelationshipForActor(
  actorUserId: string,
  input: {
    targetUserId?: string;
    contactId?: string;
    operation: 'remove' | 'block' | 'unblock';
  }
) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  let targetId = input.targetUserId;
  if (!targetId && input.contactId) {
    const contact = store.scoutsList.find(
      (c) => c.contactId === input.contactId && c.ownerUserId === actorUserId
    );
    targetId = contact?.scoutId;
  }

  if (!targetId) {
    throw new AuthorizationError('Target user not found.', 404, 'TARGET_NOT_FOUND');
  }

  if (input.operation === 'remove') {
    store.scoutsList = store.scoutsList.filter(
      (c) =>
        !(
          (c.ownerUserId === actorUserId && c.scoutId === targetId) ||
          (c.ownerUserId === targetId && c.scoutId === actorUserId)
        )
    );
    return;
  }

  if (input.operation === 'block') {
    if (!store.userBlocks.some((b) => b.blockerId === actorUserId && b.blockedId === targetId)) {
      store.userBlocks.push({
        blockerId: actorUserId,
        blockedId: targetId,
        createdAt: new Date().toISOString(),
      });
    }
    // Remove from active contacts as well
    store.scoutsList = store.scoutsList.filter(
      (c) =>
        !(
          (c.ownerUserId === actorUserId && c.scoutId === targetId) ||
          (c.ownerUserId === targetId && c.scoutId === actorUserId)
        )
    );
    return;
  }

  if (input.operation === 'unblock') {
    store.userBlocks = store.userBlocks.filter(
      (b) => !(b.blockerId === actorUserId && b.blockedId === targetId)
    );
  }
}

export function reportAbuseForActor(
  actorUserId: string,
  input: {
    reportedUserId: string;
    referralEventId?: string | null;
    reason: string;
    description: string;
  }
): AbuseReportRecord {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  const report: AbuseReportRecord = {
    id: `ABR-${Math.floor(200 + Math.random() * 800)}`,
    reporterId: actorUserId,
    reporterHandle: store.scouts[actorUserId]?.username || 'scout',
    reportedUserId: input.reportedUserId,
    reportedHandle: store.scouts[input.reportedUserId]?.username || 'user',
    referralEventId: input.referralEventId ?? null,
    reason: input.reason.trim() || 'Abuse report',
    description: input.description.trim(),
    status: 'OPEN',
    resolvedBy: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  store.abuseReports.unshift(report);
  return report;
}

// ============================================================================
// SELLER ONBOARDING, DRAFTS, VERIFICATION GATE & TEAM MANAGEMENT
// ============================================================================

export function activateSellerOnboarding(
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
): SellerProfileRecord {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  if (!input.termsAccepted) {
    throw new AuthorizationError('You must accept the Seller Terms to proceed.', 400, 'TERMS_REQUIRED');
  }
  if (ctx.seller) {
    throw new AuthorizationError('Seller capabilities are already activated on this account.', 409, 'SELLER_EXISTS');
  }

  const nowIso = new Date().toISOString();
  const sellerId = crypto.randomUUID();
  const seller: SellerProfileRecord = {
    id: sellerId,
    ownerUserId: actorUserId,
    sellerType: input.sellerType,
    sellerName: input.sellerName.trim(),
    description: input.description.trim() || null,
    businessCategory: input.businessCategory,
    businessRegNumber: input.sellerType === 'BUSINESS' ? input.businessRegNumber?.trim() || null : null,
    businessAddress: input.businessAddress?.trim() || null,
    businessContactEmail: input.businessContactEmail?.trim() || ctx.email,
    businessContactPhone: input.businessContactPhone?.trim() || null,
    sellerStatus: 'ONBOARDING',
    subscriptionPlan: planIdToEnum(input.planId),
    subscriptionStatus: 'ACTIVE',
    termsAcceptedAt: nowIso,
    createdAt: nowIso,
  };

  store.sellers[sellerId] = seller;
  store.teamMembers.push({
    id: `TM-${Date.now()}`,
    sellerProfileId: sellerId,
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
    invitedBy: null,
    createdAt: nowIso,
    revokedAt: null,
  });

  const cleanPaths =
    input.evidencePaths.length > 0
      ? input.evidencePaths
      : [`verification-docs/${actorUserId}/seller-kyc-${Date.now()}.pdf`];

  store.verifications.unshift({
    id: `VER-SEL-${Date.now()}`,
    userId: actorUserId,
    sellerProfileId: sellerId,
    category: 'SELLER',
    status: 'PENDING',
    evidencePaths: cleanPaths,
    reviewerNotes: null,
    reviewedBy: null,
    submittedAt: nowIso,
    reviewedAt: null,
  });

  store.verifications.unshift({
    id: `VER-ID-${Date.now() + 1}`,
    userId: actorUserId,
    sellerProfileId: null,
    category: 'IDENTITY',
    status: 'PENDING',
    evidencePaths: cleanPaths,
    reviewerNotes: null,
    reviewedBy: null,
    submittedAt: nowIso,
    reviewedAt: null,
  });

  if (input.sellerType === 'BUSINESS') {
    store.verifications.unshift({
      id: `VER-BIZ-${Date.now() + 2}`,
      userId: actorUserId,
      sellerProfileId: sellerId,
      category: 'BUSINESS',
      status: 'PENDING',
      evidencePaths: cleanPaths,
      reviewerNotes: null,
      reviewedBy: null,
      submittedAt: nowIso,
      reviewedAt: null,
    });
  }

  recordAuditLog(store, {
    actorId: actorUserId,
    affectedUserId: actorUserId,
    action: 'SELLER_ONBOARDING_SUBMITTED',
    entityType: 'seller_profiles',
    entityId: sellerId,
    newValue: {
      sellerType: seller.sellerType,
      sellerStatus: 'ONBOARDING',
      subscriptionPlan: seller.subscriptionPlan,
    },
  });

  return seller;
}

export function createSellerDraftListing(
  actorUserId: string,
  input: {
    title: string;
    category: string;
    priceNaira: number;
    deliveryFeeNaira: number;
    stock: number;
    description: string;
  }
): ProductListing {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertCanManageSellerDrafts(ctx);

  const seller = store.sellers[ctx!.seller!.sellerProfileId]!;
  const planSpec = SELLER_PLANS[planEnumToId(seller.subscriptionPlan)];
  const idNum = 107 + store.products.length;
  const seed = `nairascout-item-${idNum}`;
  const flags = getSellerPublicFlags(store, seller.id);

  const listing: ProductListing = {
    id: `LST-${idNum}`,
    productId: `PRD-${idNum}`,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priceKobo: Math.round(Math.max(500, input.priceNaira) * 100),
    deliveryFeeKobo: Math.round(Math.max(0, input.deliveryFeeNaira) * 100),
    stock: Math.max(1, Math.round(input.stock)),
    sellerScoutId: seller.ownerUserId,
    sellerProfileId: seller.id,
    sellerName: seller.sellerName,
    sellerCity: store.scouts[seller.ownerUserId]?.locationState || 'Lagos',
    hasActiveSellerBadge: flags.hasActiveSellerBadge,
    isSellerVerified: flags.isSellerVerified,
    status: 'DRAFT',
    imageSeed: seed,
    imageUrl: `https://picsum.photos/seed/${seed}/800/600`,
    daysRemaining: planSpec.listingDurationDays,
    specifications: ['Seller draft listing', '10-day publication duration once published'],
    returnPolicy: 'Standard 7-day NairaScout return terms',
    warranty: 'Seller fulfilment guarantee',
    impressions: 0,
    referralShares: 0,
  };

  store.products.unshift(listing);
  return listing;
}

export function publishSellerListingById(
  actorUserId: string,
  listingId: string
): ProductListing {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  const sellerProfileId = ctx?.seller?.sellerProfileId;

  const listing = store.products.find((p) => p.id === listingId);
  if (!listing) {
    throw new AuthorizationError('Listing not found.', 404, 'LISTING_NOT_FOUND');
  }
  if (sellerProfileId && listing.sellerProfileId !== sellerProfileId) {
    throw new AuthorizationError('You do not own this listing.', 403, 'FORBIDDEN');
  }

  const sellerListings = store.products.filter((p) => p.sellerProfileId === listing.sellerProfileId);
  const activePublished = sellerListings.filter((p) => p.status === 'PUBLISHED');
  const distinctCats = new Set(activePublished.map((p) => p.category));
  const pubsUsed = store.monthlyPublicationsBySeller[listing.sellerProfileId] ?? 0;

  assertCanPublishListing(ctx, {
    currentActiveListings: activePublished.length,
    publicationsThisMonth: pubsUsed,
    distinctCategoriesUsed: distinctCats.size,
    isNewCategory: !distinctCats.has(listing.category),
  });

  if (listing.status === 'PUBLISHED') {
    return listing;
  }

  listing.status = 'PUBLISHED';
  const flags = getSellerPublicFlags(store, listing.sellerProfileId);
  listing.hasActiveSellerBadge = flags.hasActiveSellerBadge;
  listing.isSellerVerified = flags.isSellerVerified;

  store.monthlyPublicationsBySeller[listing.sellerProfileId] = pubsUsed + 1;

  return listing;
}

export function upgradeSellerPlanForActor(actorUserId: string, planId: SellerPlanId) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);
  if (!ctx.seller) {
    throw new AuthorizationError('Activate Seller capabilities first.', 403, 'NOT_A_SELLER');
  }
  if (!ctx.seller.permissions.canManageBilling && ctx.seller.role !== 'BUSINESS_OWNER') {
    throw new AuthorizationError('Billing permission required.', 403, 'FORBIDDEN');
  }

  const seller = store.sellers[ctx.seller.sellerProfileId]!;
  const prevPlan = seller.subscriptionPlan;
  seller.subscriptionPlan = planIdToEnum(planId);
  seller.subscriptionStatus = 'ACTIVE';

  recordAuditLog(store, {
    actorId: actorUserId,
    affectedUserId: seller.ownerUserId,
    action: 'SELLER_SUBSCRIPTION_UPDATED',
    entityType: 'seller_profiles',
    entityId: seller.id,
    previousValue: { subscriptionPlan: prevPlan },
    newValue: { subscriptionPlan: seller.subscriptionPlan },
  });
}

export function manageSellerTeamForActor(
  actorUserId: string,
  input:
    | { operation: 'invite'; memberEmail: string; role: 'BUSINESS_ADMIN' | 'TEAM_MEMBER'; permissions: SellerTeamPermissions }
    | { operation: 'revoke'; memberId: string }
) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertCanManageSellerTeam(ctx);

  const sellerId = ctx!.seller!.sellerProfileId;

  if (input.operation === 'revoke') {
    const target = store.teamMembers.find(
      (m) => m.id === input.memberId && m.sellerProfileId === sellerId
    );
    if (!target) {
      throw new AuthorizationError('Team member not found.', 404, 'MEMBER_NOT_FOUND');
    }
    if (target.role === 'BUSINESS_OWNER') {
      throw new AuthorizationError('Cannot revoke the Business Owner.', 400, 'OWNER_IMMUTABLE');
    }
    target.status = 'REVOKED';
    target.revokedAt = new Date().toISOString();
    return;
  }

  const memberUser = findUserByEmail(store, input.memberEmail);
  if (!memberUser) {
    throw new AuthorizationError(
      'Invited user must have a registered NairaScout account first.',
      404,
      'USER_NOT_FOUND'
    );
  }
  if (
    store.teamMembers.some(
      (m) =>
        m.sellerProfileId === sellerId &&
        m.userId === memberUser.id &&
        m.status === 'ACTIVE'
    )
  ) {
    throw new AuthorizationError('User is already an active team member.', 409, 'ALREADY_MEMBER');
  }

  store.teamMembers.push({
    id: `TM-${Date.now()}`,
    sellerProfileId: sellerId,
    userId: memberUser.id,
    role: input.role,
    permissions: input.permissions,
    status: 'ACTIVE',
    invitedBy: actorUserId,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  });
}

// ============================================================================
// SETTINGS, PRIVACY, VERIFICATION SUBMISSIONS & VOLUNTARY CLOSURE
// ============================================================================

export function updateProfileAndPrivacy(
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
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  const scout = store.scouts[actorUserId];
  if (!scout) throw new AuthorizationError('Scout profile not found.', 404, 'NOT_FOUND');

  if (input.username && input.username.trim().toLowerCase() !== scout.username.toLowerCase()) {
    const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const taken = Object.values(store.scouts).some(
      (s) => s.userId !== actorUserId && s.username.toLowerCase() === cleanUsername
    );
    if (taken) {
      throw new AuthorizationError('Username is already taken.', 409, 'USERNAME_TAKEN');
    }
    scout.username = cleanUsername;
  }

  if (input.displayName !== undefined) scout.displayName = input.displayName.trim() || scout.displayName;
  if (input.bio !== undefined) scout.bio = input.bio.trim() || null;
  if (input.locationState !== undefined) scout.locationState = input.locationState.trim() || scout.locationState;
  if (input.preferredCategories !== undefined) scout.preferredCategories = input.preferredCategories;
  if (input.invitationPolicy !== undefined) scout.invitationPolicy = input.invitationPolicy;
  if (input.muteReferrals !== undefined) scout.muteReferrals = input.muteReferrals;
  if (input.profileVisibility !== undefined) scout.profileVisibility = input.profileVisibility;
}

export function submitVerificationEvidence(
  actorUserId: string,
  input: {
    category: VerificationCategory;
    evidencePaths: string[];
    bankSummary?: string;
  }
): VerificationRecord {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  const nowIso = new Date().toISOString();
  const sellerId =
    input.category === 'SELLER' || input.category === 'BUSINESS'
      ? ctx.seller?.sellerProfileId ?? null
      : null;

  if (input.category === 'PAYOUT_BANK' && input.bankSummary?.trim()) {
    store.scouts[actorUserId].bankSummary = input.bankSummary.trim();
  }

  const existing = store.verifications.find(
    (v) => v.userId === actorUserId && v.category === input.category
  );

  if (existing) {
    existing.status = 'PENDING';
    existing.evidencePaths =
      input.evidencePaths.length > 0
        ? input.evidencePaths
        : [`verification-docs/${actorUserId}/${input.category.toLowerCase()}-${Date.now()}.pdf`];
    existing.submittedAt = nowIso;
    existing.reviewerNotes = null;
    return existing;
  }

  const rec: VerificationRecord = {
    id: `VER-${Date.now()}`,
    userId: actorUserId,
    sellerProfileId: sellerId,
    category: input.category,
    status: 'PENDING',
    evidencePaths:
      input.evidencePaths.length > 0
        ? input.evidencePaths
        : [`verification-docs/${actorUserId}/${input.category.toLowerCase()}-${Date.now()}.pdf`],
    reviewerNotes: null,
    reviewedBy: null,
    submittedAt: nowIso,
    reviewedAt: null,
  };
  store.verifications.unshift(rec);
  return rec;
}

export function closeAccountVoluntarily(actorUserId: string, reason?: string) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  const user = store.users[actorUserId]!;
  const prevStatus = user.accountStatus;
  user.accountStatus = 'CLOSED';
  user.closedAt = new Date().toISOString();
  user.restrictionReason = reason?.trim() || 'Voluntary account closure';

  // Preserve referralAncestry, referralEvents, users, and ledger entries intact!
  recordAuditLog(store, {
    actorId: actorUserId,
    affectedUserId: actorUserId,
    action: 'ACCOUNT_CLOSED_VOLUNTARY',
    entityType: 'users',
    entityId: actorUserId,
    previousValue: { accountStatus: prevStatus },
    newValue: { accountStatus: 'CLOSED', historicalRecordsPreserved: true },
    reason: user.restrictionReason,
  });
}

// ============================================================================
// ADMIN GOVERNANCE & AUDIT LOGS
// ============================================================================

export function getAdminConsoleSnapshot(actorUserId: string) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertAdminRole(ctx, [
    'VERIFICATION_OFFICER',
    'TRUST_AND_SAFETY',
    'FINANCE_OPS',
    'SUPPORT_AGENT',
  ]);

  const verificationQueue = store.verifications.map((v) => {
    const scout = store.scouts[v.userId];
    const seller = v.sellerProfileId ? store.sellers[v.sellerProfileId] : null;
    return {
      ...v,
      username: scout?.username || 'unknown',
      displayName: scout?.displayName || 'Unknown User',
      email: store.users[v.userId]?.email || '',
      sellerName: seller?.sellerName || null,
      sellerType: seller?.sellerType || null,
      sellerStatus: seller?.sellerStatus || null,
    };
  });

  const managedUsers = Object.values(store.users).map((u) => {
    const scout = store.scouts[u.id];
    const seller = Object.values(store.sellers).find((s) => s.ownerUserId === u.id) ?? null;
    const ancestryRec = store.ancestry[u.id];
    const ledgerCount = store.ledger.filter((l) => l.beneficiaryScoutId === u.id).length;
    return {
      userId: u.id,
      email: u.email,
      username: scout?.username || '',
      displayName: scout?.displayName || '',
      accountStatus: u.accountStatus,
      restrictionReason: u.restrictionReason,
      closedAt: u.closedAt,
      sellerProfileId: seller?.id || null,
      sellerName: seller?.sellerName || null,
      sellerStatus: seller?.sellerStatus || null,
      subscriptionPlan: seller?.subscriptionPlan || null,
      adminRole: store.adminRoles[u.id] || null,
      hasPermanentAncestry: Boolean(ancestryRec),
      ledgerEntriesCount: ledgerCount,
    };
  });

  return {
    adminRole: ctx!.adminRole ?? null,
    verifications: verificationQueue,
    users: managedUsers,
    abuseReports: store.abuseReports,
    auditLogs: store.auditLogs,
  };
}

export function adminReviewVerification(
  actorUserId: string,
  input: {
    verificationId: string;
    decision: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED';
    reviewerNotes: string;
  }
) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertAdminRole(ctx, ['VERIFICATION_OFFICER']);

  if (!input.reviewerNotes.trim()) {
    throw new AuthorizationError('Mandatory reviewer notes are required.', 400, 'NOTES_REQUIRED');
  }

  const verif = store.verifications.find((v) => v.id === input.verificationId);
  if (!verif) {
    throw new AuthorizationError('Verification record not found.', 404, 'VERIFICATION_NOT_FOUND');
  }

  const prevStatus = verif.status;
  verif.status = input.decision;
  verif.reviewerNotes = input.reviewerNotes.trim();
  verif.reviewedBy = actorUserId;
  verif.reviewedAt = new Date().toISOString();

  // If SELLER verification is APPROVED, activate sellerStatus from ONBOARDING -> ACTIVE
  if (verif.category === 'SELLER' && verif.sellerProfileId) {
    const seller = store.sellers[verif.sellerProfileId];
    if (seller && input.decision === 'APPROVED' && seller.sellerStatus === 'ONBOARDING') {
      seller.sellerStatus = 'ACTIVE';
    }
  }

  recordAuditLog(store, {
    actorId: actorUserId,
    affectedUserId: verif.userId,
    action: `VERIFICATION_${input.decision}`,
    entityType: 'verification_records',
    entityId: verif.id,
    previousValue: { status: prevStatus, category: verif.category },
    newValue: { status: input.decision, category: verif.category },
    reason: verif.reviewerNotes,
  });

  store.notifications.unshift({
    id: `NTF-${Date.now()}`,
    userId: verif.userId,
    category: 'trust',
    title: `${verif.category} verification ${input.decision}`,
    body: verif.reviewerNotes,
    createdAt: new Date().toISOString(),
    read: false,
  });

  return verif;
}

export function adminApplyUserAction(
  actorUserId: string,
  input: {
    targetUserId: string;
    actionType: 'SET_ACCOUNT_STATUS' | 'SET_SELLER_STATUS' | 'HOLD_PENDING_COMMISSIONS' | 'RESOLVE_ABUSE_REPORT';
    accountStatus?: AccountStatus;
    sellerStatus?: SellerStatus;
    abuseReportId?: string;
    abuseResolution?: 'RESOLVED' | 'DISMISSED';
    reason: string;
  }
) {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertAdminRole(ctx, ['TRUST_AND_SAFETY', 'FINANCE_OPS']);

  if (!input.reason.trim()) {
    throw new AuthorizationError('Documented reason is required for admin governance actions.', 400, 'REASON_REQUIRED');
  }

  const targetUser = store.users[input.targetUserId];
  if (!targetUser) {
    throw new AuthorizationError('Target user not found.', 404, 'USER_NOT_FOUND');
  }

  if (input.actionType === 'SET_ACCOUNT_STATUS' && input.accountStatus) {
    const prev = targetUser.accountStatus;
    targetUser.accountStatus = input.accountStatus;
    targetUser.restrictionReason = input.reason.trim();
    recordAuditLog(store, {
      actorId: actorUserId,
      affectedUserId: targetUser.id,
      action: 'ADMIN_ACCOUNT_STATUS_CHANGED',
      entityType: 'users',
      entityId: targetUser.id,
      previousValue: { accountStatus: prev },
      newValue: { accountStatus: input.accountStatus },
      reason: input.reason.trim(),
    });
  }

  if (input.actionType === 'SET_SELLER_STATUS' && input.sellerStatus) {
    const seller = Object.values(store.sellers).find((s) => s.ownerUserId === targetUser.id);
    if (!seller) {
      throw new AuthorizationError('Target user has no Seller profile.', 400, 'NO_SELLER_PROFILE');
    }
    const prev = seller.sellerStatus;
    seller.sellerStatus = input.sellerStatus;
    recordAuditLog(store, {
      actorId: actorUserId,
      affectedUserId: targetUser.id,
      action: 'ADMIN_SELLER_STATUS_CHANGED',
      entityType: 'seller_profiles',
      entityId: seller.id,
      previousValue: { sellerStatus: prev },
      newValue: { sellerStatus: input.sellerStatus },
      reason: input.reason.trim(),
    });
  }

  if (input.actionType === 'HOLD_PENDING_COMMISSIONS') {
    const nowIso = new Date().toISOString();
    const pendingEntries = store.ledger.filter(
      (l) => l.beneficiaryScoutId === targetUser.id && l.status === 'Pending' && !l.linkedToReference
    );
    for (const root of pendingEntries) {
      store.ledger.unshift({
        id: `${root.reference}-HOLD-${Date.now()}`,
        reference: `${root.reference}-HOLD`,
        orderId: root.orderId,
        referralEventId: root.referralEventId,
        beneficiaryScoutId: root.beneficiaryScoutId,
        generation: root.generation,
        fractionLabel: root.fractionLabel,
        amountKobo: root.amountKobo,
        status: 'On Hold',
        ruleVersion: COMMISSION_RULE_VERSION,
        description: `Trust & Safety hold: ${input.reason.trim()} (${root.reference})`,
        createdAt: nowIso,
        linkedToReference: root.reference,
      });
    }
    recordAuditLog(store, {
      actorId: actorUserId,
      affectedUserId: targetUser.id,
      action: 'ADMIN_COMMISSIONS_PLACED_ON_HOLD',
      entityType: 'ledger',
      entityId: null,
      newValue: { heldEntriesCount: pendingEntries.length },
      reason: input.reason.trim(),
    });
  }

  if (input.actionType === 'RESOLVE_ABUSE_REPORT' && input.abuseReportId) {
    const rep = store.abuseReports.find((r) => r.id === input.abuseReportId);
    if (rep) {
      rep.status = input.abuseResolution || 'RESOLVED';
      rep.resolvedBy = actorUserId;
      rep.resolvedAt = new Date().toISOString();
      recordAuditLog(store, {
        actorId: actorUserId,
        affectedUserId: rep.reportedUserId,
        action: `ABUSE_REPORT_${rep.status}`,
        entityType: 'abuse_reports',
        entityId: null,
        newValue: { reportId: rep.id, status: rep.status },
        reason: input.reason.trim(),
      });
    }
  }
}

export function submitSupportCaseForActor(
  actorUserId: string,
  input: {
    topic: SupportCase['topic'];
    subject: string;
    details: string;
  }
): SupportCase {
  const store = getStore();
  const ctx = buildUserAuthContextFromStore(actorUserId);
  assertActiveAccount(ctx);

  const supportCase: SupportCase = {
    id: `SUP-${Math.floor(1000 + Math.random() * 8999)}`,
    userId: actorUserId,
    topic: input.topic,
    subject: input.subject.trim(),
    details: input.details.trim(),
    status: 'Under Review',
    createdAt: new Date().toISOString(),
  };
  store.supportCases.unshift(supportCase);
  return supportCase;
}
