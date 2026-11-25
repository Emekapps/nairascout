// NS-ACC-002: Unified Identity & Decoupled Lifecycle RBAC Definitions
import type { SellerTeamPermissions } from '@/lib/db/schema';
import {
  AccountStatus,
  SellerStatus,
  SubscriptionStatus,
  VerificationStatus,
  normalizeVerificationStatus,
} from './transitions';

export type {
  AccountStatus,
  SellerStatus,
  SubscriptionStatus,
  VerificationStatus,
};

export type SubscriptionPlan = 'STARTER' | 'TRACTION' | 'GROWTH' | 'SPRAWL';

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'VERIFICATION_OFFICER'
  | 'TRUST_AND_SAFETY'
  | 'APPEALS_OFFICER'
  | 'FINANCE_OFFICER'
  | 'SUPPORT_OFFICER'
  | 'OPERATIONS_MANAGER'
  | 'ANALYST_VIEWER';

export const ALL_PLATFORM_ADMIN_ROLES: AdminRole[] = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'VERIFICATION_OFFICER',
  'TRUST_AND_SAFETY',
  'APPEALS_OFFICER',
  'FINANCE_OFFICER',
  'SUPPORT_OFFICER',
  'OPERATIONS_MANAGER',
  'ANALYST_VIEWER',
];

export type SellerTeamRole =
  | 'BUSINESS_OWNER'
  | 'BUSINESS_ADMIN'
  | 'PRODUCT_MANAGER'
  | 'ORDER_MANAGER'
  | 'FINANCE_MANAGER'
  | 'ANALYST_VIEWER';

export const ALL_SELLER_TEAM_ROLES: SellerTeamRole[] = [
  'BUSINESS_OWNER',
  'BUSINESS_ADMIN',
  'PRODUCT_MANAGER',
  'ORDER_MANAGER',
  'FINANCE_MANAGER',
  'ANALYST_VIEWER',
];

export const MAX_SELLER_TEAM_SEATS = 5;
export const MAX_REFERRAL_RECIPIENTS_PER_BATCH = 20;

export const SELLER_TEAM_ROLE_PERMISSIONS: Record<SellerTeamRole, SellerTeamPermissions> = {
  BUSINESS_OWNER: {
    canManageListings: true,
    canManageOrders: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canManageTeam: true,
  },
  BUSINESS_ADMIN: {
    canManageListings: true,
    canManageOrders: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageTeam: true,
  },
  PRODUCT_MANAGER: {
    canManageListings: true,
    canManageOrders: false,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageTeam: false,
  },
  ORDER_MANAGER: {
    canManageListings: false,
    canManageOrders: true,
    canViewAnalytics: false,
    canManageBilling: false,
    canManageTeam: false,
  },
  FINANCE_MANAGER: {
    canManageListings: false,
    canManageOrders: false,
    canViewAnalytics: true,
    canManageBilling: true,
    canManageTeam: false,
  },
  ANALYST_VIEWER: {
    canManageListings: false,
    canManageOrders: false,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageTeam: false,
  },
};

export type CapabilityCode =
  | 'CREATE_REFERRAL'
  | 'PUBLISH_LISTING'
  | 'REQUEST_WITHDRAWAL'
  | 'INITIATE_PURCHASE'
  | 'MANAGE_TEAM';

export type RestrictionScope = 'ACCOUNT' | 'ROLE' | 'CAPABILITY' | 'RESOURCE';

export interface ActiveRestrictionDTO {
  id: string;
  scope: RestrictionScope;
  capabilityCode: CapabilityCode;
  resourceId: string | null;
  reason: string;
  status: 'ACTIVE' | 'LIFTED';
  imposedBy: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface UserAuthContext {
  userId: string;
  email: string;
  accountStatus: AccountStatus;
  activeRestrictions: ActiveRestrictionDTO[];
  seller?: {
    sellerProfileId: string;
    sellerType: 'INDIVIDUAL' | 'BUSINESS';
    sellerStatus: SellerStatus;
    sellerVerificationStatus: VerificationStatus;
    subscriptionPlan: SubscriptionPlan;
    subscriptionStatus: SubscriptionStatus;
    role: SellerTeamRole;
    permissions: SellerTeamPermissions;
  } | null;
  adminRole?: AdminRole | null;
}

export class AuthorizationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 403, code = 'FORBIDDEN') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeAdminRole(raw: string | null | undefined): AdminRole | null {
  if (!raw) return null;
  if (raw === 'FINANCE_OPS') return 'FINANCE_OFFICER';
  if (raw === 'SUPPORT_AGENT') return 'SUPPORT_OFFICER';
  if (ALL_PLATFORM_ADMIN_ROLES.includes(raw as AdminRole)) {
    return raw as AdminRole;
  }
  return null;
}

