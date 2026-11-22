# NAIRASCOUT — CONSOLIDATED PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module 3 & Blueprint Part B: User Types, Accounts, Roles, Permissions & Governance Controls

**Document Version:** 3.0 (Consolidated Baseline + Approved Review Decisions)  
**Target Codebase:** `nairascout-main` (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth, Supabase PostgreSQL & Storage, Drizzle ORM, TanStack Query)  
**Governing Authorities:** NairaScout Concept Development v4.0, Blueprint Part B, and Module 3 PRD & Review Decisions

---

## 1. Instructions for the AI Coding Agent

1. **Incremental Upgrade Over Existing Live Codebase:**
   * `nairascout-main` is already connected to live Supabase Auth (`@supabase/ssr`) and Supabase PostgreSQL (`DATABASE_URL` via Transaction Pooler).
   * Do **not** recreate existing tables destructively or delete existing user, referral ancestry, or ledger data. Apply the non-destructive schema upgrades in Section 6 and Section 9.
2. **Strict Separation of 7 Identity & Lifecycle Dimensions:**
   * Never collapse user identity, participation roles, permissions, account status, Seller status, verification status, or subscription status into a single boolean or enum.
   * A single human user has **one primary identity** (`public.users`) and may act simultaneously as Scout, Buyer, Seller, Seller Team Member, or Platform Administrator without creating duplicate accounts.
3. **Fail-Secure Server-Side Enforcement:**
   * Hiding UI buttons is purely cosmetic. Every protected action must be authorized on the server (Next.js Server Actions / Route Handlers) and reinforced by PostgreSQL Row-Level Security (RLS).
   * If role data, status, ownership, or subscription state cannot be verified, **deny by default**.

---

## 2. Core Architectural Principles & Approved Decisions

1. **One User, One Primary Identity:** Every registered human user has one `users` row (`auth.users.id`) and automatically receives a free **Scout Account** (`scout_profiles`) plus an immutable **13-generation ancestry anchor** (`referral_ancestry`).
2. **Decoupled 4-Axis Status Vocabularies:**
   * **Account Status (6 states):** `PENDING_ACTIVATION`, `ACTIVE`, `RESTRICTED`, `SUSPENDED`, `CLOSURE_PENDING`, `CLOSED` *(no `DEACTIVATED` status)*.
   * **Seller Status (7 states):** `NOT_ACTIVATED`, `ACTIVATION_PENDING`, `ACTIVE`, `RESTRICTED`, `SUSPENDED`, `CLOSURE_PENDING`, `CLOSED` *(verification states are strictly excluded from Seller status)*.
   * **Verification Status (8 states):** `NOT_STARTED`, `SUBMITTED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `VERIFIED`, `REJECTED`, `EXPIRED`, `REVOKED`.
   * **Subscription Status (9 states):** `NOT_SUBSCRIBED`, `PAYMENT_PENDING`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD` (7 calendar days), `SUSPENDED`, `CANCELLATION_SCHEDULED`, `EXPIRED`, `CANCELLED`.
3. **Separation of Duties & Maker-Checker Dual Control:**
   * No user or officer may approve their own Seller verification, financial adjustment, or payout exception.
   * Appeals must be reviewed by an independent `APPEALS_OFFICER` or `SUPER_ADMIN` who did not make the original decision.
   * High-risk actions (manual commission adjustments, wallet corrections, exceptional payout releases, refund exceptions, platform role assignments, and ancestry overrides) require a **Maker-Checker** two-step approval workflow (`maker_checker_requests`).
4. **Two-Track Controlled Closure:**
   * **Seller Capability Closure** closes selling privileges (`seller_status = 'CLOSED'`) while keeping the user's Scout Account, Scouts List, wallet, and referral commissions active.
   * **Full Account Closure** transitions through `CLOSURE_PENDING` (assessing open orders, disputes, unfulfilled Seller obligations, and payable wallet balances) to `CLOSED`, revoking sessions while **preserving `referral_ancestry`, `referral_events`, orders, and financial ledger entries intact**.

---

