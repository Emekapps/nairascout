# NAIRASCOUT — DESIGN SYSTEM & FRONTEND ARCHITECTURE GUIDE
## Base Aesthetic: Electric Social Pulse (Mobile-First, Light & Deep Obsidian Dark Mode with Feed-First Layout & 6-Slide In-Feed Carousel)

**Document Version:** 1.4 (Feed-First Marketplace Top Layout + 6-Slide Info Carousel Every 25 Listings)  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, `next-themes`, Lucide Icons  
**Visual Reference:** Electric Social Pulse (Desktop Left-Sidebar Feed + Mobile Bottom-Nav & Slide-Up Referral Drawer)  
**Core Typography:** `Plus Jakarta Sans` (Headings, UI & Body Copy) + `Inter` with `tabular-nums` (Naira Prices, Kobo Ledger & Generation Counters)

---

## 1. Design Philosophy & Visual Direction

NairaScout combines the approachable, social-feed discovery of **Electric Social Pulse** with a crisp, editorial monochrome button hierarchy (`#000000` / `#FFFFFF` for `BUY` and `#292D2F` Charcoal Black for `REFER`) and a **product-first marketplace feed**:

1. **Product-First Marketplace Discovery (Zero Hero Bloat at Top):**
   * **Top of Marketplace Page:** Open immediately with the **Search Bar**, **Location Filter** (`All Locations`, Nigerian states/cities), **Category Filter**, and the **Product Discovery Feed**—putting shoppable products and `BUY` / `REFER` actions above the fold on both mobile and desktop.
   * **6-Slide Educational & Trust Carousel (Injected Every 25 Listings):** Convert the former top Hero banner and the platform metrics cards (`Referral Pool Source`, `Permanent Ancestry Depth`, `Seller Fulfilment SLA`, `Monthly Payout Policy`, `Attribution Rule`) into a sleek, swipeable **6-slide horizontal carousel** (`components/marketplace/InFeedPromoCarousel.tsx`) that renders cleanly inside the feed **after every 25 product listings** (`index === 24`, `index === 49`, `index === 74`, etc.) as users scroll.
2. **Mobile-First Social Commerce Layout:**
   * **Mobile (`< 768px`):** Clean top header (`NairaScout` wordmark + notifications + profile avatar), full-bleed single-column feed or 2-column compact product cards, persistent **5-tab bottom navigation bar**, and native-feeling **slide-up drawers** (`CheckoutDrawer`, `ReferProductModal` with quick-share pills for WhatsApp, X/Twitter, Instagram, and copy-link).
   * **Desktop (`>= 768px` / `lg:`):** Persistent **left navigation sidebar** (`240px` fixed width) with primary route links and user identity footer, sticky top search/location utility bar with **Light / Deep Obsidian Dark Mode toggle**, and a responsive multi-column **Product Discovery Feed** (`grid-cols-2 xl:grid-cols-3`).
3. **Dual-Mode Color Strategy (Light Mode vs. Deep Obsidian Dark Mode):**
   * **Light Mode:** Warm, crisp alabaster surfaces (`#F8F9FB`) with pure white elevated cards (`#FFFFFF`), high-contrast slate ink (`#0F172A`), **Pure Black (`#000000`)** with white text for direct **`BUY`** actions, and **Charcoal Black (`#292D2F`)** with white text for **`REFER`** buttons and Scout Wallet hero surfaces.
   * **Dark Mode (Deep Obsidian):** True low-glare **Deep Obsidian (`#07090E`)** canvas with layered obsidian cards (`#0F131C`) and subtle hairline borders (`#1C2333`). Direct **`BUY`** buttons invert to high-contrast **Pure White (`#FFFFFF`)** with black text (`#000000`), while **`REFER`** buttons and Scout Wallet hero cards use **Charcoal Black (`#292D2F`)** with white text and a crisp `1px` hairline border (`#3E4346`).
