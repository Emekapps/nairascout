import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// 1. ENUMS (Decoupled State Dimensions per Blueprint Part B)
// ============================================================================

export const accountStatusEnum = pgEnum('account_status', [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'RESTRICTED',
  'SUSPENDED',
  'CLOSED',
]);

export const sellerTypeEnum = pgEnum('seller_type', ['INDIVIDUAL', 'BUSINESS']);

export const sellerStatusEnum = pgEnum('seller_status', [
  'ONBOARDING',
  'ACTIVE',
  'RESTRICTED',
  'SUSPENDED',
]);

export const verificationCategoryEnum = pgEnum('verification_category', [
  'CONTACT',
  'IDENTITY',
  'BUSINESS',
  'SELLER',
  'PAYOUT_BANK',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'NOT_SUBMITTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ACTION_REQUIRED',
  'SUSPENDED',
]);

export const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'STARTER',
  'TRACTION',
  'GROWTH',
  'SPRAWL',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
]);

export const invitationPolicyEnum = pgEnum('invitation_policy', [
  'EVERYONE',
  'CONTACTS_ONLY',
  'NOBODY',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
]);

export const teamRoleEnum = pgEnum('team_role', [
  'BUSINESS_OWNER',
  'BUSINESS_ADMIN',
  'TEAM_MEMBER',
]);

export const teamMemberStatusEnum = pgEnum('team_member_status', [
  'INVITED',
  'ACTIVE',
  'REVOKED',
]);

export const adminRoleEnum = pgEnum('admin_role', [
  'SUPER_ADMIN',
  'VERIFICATION_OFFICER',
  'FINANCE_OPS',
  'TRUST_AND_SAFETY',
  'SUPPORT_AGENT',
]);

export const abuseReportStatusEnum = pgEnum('abuse_report_status', [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
]);

// ============================================================================
// 2. PRIMARY IDENTITY, SCOUT PROFILE & PERMANENT REFERRAL ANCESTRY
// ============================================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone').unique(),
  accountStatus: accountStatusEnum('account_status').default('ACTIVE').notNull(),
  restrictionReason: text('restriction_reason'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scoutProfiles = pgTable('scout_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'restrict' }),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  locationState: text('location_state'),
  preferredCategories: jsonb('preferred_categories').$type<string[]>().default([]).notNull(),
  invitationPolicy: invitationPolicyEnum('invitation_policy').default('EVERYONE').notNull(),
  muteReferrals: boolean('mute_referrals').default(false).notNull(),
  profileVisibility: text('profile_visibility').default('PUBLIC').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const referralAncestry = pgTable(
  'referral_ancestry',
  {
    scoutUserId: uuid('scout_user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'restrict' }),
    directReferrerId: uuid('direct_referrer_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    attributionSource: text('attribution_source').notNull(),
    referralEventId: uuid('referral_event_id'),
    lockedAt: timestamp('locked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('no_self_referral', sql`${table.scoutUserId} <> ${table.directReferrerId}`),
  ]
);

// ============================================================================
// 3. SELLER PROFILES, BUSINESS TEAM MEMBERS & VERIFICATION RECORDS
// ============================================================================

export const sellerProfiles = pgTable('seller_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  sellerType: sellerTypeEnum('seller_type').notNull(),
  sellerName: text('seller_name').notNull(),
  description: text('description'),
  businessCategory: text('business_category'),
  businessRegNumber: text('business_reg_number'),
  businessAddress: text('business_address'),
  businessContactEmail: text('business_contact_email'),
  businessContactPhone: text('business_contact_phone'),
  sellerStatus: sellerStatusEnum('seller_status').default('ONBOARDING').notNull(),
  subscriptionPlan: subscriptionPlanEnum('subscription_plan').default('STARTER').notNull(),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').default('ACTIVE').notNull(),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export interface SellerTeamPermissions {
  canManageListings: boolean;
  canManageOrders: boolean;
  canViewAnalytics: boolean;
  canManageBilling: boolean;
  canManageTeam: boolean;
}

export const sellerTeamMembers = pgTable(
  'seller_team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerProfileId: uuid('seller_profile_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    role: teamRoleEnum('role').notNull(),
    permissions: jsonb('permissions').$type<SellerTeamPermissions>().notNull(),
    status: teamMemberStatusEnum('status').default('ACTIVE').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('unique_active_team_member')
      .on(table.sellerProfileId, table.userId)
      .where(sql`${table.status} = 'ACTIVE'`),
  ]
);

export const verificationRecords = pgTable('verification_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  sellerProfileId: uuid('seller_profile_id').references(() => sellerProfiles.id, {
    onDelete: 'restrict',
  }),
  category: verificationCategoryEnum('category').notNull(),
  status: verificationStatusEnum('status').default('NOT_SUBMITTED').notNull(),
  evidencePaths: jsonb('evidence_paths').$type<string[]>().default([]).notNull(),
  reviewerNotes: text('reviewer_notes'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 4. SCOUTS LIST CONTACTS, INVITATIONS, BLOCKS & ABUSE REPORTS
// ============================================================================

export const scoutsListInvitations = pgTable(
  'scouts_list_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: invitationStatusEnum('status').default('PENDING').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (table) => [
    check('no_self_invite', sql`${table.senderId} <> ${table.recipientId}`),
  ]
);

export const scoutsListContacts = pgTable(
  'scouts_list_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contactUserId: uuid('contact_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceInvitationId: uuid('source_invitation_id').references(
      () => scoutsListInvitations.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unique_scout_contact_pair').on(table.ownerUserId, table.contactUserId),
  ]
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })]
);

export const abuseReports = pgTable('abuse_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  reportedUserId: uuid('reported_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  referralEventId: uuid('referral_event_id'),
  reason: text('reason').notNull(),
  description: text('description').notNull(),
  status: abuseReportStatusEnum('status').default('OPEN').notNull(),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// ============================================================================
// 5. PLATFORM ADMIN ROLES & IMMUTABLE AUDIT LOGS
// ============================================================================

export const platformAdminRoles = pgTable('platform_admin_roles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  adminRole: adminRoleEnum('admin_role').notNull(),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'restrict' }),
  affectedUserId: uuid('affected_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  reason: text('reason'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
