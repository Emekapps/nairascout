# NAIRASCOUT — DESIGN SYSTEM & FRONTEND ARCHITECTURE GUIDE
## Base Aesthetic: Electric Social Pulse (Mobile-First, Light & Deep Obsidian Dark Mode with Monochrome Action Buttons)

**Document Version:** 1.3 (Monochrome `BUY` & `REFER` Buttons: Pure Black/White `BUY` + `#292D2F` Charcoal Black `REFER`)  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, `next-themes`, Lucide Icons  
**Visual Reference:** Electric Social Pulse (Desktop Left-Sidebar Feed + Mobile Bottom-Nav & Slide-Up Referral Drawer)  
**Core Typography:** `Plus Jakarta Sans` (Headings, UI & Body Copy) + `Inter` with `tabular-nums` (Naira Prices, Kobo Ledger & Generation Counters)

---

## 1. Design Philosophy & Visual Direction

NairaScout combines the approachable, social-feed discovery of **Electric Social Pulse** with a crisp, editorial monochrome button hierarchy (`#000000` / `#FFFFFF` for `BUY` and `#292D2F` Charcoal Black for `REFER`) and trustworthy fintech clarity for Nigerian commerce:

1. **Mobile-First Social Commerce Layout:**
   * **Mobile (`< 768px`):** Clean top header (`NairaScout` wordmark + notifications + profile avatar), full-bleed single-column feed or 2-column compact product cards, persistent **5-tab bottom navigation bar**, and native-feeling **slide-up drawers** (`CheckoutDrawer`, `ReferProductModal` with quick-share pills for WhatsApp, X/Twitter, Instagram, and copy-link).
   * **Desktop (`>= 768px` / `lg:`):** Persistent **left navigation sidebar** (`240px` fixed width) with primary route links and user identity footer, sticky top search/utility bar with **Light / Deep Obsidian Dark Mode toggle**, and a responsive multi-column **Product Discovery Feed** (`grid-cols-2 xl:grid-cols-3`).
2. **Dual-Mode Color Strategy (Light Mode vs. Deep Obsidian Dark Mode):**
   * **Light Mode:** Warm, crisp alabaster surfaces (`#F8F9FB`) with pure white elevated cards (`#FFFFFF`), high-contrast slate ink (`#0F172A`), **Pure Black (`#000000`)** with white text for direct **`BUY`** actions, and **Charcoal Black (`#292D2F`)** with white text for **`REFER`** buttons and Scout Wallet hero surfaces.
   * **Dark Mode (Deep Obsidian):** True low-glare **Deep Obsidian (`#07090E`)** canvas with layered obsidian cards (`#0F131C`) and subtle hairline borders (`#1C2333`). Direct **`BUY`** buttons invert to high-contrast **Pure White (`#FFFFFF`)** with black text (`#000000`), while **`REFER`** buttons and Scout Wallet hero cards use **Charcoal Black (`#292D2F`)** with white text and a crisp `1px` hairline border (`#3E4346`) so both actions remain clearly distinguishable at a glance.
3. **Modular Frontend Architecture:**
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
| **Page & Section Headings** | `Plus Jakarta Sans` | `font-sans text-xl md:text-2xl font-bold tracking-tight` | Feed headers (`Product discovery feed`), Dashboard titles, Modal titles |
| **Card & Modal Subheadings** | `Plus Jakarta Sans` | `font-sans text-base font-semibold tracking-tight` | Product card titles, Referral drawer title, Wallet section headers |
| **Monetary & Naira Values** | `Inter` | `font-numeric font-bold tabular-nums` | Prices (`₦18,500.00`), Wallet balances (`₦48,500.00`), Commission pools (`20% of 10%`), Gen badges (`Gen 1`–`Gen 13`) |
| **Body & UI Copy** | `Plus Jakarta Sans` | `font-sans text-sm leading-relaxed` | Product descriptions, Scout bios, instructions, form labels |
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