## 3. Complete Role & Permission Architecture

### 3.1 Participation Roles (Consumer & Commercial)
* **General Account Holder / Scout (Default on Registration):** Discovers products, manages Scouts List (`INVITE` vs `REFER`), sends product referrals (**max 20 recipients per referral operation**), earns commissions from qualifying purchases across 13 generations, and manages their Scout wallet.
* **Buyer:** Any eligible registered user (or guest completing Email OTP checkout) purchasing via Direct Marketplace or a Referral Card.
* **Seller:** A Scout who activates Seller capabilities (`INDIVIDUAL` or `BUSINESS`). Must achieve `VERIFIED` verification status before publishing their first listing.

### 3.2 Seller Team Roles (Isolated Seller Namespace — Sprawl Plan: Max 5 Seats)
Seller team roles apply **only** to the assigned `seller_profiles` business entity and never grant platform administrative access:
* `BUSINESS_OWNER`: Full business control, payout settings, team management, listings, orders, and analytics.
* `BUSINESS_ADMIN`: Manages listings, orders, analytics, and team invitations (cannot transfer business ownership or alter settlement bank details).
* `PRODUCT_MANAGER`: Creates, edits, and manages product listings and stock within plan limits.
* `ORDER_MANAGER`: Views orders, updates fulfilment statuses, uploads delivery evidence, and responds to returns.
* `FINANCE_MANAGER`: Views Seller revenue, commission expenses, refunds, and payout reports (read-only on authoritative ledger).
* `ANALYST_VIEWER`: Read-only access to business sales and referral analytics.

### 3.3 Platform Administrative & Operational Roles (Least Privilege)
* `SUPER_ADMIN`: Critical configuration, emergency intervention, role administration (all actions logged; subject to maker-checker on sensitive financial/ancestry changes).
* `PLATFORM_ADMIN`: General user and Seller account administration, listing oversight, escalation.
* `VERIFICATION_OFFICER`: Reviews Seller identity/business evidence; sets `UNDER_REVIEW`, `ACTION_REQUIRED`, `VERIFIED`, or `REJECTED` (blocked from self-approval).
* `TRUST_AND_SAFETY`: Investigates abuse reports and fraud signals; applies proportionate capability/role/account restrictions or suspensions.
* `APPEALS_OFFICER`: Reviews appeals against verification rejections, restrictions, and disputes (enforces independent reviewer rule).
* `FINANCE_OFFICER`: Monitors payouts, withdrawals, commission calculations, and reconciliation; initiates maker-checker financial adjustments.
* `SUPPORT_OFFICER`: Views support cases and permitted order/account summaries; escalates issues (zero ledger mutation or refund-override rights).
* `OPERATIONS_MANAGER`: Monitors operational queues, fulfilment SLA alerts, and workflow coordination.
* `ANALYST_VIEWER`: Read-only aggregate reporting and analytics (no PII export or mutation rights).
* `SYSTEM_SERVICE`: Non-human scoped identities for webhooks, subscription grace-period checks, and scheduled jobs.

---

## 4. Seller Subscription Plans & Entitlements (Part C + Module 3.3.5)

| Capability | Starter (Free) | Traction (₦4,500/mo) | Growth (₦35,000/mo) | Sprawl (₦250,000/mo) |
| :--- | :--- | :--- | :--- | :--- |
| **Max Active Listings** | 1 | 3 | 5 | 20 |
| **Monthly Publications** | 3 | 10 | 25 | 100 |
| **Product Categories** | 1 | 3 | 10 | All Categories |
| **Listing Duration** | 10 days | 10 days | 10 days | 10 days |
| **Images per Listing** | 6 | 6 | 6 | 6 |
| **Video per Listing** | None | 1 (60s, 30MB) | 3 (120s, 100MB) | 5 (180s, 1GB) |
| **Team Member Seats** | 0 | 0 | 0 | Up to 5 seats |
| **Promotional Placements** | No | No | Yes | Yes |

