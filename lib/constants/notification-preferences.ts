// NS-SCT-076 & NS-SCT-010: Notification preference groups & profile validation constants

export type NotificationCategoryCode =
  | 'ACCOUNT_SECURITY'
  | 'SCOUTS_LIST'
  | 'PRODUCT_REFERRALS'
  | 'PURCHASES_ORDERS'
  | 'COMMISSIONS'
  | 'WALLET_WITHDRAWALS'
  | 'PLATFORM_ANNOUNCEMENTS'
  | 'RESTRICTIONS_VERIFICATION';

export interface NotificationPreferenceGroupMeta {
  categoryCode: NotificationCategoryCode;
  label: string;
  description: string;
  isEssential: boolean;
}

export const NOTIFICATION_PREFERENCE_GROUPS: NotificationPreferenceGroupMeta[] = [
  {
    categoryCode: 'ACCOUNT_SECURITY',
    label: 'Account & Security',
    description: 'Password changes, email updates, 2FA activity, and new device security alerts.',
    isEssential: true,
  },
  {
    categoryCode: 'SCOUTS_LIST',
    label: 'Scouts List',
    description: 'Incoming Scouts List invitations, acceptances, and contact updates.',
    isEssential: false,
  },
  {
    categoryCode: 'PRODUCT_REFERRALS',
    label: 'Product Referrals',
    description: 'New product referral cards received, opened, or approaching expiry.',
    isEssential: false,
  },
  {
    categoryCode: 'PURCHASES_ORDERS',
    label: 'Purchases & Orders',
    description: 'Order confirmations, fulfilment progress, delivery updates, and disputes.',
    isEssential: true,
  },
  {
    categoryCode: 'COMMISSIONS',
    label: 'Commissions',
    description: 'Pending referral commissions earned, released to available, or adjusted.',
    isEssential: false,
  },
  {
    categoryCode: 'WALLET_WITHDRAWALS',
    label: 'Wallet & Withdrawals',
    description: 'Withdrawal requests, 15th-of-month payout batch status, and cooling-off notices.',
    isEssential: true,
  },
  {
    categoryCode: 'PLATFORM_ANNOUNCEMENTS',
    label: 'Platform Announcements',
    description: 'Programme rule updates, policy changes, and seasonal marketplace notices.',
    isEssential: false,
  },
  {
    categoryCode: 'RESTRICTIONS_VERIFICATION',
    label: 'Restrictions & Verification',
    description: 'KYC/Seller verification decisions, capability restrictions, and appeal outcomes.',
    isEssential: true,
  },
];

export const ESSENTIAL_NOTIFICATION_CODES = new Set<NotificationCategoryCode>(
  NOTIFICATION_PREFERENCE_GROUPS.filter((g) => g.isEssential).map((g) => g.categoryCode)
);

// NS-SCT-010: Anti-impersonation reserved terms blocked in display names and usernames
export const RESERVED_IMPERSONATION_TERMS = [
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

export const SCOUT_BIO_MAX_LENGTH = 250;

export function containsReservedImpersonationTerm(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  for (const term of RESERVED_IMPERSONATION_TERMS) {
    if (normalized.includes(term.replace(/_/g, '')) || value.toLowerCase().includes(term)) {
      return term;
    }
  }
  return null;
}