4. **Modular Frontend Architecture:**
   * Every domain surface (`Marketplace`, `Referrals`, `Network`, `Wallet`, `Seller Hub`, `Settings`, `Admin`) is built as an isolated feature module consuming shared design tokens and `shadcn/ui` primitives—never hardcoded hex colors inside feature components.

---

## 2. Typography System (`Plus Jakarta Sans` & `Inter`)

Configure both Google Fonts in `app/layout.tsx` using `next/font/google`. Using **Plus Jakarta Sans** across headings and body copy creates a warm, cohesive social-commerce feel that is easy on the eyes without drawing attention to itself, while **Inter (`tabular-nums`)** keeps Naira amounts and ledger columns crisply aligned.

```typescript
// app/layout.tsx
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-numeric',
  display: 'swap',
});
```

### Type Scale & Usage Rules
| Role | Font Family | Tailwind Classes | Usage |
| :--- | :--- | :--- | :--- |
| **Page & Section Headings** | `Plus Jakarta Sans` | `font-sans text-xl md:text-2xl font-bold tracking-tight` | Feed headers (`General Product Discovery`), Carousel slide titles, Dashboard titles |
| **Card & Modal Subheadings** | `Plus Jakarta Sans` | `font-sans text-base font-semibold tracking-tight` | Product card titles, Referral drawer title, Wallet section headers |
| **Monetary & Naira Values** | `Inter` | `font-numeric font-bold tabular-nums` | Prices (`₦18,500.00`), Wallet balances (`₦48,500.00`), Commission pools (`20% of 10%`), Gen badges (`Gen 1`–`Gen 13`) |
| **Body & UI Copy** | `Plus Jakarta Sans` | `font-sans text-sm leading-relaxed` | Product descriptions, Scout bios, carousel descriptions, form labels |
| **Buttons, Badges & Nav** | `Plus Jakarta Sans` | `font-sans text-xs font-semibold tracking-wide` | `BUY` / `REFER` buttons, Seller badges, Sidebar & Bottom Nav labels |

---

## 3. Color Tokens & Light / Deep Obsidian Dark Theme Variables