* **Grace Period & Downgrade Rules:**
  * Failed renewals move `ACTIVE` -> `PAST_DUE` -> `GRACE_PERIOD` (7 calendar days).
  * When `GRACE_PERIOD` ends without payment -> `EXPIRED`, downgrading effective entitlements to `STARTER`.
  * Excess active listings above the downgraded cap are **suspended (not deleted)** and historical records remain intact.

---

## 5. Deterministic Status-Transition Guards (`lib/auth/transitions.ts`)

Create `lib/auth/transitions.ts` to validate every status transition before writing to PostgreSQL and append an immutable `audit_logs` record on every change:

```typescript
export type AccountStatus =
  | 'PENDING_ACTIVATION' | 'ACTIVE' | 'RESTRICTED'
  | 'SUSPENDED' | 'CLOSURE_PENDING' | 'CLOSED';

export type SellerStatus =
  | 'NOT_ACTIVATED' | 'ACTIVATION_PENDING' | 'ACTIVE'
  | 'RESTRICTED' | 'SUSPENDED' | 'CLOSURE_PENDING' | 'CLOSED';

export type VerificationStatus =
  | 'NOT_STARTED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACTION_REQUIRED'
  | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';

export type SubscriptionStatus =
  | 'NOT_SUBSCRIBED' | 'PAYMENT_PENDING' | 'ACTIVE' | 'PAST_DUE'
  | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLATION_SCHEDULED'
  | 'EXPIRED' | 'CANCELLED';

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
  ACTIVATION_PENDING: ['ACTIVE', 'NOT_ACTIVATED'],
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
  ACTION_REQUIRED: ['SUBMITTED', 'REJECTED'],
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

export function assertValidTransition<T extends string>(
  map: Record<T, T[]>,
  from: T,
  to: T,
  domain: string
): void {
  if (!map[from]?.includes(to)) {
    throw new Error(`Invalid ${domain} status transition: ${from} -> ${to}`);
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
```

---

## 6. Updated Drizzle Schema & RBAC Guards (`lib/db/schema.ts` & `lib/auth/rbac.ts`)

### 6.1 Key Schema Additions
* **`capability_restrictions`:** Granular capability/role/resource-level restrictions (`id`, `user_id`, `scope` [`ACCOUNT` | `ROLE` | `CAPABILITY` | `RESOURCE`], `capability_code` [`CREATE_REFERRAL` | `PUBLISH_LISTING` | `REQUEST_WITHDRAWAL` | `INITIATE_PURCHASE` | `MANAGE_TEAM`], `resource_id`, `reason`, `status` [`ACTIVE` | `LIFTED`], `imposed_by`, `expires_at`, `created_at`, `lifted_at`).
* **`maker_checker_requests`:** Dual-control approval queue (`id`, `action_type` [`COMMISSION_ADJUSTMENT` | `WALLET_CORRECTION` | `EXCEPTIONAL_PAYOUT` | `REFUND_EXCEPTION` | `ROLE_ASSIGNMENT` | `ANCESTRY_OVERRIDE` | `CRITICAL_CONFIG`], `target_user_id`, `target_entity_id`, `payload`, `reason`, `status` [`PENDING` | `APPROVED` | `REJECTED` | `EXECUTED`], `maker_id`, `checker_id`, `checker_notes`, `created_at`, `decided_at`).
  * *Constraint:* `maker_id <> checker_id` (the initiator cannot approve their own request).
* **`governance_appeals`:** Independent appeals workflow (`id`, `appellant_user_id`, `target_type` [`VERIFICATION` | `RESTRICTION` | `SUSPENSION` | `DISPUTE`], `target_record_id`, `original_reviewer_id`, `appeal_reason`, `evidence_paths`, `status` [`OPEN` | `UNDER_REVIEW` | `UPHELD` | `OVERTURNED`], `appeals_officer_id`, `decision_notes`, `created_at`, `resolved_at`).
  * *Constraint:* `appeals_officer_id <> original_reviewer_id`.

