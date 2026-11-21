import {
  AncestorNode,
  CommissionBreakdown,
  COMMISSION_RULE_VERSION,
  calculateThirteenGenerationCommissions,
  validateAncestryRelationship,
} from './commission-engine';

export type SellerPlanId = 'starter' | 'traction' | 'growth' | 'sprawl';

export interface SellerPlanSpec {
  id: SellerPlanId;
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
  advancedReporting: boolean;
}

export const SELLER_PLANS: Record<SellerPlanId, SellerPlanSpec> = {
  starter: {
    id: 'starter',
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
    advancedReporting: false,
  },
  traction: {
    id: 'traction',
    name: 'Traction',
    tagline: 'For active merchants building repeat referrals',
    monthlyPriceKobo: 450000, // ₦4,500
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
    promotionalPlacements: false,
    sellerTeamAccounts: false,
    advancedReporting: false,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'For scaling brands with multi-category catalogues',
    monthlyPriceKobo: 3500000, // ₦35,000
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
    advancedReporting: false,
  },
  sprawl: {
    id: 'sprawl',
    name: 'Sprawl',
    tagline: 'For high-volume sellers and merchant teams',
    monthlyPriceKobo: 25000000, // ₦250,000
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
    advancedReporting: true,
  },
};

export interface ScoutProfile {
  id: string;
  handle: string;
  displayName: string;
  city: string;
  directReferrerId: string | null;
  eligible: boolean;
  ineligibilityReason?: string;
  isSeller: boolean;
  sellerVerified: boolean;
  sellerPlan: SellerPlanId;
  kycVerified: boolean;
  bankVerified: boolean;
  bankSummary: string;
  invitePolicy: 'anyone' | 'contacts_only' | 'disabled';
  joinedAt: string;
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
  sellerName: string;
  sellerCity: string;
  sellerVerified: boolean;
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
  scoutId: string;
  handle: string;
  displayName: string;
  city: string;
  addedAt: string;
  blocked: boolean;
}

