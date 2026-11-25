# NAIRASCOUT — MODULE 2: PRODUCT FOUNDATION, COMPLIANCE TERMINOLOGY, PROGRAMME RULES & HELP CENTRE PRD
## Implementation Specification for Coding Agent

**Document Version:** 1.0  
**Module:** PRD Module 2 (Aligned with Approved Blueprint Part A)  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM, Supabase PostgreSQL  
**Requirement IDs:** `NS-FND-001` through `NS-FND-010`

---

## 1. Purpose & Objectives
Implement the foundational product positioning, compliance copy guardrails, dynamic **Programme Rules & Platform Boundaries** policies, and searchable **Help Centre / Knowledge Base** established in **Blueprint Part A** and **PRD Module 2**:
1. Purge any prohibited `"escrow"` terminology across the UI and codebase (`NS-FND-001`).
2. Align brand messaging, tagline (`"No earning limits."`), and non-guarantee earnings disclaimers across user-facing surfaces (`NS-FND-002`).
3. Create database-backed, versioned **Platform Policies** (`public.platform_policies`) and **Help Centre Articles** (`public.help_articles`) with RLS and Super Admin management (`NS-FND-003`, `NS-FND-004`).
4. Build the mobile-first **Programme Rules & Trust Guide** and **Help Centre** pages/drawers accessible from the footer, Trust & Guide menu, and Account settings (`NS-FND-005`, `NS-FND-006`).

---

## 2. Mandatory Compliance Copy Audit & Terminology Cleanup (`NS-FND-001`)
Search the entire codebase (`app/`, `components/`, `lib/`) and apply these strict replacements:
1. **Remove All "Escrow" References (`Blueprint A7.8, A12; Module 2.8.6, 2.11.10`):**
   * Replace any occurrence of `"escrow"`, `"Escrow"`, `"Pending Escrow"`, or `"held in escrow"` with **`"Pending Settlement"`**, **`"Pending Release"`**, or **`"Pending Commission"`** as contextually appropriate.
   * Add an explicit transparency note in the Wallet and Programme Rules views: *"NairaScout maintains internal platform accounting records for pending orders and commissions. NairaScout is not a bank, deposit-taking institution, or licensed escrow provider."*
2. **Standardize Earnings Non-Guarantee Disclaimer (`Module 2.2.4(5), 2.11.6`):**
   * Ensure the Referral Card bottom sheet, Commission Calculator, and Wallet include clear, accurate disclosure: *"Commissions are earned strictly from genuine, completed, non-reversed qualifying purchases attributed under NairaScout rules. Sending a referral or building a network does not guarantee purchases or income."*
3. **Standardize Approved Tagline & Value Proposition (`Blueprint A2.1; Module 2.2.1`):**
   * Primary tagline: **"No earning limits."**
   * Primary hook: **"Earn way more from people in your referral network who find buyers for products you recommend."**

---

## 3. Database Schema (`lib/db/schema.ts` — Drizzle ORM)

Add the following two tables to `lib/db/schema.ts` (matching the SQL migration in `nairascout_module2_kb_policies.sql`):

```typescript
// NS-FND-003: Versioned Platform Policies & Programme Rules
export const platformPolicies = pgTable('platform_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(), // e.g., 'programme-rules', 'platform-boundaries', 'consumer-notice'
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  version: text('version').notNull().default('1.0.0'),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).defaultNow().notNull(),
  isPublished: boolean('is_published').default(true).notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// NS-FND-004: Searchable Help Centre & Knowledge Base Articles
export const helpArticles = pgTable('help_articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  category: text('category').notNull(), // 'GETTING_STARTED' | 'SCOUTS_REFERRALS' | 'BUYERS_ORDERS' | 'SELLERS_PLANS' | 'WALLET_PAYOUTS' | 'TRUST_SAFETY'
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  bodyMarkdown: text('body_markdown').notNull(),
  audienceRole: text('audience_role').notNull().default('ALL'), // 'ALL' | 'SCOUT' | 'BUYER' | 'SELLER'
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

## 4. UI Pages & Components to Build

### 4.1 Help Centre & Knowledge Base Page (`/help` & `components/trust/HelpCentreView.tsx`) — `NS-FND-005`
* **Mobile-First Layout:**
  * Header back link (`← Back to Home`) + page heading **`"Help Centre"`** (`Plus Jakarta Sans`).
  * **Instant Search Input:** Filters published `help_articles` by title, summary, and body keywords (client-side instant filter + server query support).
  * **Horizontally Sliding Capsule Category Pills** (using Light Mode `#F3F4F6` container, `#FFFFFF`/`#000000` unhighlighted, `#000000`/`#FFFFFF` highlighted): `All`, `Getting Started`, `Scouts & Referrals`, `Buyers & Orders`, `Sellers & Plans`, `Wallet & Payouts`, `Trust & Safety`.
  * **Accordion / Article Detail Drawer:** Tapping an article opens a clean, readable view displaying the formatted policy/guide content, role badge (`Scout`, `Buyer`, `Seller`, or `All`), and last-updated date.

### 4.2 Programme Rules & Platform Boundaries Page (`/programme-rules` & `TrustGuideDrawer.tsx`) — `NS-FND-006`
* Wire the footer links (**`Programme Rules`**, **`Commission Calculator`**, **`Payout Policy`**) and **`Trust & Guide`** menu item so they display the live published policies from `public.platform_policies`:
  1. **Programme Rules & Commercial Model (`programme-rules`):** Explains the 90% Seller / 10% NairaScout revenue split, 20% of 10% (`2%`) referral pool across up to **13 generations**, 14th-Scout exclusion rule, direct (`BUY`) vs. referral (`REFER`) attribution (non-last-click, 30-day validity, 7-day abandoned checkout protection), and 10-day Seller fulfilment SLA.
  2. **Payout & Wallet Policy (`payout-policy`):** Explains Pending vs. Available vs. Withdrawn balances, the **₦5,000 minimum withdrawal threshold**, the **15th of each month** payout schedule, and the non-bank / non-escrow accounting boundary.
  3. **Platform Boundaries & Consumer Protection Notice (`platform-boundaries`):** Clearly states what NairaScout provides vs. Seller responsibilities (product authenticity, inventory, packaging, physical delivery, warranties) and preserves statutory consumer protection rights.

### 4.3 Super Admin Policy & Help Content Editor (`/admin/content`) — `NS-FND-007`
* Protected by `assertAdminRole(userId, ['SUPER_ADMIN', 'PLATFORM_ADMIN'])`.
* Allows authorized administrators to create, edit, version, and publish/unpublish entries in `platform_policies` and `help_articles`, recording every change in `audit_logs`.

---

## 5. Verification Checklist for the Coding Agent
1. [ ] Zero occurrences of the word `"escrow"` remain in user-facing UI strings, drawers, or wallet descriptions (`NS-FND-001`).
2. [ ] All commission/referral explanations consistently state **13 generations / 13 most recent eligible referrers** (`Blueprint Part A`).
3. [ ] `/help` renders searchable, category-filtered articles from `public.help_articles` in both Light Mode (`#F3F4F6` canvas / `#FFFFFF` cards) and Midnight Obsidian Dark Mode (`#101010` canvas / `#181818` cards).
4. [ ] Footer links (`Programme Rules`, `Payout Policy`) and `Trust & Guide` open live policy content from `public.platform_policies`.
5. [ ] Super Admin / Platform Admin can add and update Help Centre articles and Platform Policies with audit logging.
