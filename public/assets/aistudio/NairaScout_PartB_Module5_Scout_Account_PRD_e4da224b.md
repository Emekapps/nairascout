# NAIRASCOUT — MODULE 5 & BLUEPRINT PART B IMPLEMENTATION PRD
## Scout Profiles, Private-by-Default Visibility, Dashboard, Activity Feed, Commission History & Restriction UX

**Document Version:** 1.0  
**Target Codebase:** `nairascout-main` (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth/PostgreSQL/Storage, Drizzle ORM, TanStack Query)  
**Governing Authorities:** Approved NairaScout Blueprint Part B & PRD Module 5 (including Approved Section 5.11.4 Resolutions)  
**Pre-requisite SQL:** `nairascout_partB_module5_scout_profiles.sql`

---

## 1. Instructions for the AI Coding Agent

1. **Follow `CUSTOM_INSTRUCTIONS.md` (v2.1):** Enforce integer kobo (`BIGINT`), `Africa/Lagos` date boundaries, Light Mode (`#F3F4F6` canvas / `#FFFFFF` cards / `#292D2F` Charcoal `REFER` / `#000000` `BUY`) and Midnight Obsidian Dark Mode (`#101010` canvas / `#292D2F` Charcoal `REFER` / `#FFFFFF` `BUY`), and include `// NS-SCT-[NNN]` traceability tags on all new handlers and components.
2. **Presentation Layer Only for Financial & Attribution Data:** Module 5 interfaces (Scout Dashboard, Activity Feed, Wallet Overview, Referral Statistics, Commission History) **must read exclusively** from authoritative database tables/services. Never compute independent balances, cache withdrawal eligibility on the client, or allow users to mutate ledger/commission figures.
3. **Private-by-Default Scout Identity:** Default `scout_profiles.profile_visibility` to `'PRIVATE'` and **do not** build a public `/scouts/[username]` profile page in MVP. Expose `displayName`, `username`, and square `avatarUrl` only where required for legitimate Scouts List / referral interactions.

---

## 2. Database & Storage Alignment (`lib/db/schema.ts`)

Update `lib/db/schema.ts` to match `nairascout_partB_module5_scout_profiles.sql`:
* **`scoutProfiles`:** Add `locationLga: text('location_lga')`, set `profileVisibility` default to `'PRIVATE'`, and enforce `bio` max length `250`.
* **`notificationPreferences`:** Add Drizzle table definition for `public.notification_preferences` (`userId`, `categoryCode`, `inAppEnabled`, `emailEnabled`, `isEssential`, `updatedAt`).

---

## 3. Feature Requirements & Implementation Specifications

### 3.1 Scout Profile, LGA & Square Avatar Validation (`NS-SCT-010` – `NS-SCT-018`)
* **Profile Settings Form (`Account Settings → Profile`):**
  * Display read-only foundational identity fields (`Full Name`, `Email`, `Account Creation Date`, `Account Status`).
  * Editable Scout Profile fields:
    * `Display Name` (required, anti-impersonation check blocking reserved words like `admin`, `nairascout`, `support`).
    * `Username` (required, unique, URL-safe).
    * `Short Biography` (optional, **250-character hard limit** with live `X / 250` character counter).
    * `State` (dropdown from `nigerian_states`) and optional `LGA` (`locationLga` text/select input).
    * `Preferred Product Categories` (multi-select from `listing_categories`).
* **Profile Photo Uploader (`NS-SCT-012`):**
  * Accept **JPEG (`image/jpeg`), PNG (`image/png`), and WebP (`image/webp`)** only. Reject GIF/animated images and unsupported MIME types.
  * Enforce **maximum file size `5 MB`** (`5,242,880` bytes) and **minimum dimensions `200 × 200` pixels** on both client (via `Image` naturalWidth/naturalHeight check before upload) and server.
  * Strip EXIF/GPS metadata on upload (re-encoding via canvas or server sharp/canvas pipeline before uploading to Supabase `avatars` bucket).
  * Render avatars everywhere in a **1:1 square aspect ratio** (`aspect-square object-cover`, circular avatar container in navigation/headers and rounded-square/circle per component spec), with **Replace** and **Remove** actions.
* **Private-by-Default Visibility (`NS-SCT-015`, `5.11.4 #3`):**
  * Default `profileVisibility` to `'PRIVATE'`. In `Privacy & Referrals`, allow Scouts to opt in to showing optional `bio`, `State/LGA`, and `preferredCategories` in Scouts List search results, while keeping `email`, `phone`, `Scouts List`, `referralAncestry`, and `wallet` strictly private forever.