export interface ScoutsListInvitation {
  id: string;
  direction: 'incoming' | 'outgoing';
  otherScoutId: string;
  otherHandle: string;
  otherDisplayName: string;
  otherCity: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface ProductReferralEvent {
  id: string; // e.g. RE-8402-NG
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
  generation: number; // 0 for seller net / platform, 1..13 for Scout referral
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
  topic: 'attribution' | 'commission' | 'payout' | 'fulfilment' | 'abuse';
  subject: string;
  details: string;
  status: 'Open' | 'Under Review' | 'Resolved';
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
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

export interface NairaScoutSnapshot {
  activeScout: ScoutProfile;
  products: ProductListing[];
  scoutsList: ScoutsListContact[];
  invitations: ScoutsListInvitation[];
  referralsInbox: ProductReferralEvent[];
  sentReferrals: ProductReferralEvent[];
  orders: MarketplaceOrder[];
  ledgerEntries: LedgerEntry[];
  wallet: WalletSummary;
  upstreamAncestry: AncestorNode[];
  downstreamGenerations: DownstreamGenerationStat[];
  sellerStats: {
    activeListingsCount: number;
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
  allScoutsDirectory: Pick<ScoutProfile, 'id' | 'handle' | 'displayName' | 'city' | 'isSeller'>[];
}

// ---------- Authoritative Server-Side Seed & Store ----------

interface InternalStore {
  activeScoutId: string;
  scouts: Record<string, ScoutProfile>;
  products: ProductListing[];
  scoutsList: ScoutsListContact[];
  invitations: ScoutsListInvitation[];
  referralEvents: ProductReferralEvent[];
  orders: MarketplaceOrder[];
  ledger: LedgerEntry[];
  notifications: PlatformNotification[];
  supportCases: SupportCase[];
  monthlyPublicationsUsed: number;
}

function createInitialStore(): InternalStore {
  // 13-generation permanent ancestry chain:
  // anc_13 -> anc_12 -> ... -> anc_2 -> anc_1 -> scout_amara -> seller_adaeze (Gen 1 from seller_adaeze is Amara!)
  // Plus deeper seller_kofi sits at Gen 4 under Amara, so when seller_kofi makes a referral sale, Amara is Gen 4!
  const scouts: Record<string, ScoutProfile> = {
    anc_13: {
      id: 'anc_13',
      handle: 'chiefo_abuja',
      displayName: 'Chief O. Nwosu',
      city: 'Abuja',
      directReferrerId: null,
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Zenith Bank · ****4102',
      invitePolicy: 'contacts_only',
      joinedAt: '2025-01-12',
    },
    anc_12: {
      id: 'anc_12',
      handle: 'bimpe_curates',
      displayName: 'Bimpe Adeyemi',
      city: 'Ibadan',
      directReferrerId: 'anc_13',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'GTBank · ****1190',
      invitePolicy: 'anyone',
      joinedAt: '2025-02-03',
    },
    anc_11: {
      id: 'anc_11',
      handle: 'musa_kano',
      displayName: 'Musa Danjuma',
      city: 'Kano',
      directReferrerId: 'anc_12',
      eligible: false,
      ineligibilityReason: 'Dormant verification review',
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: false,
      bankVerified: false,
      bankSummary: 'Pending verification',
      invitePolicy: 'contacts_only',
      joinedAt: '2025-02-28',
    },
    anc_10: {
      id: 'anc_10',
      handle: 'esther_ph',
      displayName: 'Esther Briggs',
      city: 'Port Harcourt',
      directReferrerId: 'anc_11',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Access Bank · ****8841',
      invitePolicy: 'anyone',
      joinedAt: '2025-03-19',
    },
    anc_9: {
      id: 'anc_9',
      handle: 'segun_tech',
      displayName: 'Segun Lawal',
      city: 'Lagos',
      directReferrerId: 'anc_10',
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'traction',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Kuda · ****3019',
      invitePolicy: 'anyone',
      joinedAt: '2025-04-04',
    },
    anc_8: {
      id: 'anc_8',
      handle: 'halima_style',
      displayName: 'Halima Bello',
      city: 'Kaduna',
      directReferrerId: 'anc_9',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'UBA · ****5520',
      invitePolicy: 'anyone',
      joinedAt: '2025-05-11',
    },
    anc_7: {
      id: 'anc_7',
      handle: 'ifeanyi_enugu',
      displayName: 'Ifeanyi Eze',
      city: 'Enugu',
      directReferrerId: 'anc_8',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Fidelity · ****7412',
      invitePolicy: 'anyone',
      joinedAt: '2025-06-08',
    },
    anc_6: {
      id: 'anc_6',
      handle: 'zainab_home',
      displayName: 'Zainab Yusuf',
      city: 'Abuja',
      directReferrerId: 'anc_7',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Stanbic · ****9204',
      invitePolicy: 'anyone',
      joinedAt: '2025-07-15',
    },
    anc_5: {
      id: 'anc_5',
      handle: 'damilola_vi',
      displayName: 'Damilola Ogunleye',
      city: 'Lagos',
      directReferrerId: 'anc_6',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'GTBank · ****6310',
      invitePolicy: 'anyone',
      joinedAt: '2025-08-01',
    },
    anc_4: {
      id: 'anc_4',
      handle: 'chidi_market',
      displayName: 'Chidi Obi',
      city: 'Onitsha',
      directReferrerId: 'anc_5',
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'growth',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Zenith Bank · ****2049',
      invitePolicy: 'anyone',
      joinedAt: '2025-09-10',
    },
    anc_3: {
      id: 'anc_3',
      handle: 'folake_lagos',
      displayName: 'Folake Coker',
      city: 'Lagos',
      directReferrerId: 'anc_4',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Access Bank · ****4478',
      invitePolicy: 'anyone',
      joinedAt: '2025-10-05',
    },
    anc_2: {
      id: 'anc_2',
      handle: 'kemi_finds',
      displayName: 'Kemi Balogun',
      city: 'Lagos',
      directReferrerId: 'anc_3',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'GTBank · ****8123',
      invitePolicy: 'anyone',
      joinedAt: '2025-11-12',
    },
    anc_1: {
      id: 'anc_1',
      handle: 'tunde_ng',
      displayName: 'Tunde Bakare',
      city: 'Lagos',
      directReferrerId: 'anc_2',
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'traction',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'GTBank · ****0921',
      invitePolicy: 'anyone',
      joinedAt: '2025-12-01',
    },
    scout_amara: {
      id: 'scout_amara',
      handle: 'amara_scout',
      displayName: 'Amara Okafor',
      city: 'Lagos',
      directReferrerId: 'anc_1',
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'traction',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'GTBank · ****4829 (Verified Same-Name)',
      invitePolicy: 'anyone',
      joinedAt: '2026-01-14',
    },
    // Downstream Scouts & Sellers connected under Amara's permanent ancestry
    seller_adaeze: {
      id: 'seller_adaeze',
      handle: 'adaeze_atelier',
      displayName: 'Adaeze Crafts & Home',
      city: 'Abuja',
      directReferrerId: 'scout_amara', // Amara is Gen 1!
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'growth',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Zenith Bank · ****3391',
      invitePolicy: 'anyone',
      joinedAt: '2026-02-02',
    },
    scout_yemi: {
      id: 'scout_yemi',
      handle: 'yemi_audio',
      displayName: 'Yemi Adeola',
      city: 'Lagos',
      directReferrerId: 'seller_adaeze', // Amara is Gen 2!
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'traction',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Access Bank · ****1082',
      invitePolicy: 'anyone',
      joinedAt: '2026-03-11',
    },
    seller_zuri: {
      id: 'seller_zuri',
      handle: 'zuri_botanicals',
      displayName: 'Zuri Botanicals',
      city: 'Lagos',
      directReferrerId: 'scout_yemi', // Amara is Gen 3!
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'growth',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Stanbic IBTC · ****7710',
      invitePolicy: 'anyone',
      joinedAt: '2026-04-06',
    },
    seller_kano: {
      id: 'seller_kano',
      handle: 'arewa_leather',
      displayName: 'Arewa Leatherworks',
      city: 'Kano',
      directReferrerId: 'seller_zuri', // Amara is Gen 4!
      eligible: true,
      isSeller: true,
      sellerVerified: true,
      sellerPlan: 'sprawl',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'UBA · ****6620',
      invitePolicy: 'anyone',
      joinedAt: '2026-05-18',
    },
    scout_ngozi: {
      id: 'scout_ngozi',
      handle: 'ngozi_kitchen',
      displayName: 'Ngozi Peters',
      city: 'Port Harcourt',
      directReferrerId: 'scout_amara',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Fidelity · ****5122',
      invitePolicy: 'anyone',
      joinedAt: '2026-03-22',
    },
    scout_ibrahim: {
      id: 'scout_ibrahim',
      handle: 'ibrahim_gadgets',
      displayName: 'Ibrahim Sule',
      city: 'Abuja',
      directReferrerId: 'scout_ngozi',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'GTBank · ****3901',
      invitePolicy: 'anyone',
      joinedAt: '2026-04-29',
    },
    scout_sola: {
      id: 'scout_sola',
      handle: 'sola_style',
      displayName: 'Sola Akinwande',
      city: 'Ibadan',
      directReferrerId: 'scout_amara',
      eligible: true,
      isSeller: false,
      sellerVerified: false,
      sellerPlan: 'starter',
      kycVerified: true,
      bankVerified: true,
      bankSummary: 'Kuda · ****8902',
      invitePolicy: 'anyone',
      joinedAt: '2026-06-14',
    },
  };

  const products: ProductListing[] = [
    {
      id: 'LST-101',
      productId: 'PRD-101',
      title: 'Hand-Loomed Aso-Oke Throw & Cushion Pair',
      description:
        'Woven in Iseyin with heavyweight unbleached cotton and subtle indigo selvedge stripes. Finished with concealed brass zips.',
      category: 'Home & Craft',
      priceKobo: 4850000, // ₦48,500
      deliveryFeeKobo: 350000, // ₦3,500
      stock: 14,
      sellerScoutId: 'seller_adaeze',
      sellerName: 'Adaeze Crafts & Home',
      sellerCity: 'Abuja',
      sellerVerified: true,
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
      priceKobo: 10000000, // ₦100,000 (exact G3 showcase figure!)
      deliveryFeeKobo: 400000, // ₦4,000
      stock: 9,
      sellerScoutId: 'scout_yemi',
      sellerName: 'Yemi Adeola Audio',
      sellerCity: 'Lagos',
      sellerVerified: true,
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
      priceKobo: 2800000, // ₦28,000
      deliveryFeeKobo: 250000, // ₦2,500
      stock: 27,
      sellerScoutId: 'seller_zuri',
      sellerName: 'Zuri Botanicals',
      sellerCity: 'Lagos',
      sellerVerified: true,
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
      priceKobo: 12500000, // ₦125,000
      deliveryFeeKobo: 500000, // ₦5,000
      stock: 5,
      sellerScoutId: 'seller_kano',
      sellerName: 'Arewa Leatherworks',
      sellerCity: 'Kano',
      sellerVerified: true,
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
      priceKobo: 2250000, // ₦22,500
      deliveryFeeKobo: 250000, // ₦2,500
      stock: 32,
      sellerScoutId: 'scout_amara',
      sellerName: 'Amara Okafor',
      sellerCity: 'Lagos',
      sellerVerified: true,
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
      priceKobo: 18500000, // ₦185,000
      deliveryFeeKobo: 650000, // ₦6,500
      stock: 6,
      sellerScoutId: 'anc_9',
      sellerName: 'Segun Lawal Tech',
      sellerCity: 'Lagos',
      sellerVerified: true,
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
      scoutId: 'scout_ngozi',
      handle: 'ngozi_kitchen',
      displayName: 'Ngozi Peters',
      city: 'Port Harcourt',
      addedAt: '2026-04-02',
      blocked: false,
    },
    {
      contactId: 'CNT-02',
      scoutId: 'scout_sola',
      handle: 'sola_style',
      displayName: 'Sola Akinwande',
      city: 'Ibadan',
      addedAt: '2026-06-18',
      blocked: false,
    },
    {
      contactId: 'CNT-03',
      scoutId: 'anc_1',
      handle: 'tunde_ng',
      displayName: 'Tunde Bakare',
      city: 'Lagos',
      addedAt: '2026-01-16',
      blocked: false,
    },
    {
      contactId: 'CNT-04',
      scoutId: 'scout_ibrahim',
      handle: 'ibrahim_gadgets',
      displayName: 'Ibrahim Sule',
      city: 'Abuja',
      addedAt: '2026-07-04',
      blocked: false,
    },
  ];

  const invitations: ScoutsListInvitation[] = [
    {
      id: 'INV-401',
      direction: 'incoming',
      otherScoutId: 'anc_2',
      otherHandle: 'kemi_finds',
      otherDisplayName: 'Kemi Balogun',
      otherCity: 'Lagos',
      status: 'pending',
      createdAt: '2026-11-19',
      expiresAt: '2026-11-26',
    },
    {
      id: 'INV-402',
      direction: 'outgoing',
      otherScoutId: 'seller_zuri',
      otherHandle: 'zuri_botanicals',
      otherDisplayName: 'Zuri Botanicals',
      otherCity: 'Lagos',
      status: 'pending',
      createdAt: '2026-11-20',
      expiresAt: '2026-11-27',
    },
  ];

  const referralEvents: ProductReferralEvent[] = [
    {
      id: 'RE-8402-NG',
      productListingId: 'LST-102',
      senderScoutId: 'anc_1',
      senderHandle: 'tunde_ng',
      senderDisplayName: 'Tunde Bakare',
      recipientScoutId: 'scout_amara',
      recipientHandle: 'amara_scout',
      recipientDisplayName: 'Amara Okafor',
      note: 'Tested these on the Lekki-Ikoyi commute — ANC blocks danfo noise cleanly and battery lasts all week.',
      ancestryPathSignature: 'anc_1->scout_amara',
      createdAt: '2026-11-18T14:20:00Z',
      expiresAt: '2026-11-28T14:20:00Z',
      status: 'active',
    },
    {
      id: 'RE-8409-NG',
      productListingId: 'LST-104',
      senderScoutId: 'scout_ngozi',
      senderHandle: 'ngozi_kitchen',
      senderDisplayName: 'Ngozi Peters',
      recipientScoutId: 'scout_amara',
      recipientHandle: 'amara_scout',
      recipientDisplayName: 'Amara Okafor',
      note: 'Arewa Leatherworks finally restocked the cabin weekender in dark chestnut.',
      ancestryPathSignature: 'scout_ngozi->scout_amara',
      createdAt: '2026-11-19T09:15:00Z',
      expiresAt: '2026-11-29T09:15:00Z',
      status: 'active',
    },
    {
      id: 'RE-8415-NG',
      productListingId: 'LST-103',
      senderScoutId: 'scout_amara',
      senderHandle: 'amara_scout',
      senderDisplayName: 'Amara Okafor',
      recipientScoutId: 'scout_sola',
      recipientHandle: 'sola_style',
      recipientDisplayName: 'Sola Akinwande',
      note: 'Sola, this is the unrefined baobab barrier set we spoke about for harmattan.',
      ancestryPathSignature: 'scout_amara->scout_sola',
      createdAt: '2026-11-17T11:05:00Z',
      expiresAt: '2026-11-27T11:05:00Z',
      status: 'active',
    },
  ];

  const store: InternalStore = {
    activeScoutId: 'scout_amara',
    scouts,
    products,
    scoutsList,
    invitations,
    referralEvents,
    orders: [],
    ledger: [],
    notifications: [
      {
        id: 'NTF-01',
        category: 'referral',
        title: 'New product referral from @tunde_ng',
        body: 'Tunde Bakare sent you a referral card for Lagos Studio Wireless ANC Headphones (RE-8402-NG).',
        createdAt: '2026-11-18T14:20:00Z',
        read: false,
      },
      {
        id: 'NTF-02',
        category: 'payout',
        title: 'Monthly payout cycle schedule',
        body: 'Available commissions earned in November qualify for the December 15 monthly settlement (₦5,000 minimum).',
        createdAt: '2026-11-15T08:00:00Z',
        read: true,
      },
    ],
    supportCases: [],
    monthlyPublicationsUsed: 2,
  };

  // Seed historical & active orders so Wallet, Ledger, Fulfilment & Seller Analytics are rich and 100% mathematically consistent!
  seedInitialOrdersAndLedger(store);
  return store;
}

export function buildAncestryForScout(
  scoutId: string,
  scouts: Record<string, ScoutProfile>
): AncestorNode[] {
  const result: AncestorNode[] = [];
  const visited = new Set<string>([scoutId]);
  let currentId = scouts[scoutId]?.directReferrerId ?? null;
  let generation = 1;

  while (currentId && generation <= 13) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const node = scouts[currentId];
    if (!node) break;
    result.push({
      generation,
      scoutId: node.id,
      handle: node.handle,
      displayName: node.displayName,
      eligible: node.eligible,
      ineligibilityReason: node.ineligibilityReason,
    });
    currentId = node.directReferrerId;
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
  const buyer = store.scouts[params.buyerScoutId] ?? store.scouts.scout_amara;
  const eligibleMerchandiseKobo = product.priceKobo * params.quantity;
  const deliveryFeeKobo = product.deliveryFeeKobo;
  const totalChargedKobo = eligibleMerchandiseKobo + deliveryFeeKobo;

  const isReferral = Boolean(params.referralEventId);
  // Attribution anchor (H2): Seller Scout's permanent referral ancestry
  const sellerAncestry = buildAncestryForScout(product.sellerScoutId, store.scouts);
  const breakdown = calculateThirteenGenerationCommissions(
    eligibleMerchandiseKobo,
    sellerAncestry,
    isReferral
  );

  const order: MarketplaceOrder = {
    id: params.orderId,
    buyerScoutId: buyer.id,
    buyerDisplayName: buyer.displayName,
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

  // Record immutable ledger entries for each eligible Scout generation allocation
  const targetStatus: LedgerEntryStatus = params.isPaidHistorical
    ? 'Paid'
    : params.fulfilmentStatus === 'Delivered'
    ? 'Available'
    : params.fulfilmentStatus === 'Disputed'
    ? 'On Hold'
    : params.fulfilmentStatus === 'Refunded'
    ? 'Pending'
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
  // 1. Historical Paid order from October (Amara is Gen 3 of Zuri Botanicals)
  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9041',
    buyerScoutId: 'scout_sola',
    productListingId: 'LST-103', // Zuri Botanicals (Amara = Gen 3) -> ₦28,000 * 2 = ₦56,000
    quantity: 2,
    referralEventId: 'RE-8415-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-10-21T10:30:00Z',
    fulfilmentDeadline: '2026-10-31T10:30:00Z',
    isPaidHistorical: true,
  });

  // 2. Delivered October/November Available order (Amara is Gen 4 of Arewa Leatherworks -> ₦125,000 * 3 = ₦375,000 -> pool ₦7,500 -> Gen 4 = 1/30 = ₦250... let's add multiple orders so Available > ₦5,000!)
  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9118',
    buyerScoutId: 'scout_ibrahim',
    productListingId: 'LST-101', // Adaeze Crafts (Amara = Gen 1 -> 1/6 of pool!) 4 units = ₦194,000
    quantity: 4,
    referralEventId: 'RE-7710-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-10-28T16:45:00Z',
    fulfilmentDeadline: '2026-11-07T16:45:00Z',
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9154',
    buyerScoutId: 'anc_5',
    productListingId: 'LST-102', // Yemi Audio (Amara = Gen 2 -> 1/10 of pool) 3 units = ₦300,000
    quantity: 3,
    referralEventId: 'RE-7804-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-11-04T12:10:00Z',
    fulfilmentDeadline: '2026-11-14T12:10:00Z',
  });

  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9192',
    buyerScoutId: 'scout_ngozi',
    productListingId: 'LST-104', // Arewa Leatherworks (Amara = Gen 4 -> 1/30 of pool) 2 units = ₦250,000
    quantity: 2,
    referralEventId: 'RE-8011-NG',
    fulfilmentStatus: 'Delivered',
    createdAt: '2026-11-12T09:20:00Z',
    fulfilmentDeadline: '2026-11-22T09:20:00Z',
  });

  // 3. Pending order (awaiting delivery confirmation) on Amara's own Seller listing (Direct purchase = 0 referral commission!)
  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9204',
    buyerScoutId: 'scout_sola',
    productListingId: 'LST-105', // Amara's coffee
    quantity: 2,
    referralEventId: null, // Direct marketplace purchase!
    fulfilmentStatus: 'Processing',
    createdAt: '2026-11-19T15:00:00Z',
    fulfilmentDeadline: '2026-11-29T15:00:00Z',
  });

  // 4. Pending order (Referral-generated on Amara's own coffee listing -> Amara's 13 upstream ancestors earn!)
  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9210',
    buyerScoutId: 'scout_ibrahim',
    productListingId: 'LST-105', // Amara's coffee, depth = 13 upstream!
    quantity: 3,
    referralEventId: 'RE-8390-NG',
    fulfilmentStatus: 'Dispatched',
    createdAt: '2026-11-20T11:30:00Z',
    fulfilmentDeadline: '2026-11-30T11:30:00Z',
  });

  // 5. Pending order where Amara earns Gen 1 (Adaeze Crafts)
  createOrderRecordAndLedger(store, {
    orderId: 'ORD-9215',
    buyerScoutId: 'anc_6',
    productListingId: 'LST-101',
    quantity: 2,
    referralEventId: 'RE-8400-NG',
    fulfilmentStatus: 'Paid',
    createdAt: '2026-11-21T08:05:00Z',
    fulfilmentDeadline: '2026-12-01T08:05:00Z',
  });
}

