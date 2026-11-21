# IMPLEMENTATION PRD & CODE SPECIFICATION: USER ACCOUNTS, ROLES & PERMISSIONS

**Document Version:** 1.1 (Self-Contained for Google AI Studio)  
**Target Codebase:** `nairascout-main` (Next.js App Router, TypeScript, Tailwind CSS)  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth, Supabase PostgreSQL & Storage, Drizzle ORM  
**Governing Sources:** NairaScout Concept Development v4.0 & NairaScout Blueprint Part B  

---

## 1. Instructions for the Google AI Studio Coding Agent

1. **Create the Two Core Files First:** Create `lib/db/schema.ts` and `lib/auth/rbac.ts` using the exact TypeScript code provided in **Section 6** and **Section 7** of this document.
2. **Audit Existing Code:** Inspect `app/page.tsx`, `app/api/nairascout/route.ts`, `lib/nairascout-store.ts`, `lib/commission-engine.ts`, and `components/*`. Reuse existing layouts and UI components.
3. **Preserve Existing UI & Commission Logic:** Keep `lib/commission-engine.ts` and the visual structure of `MarketplaceView`, `ReferralsView`, `NetworkView`, `SellerHubView`, and `WalletView` intact while replacing mock user switching with real **Supabase Auth + PostgreSQL (Drizzle ORM)** sessions.
4. **Server-Side Enforcement First:** Never rely solely on hiding buttons in the UI. Enforce all account states, Seller verification gates, subscription plan limits, and privacy filters in Server Actions, Route Handlers, and PostgreSQL queries.

---

## 2. Five Non-Negotiable Architectural Rules

1. **One User, One Primary Identity:** Every registered individual has exactly one primary `users` record matching their Supabase `auth.users.id`. Activating Seller capabilities attaches a `seller_profiles` record (or business team membership) to that same identity—never a second unrelated account.
2. **Scout-First Participation:** Every newly registered user automatically receives a free **Scout Account** (`scout_profiles`). No payment, Seller subscription, personal purchase, or recruitment quota is required to participate in referral marketing or earn commissions.
3. **Decoupled Status Dimensions:** Keep these four state machines strictly separate in `lib/db/schema.ts` so restricting one does not break unrelated capabilities:
   * `accountStatus` (`PENDING_VERIFICATION`, `ACTIVE`, `RESTRICTED`, `SUSPENDED`, `CLOSED`)
   * `sellerStatus` (`ONBOARDING`, `ACTIVE`, `RESTRICTED`, `SUSPENDED`)
   * `verificationStatus` per category (`NOT_SUBMITTED`, `PENDING`, `APPROVED`, `REJECTED`, `ACTION_REQUIRED`, `SUSPENDED`)
   * `subscriptionPlan` (`STARTER`, `TRACTION`, `GROWTH`, `SPRAWL`) and `subscriptionStatus` (`ACTIVE`, `EXPIRED`, `CANCELLED`)
4. **Mandatory Verification Before First Publication:** A Seller may create and edit **Draft** listings during onboarding, but **cannot publish** any listing until their `SELLER` verification record status is `APPROVED`.
5. **Immutable Historical Continuity:** Voluntary account closure or suspension must **never** delete `users`, `referral_ancestry`, `referral_events`, or financial ledger records.

---

## 3. Component-by-Component Upgrade Plan for `nairascout-main`

### 3.1 Authentication & Guest Checkout Attribution (`HeaderNav.tsx` + `CheckoutDrawer.tsx`)
* **Replace Demo User Switcher:** Update `HeaderNav.tsx` and `NairaScoutApp.tsx` to read the real authenticated Supabase session (`user`, `scoutProfile`, `sellerProfile`, `verificationStatus`, `adminRole`).
* **Registration Flow (`/auth/login`, `/auth/register`):**
  * Capture any referral attribution cookie (`ns_ref_event` / `ns_ref_scout`) set when visiting a product referral link.
  * On first signup/login, atomically provision `users`, `scoutProfiles`, `referralAncestry`, and initial wallet.
* **Email OTP in `CheckoutDrawer.tsx`:**
  * If an unauthenticated external buyer clicks **BUY** on a referral card, render an inline **Email OTP Verification** step inside `CheckoutDrawer.tsx`.
  * Upon OTP verification, provision/authenticate the user and preserve the checkout session's exact `referralEventId` so `lib/commission-engine.ts` credits the right product referral chain.

### 3.2 Seller Onboarding & Mandatory Verification Gate (`SellerHubView.tsx`)
* **Seller Activation Wizard:** Inside `SellerHubView.tsx`, if the logged-in Scout has no `sellerProfiles` record, render the **Activate Seller Capabilities** flow:
  1. Choose `INDIVIDUAL` or `BUSINESS`.
  2. Enter Seller profile and business registration details.
  3. Upload ID / CAC verification documents to a private Supabase Storage bucket (`verification-docs`).
  4. Select initial plan (`STARTER` free, `TRACTION` ₦4,500, `GROWTH` ₦35,000, `SPRAWL` ₦250,000) and accept Seller Terms.