## 4. Navigation Architecture (Desktop Left Sidebar + Mobile Bottom Bar)

### 4.1 Desktop Left Sidebar (`hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0`)
Matches the **Electric Social Pulse** desktop layout:
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

### 4.2 Desktop Top Utility Bar (`sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur-md`)
* **Search Input:** Full-width rounded search bar (`Search products, categories, or verified sellers...`) on the left.
* **Right Utility Cluster:**
  * **Theme Toggle Button** (`Sun` / `Moon` icon switching `light` <-> `dark`)
  * **Notifications Bell** (with live unread dot)
  * **Quick Profile / Sign Out Menu**

### 4.3 Mobile Bottom Navigation Bar (`md:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t bg-card/95 backdrop-blur-md`)
Matches the **Electric Social Pulse** mobile screen (`5` evenly spaced touch targets, minimum `48px` height, `pb-safe` for mobile home indicators):
1. **Feed** (`Home` / `Compass` icon -> Marketplace)
2. **Referrals** (`Send` / `Share2` icon -> Referrals Inbox)
3. **Network** (`Users` icon -> 13-Gen Network & Scouts List)
4. **Wallet** (`Wallet` icon -> Scout Wallet)
5. **Account** (`User` / `Store` icon -> opens sheet/menu for Seller Hub, Settings, Theme Toggle, and Admin)

---

## 5. Core Component Visual Specifications

### 5.1 Product Discovery Card (`components/marketplace/ProductCard.tsx`)
Matches the Electric Social Pulse product card grid with **Black/White `BUY`** and **Charcoal Black (`#292D2F`) `REFER`** buttons:
* **Container:** `rounded-2xl border bg-card overflow-hidden transition-all hover:border-primary/50`
* **Seller Attribution Strip (Top of Card):** Small avatar + `sellerName` + **Seller Badge** (`ACTIVE` seller indicator; separate shield badge only if `verificationStatus === 'VERIFIED'`).
* **Product Media (`aspect-[4/3]`):** Rounded inner image container (`bg-muted`) with category pill badge.
* **Details:**
  * Title: `font-sans text-sm font-semibold line-clamp-1 text-foreground`
  * Description: `font-sans text-xs text-muted-foreground line-clamp-2`
  * Price: `font-numeric text-base font-bold tabular-nums text-foreground` (e.g., `₦18,500.00`)
* **Dual Action Button Row (`grid grid-cols-2 gap-2 pt-2`):**
  * Left Button (**`BUY`**): `bg-commerce text-commerce-foreground hover:bg-commerce/90 font-sans text-xs font-bold uppercase tracking-wider rounded-lg h-9` (renders **Pure Black `#000000`** with white text in Light Mode, and **Pure White `#FFFFFF`** with black text in Dark Mode).
  * Right Button (**`REFER`**): `bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90 font-sans text-xs font-bold uppercase tracking-wider rounded-lg h-9` (renders **Charcoal Black `#292D2F`** with white text in both Light Mode and Deep Obsidian Dark Mode, with a subtle `#3E4346` border in Dark Mode).

### 5.2 Scout Wallet Hero Card (`components/wallet/WalletHeroCard.tsx`)
Unified **Charcoal Black (`#292D2F`)** executive fintech card across both Light Mode and Deep Obsidian Dark Mode:
* **Container:** `bg-[#292D2F] border border-primary-border text-white rounded-2xl p-5 shadow-sm`
* **Typography:**
  * Label (`Available Balance`): `font-sans text-xs font-medium text-white/75`
  * Balance (`₦48,500.00`): `font-numeric text-3xl font-bold tracking-tight tabular-nums text-white`
  * Sub-row (`Pending Escrow` vs. `Total Withdrawn`): `font-numeric text-xs tabular-nums text-white/85`

