# NAIRASCOUT — HEADER, LOCATION PICKER SHEET, REFERRAL CARD SHEET & SELLER DASHBOARD PRD (v1.6)
## Implementation Specification for Coding Agent

**Document Version:** 1.6  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Lucide Icons  
**Scope:**
1. Under-Header Cleanup & Mobile Search/Location UX (Remove redundant search bar, `"Edit Preferred Categories"` button, and location dropdown under header; remove header theme toggle; add mobile Search `🔍` trigger opening dedicated Smart Search view + Location pin trigger opening draggable Location Picker bottom sheet with smart state search & 3 most recent States)
2. Product Listing Card > Referral Card Bottom Sheet (Monochrome Quick Social Share Buttons — White+Black in Dark Mode, Charcoal Black `#292D2F`+White in Light Mode; Draggable Handle + Close Button + Outside Tap Dismissal)
3. Verified Seller Dashboard (`"Dashboard"` Heading, Stacked Mobile KPI Cards, `"Create Listing"` Form with Mobile Stacked Inputs & `"Save Draft"` CTA)
4. Seller Plan Cards (`Plan ([currentPlan])` Tab — Green Circled Check `CheckCircle2` for Included Features, Red Circled Cancel `XCircle` for Unavailable Features, Separate `"Team"` Feature Row Listed Directly Under `"Promotions"`)

---

## 1. Header & Under-Header Cleanup + Mobile Search & Location Picker Sheet

### Target File(s)
* `components/layout/TopUtilityBar.tsx` / `components/HeaderNav.tsx`
* `components/marketplace/MarketplaceView.tsx`
* `components/search/MobileSearchView.tsx` (new dedicated mobile search view/page)
* `components/location/LocationPickerSheet.tsx` (new draggable location bottom sheet)

### 1.1 Desktop & Mobile Under-Header Cleanup
1. **Desktop (`md:` and up):**
   * Remove the secondary search bar and `"Edit Preferred Categories"` shortcut button located **under** the top header (keep the primary smart search bar inside the top utility header).
2. **Mobile (`< md:`):**
   * Remove the secondary search bar and `"Edit Preferred Categories"` shortcut button from under the header.
   * Remove the inline Location `<select>` dropdown from under the header.
   * Remove the Light/Dark mode toggle button from the top header (since it already lives inside the `Accounts` bottom sheet).

### 1.2 Mobile Top Header Icon Layout (`< md:`)
* In the mobile top header right-hand action cluster, render **only**:
  1. **Search Icon (`Search` / 🔍 from `lucide-react`):** Positioned immediately to the **left** of the Notifications bell icon.
  2. **Notifications Bell Icon (`Bell`):** Positioned immediately to the **right** of the Search icon.
* **Tapping the Mobile Search Icon (`🔍`):**
  * Opens a clean, full-height **Smart Search View** (`/search` or stateful full-screen view) featuring:
    * A prominent, auto-focused **Smart Search Bar** at the top (`Search products, categories, or scouts...`) with a **Location (`MapPin`) icon button immediately to the right of the search bar**, plus a Back/Close button (`←`).
    * Real-time smart search suggestions triggered from **3 or more typed characters** (`>= 3` letters) across **Products**, **Categories**, and **Sanitized Scouts/Sellers** (Avatar + Full Name + `@username` stacked underneath).
* **Tapping the Location (`MapPin`) Icon (to the right of the search bar):**
  * Opens a **draggable Location Picker Bottom Sheet** (`LocationPickerSheet.tsx`) with:
    * **Header:** Title `"Select Location"` + top-right **Close (`X`) button**.
    * **Smart Location Search Input:** Filters all **36 Nigerian States + FCT - Abuja** (plus `"All Locations"`) dynamically as the user types.
    * **Recent Locations Section (`Recent States`):** Displays up to the **3 most recent States** selected by the user (persisted in `localStorage` under `'nairascout_recent_states_v1'`, e.g., `["Lagos", "Imo", "FCT - Abuja"]`) as quick-tap rows/pills above the full alphabetical state list.
    * **Three Dismissal Methods (Consistent with `Accounts` Bottom Sheet):**
      1. Tapping the **Close (`X`) button** at the top-right of the sheet.
      2. Tapping **outside** the sheet on the backdrop overlay.
      3. **Dragging the sheet downward by its top drag handle** (`w-12 h-1.5 rounded-full bg-muted-foreground/30` inside a `touch-none` handle bar using Framer Motion `drag="y"`, closing when `info.offset.y > 90 || info.velocity.y > 450`).

---

## 2. Product Listing Card > Referral Card Bottom Sheet (`ReferProductModal.tsx`)

### Target File(s)
* `components/referrals/ReferProductModal.tsx`

### Requirements
1. **Theme-Adaptive Monochrome Quick Social Share Buttons:**
   * Replace the colored WhatsApp/X/Instagram gradient buttons with clean monochrome buttons that adapt to the active theme:
     * **Light Mode:** **Charcoal Black background (`#292D2F` / `bg-primary`)** with **Pure White icon and text (`text-white`)** (`bg-[#292D2F] text-white hover:bg-[#292D2F]/90`).
     * **Dark Mode (Midnight Obsidian):** **Pure White background (`#FFFFFF`)** with **Pure Black icon and text (`text-black`)** (`dark:bg-white dark:text-black dark:hover:bg-white/90`).
   * Apply this exact styling (`bg-[#292D2F] text-white dark:bg-white dark:text-black`) uniformly across all three **Quick Social Share** buttons (**WhatsApp**, **X / Twitter**, and **Instagram / Copy Link**).
