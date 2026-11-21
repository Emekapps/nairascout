export const COMMISSION_RULE_VERSION = 'v4.0-13G-2026.11';

export interface ScheduleEntry {
  generation: number;
  numerator: number;
  denominator: number;
  label: string;
}

export interface AncestorNode {
  generation: number; // 1..13
  scoutId: string;
  handle: string;
  displayName: string;
  eligible: boolean;
  ineligibilityReason?: string;
}

export interface GenerationAllocation {
  generation: number;
  scoutId: string;
  handle: string;
  displayName: string;
  eligible: boolean;
  ineligibilityReason?: string;
  fractionLabel: string;
  numerator: number;
  denominator: number;
  amountKobo: number;
}

export interface CommissionBreakdown {
  ruleVersion: string;
  eligibleMerchandiseKobo: number;
  marketplaceCommissionRateBps: number; // 1000 = 10%
  marketplaceCommissionKobo: number;
  sellerProceedsKobo: number;
  referralPoolRateBps: number; // 2000 = 20% of marketplace commission
  referralPoolKobo: number;
  actualAncestryDepth: number;
  scheduleName: string;
  allocations: GenerationAllocation[];
  totalAllocatedKobo: number;
  undistributedRetainedKobo: number;
  nairaScoutNetRetainedKobo: number;
}

const SCHEDULE_DEPTH_1: ScheduleEntry[] = [
  { generation: 1, numerator: 1, denominator: 2, label: '1/2' },
];

const SCHEDULE_DEPTH_2: ScheduleEntry[] = [
  { generation: 1, numerator: 1, denominator: 4, label: '1/4' },
  { generation: 2, numerator: 1, denominator: 5, label: '1/5' },
];

const SCHEDULE_DEPTH_3: ScheduleEntry[] = [
  { generation: 1, numerator: 1, denominator: 5, label: '1/5' },
  { generation: 2, numerator: 1, denominator: 6, label: '1/6' },
  { generation: 3, numerator: 1, denominator: 10, label: '1/10' },
];

const SCHEDULE_DEPTH_4_TO_13: ScheduleEntry[] = [
  { generation: 1, numerator: 1, denominator: 6, label: '1/6' },
  { generation: 2, numerator: 1, denominator: 10, label: '1/10' },
  { generation: 3, numerator: 1, denominator: 20, label: '1/20' },
  { generation: 4, numerator: 1, denominator: 30, label: '1/30' },
  { generation: 5, numerator: 1, denominator: 40, label: '1/40' },
  { generation: 6, numerator: 1, denominator: 50, label: '1/50' },
  { generation: 7, numerator: 1, denominator: 60, label: '1/60' },
  { generation: 8, numerator: 1, denominator: 70, label: '1/70' },
  { generation: 9, numerator: 1, denominator: 80, label: '1/80' },
  { generation: 10, numerator: 1, denominator: 90, label: '1/90' },
  { generation: 11, numerator: 1, denominator: 100, label: '1/100' },
  { generation: 12, numerator: 1, denominator: 110, label: '1/110' },
  { generation: 13, numerator: 1, denominator: 120, label: '1/120' },
];

export function selectCommissionSchedule(actualDepth: number): {
  scheduleName: string;
  entries: ScheduleEntry[];
} {
  if (actualDepth <= 0) {
    return { scheduleName: 'No referral ancestry (Depth 0)', entries: [] };
  }
  if (actualDepth === 1) {
    return { scheduleName: '1-Generation Schedule', entries: SCHEDULE_DEPTH_1 };
  }
  if (actualDepth === 2) {
    return { scheduleName: '2-Generation Schedule', entries: SCHEDULE_DEPTH_2 };
  }
  if (actualDepth === 3) {
    return { scheduleName: '3-Generation Schedule', entries: SCHEDULE_DEPTH_3 };
  }
  return {
    scheduleName: 'Extended 4–13 Generation Schedule',
    entries: SCHEDULE_DEPTH_4_TO_13.slice(0, Math.min(actualDepth, 13)),
  };
}

/**
 * Exact integer kobo calculation for the NairaScout v4.0 13-Generation Referral Model.
 * - Marketplace commission = 10% of eligible merchandise revenue (after discounts/refunds, excluding delivery/taxes).
 * - Seller proceeds = 90% of eligible merchandise revenue.
 * - Referral pool = 20% of NairaScout's eligible marketplace commission revenue.
 * - Schedule is selected strictly by actual ancestry depth (1..13), NOT by eligible ancestor count.
 * - Ineligible ancestors receive 0 kobo; deeper ancestors are NEVER promoted to fill gaps.
 * - Individual allocations rounded to whole kobo; rounding residuals and unallocated portions remain with NairaScout.
 */
