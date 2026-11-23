# NAIRASCOUT — UI & DESIGN REFINEMENT INSTRUCTIONS (v1.1)
## Implementation Specification for Coding Agent

**Document Version:** 1.1 (Updated Network Page Heading, Dismissible Explainer Panel, Tab Renaming, and Mobile Guest Button Stacking)  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, `next-themes`, Framer Motion, Lucide Icons  
**Scope:** Feed Page Dismissible Notification Panel, Midnight Obsidian (`#101010`) Dark Theme, Draggable Animated Guest Account Bottom Sheet, Network Page Updates (Heading, Dismissible Explainer Panel, Tab Renaming, Mobile Stacked Guest Buttons), Theme Toggle Icon Colors, and Lexend Extrabold Wordmark.

---

## Reusable Dismissible Notice Component (`components/shared/DismissibleNoticePanel.tsx`)

Create a single reusable, SSR-safe component for both the **Feed Page** and the **Network Page** notification panels so persistence and dismissal logic remain consistent across the app:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

interface DismissibleNoticePanelProps {
  storageKey: string;
  title?: string;
  description: string;
  ariaLabel: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function DismissibleNoticePanel({
  storageKey,
  title,
  description,
  ariaLabel,
}: DismissibleNoticePanelProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setVisible(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed.status === 'dismissed_permanent') {
        setVisible(false);
      } else if (parsed.status === 'dismissed_temp' && Date.now() >= parsed.dismissUntil) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  const handleDismiss30Days = () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ status: 'dismissed_temp', dismissUntil: Date.now() + THIRTY_DAYS_MS })
    );
    setVisible(false);
  };

  const handleDismissPermanent = () => {
    localStorage.setItem(storageKey, JSON.stringify({ status: 'dismissed_permanent' }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className="mb-4 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-muted p-2 text-foreground">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          {title && (
            <h2 className="font-sans text-sm font-bold text-foreground">
              {title}
            </h2>
          )}
          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleDismiss30Days}
              className="rounded-lg bg-primary px-3 py-1.5 font-sans text-xs font-semibold text-primary-foreground border border-primary-border hover:bg-primary/90 transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleDismissPermanent}
              className="rounded-lg border border-border bg-secondary px-3 py-1.5 font-sans text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Don’t show this again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 1. Feed Page Dismissible Notification Panel (`General Product Discovery`)

### Target File(s)
* `components/marketplace/MarketplaceView.tsx`

### Requirements
1. Remove the static `"General Product Discovery"` page heading and its descriptive support text `"Direct BUY initiates a direct marketplace order • REFER shares a traceable Referral Card"` from above the product grid.
2. Render `<DismissibleNoticePanel />` **directly above the Search Bar** on the Feed page:
   * `storageKey`: `'nairascout_feed_discovery_notice_v1'`
   * `title`: `'General Product Discovery'`
   * `description`: `'Direct BUY initiates a direct marketplace order • REFER shares a traceable Referral Card'`
   * `ariaLabel`: `'General Product Discovery Notice'`
3. Clicking **`Dismiss`** hides the panel for **30 days**; clicking **`Don’t show this again`** hides it **permanently**.

---

## 2. Dark Mode Theme Color: Midnight Obsidian (`#101010`)

### Target File(s)
* `app/globals.css` (and any hardcoded `#07090E` references across layout/theme files)

### Requirements
1. Replace **Deep Obsidian (`#07090E`)** with **Midnight Obsidian (`#101010` / `hsl(0 0% 6.3%)`)** as the dark mode `--background` color.
2. Keep elevated dark mode card/sidebar surfaces cleanly layered above `#101010`:

```css
.dark {
  /* DARK MODE — Midnight Obsidian (#101010) + Charcoal Black (#292D2F) Buttons */
  --background: 0 0% 6.3%;            /* #101010 — Midnight Obsidian */
  --foreground: 210 40% 98%;          /* #F8FAFC */

  --card: 0 0% 9.5%;                  /* #181818 — Elevated Midnight Card */
  --card-foreground: 210 40% 98%;

  --popover: 0 0% 11%;                /* #1C1C1C */
  --popover-foreground: 210 40% 98%;

  --sidebar: 0 0% 8%;                 /* #141414 — Midnight Sidebar */
  --sidebar-foreground: 215 20% 75%;  /* #94A3B8 */
  --sidebar-border: 0 0% 16%;         /* #292929 */

  /* Primary Brand Action (REFER & Primary CTAs): Charcoal Black (#292D2F) */
  --primary: 200 7% 17%;              /* #292D2F */
  --primary-foreground: 0 0% 100%;    /* #FFFFFF */
  --primary-border: 204 6% 26%;       /* #3E4346 */

  /* Commerce Action (BUY buttons): Pure White (#FFFFFF) in Dark Mode */
  --commerce: 0 0% 100%;              /* #FFFFFF */
  --commerce-foreground: 0 0% 0%;     /* #000000 */

  --secondary: 0 0% 14%;              /* #242424 */
  --secondary-foreground: 210 40% 98%;

  --muted: 0 0% 14%;                  /* #242424 */
  --muted-foreground: 0 0% 62%;       /* #9E9E9E */

  --accent: 200 7% 17%;               /* #292D2F */
  --accent-foreground: 210 40% 98%;

  --destructive: 0 72% 51%;           /* #DC2626 */
  --destructive-foreground: 0 0% 100%;

  --success: 158 64% 52%;             /* #34D399 */
  --warning: 38 92% 50%;              /* #F59E0B */

  --border: 0 0% 16%;                 /* #292929 */
  --input: 0 0% 18%;                  /* #2E2E2E */
  --ring: 204 6% 35%;
}
```

---

## 3. Draggable & Animated Guest `Accounts` Bottom Sheet

### Target File(s)
* `components/layout/MobileBottomNav.tsx` (and the Guest Account bottom sheet component triggered when tapping **Accounts** on mobile)

### Requirements
1. **Smooth Slide-Up Entry & Slide-Down Exit Animation:**
   * When a Guest taps the **`Accounts`** tab in the mobile bottom navigation bar, animate the bottom sheet upward smoothly (`y: "100%"` -> `y: 0`) with a fade-in backdrop overlay (`bg-black/60 backdrop-blur-xs`).
2. **Three Dismissal Methods:**
   * Tapping the close (`X`) button inside the sheet header.
   * Tapping outside the sheet on the backdrop overlay.
   * **Dragging the sheet downward by its top drag handle** (`w-12 h-1.5 rounded-full bg-muted-foreground/30` inside a `touch-none` drag handle bar).
   * Using `framer-motion` (`drag="y"`, `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={{ top: 0, bottom: 0.6 }}`), close the sheet when `info.offset.y > 90 || info.velocity.y > 450`; otherwise spring back smoothly to `y: 0`.

---

## 4. Network Page Updates (`components/network/NetworkView.tsx`)

### Target File(s)
* `components/network/NetworkView.tsx`

### Requirements
1. **Page Heading Update:**
   * Change the Network page heading from `"Thirteen-Generation Network & Scouts List"` to **`"Network"`**.
2. **Dismissible Explainer Notification Panel:**
   * Replace the old static subheading (`"Inspect your permanent referral ancestry, manage Scouts List relationships with strict privacy controls, or test the server-side kobo commission engine"`) with `<DismissibleNoticePanel />` rendered below the `"Network"` heading:
     * `storageKey`: `'nairascout_network_explainer_notice_v1'`
     * `description`: `'Inspect your permanent referral ancestry, manage Scouts List with strict privacy controls, or calculate your Commissions'`
     * `ariaLabel`: `'Network Explainer Notice'`
   * Include the two action buttons **`Dismiss`** (hides for **30 days**) and **`Don’t show this again`** (hides **permanently**).
3. **Tab Label Updates:**
   * Relabel the three tabs inside `NetworkView.tsx`:
     * `"Network Explorer"` -> **`"Ancestry"`**
     * `"Scouts List"` -> **`"Scouts"`**
     * `"13-Gen Calculator"` -> **`"Calculator"`**
4. **Guest View Mobile Stacked Action Buttons:**
   * In the Network page **Guest view** (and anywhere else those two guest CTAs appear), stack **`"Sign In/Join Free"`** and **`"Open Commission Calculator"`** vertically on mobile (`flex flex-col sm:flex-row gap-3 w-full`) with full-width buttons (`w-full sm:w-auto min-h-[44px]`) so they never sit cramped side by side on phone screens.

---

## 5. Theme Toggle Icon Colors (Silver for Dark Mode, Yellow for Light Mode)

### Target File(s)
* `components/layout/TopUtilityBar.tsx`, `components/layout/DesktopSidebar.tsx`, and mobile theme toggle controls

### Requirements
1. **Dark Mode Icon (`Moon`):** Style in **Silver** (`text-[#C0C0C0]` / `text-slate-300` with `fill-slate-300/20`).
2. **Light Mode Icon (`Sun`):** Style in **Yellow** (`text-yellow-400` / `text-[#FACC15]` with `fill-yellow-400/20`).
3. Apply consistently across desktop top bar, desktop sidebar footer, and mobile account sheet.

---

## 6. Top Brand Header: `Lexend` Extrabold Wordmark (Remove `N` Geometric Icon)

### Target File(s)
* `app/layout.tsx`, `tailwind.config.ts`, `components/layout/DesktopSidebar.tsx`, `components/layout/TopUtilityBar.tsx` / mobile top header

### Requirements
1. **Load `Lexend` (Weight `800` / Extrabold) via `next/font/google`:**
   ```typescript
   // app/layout.tsx
   import { Plus_Jakarta_Sans, Inter, Lexend } from 'next/font/google';

   const lexend = Lexend({
     subsets: ['latin'],
     weight: ['800'],
     variable: '--font-brand',
     display: 'swap',
   });
   ```
   * Attach `lexend.variable` to `<html>` / `<body>` in `app/layout.tsx` and map `'brand': ['var(--font-brand)', 'sans-serif']` in `tailwind.config.ts`.
2. **Remove the Geometric `N` Icon Box:**
   * Remove the geometric `N` logo badge next to `NairaScout` in both the Desktop Left Sidebar header and the Mobile Top Header.
3. **Render Pure Wordmark:**
   * Display **`NairaScout`** as a clean standalone wordmark styled with `font-brand font-extrabold text-xl tracking-tight text-foreground`.

---

## 7. Verification Checklist for the Coding Agent

1. [ ] Feed page displays `"General Product Discovery"` and `"Direct BUY initiates a direct marketplace order • REFER shares a traceable Referral Card"` inside a dismissible panel above the search bar with **`Dismiss`** (30 days) and **`Don’t show this again`** (permanent).
2. [ ] Dark mode uses **Midnight Obsidian (`#101010`)** as its background canvas.
3. [ ] Tapping **`Accounts`** as a Guest on mobile opens an animated slide-up bottom sheet that closes via close button, outside backdrop tap, or **dragging down by the top handle**.
4. [ ] Network page heading reads **`"Network"`**, displays the updated explainer text inside a dismissible panel (**30-day Dismiss** / **Permanent Don’t show this again**), renames the tabs to **`"Ancestry"`**, **`"Scouts"`**, and **`"Calculator"`**, and stacks **`"Sign In/Join Free"`** and **`"Open Commission Calculator"`** vertically on mobile.
5. [ ] Dark Mode (`Moon`) icon is **Silver** and Light Mode (`Sun`) icon is **Yellow** across all theme toggles.
6. [ ] Top Brand Header displays **`NairaScout`** in **Lexend Extrabold (`800`)** with the geometric `N` icon removed.
