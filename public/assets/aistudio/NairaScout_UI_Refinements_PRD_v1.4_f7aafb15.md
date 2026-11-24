# NAIRASCOUT — SIGNUP WIZARD, FEED, WALLET, SETTINGS & ADMIN CATEGORIES PRD (v1.4)
## Implementation Specification for Coding Agent

**Document Version:** 1.4  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth & PostgreSQL (Drizzle ORM), Framer Motion, Lucide Icons  
**Scope:**
1. Free Scout Account Creation Form (Updated Copy, 6-Step Sliding Form Wizard with Next/Back, `"Username"` Label, Database-Backed 36 Nigerian States + FCT Selector, Last Two Fields Grouped on Step 6)
2. Feed / Marketplace Empty-State Copy Updates
3. Wallet Page Refinements (`"Wallet"` Heading, Dismissible `"Referral Earnings Wallet & Ledger"` Notice Panel Above Wallet, `"Pending"` Label, Mobile Stacked KPI Cards, `"Payout — 15th of Each Month"`, `"Ledger"`)
4. Account Settings Page Refinements (Remove `"Primary Identity:"` Label, Green Circled Check Icon Left of `"ACTIVE"`, Remove Avatar Helper Subtext)
5. Super Admin Listing Categories Management Component (`listing_categories` PostgreSQL Table + Admin Console CRUD UI + Dynamic Sync with Account Settings `Preferred Categories` and Marketplace/Seller Hub Category Dropdowns)

---

## 1. Free Scout Account Creation Form (6-Step Sliding Wizard + Supabase States)

### Target File(s)
* `components/auth/RegisterWizard.tsx` (or the registration form component inside `/auth/register` / auth modal)
* `lib/db/schema.ts` & Supabase SQL migration (`nigerian_states` lookup table)

### Requirements
1. **Header & Subheading Copy Updates:**
   * Change `"Create Your Primary Identity"` to **`"Create Your Account"`**.
   * Change `"Every user starts with a free Scout Account. Seller capabilities can be activated later under the same identity."` to **`"Every user starts with a free Scout Account. You can activate Seller capabilities later under the same account."`**.
2. **Field Label & Database-Backed Nigerian States Dropdown:**
   * Change the field labeled `"Scout username"` to **`"Username"`**.
   * Create a PostgreSQL table **`public.nigerian_states`** seeded with all **36 States of Nigeria** (plus Federal Capital Territory — Abuja, optionally marked or listed cleanly) and populate the `"State"` dropdown dynamically from Supabase so state values are normalized across registration, Account Settings, and Marketplace location filters.
3. **6-Step Sliding Form Wizard (`Next` & `Back` Navigation, Last Two Fields on Step 6):**
   * Divide the 6 form fields across **6 sequential, horizontally sliding screens** (`1` through `6`) with a visual step indicator (`Step X of 6`), smooth horizontal slide transitions (`framer-motion` `AnimatePresence`), a **`Back`** button (on steps 2–6), a **`Next`** button (on steps 1–5, validating the current step before advancing), and the final **`Create Free Scout Account`** submit button on **Step 6**:
     * **Step 1:** Field 1 — **Full Name / Display Name** (`Next` button)
     * **Step 2:** Field 2 — **Username** (relabeled from `"Scout username"`, with live availability/format check + `Back` & `Next` buttons)
     * **Step 3:** Field 3 — **Email Address** (`Back` & `Next` buttons)
     * **Step 4:** Field 4 — **State** (dropdown populated from `public.nigerian_states` containing all 36 Nigerian states + `Back` & `Next` buttons)
     * **Step 5:** Field 5 — **Password** (or primary credential field + `Back` & `Next` buttons)
     * **Step 6:** **Both the 5th/6th final fields together on the sixth screen** (e.g., **Confirm Password** + **Optional Direct Referrer Code / Attribution**—or whichever last two fields exist in the 6-field registration form—grouped cleanly on Step 6 alongside `Back` and **`Create Free Scout Account`**).
   * *(Implementation Note: Inspect the exact 6 fields currently rendered in the existing signup form; map fields 1–4 individually to Screens 1–4, Screen 5 to the transitional/password step, and ensure **the last two form fields appear together on Screen 6**).*

---

## 2. Feed / Marketplace Empty-State Copy Updates (`components/marketplace/MarketplaceView.tsx`)

### Requirements
1. Change `"No published marketplace listings yet"` to **`"No published listings yet"`**.
2. Change `"Verified Sellers can create draft listings and publish them to the live PostgreSQL catalogue from the Seller Hub"` to **`"Verified Sellers can create product listings, save them as draft, and publish them to the live marketplace from the Seller Hub"`**.