// Persist across hot reloads in Node globalThis
const globalForStore = globalThis as unknown as {
  __nairascoutStore?: InternalStore;
};

function getStore(): InternalStore {
  if (!globalForStore.__nairascoutStore) {
    globalForStore.__nairascoutStore = createInitialStore();
  }
  return globalForStore.__nairascoutStore;
}

function computeWalletSummary(store: InternalStore, scoutId: string): WalletSummary {
  const scoutEntries = store.ledger.filter((e) => e.beneficiaryScoutId === scoutId);
  // Note: For immutable ledger, when an entry transitions state, we keep an authoritative status on the latest linked entry or track active balances.
  // To ensure clean non-double-counting across status transitions in our immutable ledger:
  // Original allocation entries have reference `LDG-...`, and status updates/reversals record new linked entries or supersede prior state.
  // Let's compute active state per unique allocation `reference` (strip `-REL`, `-HOLD`, `-REV`, `-PAID` suffixes).
  const latestByRootRef = new Map<string, LedgerEntry>();
  // store.ledger is unshifted (newest first), so iterate oldest -> newest
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
      // October 2026 entries qualify for the November 15 / next cycle payout check
      if (entry.createdAt.startsWith('2026-10')) {
        precedingMonthAvailableKobo += entry.amountKobo;
      }
    }
    if (entry.status === 'On Hold') onHoldKobo += entry.amountKobo;
    if (entry.status === 'Paid') paidKobo += entry.amountKobo;
    if (entry.status === 'Reversed') reversedKobo += entry.amountKobo;
  }

  const minimumPayoutKobo = 500000; // ₦5,000
  const scout = store.scouts[scoutId];

  return {
    pendingKobo,
    availableKobo,
    onHoldKobo,
    paidKobo,
    reversedKobo,
    minimumPayoutKobo,
    nextPayoutDate: '15 Dec 2026',
    precedingMonthAvailableKobo,
    eligibleForNextPayout:
      Boolean(scout?.kycVerified && scout?.bankVerified) && availableKobo >= minimumPayoutKobo,
  };
}

