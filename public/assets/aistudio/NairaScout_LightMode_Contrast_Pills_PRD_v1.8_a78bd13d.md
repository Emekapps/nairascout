# NAIRASCOUT — LIGHT MODE SURFACE CONTRAST, PILL TOKENS & SELLER HEADER STACK PRD (v1.8)
## Implementation Specification for Coding Agent

**Document Version:** 1.8  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons  
**Scope:**
1. Feed / Marketplace Page (Light Mode unhighlighted category pills `#FFFFFF`)
2. Network Page (Light Mode `#D1D5DB` pill containers, `#FFFFFF`/`#000000` unhighlighted & `#000000`/`#FFFFFF` highlighted pills, Pending Invitations sub-pills, and normalized `"Network"` heading font size matching `"Referrals"` and `"Wallet"`)
3. Wallet Page (Light Mode `#FFFFFF` card backgrounds for `"Paid (Cumulative)"` and `"Reversed (Cumulative)"` widgets, plus `#D1D5DB` / `#FFFFFF` / `#000000` Ledger filter pills)
4. Account Settings Page (Light Mode unhighlighted capsule pills `#FFFFFF` background with `#000000` text)
5. Seller Hub & Listings (`Dashboard` Header — Larger rounded-square Business Logo frame + exact 6-row vertical stack order + `#D1D5DB` / `#FFFFFF` / `#000000` navigation pills)

---

## 1. Shared Light Mode Pill & Tab Bar Specification

In **Light Mode** (when `dark` class is not active), apply the following uniform pill styling across **Network**, **Wallet (Ledger)**, **Account Settings**, and **Seller Hub & Listings**:
* **Pill Track / Container:** `bg-[#D1D5DB] dark:bg-muted p-1 rounded-full` (or `rounded-xl` where appropriate)
* **Unhighlighted / Inactive Pill:** `bg-[#FFFFFF] text-[#000000] dark:bg-card dark:text-foreground hover:opacity-90 transition-colors`
* **Highlighted / Active Pill:** `bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-sm`

---

## 2. Page-by-Page Requirements

### 2.1 Feed / Marketplace Page (`components/marketplace/MarketplaceView.tsx`)
* **Category Pills Under Header (Light Mode):**
  * **Unhighlighted Category Pills:** Set background to **Pure White (`bg-[#FFFFFF]`)** in Light Mode while keeping the existing text color (`text-foreground` / current label styling) and preserving Dark Mode styling (`dark:bg-[#181818]`).

---

### 2.2 Network Page (`components/network/NetworkView.tsx`)
1. **Normalize `"Network"` Heading Font Size:**
   * Match the exact heading typography class used by `"Referrals"` and `"Wallet"` (e.g., `text-xl md:text-2xl font-bold tracking-tight text-foreground`—reduce it from any oversized `text-2xl`/`text-3xl` heading so `"Network"`, `"Referrals"`, and `"Wallet"` share identical scale and weight).
2. **Primary Tabs Under `"Network"` Heading (`Ancestry`, `Scouts`, `Calculator`) — Light Mode:**
   * **Pills Container:** `bg-[#D1D5DB]` in Light Mode (`dark:bg-[#181818]`).
   * **Unhighlighted Pills:** `bg-[#FFFFFF] text-[#000000]` in Light Mode.
   * **Highlighted Pill:** `bg-[#000000] text-[#FFFFFF]` in Light Mode.
3. **`Scouts` Tab → `Pending Invitations` Filter Pills (`Received`, `Sent`) — Light Mode:**
   * **Pills Container:** `bg-[#D1D5DB]` in Light Mode.
   * **Highlighted Pill:** `bg-[#000000] text-[#FFFFFF]` in Light Mode (and unhighlighted pill `bg-[#FFFFFF] text-[#000000]`).

---

### 2.3 Wallet Page (`components/wallet/WalletView.tsx`)
1. **Cumulative Balance Widgets (Light Mode):**
   * Set the card background of **`"Paid (Cumulative)"`** to **Pure White (`bg-[#FFFFFF]`)** in Light Mode (`dark:bg-[#181818]`).
   * Set the card background of **`"Reversed (Cumulative)"`** to **Pure White (`bg-[#FFFFFF]`)** in Light Mode (`dark:bg-[#181818]`).