Add these semantic CSS variables to `app/globals.css`. Both `:root` (Light Mode) and `.dark` (Deep Obsidian Dark Mode) map `--primary` (`REFER` & primary CTAs) to **Charcoal Black (`#292D2F`)**, while `--commerce` (`BUY` buttons) switches from **Pure Black (`#000000`)** in Light Mode to **Pure White (`#FFFFFF`)** in Dark Mode.

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* LIGHT MODE — Crisp Alabaster + Black BUY + Charcoal Black (#292D2F) REFER */
    --background: 220 20% 98%;          /* #F8F9FB */
    --foreground: 222 47% 11%;          /* #0F172A */

    --card: 0 0% 100%;                  /* #FFFFFF */
    --card-foreground: 222 47% 11%;     /* #0F172A */

    --popover: 0 0% 100%;               /* #FFFFFF */
    --popover-foreground: 222 47% 11%;

    --sidebar: 0 0% 100%;               /* #FFFFFF */
    --sidebar-foreground: 215 25% 27%;  /* #334155 */
    --sidebar-border: 214 32% 91%;      /* #E2E8F0 */

    /* Primary Brand Action (REFER & Primary CTAs): Charcoal Black (#292D2F) */
    --primary: 200 7% 17%;              /* #292D2F */
    --primary-foreground: 0 0% 100%;    /* #FFFFFF */
    --primary-border: 200 7% 17%;       /* #292D2F */

    /* Commerce Action (BUY buttons): Pure Black (#000000) in Light Mode */
    --commerce: 0 0% 0%;                /* #000000 */
    --commerce-foreground: 0 0% 100%;   /* #FFFFFF */

    --secondary: 210 40% 96%;           /* #F1F5F9 */
    --secondary-foreground: 222 47% 11%;

    --muted: 210 40% 96%;               /* #F1F5F9 */
    --muted-foreground: 215 16% 47%;    /* #64748B */

    --accent: 210 20% 94%;              /* #ECEFF2 — Soft Charcoal Tint */
    --accent-foreground: 200 7% 17%;    /* #292D2F */

    --destructive: 0 84% 60%;           /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    --success: 160 84% 39%;             /* #10B981 */
    --warning: 38 92% 50%;              /* #F59E0B */

    --border: 214 32% 91%;              /* #E2E8F0 */
    --input: 214 32% 91%;
    --ring: 200 7% 17%;                 /* #292D2F */
    --radius: 0.875rem;                 /* 14px rounded cards matching mockup */
  }

  .dark {
    /* DARK MODE — Deep Obsidian + White BUY + Charcoal Black (#292D2F) REFER */
    --background: 223 33% 4%;           /* #07090E — Deep Obsidian */
    --foreground: 210 40% 98%;          /* #F8FAFC */

    --card: 222 30% 8%;                 /* #0F131C — Elevated Obsidian Card */
    --card-foreground: 210 40% 98%;

    --popover: 222 32% 10%;             /* #121723 */
    --popover-foreground: 210 40% 98%;

    --sidebar: 223 35% 6%;              /* #0A0D14 — Obsidian Sidebar */
    --sidebar-foreground: 215 20% 75%;  /* #94A3B8 */
    --sidebar-border: 222 27% 15%;      /* #1C2333 */

    /* Primary Brand Action (REFER & Primary CTAs): Charcoal Black (#292D2F) */
    --primary: 200 7% 17%;              /* #292D2F */
    --primary-foreground: 0 0% 100%;    /* #FFFFFF */
    --primary-border: 204 6% 26%;       /* #3E4346 — Subtle edge lift on Deep Obsidian */

    /* Commerce Action (BUY buttons): Pure White (#FFFFFF) in Dark Mode */
    --commerce: 0 0% 100%;              /* #FFFFFF */
    --commerce-foreground: 0 0% 0%;     /* #000000 */

    --secondary: 222 27% 13%;           /* #181F2E */
    --secondary-foreground: 210 40% 98%;

    --muted: 222 27% 13%;               /* #181F2E */
    --muted-foreground: 215 20% 60%;    /* #8592A6 */

    --accent: 200 7% 17%;               /* #292D2F */
    --accent-foreground: 210 40% 98%;   /* #F8FAFC */

    --destructive: 0 72% 51%;           /* #DC2626 */
    --destructive-foreground: 0 0% 100%;

    --success: 158 64% 52%;             /* #34D399 — Status badges & sparklines */
    --warning: 38 92% 50%;              /* #F59E0B */

    --border: 222 27% 15%;              /* #1C2333 */
    --input: 222 27% 16%;
    --ring: 204 6% 35%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased selection:bg-primary/20 selection:text-foreground;
  }
  h1, h2, h3, h4, .font-heading {
    @apply font-sans tracking-tight;
  }
}
```

### Tailwind Configuration (`tailwind.config.ts`)
Extend `tailwind.config.ts` so `font-sans`, `font-numeric`, `bg-commerce`, `border-primary-border`, and `bg-sidebar` work as first-class utility classes:

```typescript
// tailwind.config.ts (theme.extend)
fontFamily: {
  sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
  numeric: ['var(--font-numeric)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
},
colors: {
  'primary-border': 'hsl(var(--primary-border))',
  commerce: {
    DEFAULT: 'hsl(var(--commerce))',
    foreground: 'hsl(var(--commerce-foreground))',
  },
  sidebar: {
    DEFAULT: 'hsl(var(--sidebar))',
    foreground: 'hsl(var(--sidebar-foreground))',
    border: 'hsl(var(--sidebar-border))',
  },
},
```

---

## 4. Marketplace Feed Layout & 6-Slide In-Feed Carousel Specification

### 4.1 Top-of-Page Product Discovery Feed (`components/marketplace/MarketplaceView.tsx`)
* **Remove Top Hero & Metric Grid:** Do **not** render the large Hero banner or the 4-card metrics row above the product listings.
* **Immediate Top Controls:** Place the **Search Input**, **Location Filter** (`All Locations`, Nigerian states/cities), and **Category Pills** directly at the top of the Marketplace view, followed immediately by the **Product Listings Grid** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`).