function computeDownstreamGenerations(
  store: InternalStore,
  rootScoutId: string
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

  // BFS from rootScoutId for real registered downstream Scouts
  const byGen: Record<number, ScoutProfile[]> = {};
  let frontier: string[] = [rootScoutId];
  const visited = new Set<string>([rootScoutId]);

  for (let gen = 1; gen <= 13; gen++) {
    const nextFrontier: string[] = [];
    const members: ScoutProfile[] = [];
    for (const parentId of frontier) {
      for (const candidate of Object.values(store.scouts)) {
        if (candidate.directReferrerId === parentId && !visited.has(candidate.id)) {
          visited.add(candidate.id);
          members.push(candidate);
          nextFrontier.push(candidate.id);
        }
      }
    }
    byGen[gen] = members;
    frontier = nextFrontier;
  }

  // Realistic network counts beyond the named seeded sample nodes so Gen 1..13 Explorer shows full depth
  const baselineCounts = [3, 4, 6, 9, 12, 14, 11, 8, 5, 4, 3, 2, 1];
  return Array.from({ length: 13 }, (_, idx) => {
    const gen = idx + 1;
    const realMembers = byGen[gen] ?? [];
    const count = Math.max(realMembers.length, baselineCounts[idx]);
    const eligibleCount =
      realMembers.length > 0
        ? realMembers.filter((m) => m.eligible).length + Math.max(0, count - realMembers.length)
        : count;

    return {
      generation: gen,
      scoutCount: count,
      eligibleCount,
      sampleHandles: realMembers.map((m) => `@${m.handle}`),
      scheduleFractionAtFullDepth: fractions[idx],
    };
  });
}

