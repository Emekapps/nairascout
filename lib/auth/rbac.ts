import { SellerTeamPermissions } from '@/lib/db/schema';

export type AccountStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'CLOSED';

export type SellerStatus = 'ONBOARDING' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';

export type VerificationStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTION_REQUIRED'
  | 'SUSPENDED';

export type SubscriptionPlan = 'STARTER' | 'TRACTION' | 'GROWTH' | 'SPRAWL';

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'VERIFICATION_OFFICER'
  | 'FINANCE_OPS'
  | 'TRUST_AND_SAFETY'
  | 'SUPPORT_AGENT';

export interface UserAuthContext {
  userId: string;
  email: string;
  accountStatus: AccountStatus;
  seller?: {
    sellerProfileId: string;
    sellerType: 'INDIVIDUAL' | 'BUSINESS';
    sellerStatus: SellerStatus;
    sellerVerificationStatus: VerificationStatus;
    subscriptionPlan: SubscriptionPlan;
    subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    role: 'BUSINESS_OWNER' | 'BUSINESS_ADMIN' | 'TEAM_MEMBER';
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
  advancedAnalytics: boolean;
}

export const SELLER_PLAN_ENTITLEMENTS: Record<SubscriptionPlan, PlanEntitlements> = {
  STARTER: {
    monthlyPriceNgn: 0,
    maxActiveListings: 1,
    monthlyPublications: 3,
    maxCategories: 1,
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    maxVideosPerListing: 0,
    maxVideoSeconds: 0,
    maxVideoSizeMb: 0,
    promotionalPlacements: false,
    teamAccountsAllowed: false,
    advancedAnalytics: false,
  },
  TRACTION: {
    monthlyPriceNgn: 4500,
    maxActiveListings: 3,
    monthlyPublications: 10,
    maxCategories: 3,
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    maxVideosPerListing: 1,
    maxVideoSeconds: 60,
    maxVideoSizeMb: 30,
    promotionalPlacements: false,
    teamAccountsAllowed: false,
    advancedAnalytics: false,
  },
  GROWTH: {
    monthlyPriceNgn: 35000,
    maxActiveListings: 5,
    monthlyPublications: 25,
    maxCategories: 10,
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    maxVideosPerListing: 3,
    maxVideoSeconds: 120,
    maxVideoSizeMb: 100,
    promotionalPlacements: true,
    teamAccountsAllowed: false,
    advancedAnalytics: true,
  },
  SPRAWL: {
    monthlyPriceNgn: 250000,
    maxActiveListings: 20,
    monthlyPublications: 100,
    maxCategories: 'ALL',
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    maxVideosPerListing: 5,
    maxVideoSeconds: 180,
    maxVideoSizeMb: 1024,
    promotionalPlacements: true,
    teamAccountsAllowed: true,
    advancedAnalytics: true,
  },
};

export function getEffectivePlanEntitlements(
  plan: SubscriptionPlan,
  subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
): PlanEntitlements {
  if (subscriptionStatus === 'EXPIRED') {
    return SELLER_PLAN_ENTITLEMENTS.STARTER;
  }
  return SELLER_PLAN_ENTITLEMENTS[plan];
}

export function assertActiveAccount(ctx: UserAuthContext | null): asserts ctx is UserAuthContext {
  if (!ctx) {
    throw new AuthorizationError('Authentication required.', 401, 'UNAUTHENTICATED');
  }
  if (ctx.accountStatus === 'CLOSED') {
    throw new AuthorizationError('This account has been closed.', 403, 'ACCOUNT_CLOSED');
  }
  if (ctx.accountStatus === 'SUSPENDED') {
    throw new AuthorizationError('This account is currently suspended.', 403, 'ACCOUNT_SUSPENDED');
  }
}

export function assertCanParticipateAsScout(ctx: UserAuthContext | null): void {
  assertActiveAccount(ctx);
  if (ctx.accountStatus === 'RESTRICTED') {
    throw new AuthorizationError(
      'Your Scout participation is temporarily restricted.',
      403,
      'SCOUT_RESTRICTED'
    );
  }
}

export function assertCanManageSellerDrafts(ctx: UserAuthContext | null): void {
  assertActiveAccount(ctx);
  if (!ctx.seller) {
    throw new AuthorizationError('Seller capabilities are not activated.', 403, 'NOT_A_SELLER');
  }
  if (ctx.seller.sellerStatus === 'SUSPENDED' || ctx.seller.sellerStatus === 'RESTRICTED') {
    throw new AuthorizationError(
      'Seller privileges are currently suspended or restricted.',
      403,
      'SELLER_SUSPENDED'
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

export function assertCanPublishListing(
  ctx: UserAuthContext | null,
  usage: {
    currentActiveListings: number;
    publicationsThisMonth: number;
    distinctCategoriesUsed: number;
    isNewCategory: boolean;
  }
): void {
  assertCanManageSellerDrafts(ctx);
  const seller = ctx!.seller!;

  if (seller.sellerStatus !== 'ACTIVE') {
    throw new AuthorizationError(
      'Complete Seller onboarding before publishing listings.',
      403,
      'SELLER_NOT_ACTIVE'
    );
  }

  if (seller.sellerVerificationStatus !== 'APPROVED') {
    throw new AuthorizationError(
      `Seller verification is currently ${seller.sellerVerificationStatus}. Verification must be APPROVED before publishing listings.`,
      403,
      'SELLER_VERIFICATION_REQUIRED'
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

export function assertCanManageSellerTeam(ctx: UserAuthContext | null): void {
  assertActiveAccount(ctx);
  const seller = ctx?.seller;
  if (!seller || seller.sellerType !== 'BUSINESS') {
    throw new AuthorizationError(
      'Team accounts are only available for Business Sellers.',
      403,
      'BUSINESS_SELLER_REQUIRED'
    );
  }

  const entitlements = getEffectivePlanEntitlements(
    seller.subscriptionPlan,
    seller.subscriptionStatus
  );

  if (!entitlements.teamAccountsAllowed) {
    throw new AuthorizationError(
      'Upgrade to the Sprawl plan to manage Seller team accounts.',
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

export function assertAdminRole(
  ctx: UserAuthContext | null,
  allowedRoles: AdminRole[]
): void {
  assertActiveAccount(ctx);
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
    isSellerVerified: input.sellerVerificationStatus === 'APPROVED',
    workingWithCount: input.workingWithCount ?? 0,
    totalSoldUnits: input.totalSoldUnits ?? 0,
  };
}