2. **Three-Way Sheet Dismissal (Close Button, Outside Tap & Drag-Down Handle):**
   * Ensure the Referral Card bottom sheet on mobile includes:
     * A centered top **drag handle** (`w-12 h-1.5 rounded-full bg-muted-foreground/30`) with `framer-motion` `drag="y"` so dragging downward (`offset.y > 90` or `velocity.y > 450`) smoothly dismisses the sheet.
     * A top-right **Close (`X`) button**.
     * **Backdrop click-outside** dismissal (`onClick` on overlay).

---

## 3. Verified Seller Dashboard (`SellerHubView.tsx`)

### Target File(s)
* `components/seller/SellerHubView.tsx`

### Requirements
1. **Main Heading Update (Verified Sellers View):**
   * Change the heading `"Seller Operations & Subscriptions"` to **`"Dashboard"`** (`font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground`).
2. **`Drafts, Listings, & Orders` Tab — Mobile Stacked KPI Widgets:**
   * Render the four summary metrics—**`"Eligible Merchandise Revenue"`**, **`"NairaScout 10% Commission"`**, **`"Net Seller Proceeds (90%)"`**, and **`"Listings & Publications"`**—in separate widget cards stacked vertically on mobile (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`) so numbers and labels never cramp horizontally on phone screens.
3. **`Create Listing` Form Refinements:**
   * Change form heading `"Create Draft Listing"` to **`"Create Listing"`**.
   * **Stack All Form Fields Vertically on Mobile:** Use `grid grid-cols-1 md:grid-cols-2 gap-4` (or `flex flex-col gap-4` on `< md:`) so every input, textarea, price/delivery fee field, stock field, and category selector stacks cleanly in a single full-width column on mobile devices.
   * Change submit button text `"Save as Draft Listing"` to **`"Save Draft"`**.

---

## 4. Seller Plan Cards (`Plan ([currentPlan])` Tab in `SellerHubView.tsx`)

### Target File(s)
* `components/seller/SellerHubView.tsx` (Subscription Plan comparison cards under `Plan ([user's currently selected plan])`)

### Requirements
1. **Available vs. Unavailable Feature Line Icons:**
   * On every subscription plan card (**Starter**, **Traction**, **Growth**, **Sprawl**):
     * Mark **available / included features** with a **green circled check mark line icon**: `<CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />`.
     * Mark **unavailable / excluded features** with a **red circled cancel (`x`) line icon**: `<XCircle className="h-4 w-4 text-red-500 shrink-0" />` (with `text-muted-foreground` label styling).
2. **Separate `"Team"` Feature Listed Directly Under `"Promotions"`:**
   * Ensure **`Team`** is rendered as its own distinct feature row positioned **immediately underneath `"Promotions"`** on every plan card:
     * **Starter (Free):**
       * `<XCircle className="h-4 w-4 text-red-500 shrink-0" />` `Promotions` (or `Promotions: Not included`)
       * `<XCircle className="h-4 w-4 text-red-500 shrink-0" />` `Team` (or `Team: Individual only`)
     * **Traction (₦4,500/mo):**
       * `<CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />` `Promotions`
       * `<XCircle className="h-4 w-4 text-red-500 shrink-0" />` `Team`
     * **Growth (₦35,000/mo):**
       * `<CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />` `Promotions`
       * `<XCircle className="h-4 w-4 text-red-500 shrink-0" />` `Team`
     * **Sprawl (₦250,000/mo):**
       * `<CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />` `Promotions`
       * `<CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />` `Team (Up to 5 seats)`

---

## 5. Verification Checklist for the Coding Agent

1. [ ] Under-header secondary search bar, `"Edit Preferred Categories"` button, and location dropdown are removed; top header light/dark toggle is removed; mobile header shows **`🔍` Search** to the left of **Notifications**, opening a search page with a top smart search bar + **`MapPin` Location icon** on the right that opens a draggable Location Picker bottom sheet with smart state search and the **3 most recent States**.
2. [ ] Referral Card bottom sheet renders all three **Quick Social Share** buttons with **Charcoal Black (`#292D2F`) + white text/icons** in Light Mode and **Pure White (`#FFFFFF`) + black text/icons** in Dark Mode, and closes via Close (`X`) button, outside backdrop tap, or **dragging down by the handle**.
3. [ ] Verified Seller section heading reads **`"Dashboard"`**; mobile KPI cards (`"Eligible Merchandise Revenue"`, `"NairaScout 10% Commission"`, `"Net Seller Proceeds (90%)"`, `"Listings & Publications"`) stack vertically on mobile; and the listing form is titled **`"Create Listing"`** with mobile-stacked inputs and **`"Save Draft"`** button.
4. [ ] Every Seller Plan card uses green **`CheckCircle2`** for available features, red **`XCircle`** for unavailable features, and lists **`Team`** as a separate feature row directly beneath **`Promotions`**.
