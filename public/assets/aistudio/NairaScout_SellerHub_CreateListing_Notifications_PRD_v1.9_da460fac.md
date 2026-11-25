# NAIRASCOUT — SELLER HUB FAB, 4-STEP CREATE LISTING WIZARD, VIDEO DEEP-LINK & NOTIFICATIONS PAGE PRD (v1.9)
## Implementation Specification for Coding Agent

**Document Version:** 1.9  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Lucide Icons, Supabase Storage & PostgreSQL (Drizzle ORM)  
**Scope:**
1. Network Page Light Mode Pill Container Updates (`#F3F4F6` main pill track; `#D1D5DB` / `#D1D5D8` / `#000000` Pending Invitations pills)
2. Wallet Page Light Mode Ledger Pill Container Update (`#F3F4F6` pill track)
3. Seller Hub & Listings (`Seller Hub` heading, exact 4-row header stack, badge colors, red `Close Seller Capabilities` link, `#F3F4F6` tab container, global bottom-right rounded-square FAB for Verified Sellers, dedicated 4-screen slidable **Create Listing** page with up to 10 images + plan-capped YouTube/TikTok video links, inline Feed video player with shrunk multi-item image carousel & platform credit)
4. Feed Page Product Listing Card (rounded-square business logo frame)
5. Header Notifications Page (full dedicated Notifications page instead of dropdown panel + green unread badge cleared upon opening/reading)

---

## 1. Network & Wallet Light Mode Pill Adjustments

### 1.1 Network Page (`components/network/NetworkView.tsx`)
* **Primary Pills Under `"Network"` Heading (`Ancestry`, `Scouts`, `Calculator`) — Light Mode:**
  * Change the **pills container** background in Light Mode to **`bg-[#F3F4F6]`** (`hsl(220 14% 96%)`).
  * Keep unhighlighted pills `bg-[#FFFFFF] text-[#000000]` and highlighted pill `bg-[#000000] text-[#FFFFFF]`.
* **`Scouts` Tab → `Pending Invitations` Pills (`Received`, `Sent`) — Light Mode:**
  * **Pills Container:** `bg-[#D1D5DB]`
  * **Unhighlighted Pill:** `bg-[#D1D5D8] text-[#000000]`
  * **Highlighted Pill:** `bg-[#000000] text-[#FFFFFF]`

### 1.2 Wallet Page (`components/wallet/WalletView.tsx`)
* **Pills Under `"Ledger"` Heading — Light Mode:**
  * **Pills Container:** `bg-[#F3F4F6]` (`hsl(220 14% 96%)`)
  * **Unhighlighted Pills:** `bg-[#FFFFFF] text-[#000000]`
  * **Highlighted Pill:** `bg-[#000000] text-[#FFFFFF]`

---

## 2. Seller Hub & Listings Updates (`components/seller/SellerHubView.tsx`)

### 2.1 Header Renaming, Badges & Exact 4-Row Stack Order
1. **Page Heading:** Rename `"Dashboard"` to **`"Seller Hub"`**.
2. **Exact 4-Row Stack Order:**
   * **Row 1:** Business Logo uploader (rounded square) + **`"Seller Hub"`** heading (`flex items-center gap-3.5`).
   * **Row 2:** **Business Name** (`seller_name`).
   * **Row 3:** **Seller Status** badge (`bg-[#D1D5D8]` in Light Mode, existing text color) alongside **Verification Status** badge (`bg-[#D1D5D8]` in Light Mode, existing text color).
   * **Row 4:** **Subscription Plan** badge (`bg-[#FFFFFF] text-[#000000]` in Light Mode) alongside the **`"Close Seller Capabilities"`** link styled in **Red (`text-destructive` / `text-red-600`)**.
3. **Navigation Pills Directly Under Row 4 (`"Close Seller Capabilities"`):**
   * **Pills Container (Light Mode):** `bg-[#F3F4F6]` (`hsl(220 14% 96%)`).

---

## 3. Verified Seller FAB & Dedicated 4-Screen "Create Listing" Page

