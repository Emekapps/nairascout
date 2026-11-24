# NAIRASCOUT — ACCOUNT SETTINGS, SELLER SETUP, GLOBAL SMART SEARCH & PREFERRED CATEGORIES FEED PRD (v1.5)
## Implementation Specification for Coding Agent

**Document Version:** 1.5  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase Storage & PostgreSQL (Drizzle ORM), Lucide Icons  
**Scope:**
1. Account Settings & Mobile Bottom Sheet Refinements (Stacked Mobile Account Status, Hide Internal Storage Bucket Path, Red Sign Out & Close Seller Only Buttons, Renamed Closure Heading, Stacked Mobile Closure Summary Cards)
2. Seller Setup & Onboarding Refinements (`"Seller Setup"` Heading, Dismissible `"Activate Seller Capabilities"` Notice Panel, Horizontally Slidable Onboarding Step Pills, Business Profile Photo Upload with Supabase, Hide Internal Target Object Path, Updated Step 4 Heading & Submit Button Copy)
3. Global Smart Search Bar (Autocomplete Dropdown Triggered at >= 3 Typed Characters Across Products, Categories & Sanitized Scouts/Sellers)
4. Feed (Marketplace) Preferred Categories Filtering (Show Only User-Selected Category Pills & Filter Feed Listings to Match Preferred Categories)

---

## 1. Account Settings & Bottom Sheet Refinements (`SettingsView.tsx` & `MobileBottomNav.tsx`)

### 1.1 Account Settings Header (`components/settings/SettingsView.tsx`)
* **Stacked Account Status on Mobile:**
  * On mobile screens (`< sm:`), position **`Account Status: (√) ACTIVE`** (with the green circled `CheckCircle2` icon to the left of `ACTIVE`) **directly underneath the user's email address** (`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5`) instead of sitting inline on the same row.

### 1.2 Verification & Banking Pill (`SettingsView.tsx`)
* **Hide Internal Storage Bucket Path:**
  * Completely remove/hide any internal Supabase Storage path string such as `"Bucket path: verification-docs/5bf3cbd2-d981-4344-a702-220807de087f/national-id-nin.pdf"` from the UI. Instead, display a clean user-friendly status label (e.g., `"Document uploaded"` or the sanitized original filename without bucket/UUID paths).

### 1.3 Mobile Bottom Sheet (`components/layout/MobileBottomNav.tsx`)
* **Consistent Destructive Styling on `"Sign out"` Button:**
  * Style the **`Sign out`** button inside the `Accounts` bottom sheet with the exact same destructive red background and white icon + text styling as the `"Open Closure Flow"` button (`bg-destructive text-destructive-foreground hover:bg-destructive/90`).

### 1.4 Account Lifecycle Pill (`SettingsView.tsx`)
1. **Heading Update:**
   * Change `"Two-Track Account & Seller Closure"` to **`"Account & Seller Closure"`**.
2. **Stacked Obligation Summary Cards on Mobile:**
   * Render **`"Open Orders"`**, **`"Pending Commissions"`**, and **`"Available Balance"`** in separate stacked widget cards on mobile (`grid grid-cols-1 sm:grid-cols-3 gap-3`) so numbers and labels never cramp horizontally on phone screens.
3. **Consistent Destructive Styling on `"Close Seller Only"` Button:**
   * Style the **`Close Seller Only`** button with the exact same destructive red background and white text color as the `"Open Closure Flow"` button (`bg-destructive text-destructive-foreground hover:bg-destructive/90`).

---

## 2. Seller Setup & Onboarding Refinements (`components/seller/SellerHubView.tsx`)

### 2.1 Page Heading & Dismissible Notification Panel
1. **Main Page Heading:**
   * Set the Seller onboarding page heading to **`"Seller Setup"`** (`font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground`).
