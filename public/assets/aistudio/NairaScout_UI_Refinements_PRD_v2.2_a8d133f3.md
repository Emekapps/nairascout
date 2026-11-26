# NAIRASCOUT — UI & INTERACTION REFINEMENTS PRD (v2.2)
## Sliding Pill Polish, Red `BUY` / Black `REFER` Buttons, Dedicated Product Detail Page & Deep Emerald (`#005B46`) Semantic Accents

**Document Version:** 2.2  
**Target Codebase:** `nairascout-main` (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui)  
**Governing Authorities:** `CUSTOM_INSTRUCTIONS.md` (v2.2) & Design System Specification

---

## 1. Instructions for the AI Coding Agent

Apply all **6 UI and routing updates** below consistently across Light Mode and Midnight Obsidian Dark Mode (`#101010`), without altering backend business logic, RBAC guards, or `lib/commission-engine.ts`.

---

## 2. Detailed UI & Routing Requirements

### `NS-UI-020`: Light Mode Unhighlighted Pill Border Alignment
* **Rule:** Every horizontally sliding capsule/segmented pill with a white (`#FFFFFF`) background when unhighlighted in **Light Mode** (across Feed categories, Network tabs, Pending Invitations sub-tabs, Wallet Ledger filters, Account Settings tabs, and Seller Hub tabs) must share the **exact same border line color and border thickness** as the search bar input in Light Mode (`border border-input` / `1px solid` matching the search input border token).
* **Highlighted State:** Remains `#000000` background with `#FFFFFF` text in Light Mode.

### `NS-UI-021`: Hide Horizontal Scrollbar on Sliding Pills + Halfway Peek Cue
* **Hidden Scrollbar:** Completely hide the horizontal scrollbar track and thumb on every sliding pill container across all browsers (`scrollbar-none` / `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`) so no horizontal bar appears when sliding pills.
* **Right-Edge Halfway Peek Cue:** Whenever a pill container overflows the horizontal viewport width on mobile, size/space the pills (`w-max`, `shrink-0`, natural pill padding) so that the pill closest to the screen's right edge renders **partially visible (~40%–60% peeking in)** rather than clipping cleanly at a gap—giving users an immediate visual affordance that the pill bar slides horizontally.

### `NS-UI-022`: Product Listing Card Button Colors (`BUY` Red `#E53935`, `REFER` Black `#000000`)
* Update every product listing card (`MarketplaceView.tsx`, search results, and category feeds):
  * **`BUY` button:** Background **`#E53935`** (hover `#C62828`), text **`#FFFFFF`**.
  * **`REFER` button:** Background **`#000000`** (hover `#1A1A1A`), text **`#FFFFFF`** (add a subtle `1px solid #2E2E2E` border in Midnight Obsidian Dark Mode so the `#000000` button stays crisp against `#181818` cards).

### `NS-UI-023`: Dedicated Product Detail Page (`/products/[id]`) Replacing Product Detail Modal
* **Route Conversion:** Tapping a product listing card (image, title, or price area) must navigate to a dedicated **Product Detail Page** (`/products/[id]` or `/listings/[id]`) instead of opening an overlay modal.
* **Page Contents & Layout:**
  * Top back navigation (`← Back to Feed` / `← Back`).
  * Full slidable product image gallery (up to 10 images) + embedded/linked YouTube & TikTok product videos (supporting the Seller's video links).
  * Product title, Naira price (`tabular-nums`), stock status, Seller info card (rounded-square Seller logo, Seller name, active Seller badge, verification status), full description, specifications, delivery fee & 10-day fulfilment SLA notice, return & warranty policies.
  * Sticky or prominent bottom/inline action bar with:
    * **`BUY DIRECT` button:** Background **`#E53935`** (hover `#C62828`), text **`#FFFFFF`**.
    * **`REFER` button:** Background **`#000000`** (hover `#1A1A1A`), text **`#FFFFFF`** (with subtle `#2E2E2E` border in Dark Mode), opening the draggable Referral Card bottom sheet.
* **Referral Link Compatibility:** Ensure visiting a product via a referral link (`/r/[referralEventId]` or `/products/[id]?ref=...`) lands cleanly on the Product Detail Page while preserving the `referralEventId` attribution banner and passing it directly into `CheckoutDrawer` when `BUY DIRECT` / `BUY` is tapped.

### `NS-UI-024`: Standardize All Emerald Badges, Marks, Text & Links to Deep Emerald (`#005B46`)
* **Global Color Replacement:** Search the entire codebase (`app/`, `components/`, `lib/`) for any `emerald-*` Tailwind classes (`text-emerald-*`, `bg-emerald-*`, `border-emerald-*`, `fill-emerald-*`, `stroke-emerald-*`) or emerald hex values used on badges, checkmarks (`CheckCircle2`), status indicators, unread dots, text highlights, and links, and replace them with **Deep Emerald (`#005B46`)**:
  * Text & links: `text-[#005B46]` (and high-contrast readable tint `text-[#10B981]` or `#005B46` badge fill with `#FFFFFF` text where needed on `#101010` dark backgrounds so WCAG contrast is preserved).
  * Solid badges / unread dots: `bg-[#005B46] text-white`.
  * Outline / tinted badges: `border-[#005B46]/30 bg-[#005B46]/10 text-[#005B46]` (or `dark:bg-[#005B46] dark:text-white` for crisp legibility in Dark Mode).
  * Check icons (`(√) ACTIVE`, plan included checkmarks): `text-[#005B46]` (with `dark:text-[#34D399]` or solid `#005B46` badge pill if placed directly on `#101010`).

---

## 3. Verification Checklist (Definition of Done)
1. [ ] Unhighlighted `#FFFFFF` pills in Light Mode share the exact `1px` border color and thickness of Light Mode search bars.
2. [ ] Sliding pill tracks show zero horizontal scrollbar, and overflowing pill rows display the rightmost pill peeking halfway into the viewport.
3. [ ] Product listing cards render **`BUY`** in **`#E53935`** (white text) and **`REFER`** in **`#000000`** (white text).
4. [ ] Tapping a product listing opens a dedicated **`/products/[id]`** Product Detail Page (not a modal) with **`BUY DIRECT`** in **`#E53935`** and **`REFER`** in **`#000000`**.
5. [ ] All emerald badges, checkmarks, unread indicators, text accents, and links use **Deep Emerald (`#005B46`)**.