### 4.2 Eight-Slide In-Feed Carousel (`components/marketplace/InFeedPromoCarousel.tsx`)
* **Placement Rule (Every 25 Product Listings):**
  * Render the full-width carousel (`col-span-full`) inside the product listings feed **after every 25 products** (i.e., after the 25th listing, 50th listing, 75th listing, etc., whenever `(index + 1) % 25 === 0`).
  * Ensure the carousel spans the full width of the feed grid cleanly without breaking card alignment before or after it.
* **Eight Required Slides (Swipeable on Mobile + Prev/Next Arrows & Pagination Dots on Desktop):**
  1. **Slide 1 — Platform Value Proposition (Former Hero):**
     * **Headline:** `Discover products worth sharing.`
     * **Body:** `Browse quality products from our favourite brands and vendors.`
     * **CTA:** `Open Referrals Inbox` button (`bg-primary text-primary-foreground`).
  2. **Slide 2 — Platform Value Proposition (Former Hero):**
     * **Headline:** `Share them with others.`
     * **Body:** `Share traceable product referrals with people you know.`
     * **CTA:** `Open Referrals Inbox` button (`bg-primary text-primary-foreground`).
  3. **Slide 3 — Platform Value Proposition (Former Hero):**
     * **Headline:** `Get paid when they make sales.`
     * **Body:** `Earn from genuine qualifying sales across your permanent referral ancestry.`
     * **CTA:** `Open Referrals Inbox` button (`bg-primary text-primary-foreground`). 
  4. **Slide 4 — Direct Marketplace vs. Referral-Card Attribution:**
     * **Eyebrow / Badge:** `Attribution Rule`
     * **Headline:** `Direct Marketplace vs. Referral-Card Attribution`
     * **Body:** `Buying from a general listing is a direct order (₦0 referral commission). Buying from a traceable Referral Card anchors the 20% commission pool.`
  5. **Slide 5 — Referral Pool Source:**
     * **Icon:** `Percent` / `Coins` icon in a subtle `bg-muted` pill
     * **Label:** `Referral Pool Source`
     * **Highlight Value (`font-numeric`):** `20% of 10%`
     * **Subtext:** `Of eligible NairaScout commission`
  6. **Slide 6 — Permanent Ancestry Depth:**
     * **Icon:** `GitBranch` / `Network` icon in a subtle `bg-muted` pill
     * **Label:** `Permanent Ancestry Depth`
     * **Highlight Value (`font-numeric`):** `Up to 13 Gen`
     * **Subtext:** `Ineligible ancestors are never skipped`
  7. **Slide 7 — Seller Fulfilment SLA:**
     * **Icon:** `ShieldCheck` / `Truck` icon in a subtle `bg-muted` pill
     * **Label:** `Seller Fulfilment SLA`
     * **Highlight Value (`font-numeric`):** `10 Days`
     * **Subtext:** `Delivery verified before release`
  8. **Slide 8 — Monthly Payout Policy:**
     * **Icon:** `Wallet` / `Banknote` icon in a subtle `bg-muted` pill
     * **Label:** `Monthly Payout Policy`
     * **Highlight Value (`font-numeric`):** `₦5,000 Min`
     * **Subtext:** `15th of each month · NGN`
* **Carousel Styling & Controls:**
  * **Container:** `rounded-2xl border bg-card p-5 md:p-6 shadow-sm`
  * **Interaction:** Touch-swipe horizontal scrolling (`overflow-x-auto snap-x snap-mandatory scroll-smooth`) on mobile, plus subtle `ChevronLeft` / `ChevronRight` buttons and `6` interactive indicator dots (`w-2 h-2 rounded-full`, active dot `w-6 bg-foreground`) at the bottom of the card.

---

## 5. Navigation Architecture (Desktop Left Sidebar + Mobile Bottom Bar)

