# NAIRASCOUT — UI POLISH & COMPONENT REFINEMENT INSTRUCTIONS (v1.2)
## Implementation Specification for Coding Agent

**Document Version:** 1.2  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons  
**Scope:** Avatar-Only vs. Stacked Identity Display Rules, Account Settings Page Refinements (Header Link, Horizontally Sliding Capsule Tabs, Stacked Account Closure CTA), and Symmetrical Select/Dropdown Chevron Padding.

---

## 1. User Avatar & Identity Display Rules Across the Platform

### Target File(s)
* `components/shared/UserAvatar.tsx` (create a reusable avatar component)
* `components/layout/TopUtilityBar.tsx` / `HeaderNav.tsx` (header user trigger)
* `components/network/ScoutsListPanel.tsx` / `NetworkView.tsx` (Scouts List search bar smart suggestion dropdown, active contacts, and pending invitations)
* `components/marketplace/ProductCard.tsx`, `components/referrals/ReferProductModal.tsx`, and `components/admin/AdminConsoleView.tsx`

### Requirements
1. **Create a Reusable `<UserAvatar />` Component (`components/shared/UserAvatar.tsx`):**
   * Accepts `avatarUrl?: string | null`, `displayName: string`, `username?: string`, `size?: 'sm' | 'md' | 'lg'`, and `className?: string`.
   * Renders the user's `avatarUrl` image (`object-cover rounded-full`) when present, and falls back gracefully to a styled monogram circle showing the first 1–2 uppercase initials of `displayName` (or `username`) on a subtle Charcoal/Muted surface (`bg-primary text-primary-foreground font-sans font-bold`).