2. **Pills Under `"Ledger"` Heading (Light Mode):**
   * **Pills Container:** `bg-[#D1D5DB]` in Light Mode (`dark:bg-[#181818]`).
   * **Unhighlighted Pills:** `bg-[#FFFFFF] text-[#000000]` in Light Mode.
   * **Highlighted Pill:** `bg-[#000000] text-[#FFFFFF]` in Light Mode.

---

### 2.4 Account Settings Page (`components/settings/AccountSettingsView.tsx`)
* **Sliding Capsule Pills Under `"Account Status: (√) ACTIVE"` (`Profile`, `Privacy & Referrals`, `Verification & Banking`, `Account Lifecycle`) — Light Mode:**
  * **Unhighlighted Pills:** Set background to **Pure White (`bg-[#FFFFFF]`)** and text to **Pure Black (`text-[#000000]`)** in Light Mode (keeping the active pill highlighted in `bg-[#000000] text-[#FFFFFF]` in Light Mode).

---

### 2.5 Seller Hub & Listings (`components/seller/SellerHubView.tsx`)
1. **Larger Rounded-Square Business Logo Frame:**
   * Render the Business Logo frame/uploader as a **square with rounded corners (`rounded-xl` or `rounded-2xl`)** instead of a circle, and increase its dimensions slightly (e.g., `w-16 h-16` / `64px × 64px` on mobile and `w-20 h-20` / `80px × 80px` on desktop, with `object-cover`).
2. **Exact 6-Row Vertical Stack Order in Seller Header:**
   Arrange the Seller Dashboard header elements strictly in this top-to-bottom stack order:
   * **Row 1 (Top Row):** Business Logo uploader (rounded square) alongside the **`"Dashboard"`** heading (`flex items-center gap-3.5`).
   * **Row 2 (Second Row):** **Business Name** (`seller_name`, prominent semibold/bold text).
   * **Row 3 (Third Row):** **Seller Status** badge/indicator (`seller_status`, e.g., `ACTIVE`).
   * **Row 4 (Fourth Row):** **Verification Status** badge/indicator (`verification_status`, e.g., `VERIFIED` / `SUBMITTED`).
   * **Row 5 (Fifth Row):** **Subscription Plan** badge/label (`subscription_plan`, e.g., `Starter`, `Traction`, `Growth`, `Sprawl`).
   * **Row 6 (Sixth Row):** **`"Close Seller Capabilities"`** action link.
3. **Pills Directly Under `"Close Seller Capabilities"` Link (Light Mode):**
   * **Pills Container:** `bg-[#D1D5DB]` in Light Mode (`dark:bg-[#181818]`).
   * **Unhighlighted Pill:** `bg-[#FFFFFF] text-[#000000]` in Light Mode.
   * **Highlighted Pill:** `bg-[#000000] text-[#FFFFFF]` in Light Mode.

---

## 3. Verification Checklist for the Coding Agent

1. [ ] **Feed (Light Mode):** Unhighlighted category pills under the header have `bg-[#FFFFFF]` with existing text styling.
2. [ ] **Network (Light Mode):** `"Network"` heading matches the font size of `"Referrals"` and `"Wallet"`; main tab pills and `Pending Invitations` pills sit inside a `bg-[#D1D5DB]` container with `bg-[#FFFFFF] text-[#000000]` unhighlighted and `bg-[#000000] text-[#FFFFFF]` highlighted.
3. [ ] **Wallet (Light Mode):** `"Paid (Cumulative)"` and `"Reversed (Cumulative)"` widgets use `bg-[#FFFFFF]`; `"Ledger"` filter pills use a `bg-[#D1D5DB]` container with `bg-[#FFFFFF] text-[#000000]` unhighlighted and `bg-[#000000] text-[#FFFFFF]` highlighted.
4. [ ] **Account Settings (Light Mode):** Unhighlighted capsule pills under `"Account Status: (√) ACTIVE"` use `bg-[#FFFFFF] text-[#000000]`.
5. [ ] **Seller Hub & Listings (Light Mode):** Business logo frame is a larger rounded square (`rounded-xl`/`rounded-2xl`, `64px–80px`); header stacks strictly in the 6-row order (Logo + `"Dashboard"` → Business Name → Seller Status → Verification Status → Subscription Plan → `"Close Seller Capabilities"`); and the pills underneath use a `bg-[#D1D5DB]` container with `bg-[#FFFFFF] text-[#000000]` unhighlighted and `bg-[#000000] text-[#FFFFFF]` highlighted.