### 6.2 RBAC Server Guards (`lib/auth/rbac.ts`)
* `assertAccountOperational(user)`: Requires `account_status` in `['ACTIVE', 'RESTRICTED']` (denies `PENDING_ACTIVATION`, `SUSPENDED`, `CLOSURE_PENDING`, `CLOSED`).
* `assertCapabilityNotRestricted(userId, capabilityCode)`: Checks `capability_restrictions` for active locks before permitting referrals, withdrawals, listing publication, or purchases.
* `assertCanPublishListing(user, sellerProfile, verificationRecord, activeListingCount, monthlyPubCount)`:
  1. `user.accountStatus === 'ACTIVE'`
  2. `sellerProfile.sellerStatus === 'ACTIVE'`
  3. `verificationRecord.category === 'SELLER' && verificationRecord.status === 'VERIFIED'`
  4. No active `PUBLISH_LISTING` restriction
  5. `subscriptionStatus` in `['ACTIVE', 'GRACE_PERIOD', 'CANCELLATION_SCHEDULED']` (or `STARTER` plan)
  6. Active listings and monthly publications strictly within plan caps.
* `assertReferralBatchValid(senderId, recipientIds)`: Enforces `recipientIds.length >= 1 && recipientIds.length <= 20`, filters out blocked pairs (`user_blocks`), and checks `mute_referrals === false`.
* `assertCanReviewVerification(officerUserId, targetSellerOwnerId)`: Denies if `officerUserId === targetSellerOwnerId` (prevents self-approval).

---

## 7. UI & Workflow Upgrades Required