### 3.1 Global Rounded-Square Floating Action Button (FAB)
* **Visibility:** Rendered across **every page** of the application **only** when the authenticated user has `seller_status === 'ACTIVE'` AND `verification_status === 'VERIFIED'`.
* **Position & Shape:** Fixed bottom-right (`fixed right-4 bottom-20 md:bottom-6 z-40`), **square with rounded corners (`w-12 h-12 md:w-14 md:h-14 rounded-2xl`)**, high-contrast primary styling (`bg-[#292D2F] text-white dark:bg-white dark:text-black shadow-lg`), with a `+` (`Plus`) icon and accessible label `"Create Listing"`.
* **Action:** Tapping the FAB opens the dedicated **Create Listing** page (`/seller/listings/new` or dedicated full-page route/view).

### 3.2 Dedicated 4-Screen Slidable "Create Listing" Wizard
Remove the inline Create Listing form from the Seller Hub tab and move it to its own dedicated page with a back button (`← Back to Seller Hub`), progress indicator (`Step 1 of 4`–`4 of 4`), horizontal slide transitions (`framer-motion`), **`Back`** and **`Next`** buttons, and the **`"Save Draft"`** submit button on **Screen 4**:

* **Screen 1 (2 fields):**
  1. **Product Name** (`title`, required text input)
  2. **Category** (`category`, `<select>` dropdown populated from active `public.listing_categories` matching the Seller's plan category allowance)
* **Screen 2 (2 fields):**
  1. **Quantity** (`stock`, integer input `>= 1`)
  2. **Unit Price (₦)** (`price_kobo`, numeric Naira input converted server-side to integer kobo)
* **Screen 3 (2 fields):**
  1. **Delivery Fee (₦)** (`delivery_fee_kobo`, numeric Naira input converted server-side to integer kobo)
  2. **Description** (`description`, multiline textarea)
* **Screen 4 (2 fields + `"Save Draft"` CTA):**
  1. **Image Uploader (`up to 10 images`):** Multi-file image uploader (Supabase Storage bucket `listing-media`, max **10 images** per listing, JPEG/PNG/WebP, reorderable/removable thumbnails with primary cover indicator). Store ordered URLs in `image_urls` (`JSONB` array) while keeping `image_url` synced to `image_urls[0]` for backward compatibility.
  2. **Video Link Input Field (Plan-Capped YouTube & TikTok Links):** Repeatable URL input list allowing Sellers to paste **YouTube** (`youtube.com`, `youtu.be`) and **TikTok** (`tiktok.com`) video links up to their active subscription plan limit:
     * `Starter`: **0 videos** (show upgrade notice; input disabled)
     * `Traction`: **up to 1 video link**
     * `Growth`: **up to 3 video links**
     * `Sprawl`: **up to 5 video links**
     * Validate URLs server-side and store `{ url, platform: 'YouTube' | 'TikTok' }[]` in `video_links` (`JSONB` array).
  3. **Action Buttons on Screen 4:** **`Back`** button and **`"Save Draft"`** primary button (saves listing as `DRAFT` in PostgreSQL and returns to Seller Hub Drafts).

---

## 4. Feed Product Card & Inline Video Deep-Link Experience

### 4.1 Rounded-Square Business Logo Frame on Feed Cards (`components/marketplace/MarketplaceView.tsx`)
* Update the Seller business logo avatar on every **Product Listing Card** in the Marketplace Feed from circular (`rounded-full`) to a **square with rounded corners (`rounded-xl` or `rounded-lg`)**.

### 4.2 Slidable Product Images, Detail Modal Videos & In-Feed Deep-Link Video Player
1. **Slidable Images on Feed Card:**
   * When a published listing has multiple images (`image_urls.length > 1`), render a horizontal swipeable/slidable image carousel with pagination dots on the product card.
2. **Listing Detail Modal Video List:**
   * When a user opens the **Listing Detail Modal**, display all valid `video_links` attached to the listing (playable embeds / external watch triggers).
3. **Overlay Deep-Link Button & In-Feed Video Expansion:**
   * When a listing has at least one video link (`video_links.length > 0`), render a **Deep Link Button** (`Play` / video badge button) overlaid in the **bottom-right corner** of the product card's image slider.
   * **Tapping the Deep Link Button (In-Feed Video Mode):**
     * Plays the first attached video **directly inline inside the Feed card** (do not force a page navigation).
     * **Video Dimensions:** Spans **100% of the phone screen width (`w-full`)** and **one-third of the viewport height (`h-[33.33vh]` / `min-h-[220px]`)** using a responsive YouTube/TikTok embed player (`autoplay=1`).
     * **Shrunk Multi-Item Image Carousel Below Video:** Directly underneath the inline video player, shrink the listing's product photos into a compact **horizontal multi-item thumbnail carousel** (`h-14` / `56px` rounded-lg thumbnails) that users can tap/scroll through while watching, plus a close/collapse button (`×`) to return the card to standard image-slider mode.
     * **Host Platform Credit Attribution:** Display a subtle attribution caption beneath the player crediting the host platform from the Seller's first video link (e.g., **`"Video hosted on YouTube"`** or **`"Video hosted on TikTok"`**).

---

## 5. Header Notifications Page & Read/Unread Green Badge

### 5.1 Dedicated Notifications Page (Replaces Dropdown Panel)
* **Header Bell Behavior:** Tapping the **Notifications (`Bell`)** icon in the global header navigates to a dedicated full **Notifications Page** (`/notifications` or full-page view in `AppShell`) instead of opening a floating dropdown/popover panel.
* **Read / Unread State & Green Badge:**
  * Persist notifications in PostgreSQL (`public.notifications`: `id`, `user_id`, `type`, `title`, `body`, `link_url`, `is_read` boolean default `false`, `created_at`).
  * **Unread Notifications:** Display a clear **green badge** (e.g., `bg-emerald-500` pill `"New"` or green dot indicator + subtle unread highlight).
  * **Marking as Read:** When a user taps/opens a notification item (or opens its detail), immediately mark `is_read = true` in PostgreSQL and **remove the green badge** from that notification, decrementing the header bell's unread counter in real time.

---

## 6. Database Schema & Storage Additions (Run in Supabase SQL Editor)

```sql
-- 1. Extend product_listings with multi-image and video_links arrays
ALTER TABLE public.product_listings
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_links JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill image_urls from existing image_url where empty
UPDATE public.product_listings
SET image_urls = jsonb_build_array(image_url)
WHERE jsonb_array_length(image_urls) = 0 AND image_url IS NOT NULL AND image_url <> '';

-- 2. Public storage bucket for product listing images (up to 10 per listing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-media',
  'listing-media',
  TRUE,
  5242880, -- 5 MB per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated sellers upload listing media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listing-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read listing media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'listing-media');

-- 3. Persistent user notifications table for Read/Unread green badge tracking
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'SYSTEM',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);
```

---

## 7. Verification Checklist for the Coding Agent

1. [ ] **Network & Wallet Pills (Light Mode):** Network main pills container is `#F3F4F6`; Pending Invitations pills container is `#D1D5DB` with `#D1D5D8` unhighlighted and `#000000` highlighted pills; Wallet Ledger pills container is `#F3F4F6`.
2. [ ] **Seller Hub Header:** Heading reads `"Seller Hub"`; 4 rows stack in exact order (`Logo + Seller Hub` → `Business Name` → `Seller Status & Verification Status` → `Subscription Plan & red Close Seller Capabilities link`); badges use `#D1D5D8` / `#FFFFFF` tokens; pill container below Row 4 is `#F3F4F6`.
3. [ ] **Verified Seller FAB & 4-Screen Create Listing Wizard:** Rounded-square FAB appears bottom-right on all pages for Verified Sellers only; opens dedicated 4-screen slidable form (2 fields per screen) with up to 10 image uploads and plan-capped YouTube/TikTok video links (`0 / 1 / 3 / 5`) and `"Save Draft"` on Screen 4.
4. [ ] **Feed Card & Inline Video Player:** Business logo frame is a rounded square; images slide horizontally; bottom-right Deep Link button expands the first video inline at `100%` width × `1/3` viewport height with a shrunk multi-item image carousel underneath and host platform credit (`YouTube` / `TikTok`).
5. [ ] **Header Notifications Page:** Tapping the header bell opens a dedicated Notifications page; unread items show a green badge that disappears as soon as the notification is opened and marked read.