2. **Dismissible Notification Panel at Top of Page:**
   * Move `"Activate Seller Capabilities"` and its descriptive support text `"Attached to your account (@[username]). You may start creating your product listings and saving them as drafts. But publishing requires Seller verification approval."` (interpolating the authenticated user's actual `@username`) into `<DismissibleNoticePanel />` rendered at the top of the **Seller Setup** page:
     * `storageKey`: `'nairascout_seller_setup_notice_v1'`
     * `title`: `'Activate Seller Capabilities'`
     * `description`: `` `Attached to your account (@${username}). You may start creating your product listings and saving them as drafts. But publishing requires Seller verification approval.` ``
     * `ariaLabel`: `'Activate Seller Capabilities Notice'`
   * Features the two action buttons **`Dismiss`** (hides for **30 days** via `localStorage`) and **`Don’t show this again`** (hides **permanently**).

### 2.2 Horizontally Slidable Onboarding Step Pills
* Make the 4 seller onboarding step pills—**`"1. Seller Type"`**, **`"2. Business Profile"`**, **`"3. Verification Docs"`**, and **`"4. Plan & Terms"`**—horizontally scrollable/slidable on mobile (`flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 snap-x`) with `whitespace-nowrap shrink-0 snap-start rounded-full` so users can slide smoothly across all four steps without wrapping or clipping.

### 2.3 Business Profile Photo Upload (Step 2: Seller & Business Details)
* **Database & Storage Provisioning:**
  * Add `logo_url TEXT` (nullable) to `public.seller_profiles` in `lib/db/schema.ts` and Supabase SQL (`ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;`).
  * Create/use a public Supabase Storage bucket **`seller-logos`** (5 MB max, `image/jpeg`, `image/png`, `image/webp`) scoped to `${user.id}/...`.
* **Form UI (`Step 2: Seller & Business Details`):**
  * Add a **Business Profile Photo / Store Logo** uploader allowing the user to upload, preview, replace, or remove their business profile photo and persist `logo_url` on `seller_profiles`.
  * Display this business profile photo alongside `sellerName` on Seller product cards and Seller Hub headers.

### 2.4 Verification Docs Pill (Step 3)
* **Hide Internal Target Object Path:**
  * Completely remove/hide any internal storage object string such as `"Target object: verification-docs/54693c93-95e6-4f75-a824-6e5ab418179d/gov-id-nin.pdf"` from the UI. Show only a clean confirmation state (e.g., `"Document ready for submission"` or sanitized filename).

### 2.5 Plan & Terms Pill (Step 4)
1. **Step Heading Update:**
   * Change `"Step 4: Select Initial Plan & Accept Seller Terms"` to **`"Step 4: Select Plan"`**.
2. **Submit Button Copy Update:**
   * Change button text `"Submit Onboarding & Activate Seller"` to **`"Submit & Activate Seller Role"`**.

---

## 3. Global Smart Search Bar (`TopUtilityBar.tsx` / `GlobalSmartSearch.tsx`)

### Requirements
1. **Trigger Threshold (`>= 3` Characters):**
   * When the user types **3 or more characters** into the global search bar in the top header, trigger a debounced (`250ms`) server search query (`GET /api/search?q=...`) and open a floating **Smart Search Suggestions Dropdown** directly beneath the search input.
   * When fewer than 3 characters are typed, keep the dropdown closed (or show a subtle `"Type at least 3 characters to search..."` hint if focused with 1–2 characters).
2. **Grouped Suggestion Categories in Dropdown:**
   * Display up to 3–5 matching results per group with keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) and click-outside dismissal:
     * **Products:** Thumbnail image, product title, formatted Naira price (`font-numeric tabular-nums`), and Seller name (clicking opens/navigates to that product in Marketplace).
     * **Categories:** Matching active listing categories from `public.listing_categories` (clicking filters the Marketplace feed by that category).
     * **Scouts & Sellers (Privacy-Safe DTO Only):** Circular `<UserAvatar />`, `displayName` + optional `Seller` badge, and `@username` stacked directly underneath—never exposing private emails, phone numbers, or balances (clicking navigates to Network/Scouts or filters by Seller).

---

## 4. Feed (Marketplace) Filtering by User's `Preferred Categories` (`MarketplaceView.tsx`)

### Requirements
1. **Synchronize Feed Category Pills with User's `Preferred Categories`:**
   * Check the authenticated user's `scout_profiles.preferred_categories` array (selected under **Accounts → Account Settings → Profile → Preferred Categories**).
   * **When the user has selected one or more Preferred Categories (`preferredCategories.length > 0`):**
     * Display **`"All"`** (meaning *All of my preferred categories*) plus **only the category pills that match the user's selected Preferred Categories**—hide all unselected categories from the Feed pill bar.
     * Filter the Feed's product listings by default so **only listings belonging to the user's selected Preferred Categories** appear in the Feed (and selecting a specific preferred category pill narrows the Feed further to that single category).
     * Include a subtle, helpful link or button (e.g., `"Edit Preferred Categories"` -> opens Account Settings Profile tab) if the user wants to add/remove categories or if no listings exist in their chosen categories yet.
   * **When the user has NO Preferred Categories selected (`preferredCategories.length === 0`) or is a Guest:**
     * Display `"All"` plus all active platform categories from `public.listing_categories` and show all published listings as normal.

---

## 5. Supabase SQL Delta (Run in Supabase SQL Editor)

```sql
-- Add business profile photo column to seller_profiles
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create public bucket for Seller business profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-logos', 'seller-logos', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = TRUE;

CREATE POLICY "Public read seller logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'seller-logos');

CREATE POLICY "Users upload own seller logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'seller-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own seller logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'seller-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 6. Verification Checklist for the Coding Agent

1. [ ] On mobile Account Settings, **`Account Status: (√) ACTIVE`** renders below the email address; internal `Bucket path: verification-docs/...` is hidden; `Sign out` and `Close Seller Only` match `Open Closure Flow`'s destructive red + white styling; closure heading reads **`"Account & Seller Closure"`**; and `"Open Orders"`, `"Pending Commissions"`, and `"Available Balance"` stack vertically on mobile.
2. [ ] Seller Setup heading reads **`"Seller Setup"`**, displays the dismissible **`"Activate Seller Capabilities"`** notice panel at the top (**30-day Dismiss** / **Permanent Don't show this again**), makes the 4 step pills horizontally slidable, supports uploading a **Business Profile Photo** (`seller_profiles.logo_url` via Supabase `seller-logos` bucket), hides `"Target object: verification-docs/..."`, and updates Step 4 to **`"Step 4: Select Plan"`** with button **`"Submit & Activate Seller Role"`**.
3. [ ] Typing **3 or more characters** in the global header search bar opens a smart suggestions dropdown grouping matching Products, Categories, and sanitized Scouts/Sellers.
4. [ ] When a logged-in user has selected **Preferred Categories** in Account Settings, the Marketplace Feed renders **only** `"All"` plus those selected category pills, and filters the Feed listings exclusively to those preferred categories.
