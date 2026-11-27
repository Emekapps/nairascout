# NAIRASCOUT — PRODUCT DETAIL PAGE & BOTANICAL EARTH THEME PRD (v3.0)
## Dedicated `/products/[id]` Experience (Desktop & Mobile, Light & Dark Modes) + Complete Platform Color & `Lato` Typography Overhaul

**Document Version:** 3.0  
**Target Codebase:** `nairascout-main` (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui)  
**Governing Authorities:** NairaScout Blueprint Parts A–B, PRD Modules 2–5, Reference Design (`image_CRQo-2.png` & `image_uo3eFU.png`), and `CUSTOM_INSTRUCTIONS.md` (v3.0)

---

## 1. Instructions for the AI Coding Agent

1. **Global Theme & Typography Overhaul (`NS-PDP-001`):**
   * Replace the platform's previous monochrome/red theme tokens in `app/layout.tsx`, `app/globals.css`, and `tailwind.config.ts` with the **Warm Botanical Earth & Forest Olive** palette extracted directly from the approved reference design (`image_CRQo-2.png` & `image_uo3eFU.png`), applied consistently across **both Light Mode and Dark Mode** and across all platform pages (`Feed`, `Product Detail Page`, `Referrals`, `Network`, `Wallet`, `Seller Hub`, `Account Settings`, `Admin`).
   * Set **`Lato`** (`next/font/google`, weights `400`, `700`, `900`) as the primary UI/body/heading font across the platform (keeping `Lexend` Extrabold `800` for the standalone `NairaScout` header wordmark and `Inter` `tabular-nums` for crisp Naira currency alignment).
2. **Build Dedicated Product Detail Page (`/products/[id]`) (`NS-PDP-002` – `NS-PDP-008`):**
   * Tapping any product listing card opens `/products/[id]` (never a modal).
   * Implement the exact 2-column desktop split layout and mobile single-column stacked layout (with the multi-item thumbnail carousel placed **directly underneath** the main product image frame on mobile).
3. **Preserve All Core Business Rules (`CUSTOM_INSTRUCTIONS.md` v3.0):**
   * Keep `lib/commission-engine.ts` (13-generation schedule), integer kobo (`BIGINT`) math, event-based referral attribution (`referralEventId`), and compliance terminology (never `"escrow"`) intact.

---

## 2. Exact Color Palette & `Lato` Typography Tokens (`NS-PDP-001`)

### 2.1 Typography (`app/layout.tsx`)
* **Primary Font (`--font-sans`):** **`Lato`** (Google Font, weights `400`, `700`, `900`) for all headings, labels, prices, body paragraphs, badges, and buttons.
* **Brand Wordmark (`--font-brand`):** **`Lexend`** (`800` Extrabold) for the standalone `NairaScout` top header wordmark (no geometric `N` icon).
* **Numeric Alignment:** Apply `tabular-nums` on all Naira currency figures (`₦XX,XXX.XX`), stock counters, and generation tables.

### 2.2 Color Palette Extracted From Reference (`image_CRQo-2.png` & `image_uo3eFU.png`)

| Semantic Token | Light Mode Hex | Dark Mode Hex | Where Used |
| :--- | :--- | :--- | :--- |
| **Page Background (`--background`)** | **`#F6EFE6`** *(Warm Oat / Linen)* | **`#121614`** *(Deep Forest Charcoal)* | Outer page canvas behind white/elevated content cards |
| **Card / Section Surface (`--card`)** | **`#FFFFFF`** *(Pure White)* | **`#1A201D`** *(Dark Moss Slate)* | Main product detail card, listing cards, wallet & network cards |
| **Secondary Tinted Box (`--muted`)** | **`#F7F5F0`** *(Warm Ivory Tint)* | **`#222925`** *(Elevated Olive Tint)* | Purchase & quantity selector outer container, subtle badge fills |
| **Media Showcase Backdrop** | **`#EDE4D7`** *(Warm Sand Pedestal)* | **`#262E2A`** *(Muted Earth Slate)* | Main product image display backdrop & thumbnail frames |
| **Primary Brand / CTA (`--primary`)** | **`#6B4214`** *(Rich Saddle Bronze)* | **`#8A5820`** *(Warm Amber Bronze)* | Primary **`BUY DIRECT` / `BUY`** action button (`#FFFFFF` text) |
| **Secondary Brand / `REFER` (`--secondary-cta`)** | **`#2E5339`** *(Deep Forest Olive)* | **`#3A6B49`** *(Botanical Forest Green)* | **`REFER`** action button (`#FFFFFF` text) & active pill highlight |
| **Accent / Verified / Badges (`--accent`)** | **`#5C7C5D`** *(Sage Olive Green)* | **`#6E9470`** *(Soft Sage Green)* | Selected card `2px` border, circled checkmarks (`√`), `VERIFIED` / `IN STOCK` pill badges |
| **Selected Tint Fill** | **`#F2F6F2`** *(Soft Sage Wash)* | **`#1F2E24`** *(Deep Sage Wash)* | Selected quantity tier card & selected variant card background tint |
| **Primary Title Text (`--foreground`)** | **`#1E241E`** *(Deep Charcoal Olive)* | **`#F4F2ED`** *(Warm Off-White)* | Product titles, section headings, bold Naira prices |
| **Body & Paragraph Text (`--muted-foreground`)** | **`#596059`** *(Muted Slate Olive)* | **`#B2B8B2`** *(Soft Warm Gray)* | Product descriptions, labels, accordion copy, sub-captions |
| **Eyebrow / Social Proof Icon** | **`#C88A2B`** *(Warm Ochre Gold)* | **`#E0A13B`** *(Golden Ochre)* | Category eyebrow star (`★`), verified seller highlight, social proof icon |
| **Card & Input Border (`--border`)** | **`#E2DDD5`** *(Warm Stone Hairline)* | **`#2E3631`** *(Dark Stone Border)* | Card outlines, accordion dividers, search bar & unhighlighted pill `1px` borders |