export function normalizeTeamRole(raw: string | null | undefined): SellerTeamRole {
  if (raw === 'TEAM_MEMBER') return 'PRODUCT_MANAGER';
  if (ALL_SELLER_TEAM_ROLES.includes(raw as SellerTeamRole)) {
    return raw as SellerTeamRole;
  }
  return 'ANALYST_VIEWER';
}

export interface PlanEntitlements {
  monthlyPriceNgn: number;
  maxActiveListings: number;
  monthlyPublications: number;
  maxCategories: number | 'ALL';
  listingDurationDays: number;
  maxImagesPerListing: number;
  maxVideosPerListing: number;
  maxVideoSeconds: number;
  maxVideoSizeMb: number;
  promotionalPlacements: boolean;
  teamAccountsAllowed: boolean;
  maxTeamSeats: number;
  advancedAnalytics: boolean;
}

export const SELLER_PLAN_ENTITLEMENTS: Record<SubscriptionPlan, PlanEntitlements> = {
  STARTER: {
    monthlyPriceNgn: 0,
    maxActiveListings: 1,
    monthlyPublications: 3,
    maxCategories: 1,
    listingDurationDays: 10,
    maxImagesPerListing: 10,
    maxVideosPerListing: 0,
    maxVideoSeconds: 0,
    maxVideoSizeMb: 0,
    promotionalPlacements: false,
    teamAccountsAllowed: false,
    maxTeamSeats: 0,
    advancedAnalytics: false,
  },
  TRACTION: {
    monthlyPriceNgn: 4500,
    maxActiveListings: 3,
    monthlyPublications: 10,
    maxCategories: 3,
    listingDurationDays: 10,
    maxImagesPerListing: 10,
    maxVideosPerListing: 1,
    maxVideoSeconds: 60,
    maxVideoSizeMb: 30,
    promotionalPlacements: true,
    teamAccountsAllowed: false,
    maxTeamSeats: 0,
    advancedAnalytics: false,
  },
  GROWTH: {
    monthlyPriceNgn: 35000,
    maxActiveListings: 5,
    monthlyPublications: 25,
    maxCategories: 10,
    listingDurationDays: 10,
    maxImagesPerListing: 10,
    maxVideosPerListing: 3,
    maxVideoSeconds: 120,
    maxVideoSizeMb: 100,
    promotionalPlacements: true,
    teamAccountsAllowed: false,
    maxTeamSeats: 0,
    advancedAnalytics: true,
  },
  SPRAWL: {
    monthlyPriceNgn: 250000,
    maxActiveListings: 20,
    monthlyPublications: 100,
    maxCategories: 'ALL',
    listingDurationDays: 10,
    maxImagesPerListing: 10,
    maxVideosPerListing: 5,
    maxVideoSeconds: 180,
    maxVideoSizeMb: 1024,
    promotionalPlacements: true,
    teamAccountsAllowed: true,
    maxTeamSeats: MAX_SELLER_TEAM_SEATS,
    advancedAnalytics: true,
  },
};

export function getEffectivePlanEntitlements(
  plan: SubscriptionPlan,
  subscriptionStatus: SubscriptionStatus
): PlanEntitlements {
  if (
    subscriptionStatus === 'ACTIVE' ||
    subscriptionStatus === 'GRACE_PERIOD' ||
    subscriptionStatus === 'CANCELLATION_SCHEDULED'
  ) {
    return SELLER_PLAN_ENTITLEMENTS[plan];
  }
  return SELLER_PLAN_ENTITLEMENTS.STARTER;
}

/**
 * Requires accountStatus in ['ACTIVE', 'RESTRICTED'].
 * Denies PENDING_ACTIVATION, SUSPENDED, CLOSURE_PENDING, CLOSED.
 */