export function getNairaScoutSnapshot(): NairaScoutSnapshot {
  const store = getStore();
  const activeScout = store.scouts[store.activeScoutId];

  const referralsInbox = store.referralEvents.filter(
    (e) => e.recipientScoutId === activeScout.id
  );
  const sentReferrals = store.referralEvents.filter(
    (e) => e.senderScoutId === activeScout.id
  );

  // Privacy safeguard (F3, L2, L3): Only show ledger entries belonging to activeScout,
  // or summary order rows where activeScout is buyer or seller.
  const scoutLedgerEntries = store.ledger.filter(
    (entry) => entry.beneficiaryScoutId === activeScout.id
  );

  const visibleOrders = store.orders.filter(
    (o) =>
      o.buyerScoutId === activeScout.id ||
      o.sellerScoutId === activeScout.id ||
      o.commissionSnapshot.allocations.some((a) => a.scoutId === activeScout.id)
  );

  const sellerOrders = store.orders.filter(
    (o) => o.sellerScoutId === activeScout.id && o.fulfilmentStatus !== 'Refunded'
  );
  const sellerListings = store.products.filter((p) => p.sellerScoutId === activeScout.id);

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
    activeScout,
    products: store.products,
    scoutsList: store.scoutsList,
    invitations: store.invitations,
    referralsInbox,
    sentReferrals,
    orders: visibleOrders,
    ledgerEntries: scoutLedgerEntries,
    wallet: computeWalletSummary(store, activeScout.id),
    upstreamAncestry: buildAncestryForScout(activeScout.id, store.scouts),
    downstreamGenerations: computeDownstreamGenerations(store, activeScout.id),
    sellerStats: {
      activeListingsCount: sellerListings.length,
      monthlyPublicationsUsed: store.monthlyPublicationsUsed,
      directOrdersCount: sellerOrders.filter((o) => o.attributionType === 'direct').length,
      referralOrdersCount: sellerOrders.filter((o) => o.attributionType === 'referral_card').length,
      eligibleMerchandiseKobo,
      marketplaceCommissionKobo,
      referralPoolGeneratedKobo,
      netSellerProceedsKobo: eligibleMerchandiseKobo - marketplaceCommissionKobo,
    },
    notifications: store.notifications,
    supportCases: store.supportCases,
    allScoutsDirectory: Object.values(store.scouts)
      .filter((s) => s.id !== activeScout.id)
      .map((s) => ({
        id: s.id,
        handle: s.handle,
        displayName: s.displayName,
        city: s.city,
        isSeller: s.isSeller,
      })),
  };
}