---

## 3. Product Detail Page (`/products/[id]`) Architecture & Layout (`NS-PDP-002` – `NS-PDP-008`)

### 3.1 Desktop vs. Mobile Responsive Layout (`NS-PDP-002`)
* **Desktop (`lg` and up):**
  * Renders inside a centered rounded container (`bg-card border border-border rounded-2xl p-6 lg:p-8`) over the `#F6EFE6` (Light) / `#121614` (Dark) page background.
  * **2-Column Split (`grid-cols-1 lg:grid-cols-12 gap-8`):**
    * **Left Column (`lg:col-span-6`):** Vertical thumbnail strip (`64px × 64px` rounded-lg squares) on the left edge + large main product showcase (`aspect-[4/5]` or `aspect-square`, `rounded-xl`, `#EDE4D7` backdrop) on the right.
    * **Right Column (`lg:col-span-6`):** Header, social proof, short description, conditional variant swatches, Option A Unit Price & Delivery box + 3-column Quantity selector, 3-line checkmark benefits, `BUY DIRECT` + `REFER` buttons, 3-column trust badges, and collapsible accordions.
* **Mobile (`< lg`):**
  * Single-column vertical stack (`flex flex-col gap-5`):
    1. **Main Product Showcase** at top (full width, `aspect-square`, `rounded-xl`, touch-swipeable across all uploaded images).
    2. **Horizontal Multi-Item Thumbnail Carousel** positioned **directly underneath** the main product image frame (never beside it on mobile), with hidden scrollbar (`scrollbar-none`) and active `#5C7C5D` border on the selected thumbnail.
    3. All Right-Column elements stacked cleanly below in reading order.

### 3.2 Media Gallery & Inline Video Deep-Link (`NS-PDP-003`)
* Supports up to **10 product images** uploaded by the Seller.
* **Video Deep-Link Overlay:** If the Seller attached YouTube or TikTok video links, render a bottom-right **Deep Link Video Button** overlaid on the main image showcase. Tapping it plays the first video inline at full showcase width with host platform attribution (`YouTube` / `TikTok`), while keeping the multi-item image thumbnail carousel visible directly below. Additional Seller video links are also accessible in the media/video section.

### 3.3 Header, Real Social Proof & Conditional Variants (`NS-PDP-004`)
1. **Eyebrow Tag:** Small uppercase `Lato` bold label (`#C88A2B` star icon + Product Category + `VERIFIED SELLER` badge when `verification_status === 'VERIFIED'`).
2. **Product Title:** Large `Lato` Black (`900`) heading (`text-2xl sm:text-3xl text-[#1E241E] dark:text-[#F4F2ED]`).
3. **Real NairaScout Social Proof Row:**
   * Displays real completed, non-reversed **Units Sold** (`🔥 X sold on NairaScout`) alongside Seller Verification status and listing freshness (`10-Day Fulfilment SLA`).
4. **Short Product Summary:** 2-line concise summary in `#596059` (`dark:text-[#B2B8B2]`).
5. **Conditional Variant / Option Swatch Row (`NS-PDP-004b`):**
   * **Only render** this section when the Seller has configured product options/variants on the listing; **hide automatically** for single-variant products.
   * When present, render a small uppercase label (`CHOOSE OPTION`) above a horizontal row of rounded swatch cards (`bg-card border border-border rounded-xl`) with a circular swatch/thumbnail on the left, option label in the center, and a **`#5C7C5D` circled checkmark** on the right when active.

### 3.4 Option A Purchase Box: Unit Price & Delivery Summary + 3-Column Quantity Selector (`NS-PDP-005`)
Inside the rounded `#F7F5F0` (`dark:bg-[#222925]`) container (`rounded-2xl p-4 border border-border`):
* **Top Section — Option A Unit Price & Delivery Breakdown Card:**
  * Clean 2-column summary card (`bg-card border border-border rounded-xl p-4`):
    * **Left Block (`UNIT PRICE`):** Large bold Naira unit price (`₦XX,XXX`, `tabular-nums`) + per-unit label and real-time stock badge (`X IN STOCK` in `#5C7C5D` pill, or `OUT OF STOCK` in destructive red when `stock === 0`).
    * **Right Block (`DELIVERY FEE`):** Delivery fee in Naira (`₦X,XXX` or `FREE DELIVERY` if `0`) + Seller city/state and `10-Calendar-Day Fulfilment SLA`.