### 5.1 Desktop Left Sidebar (`hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0`)
* **Top Brand Header:** NairaScout `N` geometric icon + `NairaScout` in `font-sans font-bold text-lg tracking-tight`.
* **Primary Navigation Links:**
  1. `Marketplace` (Product discovery feed — default home)
  2. `Referrals` (Sent & Received Referral Cards inbox with unread badge)
  3. `Network` (13-Generation Network Explorer + Scouts List contacts & invitations)
  4. `Wallet` (Scout Kobo Wallet, Pending vs. Available balance, Payout tracker)
  5. `Seller Hub` (Seller activation, Draft/Published listings, Orders, Team)
  6. `Settings` (Profile, Privacy/Mute controls, Verification status, Account Closure)
  7. `Admin` *(Rendered conditionally only when `platformAdminRole` is present)*
* **Sidebar Footer:** Compact authenticated user card (`avatar`, `displayName`, `@username`, and **Light / Deep Obsidian Dark Mode** theme switcher button).

### 5.2 Desktop Top Utility Bar (`sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur-md`)
* **Search & Location Cluster:** Integrated product search input + Location filter dropdown right in the top discovery bar.
* **Right Utility Cluster:**
  * **Theme Toggle Button** (`Sun` / `Moon` icon switching `light` <-> `dark`)
  * **Notifications Bell** (with live unread dot)
  * **Quick Profile / Sign Out Menu**

### 5.3 Mobile Bottom Navigation Bar (`md:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t bg-card/95 backdrop-blur-md`)
1. **Feed** (`Home` / `Compass` icon -> Marketplace)
2. **Referrals** (`Send` / `Share2` icon -> Referrals Inbox)
3. **Network** (`Users` icon -> 13-Gen Network & Scouts List)
4. **Wallet** (`Wallet` icon -> Scout Wallet)
5. **Account** (`User` / `Store` icon -> opens sheet/menu for Seller Hub, Settings, Theme Toggle, and Admin)

---

## 6. Core Component Visual Specifications

### 6.1 Product Discovery Card (`components/marketplace/ProductCard.tsx`)
* **Container:** `rounded-2xl border bg-card overflow-hidden transition-all hover:border-primary/50`
* **Seller Attribution Strip (Top of Card):** Small avatar + `sellerName` + **Seller Badge** (`ACTIVE` seller indicator; separate shield badge only if `verificationStatus === 'VERIFIED'`).
* **Product Media (`aspect-[4/3]`):** Rounded inner image container (`bg-muted`) with category pill badge.
* **Details:**
  * Title: `font-sans text-sm font-semibold line-clamp-1 text-foreground`
  * Description: `font-sans text-xs text-muted-foreground line-clamp-2`
  * Price: `font-numeric text-base font-bold tabular-nums text-foreground` (e.g., `₦18,500.00`)
* **Dual Action Button Row (`grid grid-cols-2 gap-2 pt-2`):**
  * Left Button (**`BUY`**): `bg-commerce text-commerce-foreground hover:bg-commerce/90 font-sans text-xs font-bold uppercase tracking-wider rounded-lg h-9` (**Pure Black `#000000`** with white text in Light Mode; **Pure White `#FFFFFF`** with black text in Dark Mode).
  * Right Button (**`REFER`**): `bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90 font-sans text-xs font-bold uppercase tracking-wider rounded-lg h-9` (**Charcoal Black `#292D2F`** with white text in both Light Mode and Deep Obsidian Dark Mode, with a subtle `#3E4346` border in Dark Mode).

### 6.2 Scout Wallet Hero Card (`components/wallet/WalletHeroCard.tsx`)
* **Container:** `bg-[#292D2F] border border-primary-border text-white rounded-2xl p-5 shadow-sm`
* **Typography:**
  * Label (`Available Balance`): `font-sans text-xs font-medium text-white/75`
  * Balance (`₦48,500.00`): `font-numeric text-3xl font-bold tracking-tight tabular-nums text-white`
  * Sub-row (`Pending Escrow` vs. `Total Withdrawn`): `font-numeric text-xs tabular-nums text-white/85`