// ---------- Server-Side Transactional Actions ----------

export function createOrderFromCheckout(input: {
  productListingId: string;
  quantity: number;
  referralEventId: string | null;
}): { ok: true; order: MarketplaceOrder } | { ok: false; error: string } {
  const store = getStore();
  const product = store.products.find((p) => p.id === input.productListingId);
  if (!product) return { ok: false, error: 'Product listing not found.' };

  const qty = Math.max(1, Math.min(product.stock, Math.floor(input.quantity || 1)));
  if (product.stock < qty) return { ok: false, error: 'Insufficient product inventory.' };

  let validReferralEventId: string | null = null;
  if (input.referralEventId) {
    const refEvent = store.referralEvents.find((r) => r.id === input.referralEventId);
    if (!refEvent || refEvent.productListingId !== product.id || refEvent.status === 'expired') {
      return { ok: false, error: 'Referral card is invalid or expired for this product.' };
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
    buyerScoutId: store.activeScoutId,
    productListingId: product.id,
    quantity: qty,
    referralEventId: validReferralEventId,
    fulfilmentStatus: 'Paid',
    createdAt: now.toISOString(),
    fulfilmentDeadline: deadline.toISOString(),
  });

  store.notifications.unshift({
    id: `NTF-${Date.now()}`,
    category: 'order',
    title: `Order ${order.id} confirmed (${order.attributionType === 'referral_card' ? 'Referral-Attributed' : 'Direct'})`,
    body:
      order.attributionType === 'referral_card'
        ? `Referral event ${validReferralEventId} preserved. Pending commissions calculated across Seller ancestry (${order.commissionSnapshot.actualAncestryDepth} generations).`
        : 'Direct marketplace checkout completed. No referral commission generated.',
    createdAt: now.toISOString(),
    read: false,
  });

  return { ok: true, order };
}

