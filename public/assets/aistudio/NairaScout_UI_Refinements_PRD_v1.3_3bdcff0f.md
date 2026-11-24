# NAIRASCOUT — UI, NAVIGATION, REFERRALS & NETWORK REFINEMENTS (v1.3)
## Implementation Specification for Coding Agent

**Document Version:** 1.3  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase Storage & PostgreSQL (Drizzle ORM), Lucide Icons  
**Scope:**
1. Supabase Avatar Upload (`Accounts > Account Settings > Profile`) + Replace Mobile Bottom Nav `Accounts` Icon with User Avatar
2. Global Header Cleanup (Remove Top-Right User Avatar & Dropdown Menu; Keep Notifications Bell & Light/Dark Toggle Globally)
3. Referrals Page Updates (New `"Referrals"` Heading, Dismissible `"Product Referrals Inbox"` Notice Panel Above Search Bar, Label & Copy Updates)
4. Network Page Updates (`Ancestry` Stacked Separate KPI Cards & Renamed Downstream Heading, `Scouts` Tab Labels & Mobile Stacked Layout, `Calculator` Tab Label Updates, Stacked Separate Metric Cards, Renamed `"Retained (Undistributed)"`, and Horizontally Scrollable `"13 Generation Schedule"` Table)

---

## 1. Bottom Nav Bar & Supabase Avatar Upload (`Accounts > Account Settings > Profile`)

### Target File(s)
* `components/settings/SettingsView.tsx` (Profile tab)
* `app/api/profile/avatar/route.ts` (or Server Action for avatar upload & persistence)
* `components/layout/MobileBottomNav.tsx`
* Supabase Storage bucket: `avatars` (public read, authenticated user-scoped write)

### Requirements
1. **Supabase Avatar Upload in `Accounts > Account Settings > Profile`:**
   * Add an interactive **Profile Photo / Avatar Uploader** at the top of the **Profile** tab inside Account Settings:
     * Displays the user's current circular `<UserAvatar />` (`h-20 w-20`), a **"Change Photo" / "Upload Avatar"** button, and a **"Remove"** option (when an avatar exists).
     * Accepts `image/jpeg`, `image/png`, and `image/webp` up to **5 MB**.
     * Uploads to Supabase Storage bucket **`avatars`** at path `${user.id}/avatar-${Date.now()}.${ext}` (upsert/overwrite or clean old file), retrieves the public URL, updates `scout_profiles.avatar_url` in PostgreSQL via Drizzle ORM, refreshes the client user session/profile state immediately, and records an audit entry in `audit_logs`.
   * **SQL Bucket Setup (Include in migration/setup notes if `avatars` bucket does not yet exist):**
     ```sql
     INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
     VALUES ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
     ON CONFLICT (id) DO UPDATE SET public = TRUE;

     CREATE POLICY "Public read avatars"
       ON storage.objects FOR SELECT TO public
       USING (bucket_id = 'avatars');

     CREATE POLICY "Users upload own avatar"
       ON storage.objects FOR INSERT TO authenticated
       WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

     CREATE POLICY "Users update own avatar"
       ON storage.objects FOR UPDATE TO authenticated
       USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
     ```
2. **Replace the `'Accounts'` Tab Icon in Mobile Bottom Nav with the User Avatar:**
   * In `components/layout/MobileBottomNav.tsx`, replace the generic `User` / `Store` icon on the **`Accounts`** tab (`5th` bottom nav item) with the authenticated user's circular `<UserAvatar />` (`h-6 w-6 rounded-full object-cover ring-1 ring-border`, adding `ring-2 ring-primary` when the `Accounts` tab/sheet is active).
   * For unauthenticated Guests (`user === null`), render a clean neutral circular guest avatar silhouette (`h-6 w-6 rounded-full bg-muted flex items-center justify-center`).

---

## 2. Global Header Cleanup (`TopUtilityBar.tsx` / `HeaderNav.tsx`)

### Target File(s)
* `components/layout/TopUtilityBar.tsx` / `components/HeaderNav.tsx`

### Requirements
1. **Remove User Avatar & Header Account Menu Globally:**
   * Completely remove the user avatar button and its dropdown/popover account menu from the top header across all screen sizes and pages (since the **`Accounts`** tab in the bottom nav bar and its draggable bottom sheet now handle all account, Seller Hub, Admin, and sign-in/sign-out actions).
   * *(Note: Keep the `Sign In` CTA only if required on desktop when logged out, or let the Desktop Left Sidebar footer handle authenticated user actions).*
2. **Keep Notifications & Light/Dark Toggle Globally in Header:**
   * Ensure the **Notifications Bell** icon (with live unread indicator) and the **Light/Dark Mode Toggle** button (Silver `Moon` icon for dark mode, Yellow `Sun` icon for light mode) remain visible and accessible in the top header across **all pages** on both mobile and desktop.

---

## 3. Referrals Page Updates (`components/referrals/ReferralsView.tsx`)

### Target File(s)
* `components/referrals/ReferralsView.tsx`
* `components/shared/DismissibleNoticePanel.tsx`

### Requirements
1. **Page Heading:**
   * Set the main page heading to **`"Referrals"`** (`font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground`).
2. **Dismissible Notification Panel Above Search Bar:**
   * Remove the static `"Product Referrals Inbox"` heading and its descriptive support text `"Every product referral card carries a unique referral-event identifier preserved through registration, Email OTP verification, and checkout."` from their old static spot.
   * Render `<DismissibleNoticePanel />` **directly above the Search Bar** on the Referrals page:
     * `storageKey`: `'nairascout_referrals_inbox_notice_v1'`
     * `title`: `'Product Referrals Inbox'`
     * `description`: `'Every product referral card carries a unique referral-event identifier preserved through registration, Email OTP verification, and checkout.'`
     * `ariaLabel`: `'Product Referrals Inbox Notice'`
   * Features the two action buttons **`Dismiss`** (hides for **30 days** via `localStorage`) and **`Don’t show this again`** (hides **permanently**).
