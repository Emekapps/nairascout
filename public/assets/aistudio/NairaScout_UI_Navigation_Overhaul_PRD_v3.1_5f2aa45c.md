# NAIRASCOUT — UI, NAVIGATION & DEDICATED PAGES OVERHAUL PRD (v3.1)

Document Version: 3.1
Target Codebase: nairascout-main (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion)
Governing Baseline: CUSTOM_INSTRUCTIONS.md (v3.1), PRD v3.0 (Botanical Earth & Forest Olive), & Approved Modules 1–5

---

## 1. Objective & Architectural Guardrails

Refactor NairaScout's mobile/desktop navigation shell, Light Mode canvas colour, header touch targets, and multi-tabbed views into a 3-tab Bottom Navigation Bar (Home, Accounts, More Options) paired with dedicated sub-pages—layered cleanly on top of the v3.0 Botanical Earth & Forest Olive design system and Lato typography, while strictly preserving all Module 2–5 security, privacy, RBAC, integer kobo accounting, and Supabase data wiring.

### Non-Negotiable Guardrails
1. Zero Data/Logic Regression: Preserve all server-side RBAC, Supabase queries/mutations, lib/commission-engine.ts, 15-char NIST password rules, TOTP MFA gates, private-by-default Scout profiles, 250-char bio limit, 5 MB / 200x200 px square avatar validation, 20-item cursor pagination on Commission History, and the dedicated /products/[id] Product Detail Page (v3.0).
2. Traceability: Tag modified components and routes with // NS-UI-310 comments.
3. Mobile-First & Desktop Parity: Every dedicated page reachable from the mobile Accounts and More Options bottom drawers must also be cleanly reachable from DesktopSidebar.tsx on desktop viewports (md:).

---

## 2. Global Theme & Header Updates (NS-UI-311 – NS-UI-312)