* **Verification Gate Before First Publication:**
  * Allow Sellers in `PENDING` / `ACTION_REQUIRED` / `REJECTED` verification states to create and save **Draft** listings.
  * Disable the **Publish** button in `SellerHubView.tsx` and reject `POST /api/seller/listings/[id]/publish` with HTTP `403` using `assertCanPublishListing()` from `lib/auth/rbac.ts` unless `verificationRecords (category='SELLER').status === 'APPROVED'`.
* **Seller Badge Rule:**
  * Display the **Seller** badge on `MarketplaceView.tsx` product cards and `ReferProductModal.tsx` only when `sellerStatus === 'ACTIVE'`, and visually distinguish it from a KYC-approved indicator (`isSellerVerified`) so unverified Sellers are never misrepresented as verified.
* **Business Team Management Tab:**
  * Add a **Team** tab inside `SellerHubView.tsx` for `BUSINESS` Sellers (active on `SPRAWL` plan; locked with upgrade prompt on lower plans) enforced via `assertCanManageSellerTeam()`.

### 3.3 Scouts List & Relationship Controls (`NetworkView.tsx` + `ReferProductModal.tsx`)
* **Separate `INVITE` from `REFER`:**
  * In `NetworkView.tsx`, add a **Scouts List** tab with:
    * Scout search sanitized with `toPublicScoutProfileDTO()` (returning **only** `username`, `displayName`, `avatarUrl`, `locationState`, Seller badge, and aggregate `workingWithCount` and `totalSoldUnits`—never emails, phones, or balances).
    * **Send Invitation (`INVITE`)** button respecting `invitationPolicy` (`EVERYONE`, `CONTACTS_ONLY`, `NOBODY`) and `userBlocks`.
    * **Pending Invitations** sub-tabs: **Received** (`Accept` / `Reject`) and **Sent** (shows expiry timestamp + `Withdraw` button).
    * **Active Contacts** list with actions: **Refer a Product** (opens `ReferProductModal.tsx`), **Remove Contact**, **Block User**, and **Report Abuse**.
  * In `ReferProductModal.tsx`, block sending product referrals if the recipient blocked the sender or has `muteReferrals === true`.

### 3.4 Account Settings, Privacy & Voluntary Closure (`/settings`)
* Create a `/settings` page (linked from `HeaderNav.tsx`) with four tabs:
  1. **Profile:** Edit `displayName`, `username`, `bio`, `locationState`, `preferredCategories`.
  2. **Privacy & Referrals:** Configure `invitationPolicy`, `muteReferrals`, `profileVisibility`, and unblock users in `userBlocks`.
  3. **Verification & Banking:** View current status (`NOT_SUBMITTED`, `PENDING`, `APPROVED`, `ACTION_REQUIRED`, `REJECTED`) for Contact, Identity, Seller, and Payout Bank verification.
  4. **Account Lifecycle:** Execute **Close Account**—displays a confirmation dialog detailing open orders, pending commissions, and available wallet balance, then sets `accountStatus = 'CLOSED'`, revokes sessions, and **preserves `referralAncestry` and financial ledger rows intact**.

### 3.5 Admin Governance Console (`/admin`)
* Protect `/admin/*` pages and `/api/admin/*` routes using `assertAdminRole()` from `lib/auth/rbac.ts`:
  * **Verification Queue (`/admin/verifications`):** For `VERIFICATION_OFFICER` and `SUPER_ADMIN`. Generates 60-second signed Supabase Storage URLs to inspect ID/CAC docs and records `APPROVED`, `REJECTED`, or `ACTION_REQUIRED` decisions with mandatory notes in `auditLogs`.
  * **User & Trust Management (`/admin/users`):** For `TRUST_AND_SAFETY` and `SUPER_ADMIN`. Review `abuseReports`, apply proportionate restrictions (`sellerStatus = 'SUSPENDED'` vs `accountStatus = 'SUSPENDED'`), and place affected pending commissions `ON_HOLD` without deleting historical records.
  * **Audit Log Viewer (`/admin/audit-logs`):** Read-only filterable table of `auditLogs`.

---

## 4. Environment Variables (`.env.example`)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
SCOUTS_LIST_INVITATION_EXPIRY_DAYS=14
```

---

## 5. Verification Checklist (Definition of Done)

1. `npm run build` succeeds with zero TypeScript errors across `app/`, `components/`, and `lib/`.
2. Registering a new user creates `users`, `scoutProfiles`, and `referralAncestry` in a single atomic transaction.
3. Calling `POST /api/seller/listings/[id]/publish` before `SELLER` verification is `APPROVED` returns `403 Forbidden`.
4. Suspending `sellerStatus` blocks Seller endpoints while keeping Scout browsing, referral sharing, and wallet access functional.
5. Voluntary account closure sets `accountStatus = 'CLOSED'` without deleting rows from `referralAncestry` or financial ledger tables.

---

## 6. Exact Implementation File: `lib/db/schema.ts`

Create the file `lib/db/schema.ts` with the following exact contents:

```typescript
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
```

---

## 7. Exact Implementation File: `lib/auth/rbac.ts`

Create the file `lib/auth/rbac.ts` with the following exact contents:

```typescript
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
```