* **Bottom Section — 3-Column Quantity Selector (`1 Unit`, `2 Units`, `3 Units`):**
  * Three equal-width rounded cards (`grid-cols-3 gap-2.5`):
    * **Card 1:** `1 Unit` — `₦[1 × unitPrice]` — pill badge `STANDARD`
    * **Card 2:** `2 Units` — `₦[2 × unitPrice]` — pill badge `2× QTY`
    * **Card 3:** `3 Units` — `₦[3 × unitPrice]` — pill badge `3× QTY`
  * *(Disable any quantity card exceeding current available `stock`, and allow custom quantity adjustment if `stock > 3`).*
  * **Selected Quantity Card State:** `border-2 border-[#5C7C5D] bg-[#F2F6F2] dark:bg-[#1F2E24]`.
  * **Unselected Quantity Card State:** `border border-[#E2DDD5] dark:border-[#2E3631] bg-card`.

### 3.5 Benefits Checklist & Action Buttons (`NS-PDP-006`)
* **3-Line Checkmark List** (each preceded by a solid `#5C7C5D` circle with white checkmark):
  1. `Seller fulfils within 10 calendar days of verified payment`
  2. `Direct marketplace purchase or traceable referral attribution`
  3. `Transparent delivery & return policy backed by NairaScout support`
* **Action Buttons (Stacked on Mobile, Paired/Stacked Cleanly on Desktop):**
  1. **`BUY DIRECT` (or `BUY VIA REFERRAL` when opened via a referral link):**
     * Full-width button in **Rich Saddle Bronze (`#6B4214`)** (hover `#56340F`, Dark Mode `#8A5820`) with `#FFFFFF` bold `Lato` text, shopping bag icon, and live calculated total (`BUY DIRECT — ₦XX,XXX`).
     * Disabled with `"Out of Stock"` label when `stock <= 0`.
     * Opens `CheckoutDrawer` with the selected `quantity` and preserved `referralEventId` (if any).
  2. **`REFER`:**
     * Full-width button directly beneath `BUY DIRECT` in **Deep Forest Olive (`#2E5339`)** (hover `#23412C`, Dark Mode `#3A6B49`) with `#FFFFFF` bold `Lato` text and share icon (`REFER TO SCOUTS LIST / SHARE LINK`), opening the draggable Referral Card bottom sheet.

### 3.6 Three-Column Trust Strip & Expandable Accordions (`NS-PDP-007`)
* **3-Column Trust Strip (`grid-cols-3 gap-3 py-4 border-y border-border`):**
  1. **Verified Seller** (`ShieldCheck` icon in `#6B4214` / `#C88A2B` + `"KYC & business checked"`)
  2. **10-Day SLA** (`Truck` icon + `"Tracked Seller fulfilment"`)
  3. **Buyer Protection** (`RotateCcw` icon + `"Structured return & dispute review"`)
* **Expandable Accordion Rows (`+` / `−` toggle):**
  1. **Product Specifications** (renders Seller specifications list cleanly)
  2. **Delivery & Fulfilment Details** (Seller location, delivery fee, 10-day fulfilment SLA)
  3. **Return Policy & Warranty** (Seller's return policy, warranty terms, and statutory consumer rights notice)
  4. **Seller Information** (Rounded-square Seller logo, Seller/business name, Seller status, verification badge, and category)

---

## 4. Verification Checklist (Definition of Done)
1. [ ] `Lato` (`400`, `700`, `900`) is applied across UI copy, headings, labels, prices, and buttons, while `Lexend` (`800`) remains on the standalone `NairaScout` wordmark.
2. [ ] Warm Botanical Earth & Forest Olive palette (`#F6EFE6` canvas, `#FFFFFF` cards, `#F7F5F0` selector box, `#EDE4D7` media backdrop, `#6B4214` `BUY DIRECT`, `#2E5339` `REFER`, `#5C7C5D` sage olive accents/borders/checks, `#1E241E` titles, `#596059` body, `#C88A2B` gold icons) and its matching Dark Mode tokens are applied consistently across the entire platform.
3. [ ] Tapping any product listing card opens `/products/[id]` (never a modal).
4. [ ] On mobile, the multi-item thumbnail carousel sits **directly underneath** the main product image frame (never beside it).
5. [ ] Conditional variant swatches appear **only** when the Seller configured options on the listing.
6. [ ] Option A displays **Unit Price + Delivery Fee + Stock** above the **3-column Quantity Selector (`1 Unit`, `2 Units`, `3 Units`)** and passes the selected quantity into `CheckoutDrawer`.