### 6.3 Slide-Up Referral Card Drawer (`components/referrals/ReferProductModal.tsx`)
* **Container:** `rounded-t-3xl md:rounded-2xl bg-card border-t md:border p-5`
* **Header:** `Referral Card` in `font-sans text-lg font-bold` + close (`X`) button.
* **Quick Social Share Pills (Full-Width Stack on Mobile):**
  * **WhatsApp:** `bg-[#25D366] text-white rounded-full h-11 font-sans font-semibold`
  * **X / Twitter:** `bg-[#1DA1F2] text-white rounded-full h-11 font-sans font-semibold`
  * **Instagram / Copy Link:** `bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-full h-11 font-sans font-semibold`
* **Primary Send Button & Recipient Selector:** Shows live cap indicator (`Selected: X / 20 recipients` in `font-numeric text-xs tabular-nums`) with a full-width `bg-primary text-primary-foreground border border-primary-border` (`#292D2F` Charcoal Black) submit button.

---

## 7. Modular Folder Architecture (`src/` or `app/` + `components/`)

```text
components/
├── layout/
│   ├── AppShell.tsx               # Coordinates Desktop Sidebar + TopBar + Mobile BottomNav
│   ├── DesktopSidebar.tsx         # Left navigation rail + user card + theme switcher
│   ├── TopUtilityBar.tsx          # Search bar + Light/Dark toggle + notifications
│   ├── MobileBottomNav.tsx        # 5-tab mobile navigation bar
│   └── ThemeProvider.tsx          # next-themes provider (attribute="class", defaultTheme="dark")
├── marketplace/
│   ├── MarketplaceView.tsx        # Top search/location filter + product grid + 25-item carousel injection
│   ├── ProductCard.tsx            # Electric Social Pulse card with Black/White BUY + Charcoal REFER actions
│   └── InFeedPromoCarousel.tsx    # 6-slide swipeable carousel rendered after every 25 product listings
├── referrals/
│   ├── ReferralsView.tsx          # Sent & Received Referral Cards inbox
│   └── ReferProductModal.tsx      # Slide-up Referral Card drawer (Social pills + 20-cap selector)
├── network/
│   ├── NetworkView.tsx            # 13-generation explorer + Scouts List tabs
│   └── ScoutsListPanel.tsx        # Invitations, contacts, block/report actions
├── wallet/
│   ├── WalletView.tsx             # Ledger history + payout request modal
│   └── WalletHeroCard.tsx         # Charcoal Black (#292D2F) balance hero card
├── seller/
│   └── SellerHubView.tsx          # Onboarding, verification status banner, drafts, team seats
├── settings/
│   └── SettingsView.tsx           # Profile, privacy/mute toggles, verification docs, closure
└── admin/
    └── AdminConsoleView.tsx       # Verification queue, restrictions, maker-checker approvals
```

---

## 8. Implementation Checklist for the Coding Agent

1. [ ] Install `next-themes` (`npm install next-themes`) and wrap `app/layout.tsx` in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`.
2. [ ] Load `Plus_Jakarta_Sans` (`--font-sans`) and `Inter` (`--font-numeric`) in `app/layout.tsx` and map them in `tailwind.config.ts`.
3. [ ] Replace `app/globals.css` with the Light Mode (`#F8F9FB` + `#000000` `BUY` + `#292D2F` `REFER`) and Deep Obsidian Dark Mode (`#07090E` + `#FFFFFF` `BUY` + `#292D2F` `REFER` with `#3E4346` border) CSS variables from Section 3.
4. [ ] Move the **Product Discovery Feed** (with Search Bar and Location Filter) to the very top of `MarketplaceView.tsx`, and replace the former Hero + 4-card metrics section with `InFeedPromoCarousel.tsx` (6 slides, rendered after every **25 product listings**).
5. [ ] Refactor `HeaderNav.tsx` and `NairaScoutApp.tsx` into the modular `AppShell` (`DesktopSidebar` on `md+` screens, `MobileBottomNav` on `<md` screens, and `TopUtilityBar` with Light/Dark theme toggle).