### 5.3 Slide-Up Referral Card Drawer (`components/referrals/ReferProductModal.tsx`)
Matches the mobile bottom sheet in your reference:
* **Container:** `rounded-t-3xl md:rounded-2xl bg-card border-t md:border p-5`
* **Header:** `Referral Card` in `font-sans text-lg font-bold` + close (`X`) button.
* **Quick Social Share Pills (Full-Width Stack on Mobile):**
  * **WhatsApp:** `bg-[#25D366] text-white rounded-full h-11 font-sans font-semibold`
  * **X / Twitter:** `bg-[#1DA1F2] text-white rounded-full h-11 font-sans font-semibold`
  * **Instagram / Copy Link:** `bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-full h-11 font-sans font-semibold`
* **Primary Send Button & Recipient Selector:** Shows live cap indicator (`Selected: X / 20 recipients` in `font-numeric text-xs tabular-nums`) with a full-width `bg-primary text-primary-foreground border border-primary-border` (`#292D2F` Charcoal Black) submit button.

---

## 6. Modular Folder Architecture (`src/` or `app/` + `components/`)

Organize frontend components into clean, self-contained feature modules so future modules (Orders, Disputes, Wallet Payouts, Analytics) plug into the shell cleanly:

```text
components/
├── layout/
│   ├── AppShell.tsx            # Coordinates Desktop Sidebar + TopBar + Mobile BottomNav
│   ├── DesktopSidebar.tsx      # Left navigation rail + user card + theme switcher
│   ├── TopUtilityBar.tsx       # Search bar + Light/Dark toggle + notifications
│   ├── MobileBottomNav.tsx     # 5-tab mobile navigation bar
│   └── ThemeProvider.tsx       # next-themes provider (attribute="class", defaultTheme="dark")
├── marketplace/
│   ├── MarketplaceView.tsx     # Discovery feed, location/category filters
│   └── ProductCard.tsx         # Electric Social Pulse card with Black/White BUY + Charcoal REFER actions
├── referrals/
│   ├── ReferralsView.tsx       # Sent & Received Referral Cards inbox
│   └── ReferProductModal.tsx   # Slide-up Referral Card drawer (Social pills + 20-cap selector)
├── network/
│   ├── NetworkView.tsx         # 13-generation explorer + Scouts List tabs
│   └── ScoutsListPanel.tsx     # Invitations, contacts, block/report actions
├── wallet/
│   ├── WalletView.tsx          # Ledger history + payout request modal
│   └── WalletHeroCard.tsx      # Charcoal Black (#292D2F) balance hero card
├── seller/
│   └── SellerHubView.tsx       # Onboarding, verification status banner, drafts, team seats
├── settings/
│   └── SettingsView.tsx        # Profile, privacy/mute toggles, verification docs, closure
└── admin/
    └── AdminConsoleView.tsx    # Verification queue, restrictions, maker-checker approvals
```

---

## 7. Implementation Checklist for the Coding Agent

1. [ ] Install `next-themes` (`npm install next-themes`) and wrap `app/layout.tsx` in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`.
2. [ ] Load `Plus_Jakarta_Sans` (`--font-sans`) and `Inter` (`--font-numeric`) in `app/layout.tsx` and map them in `tailwind.config.ts`.
3. [ ] Replace `app/globals.css` with the Light Mode (`#F8F9FB` + `#000000` `BUY` + `#292D2F` `REFER`) and Deep Obsidian Dark Mode (`#07090E` + `#FFFFFF` `BUY` + `#292D2F` `REFER` with `#3E4346` border) CSS variables from Section 3.
4. [ ] Refactor `HeaderNav.tsx` and `NairaScoutApp.tsx` into the modular `AppShell` (`DesktopSidebar` on `md+` screens, `MobileBottomNav` on `<md` screens, and `TopUtilityBar` with Light/Dark theme toggle).
5. [ ] Apply `font-sans` to all headings, body copy, navigation labels, and buttons, and `font-numeric tabular-nums` to all Naira prices, wallet balances, and generation badges across every existing view.
