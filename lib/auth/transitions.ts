export type AccountStatus =
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'CLOSURE_PENDING'
  | 'CLOSED';

export type SellerStatus =
  | 'NOT_ACTIVATED'
  | 'ACTIVATION_PENDING'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'CLOSURE_PENDING'
  | 'CLOSED';

export type VerificationStatus =
  | 'NOT_STARTED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED';

export type SubscriptionStatus =
  | 'NOT_SUBSCRIBED'
  | 'PAYMENT_PENDING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLATION_SCHEDULED'
  | 'EXPIRED'
  | 'CANCELLED';

const ACCOUNT_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  PENDING_ACTIVATION: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['RESTRICTED', 'SUSPENDED', 'CLOSURE_PENDING'],
  RESTRICTED: ['ACTIVE', 'SUSPENDED', 'CLOSURE_PENDING'],
  SUSPENDED: ['ACTIVE', 'RESTRICTED', 'CLOSURE_PENDING'],
  CLOSURE_PENDING: ['CLOSED', 'ACTIVE'],
  CLOSED: [],
};

const SELLER_TRANSITIONS: Record<SellerStatus, SellerStatus[]> = {
  NOT_ACTIVATED: ['ACTIVATION_PENDING'],
  ACTIVATION_PENDING: ['ACTIVE', 'NOT_ACTIVATED', 'CLOSURE_PENDING'],
  ACTIVE: ['RESTRICTED', 'SUSPENDED', 'CLOSURE_PENDING'],
  RESTRICTED: ['ACTIVE', 'SUSPENDED', 'CLOSURE_PENDING'],
  SUSPENDED: ['ACTIVE', 'RESTRICTED', 'CLOSURE_PENDING'],
  CLOSURE_PENDING: ['CLOSED', 'ACTIVE'],
  CLOSED: [],
};

const VERIFICATION_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  NOT_STARTED: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['ACTION_REQUIRED', 'VERIFIED', 'REJECTED'],
  ACTION_REQUIRED: ['SUBMITTED', 'UNDER_REVIEW', 'REJECTED'],
  VERIFIED: ['EXPIRED', 'REVOKED'],
  REJECTED: ['SUBMITTED'],
  EXPIRED: ['SUBMITTED'],
  REVOKED: ['SUBMITTED'],
};

const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  NOT_SUBSCRIBED: ['PAYMENT_PENDING', 'ACTIVE'],
  PAYMENT_PENDING: ['ACTIVE', 'NOT_SUBSCRIBED', 'EXPIRED'],
  ACTIVE: ['PAST_DUE', 'CANCELLATION_SCHEDULED', 'SUSPENDED', 'EXPIRED'],
  PAST_DUE: ['GRACE_PERIOD', 'ACTIVE', 'EXPIRED'],
  GRACE_PERIOD: ['ACTIVE', 'EXPIRED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLATION_SCHEDULED: ['CANCELLED', 'ACTIVE'],
  EXPIRED: ['PAYMENT_PENDING', 'ACTIVE'],
  CANCELLED: ['PAYMENT_PENDING', 'ACTIVE'],
};

export class InvalidTransitionError extends Error {
  public readonly statusCode = 409;
  public readonly code = 'INVALID_STATUS_TRANSITION';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export function assertValidTransition<T extends string>(
  map: Record<T, T[]>,
  from: T,
  to: T,
  domain: string
): void {
  if (!map[from]?.includes(to)) {
    throw new InvalidTransitionError(`Invalid ${domain} status transition: ${from} -> ${to}`);
  }
}

export const transitions = {
  account: (from: AccountStatus, to: AccountStatus) =>
    assertValidTransition(ACCOUNT_TRANSITIONS, from, to, 'Account'),
  seller: (from: SellerStatus, to: SellerStatus) =>
    assertValidTransition(SELLER_TRANSITIONS, from, to, 'Seller'),
  verification: (from: VerificationStatus, to: VerificationStatus) =>
    assertValidTransition(VERIFICATION_TRANSITIONS, from, to, 'Verification'),
  subscription: (from: SubscriptionStatus, to: SubscriptionStatus) =>
    assertValidTransition(SUBSCRIPTION_TRANSITIONS, from, to, 'Subscription'),
};

/**
 * Normalizes pre-Module-3 database enum values cleanly to the canonical vocabularies.
 */
export function normalizeAccountStatus(raw: string | null | undefined): AccountStatus {
  if (raw === 'PENDING_VERIFICATION') return 'PENDING_ACTIVATION';
  if (
    raw === 'PENDING_ACTIVATION' ||
    raw === 'ACTIVE' ||
    raw === 'RESTRICTED' ||
    raw === 'SUSPENDED' ||
    raw === 'CLOSURE_PENDING' ||
    raw === 'CLOSED'
  ) {
    return raw;
  }
  return 'ACTIVE';
}

export function normalizeSellerStatus(raw: string | null | undefined): SellerStatus {
  if (raw === 'ONBOARDING') return 'ACTIVATION_PENDING';
  if (
    raw === 'NOT_ACTIVATED' ||
    raw === 'ACTIVATION_PENDING' ||
    raw === 'ACTIVE' ||
    raw === 'RESTRICTED' ||
    raw === 'SUSPENDED' ||
    raw === 'CLOSURE_PENDING' ||
    raw === 'CLOSED'
  ) {
    return raw;
  }
  return 'NOT_ACTIVATED';
}

export function normalizeVerificationStatus(raw: string | null | undefined): VerificationStatus {
  switch (raw) {
    case 'NOT_SUBMITTED':
      return 'NOT_STARTED';
    case 'PENDING':
      return 'SUBMITTED';
    case 'APPROVED':
      return 'VERIFIED';
    case 'SUSPENDED':
      return 'REVOKED';
    case 'NOT_STARTED':
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'ACTION_REQUIRED':
    case 'VERIFIED':
    case 'REJECTED':
    case 'EXPIRED':
    case 'REVOKED':
      return raw;
    default:
      return 'NOT_STARTED';
  }
}

export function normalizeSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  if (
    raw === 'NOT_SUBSCRIBED' ||
    raw === 'PAYMENT_PENDING' ||
    raw === 'ACTIVE' ||
    raw === 'PAST_DUE' ||
    raw === 'GRACE_PERIOD' ||
    raw === 'SUSPENDED' ||
    raw === 'CANCELLATION_SCHEDULED' ||
    raw === 'EXPIRED' ||
    raw === 'CANCELLED'
  ) {
    return raw;
  }
  return 'NOT_SUBSCRIBED';
}