export function advanceOrderStatus(input: {
  orderId: string;
  nextStatus: OrderFulfilmentStatus;
}): { ok: true; order: MarketplaceOrder } | { ok: false; error: string } {
  const store = getStore();
  const order = store.orders.find((o) => o.id === input.orderId);
  if (!order) return { ok: false, error: 'Order not found.' };

  if (order.fulfilmentStatus === 'Refunded') {
    return { ok: false, error: 'Refunded orders are terminal and cannot be modified.' };
  }

  order.fulfilmentStatus = input.nextStatus;
  const nowIso = new Date().toISOString();

  // Immutable ledger transition: append new linked entries instead of mutating historical rows
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

  store.notifications.unshift({
    id: `NTF-${Date.now()}`,
    category: 'commission',
    title: `Order ${order.id} updated to ${input.nextStatus}`,
    body: newLedgerStatus
      ? `Linked immutable ledger entries recorded with status ${newLedgerStatus}.`
      : `Fulfilment progressed to ${input.nextStatus}.`,
    createdAt: nowIso,
    read: false,
  });

  return { ok: true, order };
}

export function createReferralEvent(input: {
  productListingId: string;
  recipientScoutId: string;
  note: string;
}): { ok: true; event: ProductReferralEvent } | { ok: false; error: string } {
  const store = getStore();
  const sender = store.scouts[store.activeScoutId];
  const recipient = store.scouts[input.recipientScoutId];
  const product = store.products.find((p) => p.id === input.productListingId);

  if (!product) return { ok: false, error: 'Product listing not found.' };
  if (!recipient) return { ok: false, error: 'Recipient Scout not found.' };
  if (recipient.id === sender.id) {
    return { ok: false, error: 'Self-referrals are prohibited.' };
  }

  const contact = store.scoutsList.find((c) => c.scoutId === recipient.id);
  if (contact?.blocked) {
    return { ok: false, error: 'This contact is currently blocked.' };
  }

  // Prevent circular referral path if recipient is direct/upstream referrer of sender in this chain
  const ancestryCheck = validateAncestryRelationship(
    recipient.id,
    sender.id,
    Object.fromEntries(Object.values(store.scouts).map((s) => [s.id, s.directReferrerId]))
  );
  // Note: A product referral isn't permanent ancestry, but Part E3 prohibits circular product referral paths
  const existingReverse = store.referralEvents.find(
    (e) =>
      e.productListingId === product.id &&
      e.senderScoutId === recipient.id &&
      e.recipientScoutId === sender.id &&
      e.status === 'active'
  );
  if (existingReverse && !ancestryCheck.valid) {
    return { ok: false, error: 'Circular product referral path rejected.' };
  }

  const pathSignature = `${sender.id}->${recipient.id}`;
  const duplicate = store.referralEvents.find(
    (e) =>
      e.productListingId === product.id &&
      e.ancestryPathSignature === pathSignature &&
      e.status === 'active'
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Active referral ${duplicate.id} already exists for @${recipient.handle} on this listing.`,
    };
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const event: ProductReferralEvent = {
    id: `RE-${Math.floor(8500 + Math.random() * 1400)}-NG`,
    productListingId: product.id,
    senderScoutId: sender.id,
    senderHandle: sender.handle,
    senderDisplayName: sender.displayName,
    recipientScoutId: recipient.id,
    recipientHandle: recipient.handle,
    recipientDisplayName: recipient.displayName,
    note: input.note.trim() || `Recommended ${product.title} on NairaScout.`,
    ancestryPathSignature: pathSignature,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    status: 'active',
  };

  store.referralEvents.unshift(event);
  product.referralShares += 1;

  return { ok: true, event };
}

export function inviteToScoutsList(input: {
  targetScoutId: string;
}): { ok: true; invitation: ScoutsListInvitation } | { ok: false; error: string } {
  const store = getStore();
  const target = store.scouts[input.targetScoutId];
  if (!target) return { ok: false, error: 'Scout not found.' };
  if (target.id === store.activeScoutId) {
    return { ok: false, error: 'You cannot invite yourself to your Scouts List.' };
  }
  if (target.invitePolicy === 'disabled') {
    return { ok: false, error: 'This Scout does not accept Scouts List invitations.' };
  }
  if (store.scoutsList.some((c) => c.scoutId === target.id)) {
    return { ok: false, error: `@${target.handle} is already in your Scouts List.` };
  }
  if (
    store.invitations.some(
      (i) => i.otherScoutId === target.id && i.status === 'pending'
    )
  ) {
    return { ok: false, error: `A pending invitation already exists for @${target.handle}.` };
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const invitation: ScoutsListInvitation = {
    id: `INV-${Math.floor(500 + Math.random() * 499)}`,
    direction: 'outgoing',
    otherScoutId: target.id,
    otherHandle: target.handle,
    otherDisplayName: target.displayName,
    otherCity: target.city,
    status: 'pending',
    createdAt: now.toISOString().slice(0, 10),
    expiresAt: expires.toISOString().slice(0, 10),
  };

  store.invitations.unshift(invitation);
  return { ok: true, invitation };
}

export function respondToInvitation(input: {
  invitationId: string;
  action: 'accept' | 'reject' | 'withdraw';
}): { ok: true } | { ok: false; error: string } {
  const store = getStore();
  const inv = store.invitations.find((i) => i.id === input.invitationId);
  if (!inv || inv.status !== 'pending') {
    return { ok: false, error: 'Pending invitation not found.' };
  }

  if (input.action === 'accept') {
    inv.status = 'accepted';
    if (!store.scoutsList.some((c) => c.scoutId === inv.otherScoutId)) {
      store.scoutsList.unshift({
        contactId: `CNT-${Date.now()}`,
        scoutId: inv.otherScoutId,
        handle: inv.otherHandle,
        displayName: inv.otherDisplayName,
        city: inv.otherCity,
        addedAt: new Date().toISOString().slice(0, 10),
        blocked: false,
      });
    }
  } else if (input.action === 'reject') {
    inv.status = 'rejected';
  } else {
    inv.status = 'withdrawn';
  }

  return { ok: true };
}

export function manageContact(input: {
  contactId: string;
  action: 'remove' | 'toggle_block';
}): { ok: true } | { ok: false; error: string } {
  const store = getStore();
  const idx = store.scoutsList.findIndex((c) => c.contactId === input.contactId);
  if (idx === -1) return { ok: false, error: 'Contact not found.' };

  if (input.action === 'remove') {
    store.scoutsList.splice(idx, 1);
  } else {
    store.scoutsList[idx].blocked = !store.scoutsList[idx].blocked;
  }
  return { ok: true };
}

export function publishSellerListing(input: {
  title: string;
  category: string;
  priceNaira: number;
  deliveryFeeNaira: number;
  stock: number;
  description: string;
}): { ok: true; listing: ProductListing } | { ok: false; error: string } {
  const store = getStore();
  const seller = store.scouts[store.activeScoutId];
  const plan = SELLER_PLANS[seller.sellerPlan];

  const currentListings = store.products.filter((p) => p.sellerScoutId === seller.id);
  if (currentListings.length >= plan.maxActiveListings) {
    return {
      ok: false,
      error: `${plan.name} plan allows up to ${plan.maxActiveListings} active listing(s). Upgrade plan to publish more.`,
    };
  }
  if (store.monthlyPublicationsUsed >= plan.monthlyPublications) {
    return {
      ok: false,
      error: `Monthly publication allowance (${plan.monthlyPublications}) reached for ${plan.name} plan.`,
    };
  }

  const idNum = 107 + store.products.length;
  const seed = `nairascout-item-${idNum}`;
  const listing: ProductListing = {
    id: `LST-${idNum}`,
    productId: `PRD-${idNum}`,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priceKobo: Math.round(Math.max(500, input.priceNaira) * 100),
    deliveryFeeKobo: Math.round(Math.max(0, input.deliveryFeeNaira) * 100),
    stock: Math.max(1, Math.round(input.stock)),
    sellerScoutId: seller.id,
    sellerName: seller.displayName,
    sellerCity: seller.city,
    sellerVerified: seller.sellerVerified,
    imageSeed: seed,
    imageUrl: `https://picsum.photos/seed/${seed}/800/600`,
    daysRemaining: plan.listingDurationDays,
    specifications: ['Verified Seller listing', '10-day publication duration'],
    returnPolicy: 'Standard 7-day NairaScout return terms',
    warranty: 'Seller fulfilment guarantee',
    impressions: 1,
    referralShares: 0,
  };

  store.products.unshift(listing);
  store.monthlyPublicationsUsed += 1;
  return { ok: true, listing };
}