export function assertAccountOperational(
  ctx: UserAuthContext | null
): asserts ctx is UserAuthContext {
  if (!ctx) {
    throw new AuthorizationError('Authentication required.', 401, 'UNAUTHENTICATED');
  }
  if (ctx.accountStatus === 'PENDING_ACTIVATION') {
    throw new AuthorizationError(
      'Complete account activation before performing this action.',
      403,
      'ACCOUNT_PENDING_ACTIVATION'
    );
  }
  if (ctx.accountStatus === 'CLOSURE_PENDING' || ctx.accountStatus === 'CLOSED') {
    throw new AuthorizationError('This account is closed or closing.', 403, 'ACCOUNT_CLOSED');
  }
  if (ctx.accountStatus === 'SUSPENDED') {
    throw new AuthorizationError('This account is currently suspended.', 403, 'ACCOUNT_SUSPENDED');
  }
}

// Backward-compatible export name with explicit assertion signature
export function assertActiveAccount(
  ctx: UserAuthContext | null
): asserts ctx is UserAuthContext {
  assertAccountOperational(ctx);
}

/**
 * Checks granular capability_restrictions for active non-expired locks.
 */
export function assertCapabilityNotRestricted(
  ctx: UserAuthContext | null,
  capabilityCode: CapabilityCode,
  resourceId?: string | null
): void {
  assertAccountOperational(ctx);
  const now = Date.now();
  const lock = ctx.activeRestrictions.find((r) => {
    if (r.status !== 'ACTIVE') return false;
    if (r.expiresAt && new Date(r.expiresAt).getTime() <= now) return false;
    if (r.scope === 'ACCOUNT') return true;
    if (r.scope === 'RESOURCE' && resourceId && r.resourceId === resourceId) {
      return r.capabilityCode === capabilityCode;
    }
    return r.capabilityCode === capabilityCode;
  });

  if (lock) {
    throw new AuthorizationError(
      `Capability ${capabilityCode} is currently restricted: ${lock.reason}`,
      403,
      'CAPABILITY_RESTRICTED'
    );
  }
}

export function assertCanParticipateAsScout(ctx: UserAuthContext | null): void {
  assertAccountOperational(ctx);
  assertCapabilityNotRestricted(ctx, 'CREATE_REFERRAL');
}

export function assertCanManageSellerDrafts(ctx: UserAuthContext | null): void {
  assertAccountOperational(ctx);
  if (!ctx.seller) {
    throw new AuthorizationError('Seller capabilities are not activated.', 403, 'NOT_A_SELLER');
  }
  if (
    ctx.seller.sellerStatus === 'SUSPENDED' ||
    ctx.seller.sellerStatus === 'RESTRICTED' ||
    ctx.seller.sellerStatus === 'CLOSURE_PENDING' ||
    ctx.seller.sellerStatus === 'CLOSED'
  ) {
    throw new AuthorizationError(
      `Seller privileges are currently ${ctx.seller.sellerStatus}. Scout capabilities remain independent.`,
      403,
      'SELLER_NOT_OPERATIONAL'
    );
  }
  if (!ctx.seller.permissions.canManageListings) {
    throw new AuthorizationError(
      'You do not have permission to manage listings for this Seller account.',
      403,
      'MISSING_LISTING_PERMISSION'
    );
  }
}