### 3.2 Modular 6-Section Scout Overview & Referral Statistics (`NS-SCT-019` – `NS-SCT-026`, `NS-SCT-054` – `NS-SCT-064`)
Enhance the Scout overview / Network & Wallet summaries with a clean, mobile-first 6-section layout (single-column stacked on mobile, multi-column on desktop, no horizontal page overflow):
1. **Header:** Greeting + Scout `displayName`, square avatar, account/restriction badge, and Notifications shortcut.
2. **Wallet Summary Card:** Displays authoritative `Pending`, `Available`, and `Withdrawn (Cumulative)` balances in NGN (`tabular-nums`), progress toward the **`₦5,000` minimum withdrawal threshold**, `Last updated` timestamp, manual **Refresh** button, and shortcut to Wallet.
3. **Referral Performance Summary (`NS-SCT-054` – `NS-SCT-064`):**
   * Period filter pills: `Today`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Previous Month`, `Custom` — computed using **`Africa/Lagos` (`UTC+1`)** day boundaries.
   * Metrics (all strictly event-based, never counting general direct marketplace purchases):
     * `Referrals Sent` (distinct referral events created)
     * `Delivered` (successfully delivered referrals)
     * `Opened` (distinct opened referral events; multiple opens by same recipient count once) & `Open Rate (%)`
     * `Attributed Purchases` (completed, non-reversed referral-attributed orders) & `Conversion Rate (%)`
     * `Eligible Sales Value (₦)` (net of full cancellations/refunds and adjusted for partial refunds)
   * Cache summary queries for **5 minutes** using **TanStack Query (`staleTime: 5 * 60 * 1000`)** and invalidate automatically upon referral, order, or refund mutations.
4. **Commission Summary:** `Pending Commissions`, `Available Commissions`, recent commission items, and link to full Commission History.
5. **Recent Activity Preview:** Latest 5 chronological events with `"View All Activity →"`.
6. **Quick Actions:** `Find Products`, `Refer a Product`, `Scouts List`, `Referral Activity`, `Wallet`, `Manage Profile`.

### 3.3 Chronological Scout Activity Feed (`NS-SCT-035` – `NS-SCT-044`)
Build a dedicated **Activity** tab/view (`GET /api/scout/activity`) aggregating authoritative events chronologically (newest first, grouped by `Africa/Lagos` date) across the **8 approved categories**:
1. `Account` (registration, profile updated, password/2FA/security events)
2. `Scouts List` (invitation sent, accepted, rejected, contact removed)
3. `Product Referrals` (referral created, delivered, opened, expired)
4. `Purchases` (referral-generated purchase, direct purchase)
5. `Commissions` (commission earned, pending, released to available, adjusted/reversed)
6. `Wallet` (withdrawal requested, processing, paid, failed)
7. `Notifications` (important platform notices)
8. `Restrictions` (restriction imposed, updated, or lifted)
* Include category filter pills, date-range filter, and pagination (`20` per page). Never expose private downstream Scout names or contact info.

### 3.4 Commission History With 20-Item Cursor Pagination (`NS-SCT-065` – `NS-SCT-075`)
Upgrade the Commission History section in `WalletView.tsx` (`GET /api/scout/commissions`):
* **Cursor-Based Pagination:** Load **20 records per page** (newest first) using `(createdAt, id)` cursor pagination (`Load More` / `Next Page` preserving active filters).
* **Filters:** `All`, `Pending`, `Available`, `Withdrawn`, `Reversed / Adjusted`, plus `Date Range` and `Product` filter.
* **Row Details:** Commission reference, product title, order reference, tier (`Gen 1`–`Gen 13`), amount in NGN (`tabular-nums`), status badge, date earned (`Africa/Lagos`), date released, and adjustment/reversal explanation where applicable.
* **Authoritative Withdrawal Guard:** Never rely on cached UI balances when submitting a withdrawal—re-query authoritative ledger/wallet balances on the server (`POST /api/wallet/withdraw`).

### 3.5 Eight-Group Notification Preferences (`NS-SCT-076` – `NS-SCT-083`)
* Add a **Notifications** section in **Account Settings** backed by `public.notification_preferences`:
  * Render toggles (`In-App` and `Email`) for all 8 categories:
    1. `Account & Security` *(Locked ON — Essential)*
    2. `Scouts List`
    3. `Product Referrals`
    4. `Purchases & Orders` *(Locked ON — Essential)*
    5. `Commissions`
    6. `Wallet & Withdrawals` *(Locked ON — Essential)*
    7. `Platform Announcements`
    8. `Restrictions & Verification` *(Locked ON — Essential)*
  * Enforce on the server (`PATCH /api/settings/notifications`) that `is_essential === true` categories cannot be disabled.

### 3.6 Scout Restriction Awareness & Presentation (`NS-SCT-084` – `NS-SCT-095`)
* Whenever the authenticated user has an active `capability_restrictions` row or `account_status` in `['RESTRICTED', 'SUSPENDED']`, display a clear **Restriction Notice Banner** at the top of the Scout Dashboard, Referrals, Scouts List, or Wallet view:
  * Map internal states to user-friendly labels: `Account suspended`, `Account limited`, `Scout features restricted`, `Referrals restricted`, `Withdrawals restricted`, `Under review`.
  * Show affected capability, general reason, effective date, and duration rule:
    * If `expires_at` is set: display `"Temporarily restricted until [formatted Africa/Lagos datetime]"`.
    * If `expires_at` is `NULL`: display `"In effect pending review"` (never invent a fake end date).
  * Provide a **"Submit Appeal / Request Review"** shortcut linking to `governance_appeals` when eligible, without disclosing confidential investigative notes.

---

## 4. Verification Checklist (Definition of Done)

1. [ ] New Scout profiles default to `profile_visibility = 'PRIVATE'`, enforce a 250-character bio cap, support optional `LGA`, and have no public `/scouts/[username]` route.
2. [ ] Avatar uploads reject files `> 5 MB`, dimensions `< 200 × 200 px`, or formats outside JPEG/PNG/WebP, and display in a square crop.
3. [ ] Referral Statistics calculate `Sent`, `Delivered`, `Opened` (deduplicated per event), `Attributed Purchases`, and `Eligible Sales` in `Africa/Lagos` time with 5-minute TanStack Query caching.
4. [ ] Scout Activity displays all 8 event categories chronologically with filtering and pagination.
5. [ ] Commission History supports cursor-based pagination (`20` records/page) and status/date/product filters.
6. [ ] Notification Preferences expose all 8 groups while locking essential security, order, withdrawal, and restriction alerts.
7. [ ] Active capability/account restrictions render clear user-facing labels, accurate duration text, and appeal links while preserving historical records.