export function upgradeSellerPlan(planId: SellerPlanId): { ok: true } {
  const store = getStore();
  const seller = store.scouts[store.activeScoutId];
  seller.sellerPlan = planId;
  store.notifications.unshift({
    id: `NTF-${Date.now()}`,
    category: 'trust',
    title: `Seller plan updated to ${SELLER_PLANS[planId].name}`,
    body: `Monthly Seller subscription entitlements updated (separate from Scout referral commissions).`,
    createdAt: new Date().toISOString(),
    read: false,
  });
  return { ok: true };
}

export function updateInvitePolicy(policy: ScoutProfile['invitePolicy']): { ok: true } {
  const store = getStore();
  store.scouts[store.activeScoutId].invitePolicy = policy;
  return { ok: true };
}

export function submitSupportCase(input: {
  topic: SupportCase['topic'];
  subject: string;
  details: string;
}): { ok: true; supportCase: SupportCase } {
  const store = getStore();
  const supportCase: SupportCase = {
    id: `SUP-${Math.floor(1000 + Math.random() * 8999)}`,
    topic: input.topic,
    subject: input.subject.trim(),
    details: input.details.trim(),
    status: 'Under Review',
    createdAt: new Date().toISOString(),
  };
  store.supportCases.unshift(supportCase);
  return { ok: true, supportCase };
}