### NS-UI-311: Warm Ivory Light Mode Canvas (#FBF7F2) Over Botanical Earth Tokens
* Files: app/globals.css, components/layout/AppShell.tsx, components/shared/DismissibleNoticePanel.tsx, and all page/pill containers.
* Requirements:
  - Update the Light Mode page canvas (--background) and secondary pill/container surfaces from Warm Oat/Beige (#F6EFE6 / #F6EFE5) to Warm Ivory (#FBF7F2) (--background: 34 53% 97%) across every element currently using Warm Oat/Beige.
  - Preserve all v3.0 Botanical Earth & Forest Olive accent tokens:
    * Cards & Unhighlighted Pills: Pure White (#FFFFFF) with 1px solid #E2DDD5 border
    * BUY / BUY DIRECT buttons: Rich Saddle Bronze (#6B4214, Dark Mode #8A5820) + #FFFFFF text
    * REFER buttons & Active Pills: Deep Forest Olive (#2E5339, Dark Mode #3A6B49) + #FFFFFF text
    * Selected Borders, Checkmarks & Positive Badges: Sage Olive (#5C7C5D, Dark Mode #6E9470)
    * Eyebrow / Social Proof Star Accents: Warm Ochre Gold (#C88A2B, Dark Mode #E0A13B)
    * Dark Mode Canvas: Deep Forest Charcoal (#121614) & Dark Moss Slate Cards (#1A201D)
    * Typography: Lato (400, 700, 900) across UI/headings/body; Lexend Extrabold (800) for NairaScout wordmark; tabular-nums on Naira figures.

### NS-UI-312: Top Header Brand Wordmark & Enlarged Touch Targets
* File: components/layout/TopUtilityBar.tsx
* Brand Wordmark (NairaScout):
  - Font family: Lexend Extrabold (font-extrabold, weight 800), no geometric N icon.
  - Font size: Increase on mobile to 27px (text-[27px] leading-none tracking-tight) to match Facebook's mobile wordmark prominence.
  - Colour: Brand Forest Green / Deep Forest Olive (#2E5339) in Light Mode; crisp White (#FFFFFF) in Dark Mode.
* Search Button & Notification Button:
  - Set both icons to 44px x 44px (w-[44px] h-[44px], size={44} or crisp SVG scaled to 44px).
  - Set the interactive button/tappable container around each icon to 74px tall x 58px wide (h-[74px] w-[58px] inline-flex items-center justify-center).
  - Maintain #5C7C5D unread green dot badge on the Notifications bell and full-page /notifications navigation.

---

## 3. Three-Tab Bottom Nav Bar & Drawers (NS-UI-313 – NS-UI-315)

### NS-UI-313: Three-Tab Bottom Nav Layout & Touch Targets
* File: components/layout/MobileBottomNav.tsx
* Exact Left-to-Right Tab Arrangement:
  1. Left — Home: Home icon (44px x 44px) + "Home" label. Navigates directly to the Feed / Marketplace view.
  2. Center — Accounts: User's circular profile avatar (44px x 44px circular crop; fallback user icon for guests) + "Accounts" label. Opens the draggable Accounts Bottom Drawer Sheet.
  3. Right — More Options: Horizontal Ellipsis Circle icon (CircleEllipsis, 44px x 44px) + "More" / "More Options" label. Displays combined unread notification badges for Inbox and Wallet on the top-right corner of the icon. Opens the draggable More Options Bottom Drawer Sheet.
* Touch Target Dimensions (Mandatory):
  - Every tab icon container must render at 44px x 44px (w-[44px] h-[44px]).
  - Every tab's tappable wrapper must be 74px tall x 58px wide (h-[74px] w-[58px]).

### NS-UI-314: Accounts Bottom Drawer Sheet (Exact Top-Down Order)
* Files: components/layout/MobileBottomNav.tsx (and matching links in components/layout/DesktopSidebar.tsx)
* Dismissal Behaviour: Animated slide-up sheet with top drag handle (drag="y" dismissible), top-right Close (X) button, and outside-backdrop tap dismissal.
* Exact Top-Down Content Order (Authenticated Users):
  1. User Profile Card (Top of Sheet):
     - Enlarged circular user avatar (56px x 56px / w-14 h-14) with a Deep Emerald (#047857) Active status dot badge positioned on the bottom-right corner of the avatar when account_status === 'ACTIVE'.
     - Display Name (bold) and @username directly underneath.
     - User's email address.
     - Summary stat line: Inbox ({inboxCount} referrals) • Total earnings (₦{totalEarningsFormatted}) (tabular-nums).
  2. Settings -> Opens /settings (Account Settings).
  3. Seller Setup (Shown ONLY when user is NOT yet a Verified Seller) -> Opens the 4-step Seller Onboarding & Verification wizard so unverified users can still activate/verify their store.
  4. Seller Hub (Shown ONLY when verification_status === 'VERIFIED') -> Opens dedicated Seller Hub page (/seller/hub).
  5. Listings (Shown ONLY when verification_status === 'VERIFIED') -> Opens dedicated Listings page (/seller/listings).
  6. Order Fulfilment (Shown ONLY when verification_status === 'VERIFIED') -> Opens dedicated Order Fulfilment page (/seller/orders).
  7. Trust & 13-Gen Guide -> Opens Trust & 13-Gen Guide drawer/page.
  8. Program Rules -> Opens /programme-rules.
  9. Help Center -> Opens /help.
  10. Appearance (Light / Dark Mode Toggle) -> Theme switcher row with Yellow Sun (#EAB308) and Silver Moon (#CBD5E1).
  11. Sign out Button (or Sign In / Join Free for Guests) -> Full-width destructive red button (bg-destructive text-destructive-foreground).

### NS-UI-315: More Options (Horizontal Ellipsis Circle) Bottom Drawer Sheet (Exact Top-Down Order)
* Files: components/layout/MobileBottomNav.tsx (and matching links in components/layout/DesktopSidebar.tsx)
* Exact Top-Down Menu Items:
  1. Inbox (with unread referral count badge if > 0) -> Opens dedicated Inbox page.
  2. Sent -> Opens dedicated Sent page.
  3. Scouts List -> Opens dedicated Scouts List page.
  4. Ancestry -> Opens dedicated Ancestry page.
  5. Wallet (with unread wallet/commission badge if > 0) -> Opens dedicated Wallet page.
  6. Financial Ledger -> Opens dedicated Financial Ledger page.
  7. Commission Calculator -> Opens dedicated Commission Calculator page.
  8. Privacy Settings -> Opens dedicated Privacy Settings page.

---

## 4. Dedicated Pages & View Refactoring (NS-UI-316 – NS-UI-321)

Extract the previously bundled sub-tabs into standalone, cleanly routed/navigable dedicated pages with consistent back navigation (<- Back) and mobile-first stacked layouts:

### NS-UI-316: Account Settings -> Profile Tab Polish (components/SettingsView.tsx)
* Remove Redundant Summary Card: Remove the read-only Scout Profile summary card currently sitting above the photo uploader so the User Profile Photo Uploader sits directly at the top of the Profile tab.
* Separate Form Containers: Wrap each profile editing group in its own distinct white/dark card container (rounded-2xl border border-border bg-card p-4 space-y-3):
  1. Container 1: User Profile Photo Upload (square crop, <= 5 MB, >= 200x200 JPEG/PNG/WebP).
  2. Container 2: Display Name and Username.
  3. Container 3: State and LGA location selectors/inputs.
  4. Container 4: Bio (maxLength={250} with live counter).
  5. Container 5: Preferred Categories.
* Remove Duplicate Field: Remove the Profile Visibility toggle from the Profile tab (since it lives on the dedicated Privacy Settings page).

### NS-UI-317: Dedicated Verified Seller Pages (Seller Hub, Listings, Order Fulfilment)
Split components/SellerHubView.tsx into three dedicated pages/views for Verified Sellers:
1. Seller Hub Page (/seller/hub):
   - Top — Seller Profile Card:
     * Business logo in a square frame with rounded corners (rounded-2xl) + Medium Emerald (#10B981) Active status badge on the bottom-right corner of the logo.
     * Registered Business / Seller Display Name.
     * Verified Status badge (VERIFIED).
     * Subscription Plan badge (Starter, Traction, Growth, or Sprawl) + plan management trigger.
     * Close Seller Capabilities red text link (text-destructive font-medium).
   - Below Profile Card — 3 Stacked Stat Cards:
     * Eligible Merchandise Revenue
     * NairaScout 10% Commission
     * Net Seller Proceeds (90%)
2. Listings Page (/seller/listings):
   - Top: Listings & Publications Stat Card (showing active listings vs. plan cap and monthly publications used).
   - Below Stat Card: Your Listings ({count}) section displaying all drafted and published listings with publish/republish/edit actions (plus the bottom-right rounded-square Create Listing FAB).
3. Order Fulfilment Page (/seller/orders):
   - Dedicated Order Fulfilment & Commission Release Pipeline section displaying all Seller orders with interactive stage indicator pills:
     * Mark Processing
     * Mark Dispatched
     * Confirm Delivery (Release Commission)
     * Hold (Dispute)
     * Refund & Reverse

### NS-UI-318: Dedicated Inbox & Sent Pages (Split from components/ReferralsView.tsx)

1. Inbox Page (/referrals/inbox):
	• Dismissible intro notice panel (Dismiss 30 days / Don't show this again).
	• Displays received product referral cards with BUY (attributed) and REFER (forward chain) actions, or clean "No referrals inbox" empty state.
2. Sent Page (/referrals/sent):
	• Displays all product referrals sent by the Scout with delivery/open/conversion statuses.

### NS-UI-319: Dedicated Scouts List, Ancestry, & Commission Calculator Pages (Split from components/NetworkView.tsx)

1. Scouts List Page (/network/scouts):
	• Contains 4 clear stacked sections:
		• Scouts List (active accepted contacts)
		• Invite (smart search bar with avatar + full name + @username dropdown)
		• Pending Invitations (Incoming / Outgoing pills)
		• Your Privacy & Block Controls (Invitation policy + Blocked users)
2. Ancestry Page (/network/ancestry):
	• 4 Separate Stacked KPI/Stat Cards: Permanent Direct Referrer (Gen 1), Upstream Ancestry Depth, Direct Downstream Scouts (Gen 1), and Total 13-Gen Network Reach.
	• Downstream Network (Gen 1–13): Horizontally scrollable breakdown table.
	• Your Permanent Upstream Ancestry: Read-only Gen 1–Gen 13 chain.
3. Commission Calculator Page (/network/calculator):
	• Commission Engine Parameters (Eligible Revenue (₦) *Excluding delivery & tax).
	• 4 Separate Stacked Stat Cards: Seller Proceeds (90%), NairaScout Fee (10%), 20% Referral Pool, and Retained (Undistributed).
	• 13 Generation Schedule: Horizontally scrollable schedule table (1 to 13 generations).

### NS-UI-320: Dedicated Wallet & Financial Ledger Pages (Split from components/WalletView.tsx)

1. Wallet Page (/wallet):
	• Dismissible intro notice panel.
	• Wallet Balance Card + withdrawal request action (>= ₦5,000 minimum threshold, respecting 24h recovery cooldown).
	• 5 Stacked Metric Cards: Available, Pending Commission, On Hold, Paid (Cumulative), Reversed (Cumulative).
	• Payout — 15th of Each Month schedule card.
	• Platform Accounting Boundary statement (no "escrow" terminology).
2. Financial Ledger Page (/wallet/ledger):
	• Platform Accounting Boundary statement.
	• Immutable Financial Ledger with 20-record cursor pagination and status/date/product filters (NS-SCT-065).

### NS-UI-321: Dedicated Privacy Settings Page (/settings/privacy)

• Extracted from Account Settings -> Privacy & Referrals into its own standalone page reachable from More Options -> Privacy Settings (and linked from Settings/Referrals):
	• Profile Visibility opt-in controls (PRIVATE default per Module 5).
	• Scouts List Invitation Policy (Anyone, Mutual Scouts, Nobody).
	• Referral Mute & Communication Controls + Blocked Users list.

5. Verification Checklist (Definition of Done)

1. npm run build passes with zero TypeScript or route errors.
2. Light Mode canvas and Warm Oat/Beige surfaces render in Warm Ivory (#FBF7F2) while preserving all v3.0 Botanical Earth & Forest Olive tokens (#6B4214 BUY, #2E5339 REFER, #5C7C5D Sage Olive, Lato typography); top header NairaScout wordmark is Lexend Extrabold in Forest Green (#2E5339) at mobile Facebook-wordmark size (~27px).
3. Header Search and Notification icons are 44px x 44px inside 74px x 58px tappable containers.
4. Bottom Nav Bar has exactly 3 tabs (Home, Accounts circular avatar, More Options horizontal ellipsis circle) with 44px x 44px icons inside 74px x 58px tappable wrappers, plus combined Inbox + Wallet notification badges on More Options.
5. Accounts drawer and More Options drawer render items in the exact specified top-down order, hiding Seller Hub, Listings, and Order Fulfilment until verification_status === 'VERIFIED' (while showing Seller Setup for unverified users).
6. All extracted sections (Seller Hub, Listings, Order Fulfilment, Inbox, Sent, Scouts List, Ancestry, Wallet, Financial Ledger, Commission Calculator, Privacy Settings) work cleanly as dedicated pages on both mobile and desktop.