// NS-SEL-003 & NS-VER-002: Fail-secure server enforcement of SELLER VERIFIED status and plan caps
export function assertCanPublishListing(
  ctx: UserAuthContext | null,
  usage: {
    currentActiveListings: number;
    publicationsThisMonth: number;
    distinctCategoriesUsed: number;
    isNewCategory: boolean;
  }
): void {
  assertAccountOperational(ctx);
  if (ctx.accountStatus !== 'ACTIVE') {
    throw new AuthorizationError(
      'Account must be ACTIVE without account-wide restriction to publish listings.',
      403,
      'ACCOUNT_RESTRICTED'
    );
  }
  assertCapabilityNotRestricted(ctx, 'PUBLISH_LISTING');
  assertCanManageSellerDrafts(ctx);
  const seller = ctx!.seller!;

  if (seller.sellerStatus !== 'ACTIVE') {
    throw new AuthorizationError(
      `Seller status is ${seller.sellerStatus}. Seller must be ACTIVE before publishing listings.`,
      403,
      'SELLER_NOT_ACTIVE'
    );
  }

  const verifStatus = normalizeVerificationStatus(seller.sellerVerificationStatus);
  if (verifStatus !== 'VERIFIED') {
    throw new AuthorizationError(
      `Seller verification is currently ${verifStatus}. Verification must be VERIFIED before publishing listings.`,
      403,
      'SELLER_VERIFICATION_REQUIRED'
    );
  }

  const subAllowed =
    seller.subscriptionPlan === 'STARTER' ||
    seller.subscriptionStatus === 'ACTIVE' ||
    seller.subscriptionStatus === 'GRACE_PERIOD' ||
    seller.subscriptionStatus === 'CANCELLATION_SCHEDULED';

  if (!subAllowed) {
    throw new AuthorizationError(
      `Subscription status (${seller.subscriptionStatus}) does not permit new listing publications.`,
      403,
      'SUBSCRIPTION_INACTIVE'
    );
  }

  const entitlements = getEffectivePlanEntitlements(
    seller.subscriptionPlan,
    seller.subscriptionStatus
  );

  if (usage.currentActiveListings >= entitlements.maxActiveListings) {
    throw new AuthorizationError(
      `Active listing limit (${entitlements.maxActiveListings}) reached for the ${seller.subscriptionPlan} plan.`,
      403,
      'LISTING_LIMIT_REACHED'
    );
  }

  if (usage.publicationsThisMonth >= entitlements.monthlyPublications) {
    throw new AuthorizationError(
      `Monthly publication allowance (${entitlements.monthlyPublications}) reached for the ${seller.subscriptionPlan} plan.`,
      403,
      'PUBLICATION_QUOTA_REACHED'
    );
  }

  if (
    entitlements.maxCategories !== 'ALL' &&
    usage.isNewCategory &&
    usage.distinctCategoriesUsed >= entitlements.maxCategories
  ) {
    throw new AuthorizationError(
      `Category limit (${entitlements.maxCategories}) reached for the ${seller.subscriptionPlan} plan.`,
      403,
      'CATEGORY_LIMIT_REACHED'
    );
  }
}

// NS-SEL-004: Business Seller & Sprawl plan team-seat enforcement (max 5 seats)
export function assertCanManageSellerTeam(ctx: UserAuthContext | null): void {
  assertAccountOperational(ctx);
  assertCapabilityNotRestricted(ctx, 'MANAGE_TEAM');
  const seller = ctx?.seller;
  if (!seller || seller.sellerType !== 'BUSINESS') {
    throw new AuthorizationError(
      'Team accounts are only available for Business Sellers.',
      403,
      'BUSINESS_SELLER_REQUIRED'
    );
  }
  if (seller.sellerStatus === 'CLOSED' || seller.sellerStatus === 'SUSPENDED') {
    throw new AuthorizationError(
      `Seller status is ${seller.sellerStatus}. Team changes are locked.`,
      403,
      'SELLER_NOT_OPERATIONAL'
    );
  }

  const entitlements = getEffectivePlanEntitlements(
    seller.subscriptionPlan,
    seller.subscriptionStatus
  );

  if (!entitlements.teamAccountsAllowed) {
    throw new AuthorizationError(
      'Upgrade to the Sprawl plan to manage Seller team accounts (up to 5 seats).',
      403,
      'SPRAWL_PLAN_REQUIRED'
    );
  }

  if (!seller.permissions.canManageTeam && seller.role !== 'BUSINESS_OWNER') {
    throw new AuthorizationError(
      'You do not have permission to manage team members.',
      403,
      'MISSING_TEAM_PERMISSION'
    );
  }
}

/**
 * Enforces referral batch boundaries (1..20 recipients) and removes/rejects blocked/muted recipients.
 */