1. **Seller Hub (`components/SellerHubView.tsx`):**
   * Display decoupled **Seller Status Badge** (`ACTIVE`, `RESTRICTED`, `SUSPENDED`) separately from **Verification Badge** (`NOT_STARTED`, `SUBMITTED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `VERIFIED`, `REJECTED`, `EXPIRED`, `REVOKED`).
   * Allow draft listing creation during `SUBMITTED` / `UNDER_REVIEW` / `ACTION_REQUIRED`, while keeping **Publish** locked until `VERIFIED`.
   * Upgrade **Team** tab to support all 6 Seller Team Roles (`BUSINESS_OWNER`, `BUSINESS_ADMIN`, `PRODUCT_MANAGER`, `ORDER_MANAGER`, `FINANCE_MANAGER`, `ANALYST_VIEWER`) up to 5 seats on the `SPRAWL` plan.
2. **Referrals & Scouts List (`components/ReferProductModal.tsx` & `components/NetworkView.tsx`):**
   * Enforce and display a live counter **`Selected: X / 20 recipients`** in `ReferProductModal.tsx`.
   * Keep `INVITE` (Scouts List contact request) strictly separate from `REFER` (product referral event).
3. **Two-Track Account & Seller Closure (`/settings/closure`):**
   * Offer two distinct choices: **Close Seller Capabilities Only** (preserves Scout account & earnings) vs. **Close Entire NairaScout Account** (runs obligation check -> `CLOSURE_PENDING` -> `CLOSED`, preserving `referral_ancestry`, `referral_events`, and financial ledger records).
4. **Admin Governance Console (`/admin`):**
   * **Verifications Queue:** Enforces `officerId !== sellerOwnerId` and uses the 8-state verification workflow.
   * **Restrictions & Suspensions:** Allows applying granular `capability_restrictions` (`CREATE_REFERRAL`, `REQUEST_WITHDRAWAL`, `PUBLISH_LISTING`) or role-level `seller_status = 'SUSPENDED'` without disabling unrelated Scout actions.
   * **Maker-Checker Queue (`/admin/approvals`):** Lists pending sensitive requests where a second authorized officer approves or rejects.
   * **Appeals Desk (`/admin/appeals`):** Assigns appeals to an `APPEALS_OFFICER` independent of the original decision-maker.

---

## 8. Acceptance Criteria

1. [ ] All 4 status dimensions (`account_status`, `seller_status`, `verification_status`, `subscription_status`) operate independently and enforce valid state transitions via `lib/auth/transitions.ts`.
2. [ ] Unverified Sellers (`verification_status !== 'VERIFIED'`) can save drafts but receive `403 Forbidden` when attempting to publish a listing.
3. [ ] Suspending a Seller (`seller_status = 'SUSPENDED'`) leaves their Scout browsing, referral sharing, and wallet access functional.
4. [ ] Product referral modal and API reject batches exceeding **20 recipients**.
5. [ ] Verification officers cannot approve their own Seller applications, and appeals officers cannot review their own prior decisions.
6. [ ] Maker-Checker requests require two distinct authorized officers (`maker_id !== checker_id`) before executing sensitive financial or role changes.
7. [ ] Closing a Seller capability leaves the Scout account active; closing the full account transitions `CLOSURE_PENDING` -> `CLOSED` while preserving `referral_ancestry`, `referral_events`, and ledger rows.

---

## 9. Supabase PostgreSQL Delta Migration (Run in Supabase SQL Editor First)

```sql
-- ============================================================================
-- NAIRASCOUT MODULE 3 DELTA MIGRATION (Non-Destructive Upgrade)
-- Upgrades enums to the refined 4-axis lifecycle vocabularies & adds
-- capability_restrictions, maker_checker_requests, and governance_appeals.
-- ============================================================================

-- 1. Extend account_status enum with PENDING_ACTIVATION & CLOSURE_PENDING
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'CLOSURE_PENDING';

-- 2. Extend seller_status enum with NOT_ACTIVATED, ACTIVATION_PENDING, CLOSURE_PENDING, CLOSED
ALTER TYPE seller_status ADD VALUE IF NOT EXISTS 'NOT_ACTIVATED';
ALTER TYPE seller_status ADD VALUE IF NOT EXISTS 'ACTIVATION_PENDING';
ALTER TYPE seller_status ADD VALUE IF NOT EXISTS 'CLOSURE_PENDING';
ALTER TYPE seller_status ADD VALUE IF NOT EXISTS 'CLOSED';

-- 3. Extend verification_status enum with 8-state vocabulary
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'NOT_STARTED';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'REVOKED';

-- 4. Extend subscription_status enum with 9-state vocabulary
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'NOT_SUBSCRIBED';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'CANCELLATION_SCHEDULED';

-- 5. Extend admin_role enum with all 9 Platform & Operational roles
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'APPEALS_OFFICER';
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'FINANCE_OFFICER';
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'SUPPORT_OFFICER';
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'OPERATIONS_MANAGER';
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'ANALYST_VIEWER';

-- 6. Extend team_role enum with all 6 Seller-side business roles
ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'PRODUCT_MANAGER';
ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'ORDER_MANAGER';
ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER';
ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'ANALYST_VIEWER';

-- 7. Granular Capability / Role / Resource Restrictions
CREATE TABLE IF NOT EXISTS public.capability_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN ('ACCOUNT', 'ROLE', 'CAPABILITY', 'RESOURCE')),
  capability_code TEXT NOT NULL,
  resource_id UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LIFTED')),
  imposed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_capability_restrictions_user_active
  ON public.capability_restrictions(user_id) WHERE status = 'ACTIVE';

-- 8. Maker-Checker Dual-Control Approval Queue
CREATE TABLE IF NOT EXISTS public.maker_checker_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED')),
  maker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  checker_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  checker_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT maker_checker_distinct_officers CHECK (checker_id IS NULL OR maker_id <> checker_id)
);

-- 9. Independent Governance Appeals Table
CREATE TABLE IF NOT EXISTS public.governance_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appellant_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL CHECK (target_type IN ('VERIFICATION', 'RESTRICTION', 'SUSPENSION', 'DISPUTE')),
  target_record_id UUID NOT NULL,
  original_reviewer_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  appeal_reason TEXT NOT NULL,
  evidence_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED')),
  appeals_officer_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT independent_appeals_reviewer CHECK (
    appeals_officer_id IS NULL OR original_reviewer_id IS NULL OR appeals_officer_id <> original_reviewer_id
  )
);

ALTER TABLE public.capability_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maker_checker_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own active restrictions" ON public.capability_restrictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own appeals" ON public.governance_appeals
  FOR ALL USING (auth.uid() = appellant_user_id);