---

## 3. Wallet Page Updates (`components/wallet/WalletView.tsx`)

### Requirements
1. **Main Page Heading:**
   * Set the Wallet page heading to **`"Wallet"`** (`font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground`).
2. **Dismissible Notification Panel Above the Wallet:**
   * Move `"Referral Earnings Wallet & Ledger"` and its descriptive support text `"Internal accounting derived strictly from the immutable financial ledger. Separate from Seller proceeds. Paid and Reversed figures are cumulative historical states."` into `<DismissibleNoticePanel />` positioned **directly above the Wallet hero/summary cards** the first time a user lands on the Wallet page:
     * `storageKey`: `'nairascout_wallet_ledger_notice_v1'`
     * `title`: `'Referral Earnings Wallet & Ledger'`
     * `description`: `'Internal accounting derived strictly from the immutable financial ledger. Separate from Seller proceeds. Paid and Reversed figures are cumulative historical states.'`
     * `ariaLabel`: `'Referral Earnings Wallet & Ledger Notice'`
   * Include the two action buttons **`Dismiss`** (hides for **30 days** via `localStorage`) and **`Don’t show this again`** (hides **permanently**).
3. **Wallet Metric Labels & Mobile Stacking:**
   * Change `"Pending Escrow"` to **`"Pending"`**.
   * Render **`"Available"`**, **`"Pending"`**, **`"On Hold"`**, **`"Paid (Cumulative)"`**, and **`"Reversed (Cumulative)"`** in individual widget cards stacked vertically on mobile (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3`) so text and Naira figures never get cramped on narrow phone screens.
4. **Payout & Ledger Heading Updates:**
   * Change `"MonthlyPayoutCycle — 15thofEachMonth"` (and any missing spaces) to **`"Payout — 15th of Each Month"`**.
   * Change `"Immutable Financial Ledger"` to **`"Ledger"`**.

---

## 4. Account Settings Page Refinements (`components/settings/SettingsView.tsx`)

### Requirements
1. **Clean Email Display & Green Circled Check Icon Beside `ACTIVE`:**
   * Remove the `"Primary Identity:"` prefix label so **only the user's email address** is displayed.
   * Render a **green circled check mark line icon** (`CheckCircle2` from `lucide-react` styled with `h-4 w-4 text-emerald-500 shrink-0`) directly to the **left** of the **`ACTIVE`** status label/badge.
2. **Remove Avatar Helper Subtext:**
   * On the Profile photo upload field inside the **Profile** tab, remove the helper text `"Shown across Scouts List, Referrals, and Mobile Navigation."`.

---

## 5. Super Admin Listing Categories Management (`listing_categories`)

### Target File(s)
* `lib/db/schema.ts` & Supabase SQL migration (`public.listing_categories`)
* `app/api/admin/categories/route.ts` & `app/api/categories/route.ts`
* `components/admin/AdminConsoleView.tsx` (new **Categories** management section/tab)
* `components/settings/SettingsView.tsx` (**Preferred Categories** multi-select/pills)
* `components/marketplace/MarketplaceView.tsx` & `components/seller/SellerHubView.tsx` (consume dynamic categories from `public.listing_categories`)

### Requirements
1. **Database Table (`public.listing_categories`):**
   * Columns: `id` (UUID PK), `name` (TEXT unique not null), `slug` (TEXT unique not null), `description` (TEXT nullable), `is_active` (BOOLEAN default `true` not null), `sort_order` (INTEGER default `0` not null), `created_by` (UUID FK -> `users.id`), `created_at` (TIMESTAMPTZ).
   * Seed initial default categories (`Fashion & Apparel`, `Electronics & Gadgets`, `Beauty & Personal Care`, `Home & Living`, `Health & Wellness`, `Groceries & Provisions`, `Books & Education`, `Phones & Accessories`) using `ON CONFLICT DO NOTHING`.
2. **Super Admin Category Manager UI (`/admin` -> `Categories` Tab):**
   * Restricted to **`SUPER_ADMIN`** (enforced on the server via `assertAdminRole(userId, ['SUPER_ADMIN'])` and logged to `audit_logs` on every create/update/toggle).
   * Allows the Super Admin to:
     * **Add a new listing category** (Name, optional description, active toggle).
     * **Edit or activate/deactivate** existing categories (deactivating hides a category from new selections without breaking existing products or user preferences).
3. **Sync with Account Settings (`Preferred Categories`):**
   * Update **Account Settings → Profile → Preferred Categories** to fetch all active categories (`is_active = true`) from `public.listing_categories` so any category added by the Super Admin immediately appears as a selectable option for users.

---

## 6. Database Migration SQL (Run in Supabase SQL Editor)

```sql
-- 1. All 36 States of Nigeria (+ FCT) lookup table
CREATE TABLE IF NOT EXISTS public.nigerian_states (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  geo_zone TEXT NOT NULL
);

INSERT INTO public.nigerian_states (code, name, geo_zone) VALUES
  ('AB', 'Abia', 'South East'),
  ('AD', 'Adamawa', 'North East'),
  ('AK', 'Akwa Ibom', 'South South'),
  ('AN', 'Anambra', 'South East'),
  ('BA', 'Bauchi', 'North East'),
  ('BY', 'Bayelsa', 'South South'),
  ('BE', 'Benue', 'North Central'),
  ('BO', 'Borno', 'North East'),
  ('CR', 'Cross River', 'South South'),
  ('DE', 'Delta', 'South South'),
  ('EB', 'Ebonyi', 'South East'),
  ('ED', 'Edo', 'South South'),
  ('EK', 'Ekiti', 'South West'),
  ('EN', 'Enugu', 'South East'),
  ('FC', 'FCT - Abuja', 'North Central'),
  ('GO', 'Gombe', 'North East'),
  ('IM', 'Imo', 'South East'),
  ('JI', 'Jigawa', 'North West'),
  ('KD', 'Kaduna', 'North West'),
  ('KN', 'Kano', 'North West'),
  ('KT', 'Katsina', 'North West'),
  ('KE', 'Kebbi', 'North West'),
  ('KO', 'Kogi', 'North Central'),
  ('KW', 'Kwara', 'North Central'),
  ('LA', 'Lagos', 'South West'),
  ('NA', 'Nasarawa', 'North Central'),
  ('NI', 'Niger', 'North Central'),
  ('OG', 'Ogun', 'South West'),
  ('ON', 'Ondo', 'South West'),
  ('OS', 'Osun', 'South West'),
  ('OY', 'Oyo', 'South West'),
  ('PL', 'Plateau', 'North Central'),
  ('RI', 'Rivers', 'South South'),
  ('SO', 'Sokoto', 'North West'),
  ('TA', 'Taraba', 'North East'),
  ('YO', 'Yobe', 'North East'),
  ('ZA', 'Zamfara', 'North West')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.nigerian_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read nigerian states" ON public.nigerian_states FOR SELECT USING (true);

-- 2. Super Admin Managed Listing Categories
CREATE TABLE IF NOT EXISTS public.listing_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.listing_categories (name, slug, sort_order) VALUES
  ('Fashion & Apparel', 'fashion-apparel', 1),
  ('Electronics & Gadgets', 'electronics-gadgets', 2),
  ('Phones & Accessories', 'phones-accessories', 3),
  ('Beauty & Personal Care', 'beauty-personal-care', 4),
  ('Home & Living', 'home-living', 5),
  ('Health & Wellness', 'health-wellness', 6),
  ('Groceries & Provisions', 'groceries-provisions', 7),
  ('Books & Education', 'books-education', 8)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.listing_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active listing categories" ON public.listing_categories FOR SELECT USING (true);
```

---

## 7. Verification Checklist for the Coding Agent

1. [ ] Signup form displays **`"Create Your Account"`** and **`"Every user starts with a free Scout Account. You can activate Seller capabilities later under the same account."`**, slides across **6 screens** with `Next`/`Back` buttons, uses **`"Username"`**, populates **State** from Supabase (`nigerian_states` with all 36 states + FCT), and groups the **last two form fields on Screen 6**.
2. [ ] Feed empty state displays **`"No published listings yet"`** and **`"Verified Sellers can create product listings, save them as draft, and publish them to the live marketplace from the Seller Hub"`**.
3. [ ] Wallet page heading is **`"Wallet"`**, displays the dismissible **`"Referral Earnings Wallet & Ledger"`** panel above the wallet (**30-day Dismiss** / **Permanent Don't show this again**), relabels `"Pending Escrow"` to **`"Pending"`**, stacks all 5 balance widgets vertically on mobile, and updates headings to **`"Payout — 15th of Each Month"`** and **`"Ledger"`**.
4. [ ] Account Settings displays only the user's email (without `"Primary Identity:"`), shows a **green circled check icon (`CheckCircle2`)** to the left of **`ACTIVE`**, and removes `"Shown across Scouts List, Referrals, and Mobile Navigation."` from the avatar upload field.
5. [ ] Super Admin console includes a **Listing Categories** manager that adds/toggles categories in `public.listing_categories` and immediately exposes them under **Preferred Categories** in Account Settings.