2. **Rule A — Avatar-Only Contexts (Where Full Name & Username Are Not Necessary):**
   * In compact chrome triggers such as the **Top Utility Bar / Header profile button**, render **only the `<UserAvatar />` circle** (with an `aria-label` and hover tooltip containing the user's display name) instead of cluttering the top header with full name and `@username` text.
3. **Rule B — Stacked Full Identity Contexts (Avatar + Full Name + `@username` Underneath):**
   * Wherever all three identity fields are needed—specifically inside the **Scouts List search bar smart suggestion dropdown**, **Scouts List contact cards**, **pending invitation rows**, and **user inspection cards**—render a horizontal flex row (`flex items-center gap-3`) containing:
     * **Left:** `<UserAvatar />` (`h-9 w-9` or `h-10 w-10` circular avatar).
     * **Right (Stacked Vertically — `flex flex-col min-w-0`):**
       * **Top Line:** `displayName` (`font-sans text-sm font-semibold text-foreground truncate`) alongside any applicable `Seller` badge.
       * **Bottom Line (Directly Under Full Name):** `@${username}` (`font-sans text-xs text-muted-foreground truncate`).
   * Never place `@username` inline beside `displayName` with a bullet separator in search dropdown results; always stack `@username` cleanly underneath `displayName`.

### Reference Component Pattern
```tsx
// components/shared/UserIdentityRow.tsx
import { UserAvatar } from './UserAvatar';

interface UserIdentityRowProps {
  avatarUrl?: string | null;
  displayName: string;
  username: string;
  badge?: React.ReactNode;
}

export function UserIdentityRow({
  avatarUrl,
  displayName,
  username,
  badge,
}: UserIdentityRowProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size="md" />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-sans text-sm font-semibold text-foreground truncate">
            {displayName}
          </span>
          {badge}
        </div>
        <span className="font-sans text-xs text-muted-foreground truncate">
          @{username}
        </span>
      </div>
    </div>
  );
}
```

---

## 2. Account Settings Page Refinements (`components/settings/SettingsView.tsx` / `app/settings/page.tsx`)

### Requirements
1. **Header Back Link Text Update:**
   * Change the top navigation back link from `"← Back to NairaScout Workspace"` to **`"← Back to Home"`**.
2. **Horizontally Sliding Capsule Tabs:**
   * Replace the existing tab strip for **`Profile`**, **`Privacy & Referrals`**, **`Verification & Banking`**, and **`Account Lifecycle`** with **horizontally scrollable/sliding capsule pills**:
     * Outer container: `flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 snap-x` (so on mobile screens users can smoothly swipe/slide horizontally between all four capsules without wrapping onto two rows or squishing labels).
     * Each tab button (`whitespace-nowrap shrink-0 snap-start rounded-full px-4 py-2 font-sans text-xs font-semibold transition-all`):
       * **Active Capsule:** `bg-primary text-primary-foreground border border-primary-border shadow-xs` (`#292D2F` Charcoal Black with white text).
       * **Inactive Capsule:** `bg-secondary/70 text-muted-foreground border border-transparent hover:bg-secondary hover:text-foreground`.
3. **Stacked `'Open Closure Flow'` Button in `'Account Lifecycle'` Tab:**
   * Inside the **`Account Lifecycle`** tab, update the layout of the `"Two-Track Account & Seller Closure"` section so the **`Open Closure Flow`** button is **stacked vertically underneath** the heading and explanatory paragraph—never sitting side-by-side to the right on desktop or mobile:
     ```tsx
     <div className="rounded-2xl border bg-card p-5 flex flex-col items-start gap-4">
       <div className="space-y-1.5">
         <h3 className="font-sans text-base font-bold text-foreground">
           Two-Track Account &amp; Seller Closure
         </h3>
         <p className="font-sans text-sm leading-relaxed text-muted-foreground">
           Choose Track 1 to close only your Seller store while keeping your Scout identity and commission wallet active, or Track 2 to permanently close your full NairaScout account while preserving immutable ancestry &amp; ledger history.
         </p>
       </div>
       <button
         type="button"
         onClick={() => setClosureDialogOpen(true)}
         className="w-full sm:w-auto rounded-xl bg-destructive px-4 py-2.5 font-sans text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
       >
         Open Closure Flow
       </button>
     </div>
     ```

---

## 3. Symmetrical Padding on Every Dropdown / Select Field (`<select>` & shadcn `<Select>`)

### Target File(s)
* `app/globals.css`
* `components/ui/select.tsx` (if using shadcn/ui Select)
* Every native `<select>` element across `MarketplaceView.tsx` (Location & Category filters), `SellerHubView.tsx`, `SettingsView.tsx`, `NetworkView.tsx`, `ReferProductModal.tsx`, and `AdminConsoleView.tsx`.

### Problem & Requirement
* Currently, native `<select>` elements use browser default arrow placement, pushing the dropdown chevron (`v`) flush against the right edge while the option text has comfortable left padding (`pl-3` or `pl-3.5`).
* **Symmetry Rule:** Every dropdown selection field across the entire app must have **equal horizontal inset** on both sides—specifically **`14px` (`0.875rem` / `pl-3.5`)** between the left edge and the selected option text, and **`14px` (`0.875rem` / `right: 0.875rem`)** between the dropdown chevron (`v`) and the right edge of the field, plus **`pr-10` (`2.5rem`)** text clearance so long option labels never collide with the chevron.

### Global CSS + Custom Chevron Implementation (`app/globals.css`)
Apply `appearance-none` globally (or via a shared select utility class) to all `<select>` elements and render a crisp, theme-aware SVG chevron positioned at `right 0.875rem center` (`14px` from the right border) matching the `0.875rem` (`14px`) left padding:

```css
/* Add inside @layer base in app/globals.css */
select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-left: 0.875rem;   /* 14px left padding */
  padding-right: 2.5rem;    /* 40px right padding so text clears the chevron */
  background-repeat: no-repeat;
  background-position: right 0.875rem center; /* 14px symmetrical inset from right edge */
  background-size: 1rem 1rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

.dark select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}
```

* If any component uses shadcn/ui `<SelectTrigger>`, ensure its horizontal padding is `px-3.5` (`14px` on both left and right) so its chevron icon also sits `14px` from the right border.

---

## 4. Verification Checklist for the Coding Agent

1. [ ] Top header renders the user's circular avatar **alone** (without redundant full name or `@username`), while the **Scouts List search bar smart suggestion dropdown** renders the avatar alongside the **Full Name** with **`@username` stacked directly underneath**.
2. [ ] Account Settings page header reads **`"← Back to Home"`**.
3. [ ] Account Settings tabs (**`Profile`**, **`Privacy & Referrals`**, **`Verification & Banking`**, **`Account Lifecycle`**) render as **horizontally sliding capsule pills** (`rounded-full overflow-x-auto`).
4. [ ] Inside **`Account Lifecycle`**, the **`Open Closure Flow`** button sits **stacked below** the `"Two-Track Account & Seller Closure"` heading and description.
5. [ ] Every `<select>` and dropdown field across Marketplace, Settings, Seller Hub, Network, and Admin displays its dropdown chevron (`v`) inset **`14px` (`0.875rem`)** from the right edge—matching the **`14px`** left padding of the selected option text.