3. **Link & Section Copy Updates:**
   * Change the text link shortcut `"Manage Referral Mute & Privacy →"` to **`"Manage Privacy Settings →"`**.
   * Change `"Received Product Referral Cards"` to **`"Inbox"`**.
   * Change `"No received product referrals yet"` to **`"No referrals inbox"`**.
   * Change `"Sent Product Referrals"` to **`"Sent"`**.

---

## 4. Network Page Updates (`components/network/NetworkView.tsx` & `ScoutsListPanel.tsx`)

### 4.1 `Ancestry` Tab
1. **Separate Stacked KPI Widget Cards on Mobile:**
   * Break out the four summary metrics—**`"Permanent Direct Referrer (Gen 1)"`**, **`"Upstream Ancestry Depth"`**, **`"Direct Downstream Scouts (Gen 1)"`**, and **`"Total 13-Gen Network Reach"`**—so each metric lives inside **its own separate card wrapper** (`rounded-2xl border bg-card p-4 shadow-xs`) rather than all four sharing one combined outer card/wrapper.
   * **Responsive Grid Layout:** Stack them in a single column on mobile (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`) so each widget has full horizontal width on phone screens and text never wraps awkwardly or looks cramped.
2. **Downstream Table Heading Update:**
   * Change `"Downstream Network by Generation (Gen 1-13)"` to **`"Downstream Network (Gen 1-13)"`**.

### 4.2 `Scouts` Tab
1. **Section Heading & Mobile-Stacked Explainer Text:**
   * Change `"Active Scouts List Contacts"` to **`"Scouts List"`**.
   * On mobile (`< sm:`), stack the explainer text **`"INVITE is separate from product REFER"`** cleanly **underneath** the `"Scouts List"` heading (`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1`) instead of squeezing it side-by-side on the same line.
2. **Directory Heading Update:**
   * Change `"Discover Scouts (Sanitized Directory)"` to **`"Invite"`**.
3. **Privacy & Block Controls Mobile Stacking:**
   * Inside **`Your Privacy & Block Controls`**, stack **`"Blocked users"`** vertically **underneath** **`"Invitation policy"`** on mobile (`grid grid-cols-1 md:grid-cols-2 gap-4`) so both controls have full width on mobile screens.

### 4.3 `Calculator` Tab
1. **Input Label Update:**
   * Under **Commission Engine Parameters**, change `"Eligible Merchandise Revenue (₦, excl. delivery & tax)"` to **`"Eligible Revenue (₦). *Excluding delivery & tax"`**.
2. **Separate Stacked Revenue Breakdown Cards on Mobile + Label Update:**
   * Break out **`"Seller Proceeds (90%)"`**, **`"NairaScout Fee (10%)"`**, **`"20% Referral Pool"`**, and **`"Retained (Undistributed)"`** (relabeled from `"Undistributed Retained"`) so each metric has **its own separate card wrapper** (`rounded-2xl border bg-card p-4 shadow-xs`).
   * Stack them vertically on mobile (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`) so no text or Naira figure is cramped on narrow phone screens.
3. **Schedule Heading, Version Badge Removal & Horizontal Scroll:**
   * Relabel `"Extended 4-13 Generation Schedule"` to **`"13 Generation Schedule"`**.
   * Remove the `"Engine v4.0-13G-2026.11"` badge/label completely.
   * Wrap the **`13 Generation Schedule`** table in a horizontal scroll container (`w-full overflow-x-auto`) with `min-w-[540px]` on the `<table>` so users on mobile can slide/scroll the table horizontally just like the **`Downstream Network (Gen 1-13)`** table under the **Ancestry** tab.

---

## 5. Verification Checklist for the Coding Agent

1. [ ] Users can upload/save a profile photo in **Accounts → Account Settings → Profile** (stored in Supabase `avatars` bucket and saved to `scout_profiles.avatar_url`), and that avatar replaces the generic icon on the **`Accounts`** tab in the mobile bottom navigation bar.
2. [ ] Top header no longer renders the user avatar or user dropdown menu on any page, while keeping the **Notifications** bell and **Light/Dark mode toggle** visible globally.
3. [ ] Referrals page heading is **`"Referrals"`**, displays the dismissible **`"Product Referrals Inbox"`** notice panel above the search bar (**30-day Dismiss** / **Permanent Don't show this again**), and updates link/tab/empty labels to **`"Manage Privacy Settings →"`**, **`"Inbox"`**, **`"No referrals inbox"`**, and **`"Sent"`**.
4. [ ] Network → **Ancestry** renders the 4 summary metrics as **4 separate stacked cards on mobile** (`grid-cols-1`) and renames the table heading to **`"Downstream Network (Gen 1-13)"`**.
5. [ ] Network → **Scouts** renames headings to **`"Scouts List"`** (with `"INVITE is separate from product REFER"` stacked underneath on mobile) and **`"Invite"`**, and stacks **`"Blocked users"`** under **`"Invitation policy"`** on mobile.
6. [ ] Network → **Calculator** updates the label to **`"Eligible Revenue (₦). *Excluding delivery & tax"`**, renders the 4 breakdown metrics (including **`"Retained (Undistributed)"`**) as **4 separate stacked cards on mobile**, renames the schedule to **`"13 Generation Schedule"`** without `"Engine v4.0-13G-2026.11"`, and makes the schedule table horizontally scrollable on mobile.
