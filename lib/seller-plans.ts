import type { SellerTeamRole, SubscriptionPlan } from '@/lib/auth/rbac';

export type SellerPlanId = 'starter' | 'traction' | 'growth' | 'sprawl';

export interface SellerPlanSpec {
  id: SellerPlanId;
  enumPlan: SubscriptionPlan;
  name: string;
  tagline: string;
  monthlyPriceKobo: number;
  maxActiveListings: number;
  monthlyPublications: number;
  maxCategories: number | 'All';
  listingDurationDays: number;
  maxImagesPerListing: number;
  videoQuota: string;
  videoProcessing: string;
  analyticsLevel: 'Basic' | 'Advanced';
  orderManagement: 'Basic' | 'Advanced';
  inventoryManagement: 'Basic' | 'Advanced';
  promotionalPlacements: boolean;
  sellerTeamAccounts: boolean;
  maxTeamSeats: number;
  advancedReporting: boolean;
}

export const SELLER_TEAM_ROLE_LABELS: Record<
  SellerTeamRole,
  { label: string; summary: string }
> = {
  BUSINESS_OWNER: {
    label: 'Business Owner',
    summary: 'Full business control, payout settings, team management, listings, and orders.',
  },
  BUSINESS_ADMIN: {
    label: 'Business Admin',
    summary: 'Manages listings, orders, analytics, and team invitations (cannot alter payout bank).',
  },
  PRODUCT_MANAGER: {
    label: 'Product Manager',
    summary: 'Creates, edits, and manages product listings and stock within plan limits.',
  },
  ORDER_MANAGER: {
    label: 'Order Manager',
    summary: 'Views orders, updates fulfilment statuses, and handles delivery evidence.',
  },
  FINANCE_MANAGER: {
    label: 'Finance Manager',
    summary: 'Views Seller revenue, commission expenses, refunds, and payout reports.',
  },
  ANALYST_VIEWER: {
    label: 'Analyst Viewer',
    summary: 'Read-only access to business sales and referral analytics.',
  },
};

export const SELLER_PLANS: Record<SellerPlanId, SellerPlanSpec> = {
  starter: {
    id: 'starter',
    enumPlan: 'STARTER',
    name: 'Starter',
    tagline: 'For new individual sellers testing social commerce',
    monthlyPriceKobo: 0,
    maxActiveListings: 1,
    monthlyPublications: 3,
    maxCategories: 1,
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    videoQuota: 'None',
    videoProcessing: '—',
    analyticsLevel: 'Basic',
    orderManagement: 'Basic',
    inventoryManagement: 'Basic',
    promotionalPlacements: false,
    sellerTeamAccounts: false,
    maxTeamSeats: 0,
    advancedReporting: false,
  },
  traction: {
    id: 'traction',
    enumPlan: 'TRACTION',
    name: 'Traction',
    tagline: 'For active merchants building repeat referrals',
    monthlyPriceKobo: 450000,
    maxActiveListings: 3,
    monthlyPublications: 10,
    maxCategories: 3,
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    videoQuota: '1 per listing (60s · 30 MB)',
    videoProcessing: 'Auto compression · manual thumbnail',
    analyticsLevel: 'Basic',
    orderManagement: 'Basic',
    inventoryManagement: 'Basic',
    promotionalPlacements: true,
    sellerTeamAccounts: false,
    maxTeamSeats: 0,
    advancedReporting: false,
  },
  growth: {
    id: 'growth',
    enumPlan: 'GROWTH',
    name: 'Growth',
    tagline: 'For scaling brands with multi-category catalogues',
    monthlyPriceKobo: 3500000,
    maxActiveListings: 5,
    monthlyPublications: 25,
    maxCategories: 10,
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    videoQuota: '3 per listing (120s · 100 MB each)',
    videoProcessing: 'Auto compression · manual thumbnail',
    analyticsLevel: 'Advanced',
    orderManagement: 'Advanced',
    inventoryManagement: 'Advanced',
    promotionalPlacements: true,
    sellerTeamAccounts: false,
    maxTeamSeats: 0,
    advancedReporting: false,
  },
  sprawl: {
    id: 'sprawl',
    enumPlan: 'SPRAWL',
    name: 'Sprawl',
    tagline: 'For high-volume sellers and merchant teams (up to 5 seats)',
    monthlyPriceKobo: 25000000,
    maxActiveListings: 20,
    monthlyPublications: 100,
    maxCategories: 'All',
    listingDurationDays: 10,
    maxImagesPerListing: 6,
    videoQuota: '5 per listing (180s · 1 GB each)',
    videoProcessing: 'No compression · auto thumbnail',
    analyticsLevel: 'Advanced',
    orderManagement: 'Advanced',
    inventoryManagement: 'Advanced',
    promotionalPlacements: true,
    sellerTeamAccounts: true,
    maxTeamSeats: 5,
    advancedReporting: true,
  },
};

export function planEnumToId(plan: SubscriptionPlan): SellerPlanId {
  return plan.toLowerCase() as SellerPlanId;
}

export function planIdToEnum(planId: SellerPlanId): SubscriptionPlan {
  return SELLER_PLANS[planId].enumPlan;
}