export function assertReferralBatchValid(
  senderId: string,
  recipientIds: string[],
  options?: {
    blockedPairUserIds?: Set<string>;
    mutedRecipientIds?: Set<string>;
  }
): string[] {
  const uniqueIds = Array.from(new Set(recipientIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length < 1) {
    throw new AuthorizationError(
      'Select at least 1 Scouts List recipient for a product referral.',
      400,
      'NO_RECIPIENTS_SELECTED'
    );
  }
  if (uniqueIds.length > MAX_REFERRAL_RECIPIENTS_PER_BATCH) {
    throw new AuthorizationError(
      `Product referrals are capped at ${MAX_REFERRAL_RECIPIENTS_PER_BATCH} recipients per operation (received ${uniqueIds.length}).`,
      400,
      'REFERRAL_BATCH_LIMIT_EXCEEDED'
    );
  }
  if (uniqueIds.includes(senderId)) {
    throw new AuthorizationError('Self-referrals are prohibited.', 400, 'SELF_REFERRAL');
  }

  const blocked = options?.blockedPairUserIds;
  const muted = options?.mutedRecipientIds;

  const eligible: string[] = [];
  for (const rid of uniqueIds) {
    if (blocked?.has(rid)) {
      if (uniqueIds.length === 1) {
        throw new AuthorizationError(
          'Cannot send product referral due to a block between accounts.',
          403,
          'USER_BLOCKED'
        );
      }
      continue;
    }
    if (muted?.has(rid)) {
      if (uniqueIds.length === 1) {
        throw new AuthorizationError(
          'Recipient has muted incoming product referrals.',
          403,
          'REFERRALS_MUTED'
        );
      }
      continue;
    }
    eligible.push(rid);
  }

  if (eligible.length === 0) {
    throw new AuthorizationError(
      'No eligible recipients remaining after privacy and block filters.',
      403,
      'NO_ELIGIBLE_RECIPIENTS'
    );
  }
  return eligible;
}

// NS-VER-003: Separation of duties on verification review
export function assertCanReviewVerification(
  officerUserId: string,
  targetSellerOwnerId: string
): void {
  if (officerUserId === targetSellerOwnerId) {
    throw new AuthorizationError(
      'Separation of duties violation: officers cannot approve or review their own verification.',
      403,
      'SELF_APPROVAL_PROHIBITED'
    );
  }
}

// NS-GOV-003: Maker-Checker dual-control distinct officer guard
export function assertMakerCheckerDistinct(makerId: string, checkerId: string): void {
  if (makerId === checkerId) {
    throw new AuthorizationError(
      'Maker-Checker dual control requires a second distinct authorized officer.',
      403,
      'MAKER_CHECKER_SAME_OFFICER'
    );
  }
}

/**
 * Enforces independent appeals reviewer (appeals officer cannot review own prior decision).
 */
export function assertIndependentAppealsOfficer(
  appealsOfficerId: string,
  originalReviewerId: string | null | undefined,
  appellantUserId?: string
): void {
  if (appellantUserId && appealsOfficerId === appellantUserId) {
    throw new AuthorizationError(
      'You cannot adjudicate your own appeal.',
      403,
      'SELF_APPEAL_REVIEW_PROHIBITED'
    );
  }
  if (originalReviewerId && appealsOfficerId === originalReviewerId) {
    throw new AuthorizationError(
      'Independent review required: the original decision officer cannot adjudicate this appeal.',
      403,
      'CONFLICT_OF_INTEREST'
    );
  }
}

export function assertAdminRole(
  ctx: UserAuthContext | null,
  allowedRoles: AdminRole[]
): void {
  assertAccountOperational(ctx);
  if (!ctx.adminRole) {
    throw new AuthorizationError('Administrative access required.', 403, 'NOT_AN_ADMIN');
  }
  if (ctx.adminRole === 'SUPER_ADMIN') {
    return;
  }
  if (!allowedRoles.includes(ctx.adminRole)) {
    throw new AuthorizationError(
      `Role ${ctx.adminRole} is not authorized for this action.`,
      403,
      'INSUFFICIENT_ADMIN_ROLE'
    );
  }
}

export interface PublicScoutProfileDTO {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locationState: string | null;
  hasActiveSellerBadge: boolean;
  isSellerVerified: boolean;
  workingWithCount: number;
  totalSoldUnits: number;
}

// NS-PRI-001: Public Scout DTO sanitizer (strips private email, phone, bank, and ancestry fields)
export function toPublicScoutProfileDTO(input: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locationState: string | null;
  sellerStatus?: SellerStatus | null;
  sellerVerificationStatus?: VerificationStatus | null;
  workingWithCount?: number;
  totalSoldUnits?: number;
}): PublicScoutProfileDTO {
  return {
    userId: input.userId,
    username: input.username,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    bio: input.bio,
    locationState: input.locationState,
    hasActiveSellerBadge: input.sellerStatus === 'ACTIVE',
    isSellerVerified:
      normalizeVerificationStatus(input.sellerVerificationStatus) === 'VERIFIED',
    workingWithCount: input.workingWithCount ?? 0,
    totalSoldUnits: input.totalSoldUnits ?? 0,
  };
}