export function calculateThirteenGenerationCommissions(
  eligibleMerchandiseKobo: number,
  ancestry: AncestorNode[],
  isReferralAttributed: boolean
): CommissionBreakdown {
  const safeMerchKobo = Math.max(0, Math.round(eligibleMerchandiseKobo));
  // 10% marketplace commission in integer kobo
  const marketplaceCommissionKobo = Math.round(safeMerchKobo * 0.1);
  const sellerProceedsKobo = safeMerchKobo - marketplaceCommissionKobo;

  if (!isReferralAttributed) {
    return {
      ruleVersion: COMMISSION_RULE_VERSION,
      eligibleMerchandiseKobo: safeMerchKobo,
      marketplaceCommissionRateBps: 1000,
      marketplaceCommissionKobo,
      sellerProceedsKobo,
      referralPoolRateBps: 0,
      referralPoolKobo: 0,
      actualAncestryDepth: 0,
      scheduleName: 'Direct Marketplace Purchase (No Referral Commission)',
      allocations: [],
      totalAllocatedKobo: 0,
      undistributedRetainedKobo: 0,
      nairaScoutNetRetainedKobo: marketplaceCommissionKobo,
    };
  }

  // 20% of eligible marketplace commission revenue
  const referralPoolKobo = Math.round(marketplaceCommissionKobo * 0.2);

  // Deduplicate and enforce max 13 generations, ordered 1..13
  const cappedAncestry = [...ancestry]
    .filter((node) => node.generation >= 1 && node.generation <= 13)
    .sort((a, b) => a.generation - b.generation)
    .slice(0, 13);

  const actualAncestryDepth = cappedAncestry.length;
  const { scheduleName, entries } = selectCommissionSchedule(actualAncestryDepth);

  let runningTotalKobo = 0;
  const allocations: GenerationAllocation[] = entries.map((entry) => {
    const ancestor = cappedAncestry.find((a) => a.generation === entry.generation);
    if (!ancestor) {
      return {
        generation: entry.generation,
        scoutId: 'missing',
        handle: '—',
        displayName: 'Unassigned',
        eligible: false,
        ineligibilityReason: 'No ancestor recorded at this generation',
        fractionLabel: entry.label,
        numerator: entry.numerator,
        denominator: entry.denominator,
        amountKobo: 0,
      };
    }

    if (!ancestor.eligible) {
      return {
        generation: entry.generation,
        scoutId: ancestor.scoutId,
        handle: ancestor.handle,
        displayName: ancestor.displayName,
        eligible: false,
        ineligibilityReason: ancestor.ineligibilityReason || 'Account ineligible for this cycle',
        fractionLabel: entry.label,
        numerator: entry.numerator,
        denominator: entry.denominator,
        amountKobo: 0,
      };
    }

    const rawAmountKobo = Math.round((referralPoolKobo * entry.numerator) / entry.denominator);
    // Guarantee total allocations never exceed referralPoolKobo
    const boundedAmountKobo = Math.min(rawAmountKobo, Math.max(0, referralPoolKobo - runningTotalKobo));
    runningTotalKobo += boundedAmountKobo;

    return {
      generation: entry.generation,
      scoutId: ancestor.scoutId,
      handle: ancestor.handle,
      displayName: ancestor.displayName,
      eligible: true,
      fractionLabel: entry.label,
      numerator: entry.numerator,
      denominator: entry.denominator,
      amountKobo: boundedAmountKobo,
    };
  });

  const undistributedRetainedKobo = Math.max(0, referralPoolKobo - runningTotalKobo);
  const nairaScoutNetRetainedKobo = marketplaceCommissionKobo - runningTotalKobo;

  return {
    ruleVersion: COMMISSION_RULE_VERSION,
    eligibleMerchandiseKobo: safeMerchKobo,
    marketplaceCommissionRateBps: 1000,
    marketplaceCommissionKobo,
    sellerProceedsKobo,
    referralPoolRateBps: 2000,
    referralPoolKobo,
    actualAncestryDepth,
    scheduleName,
    allocations,
    totalAllocatedKobo: runningTotalKobo,
    undistributedRetainedKobo,
    nairaScoutNetRetainedKobo,
  };
}

/**
 * Validates that adding a direct referrer does not create self-referral or circular ancestry.
 */
export function validateAncestryRelationship(
  scoutId: string,
  proposedDirectReferrerId: string,
  directReferrerMap: Record<string, string | null>
): { valid: boolean; reason?: string } {
  if (scoutId === proposedDirectReferrerId) {
    return { valid: false, reason: 'Self-referral is prohibited.' };
  }

  const visited = new Set<string>([scoutId]);
  let current: string | null | undefined = proposedDirectReferrerId;
  let hops = 0;

  while (current && hops < 50) {
    if (visited.has(current)) {
      return { valid: false, reason: 'Circular referral ancestry detected and rejected.' };
    }
    visited.add(current);
    current = directReferrerMap[current] ?? null;
    hops += 1;
  }

  return { valid: true };
}

export function formatKoboToNaira(kobo: number): string {
  const isNegative = kobo < 0;
  const absKobo = Math.abs(Math.round(kobo));
  const naira = absKobo / 100;
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
  return `${isNegative ? '-' : ''}₦${formatted}`;
}

export function formatWholeNaira(kobo: number): string {
  const naira = Math.round(kobo / 100);
  return `₦${new Intl.NumberFormat('en-NG').format(naira)}`;
}
