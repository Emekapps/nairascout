-- NairaScout Module 2: Versioned Platform Policies & Searchable Help Centre Knowledge Base
-- Traceability: NS-FND-001, NS-FND-002, NS-FND-003, NS-FND-004, NS-FND-007

-- 1. Platform Policies & Programme Rules
CREATE TABLE IF NOT EXISTS public.platform_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_policies_published
  ON public.platform_policies(is_published, slug);

-- 2. Searchable Help Centre & Knowledge Base Articles
CREATE TABLE IF NOT EXISTS public.help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  audience_role TEXT NOT NULL DEFAULT 'ALL',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT help_articles_category_check CHECK (
    category IN (
      'GETTING_STARTED',
      'SCOUTS_REFERRALS',
      'BUYERS_ORDERS',
      'SELLERS_PLANS',
      'WALLET_PAYOUTS',
      'TRUST_SAFETY'
    )
  ),
  CONSTRAINT help_articles_audience_check CHECK (
    audience_role IN ('ALL', 'SCOUT', 'BUYER', 'SELLER')
  )
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category_published
  ON public.help_articles(is_published, category, sort_order);

-- 3. Row-Level Security (Public reads published rows; SUPER_ADMIN & PLATFORM_ADMIN manage)
CREATE OR REPLACE FUNCTION public.ns_is_content_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admin_roles par
    WHERE par.user_id = auth.uid()
      AND par.admin_role IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  );
$$;

ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_policies_select ON public.platform_policies;
CREATE POLICY platform_policies_select ON public.platform_policies
  FOR SELECT USING (is_published = TRUE OR public.ns_is_platform_admin());

DROP POLICY IF EXISTS platform_policies_admin_write ON public.platform_policies;
CREATE POLICY platform_policies_admin_write ON public.platform_policies
  FOR ALL USING (public.ns_is_content_admin())
  WITH CHECK (public.ns_is_content_admin());

DROP POLICY IF EXISTS help_articles_select ON public.help_articles;
CREATE POLICY help_articles_select ON public.help_articles
  FOR SELECT USING (is_published = TRUE OR public.ns_is_platform_admin());

DROP POLICY IF EXISTS help_articles_admin_write ON public.help_articles;
CREATE POLICY help_articles_admin_write ON public.help_articles
  FOR ALL USING (public.ns_is_content_admin())
  WITH CHECK (public.ns_is_content_admin());

-- 4. Seed Default Published Platform Policies
INSERT INTO public.platform_policies (slug, title, summary, content_markdown, version, effective_date, is_published)
VALUES
  (
    'programme-rules',
    'Programme Rules & Commercial Model',
    'Explains the 90% Seller / 10% NairaScout revenue split, 20% of 10% (2%) referral pool across up to 13 generations, 14th-Scout exclusion, and non-last-click event attribution.',
    E'# Programme Rules & Commercial Model\n\n**No earning limits.** Earn way more from people in your referral network who find buyers for products you recommend.\n\n## 1. One Primary Identity & Scout-First Participation\nEvery person on NairaScout holds a single primary user identity. Free Scout participation is included at registration, and Seller capabilities attach to that same identity only after explicit Seller onboarding and verification approval.\n\n## 2. Revenue Split (Eligible Merchandise Revenue)\n- **Seller Proceeds:** **90%** of eligible merchandise revenue (excluding delivery fees and taxes).\n- **NairaScout Platform Fee:** **10%** of eligible merchandise revenue.\n- **Referral Commission Pool:** On qualifying referral-attributed purchases, **20% of NairaScout''s 10% fee** (**2%** of eligible merchandise revenue) is allocated across the **13 most recent eligible referrers** in the Seller Scout''s permanent referral ancestry (**Gen 1 through Gen 13**).\n- **14th-Scout Exclusion Rule:** Distribution strictly stops at Generation 13. Ancestors at Generation 14 or deeper receive ₦0.00.\n- **No Promotion / No Skipping Rule:** If an ancestor slot in Gen 1–13 is ineligible, their slot remains occupied at ₦0.00 and is never skipped. Any undistributed share is retained by NairaScout.\n\n## 3. Event-Based Attribution (Non-Last-Click)\n- **Direct Marketplace BUY:** Initiating checkout from the general marketplace feed is always recorded as a **Direct Purchase** with **₦0.00** referral commission.\n- **Traceable REFER Events:** Commissions are generated only when a buyer initiates checkout from a valid, non-expired `referral_event_id`.\n- **Referral Validity & Checkout Protection:** Referral events remain valid for **30 calendar days** from creation, and abandoned checkouts retain attribution protection for **7 calendar days**.\n- **Anti-Hijack Rule:** Forwarding someone else''s referral URL never reassigns ownership.\n\n> Commissions are earned strictly from genuine, completed, non-reversed qualifying purchases attributed under NairaScout rules. Sending a referral or building a network does not guarantee purchases or income.',
    '1.0.0',
    '2026-11-25T00:00:00Z',
    TRUE
  ),
  (
    'payout-policy',
    'Payout & Wallet Policy',
    'Details Pending Commission, Available, On Hold, Paid, and Reversed wallet states, the ₦5,000 minimum threshold, the 15th of each month schedule, and platform accounting boundaries.',
    E'# Payout & Wallet Policy\n\n## 1. Distinct Wallet Accounting States\n- **Pending Commission:** Qualifying referral-attributed orders currently awaiting Seller delivery confirmation and post-delivery checks. Not withdrawable.\n- **Available:** Commissions from completed, non-reversed orders that have passed verification and dispute checks.\n- **On Hold:** Commissions temporarily paused due to an active order dispute, return review, or compliance check.\n- **Paid (Cumulative):** Total historical commissions settled to your verified Nigerian bank account.\n- **Reversed (Cumulative):** Linked negative adjustments created when an order is cancelled, refunded, or invalidated.\n\n## 2. Monthly Payout Schedule & Minimum Threshold\n- **Payout Day:** Scheduled on the **15th of each calendar month**.\n- **Minimum Payout Threshold:** **₦5,000** (`500,000 kobo`) cumulative eligible Available balance from the preceding calendar month.\n- **Verification Requirements:** Completed KYC identity verification and a verified same-name Nigerian bank account are mandatory.\n\n## 3. Platform Accounting Boundary\nNairaScout maintains internal platform accounting records for Pending Settlement orders and Pending Commission balances. NairaScout is not a bank, deposit-taking institution, investment scheme, or general money-transfer service.\n\n> Commissions are earned strictly from genuine, completed, non-reversed qualifying purchases attributed under NairaScout rules. Sending a referral or building a network does not guarantee purchases or income.',
    '1.0.0',
    '2026-11-25T00:00:00Z',
    TRUE
  ),
  (
    'platform-boundaries',
    'Platform Boundaries & Consumer Protection Notice',
    'Clarifies NairaScout platform responsibilities versus Seller obligations for inventory, product authenticity, physical delivery, warranties, and consumer rights.',
    E'# Platform Boundaries & Consumer Protection Notice\n\n## 1. Role of NairaScout\nNairaScout operates a social commerce and traceable referral-marketing technology platform connecting verified independent Sellers, Scouts, and Buyers across Nigeria.\nNairaScout maintains internal platform accounting records for Pending Settlement orders and Pending Commission balances. NairaScout is not a bank, deposit-taking institution, investment scheme, or general money-transfer service.\n\n## 2. Independent Seller Responsibilities\nEvery Seller operates as an independent merchant responsible for:\n- **Product Authenticity & Accuracy**\n- **Inventory & Packaging**\n- **Physical Delivery & 10-Calendar-Day Fulfilment SLA**\n- **Warranties & Statutory Consumer Obligations**\n\n## 3. Consumer Protection & Dispute Support\nNothing in these boundaries waives or restricts a Buyer''s statutory consumer rights under Nigerian law.',
    '1.0.0',
    '2026-11-25T00:00:00Z',
    TRUE
  )
ON CONFLICT (slug) DO NOTHING;

-- 5. Seed Initial Help Centre Articles
INSERT INTO public.help_articles (slug, category, title, summary, body_markdown, audience_role, sort_order, is_published)
VALUES
  (
    'welcome-to-nairascout',
    'GETTING_STARTED',
    'Welcome to NairaScout: One Identity, No Earning Limits',
    'Understand how Scout participation, Seller activation, and Buyer checkout work under one unified NairaScout account.',
    E'# Welcome to NairaScout\n\n**No earning limits.** Earn way more from people in your referral network who find buyers for products you recommend.\n\nEvery member registers once with a single unified identity: Scout by default, seamless Buyer checkout, and optional Seller capabilities after verification approval.',
    'ALL',
    1,
    TRUE
  ),
  (
    'thirteen-generation-commissions-explained',
    'SCOUTS_REFERRALS',
    'How the 13-Generation Referral Pool Works',
    'See how 20% of NairaScout''s 10% platform fee is distributed across the 13 most recent eligible referrers.',
    E'# How the 13-Generation Referral Pool Works\n\nOn qualifying Referral Card purchases, Sellers receive 90%, NairaScout earns 10%, and 20% of that 10% (2% of eligible merchandise revenue) is shared across the **13 most recent eligible referrers** (Gen 1–Gen 13). Ineligible ancestors are never skipped, and Gen 14+ are excluded.',
    'SCOUT',
    2,
    TRUE
  ),
  (
    'direct-buy-vs-referral-attribution',
    'SCOUTS_REFERRALS',
    'Direct BUY vs. Referral Card Attribution (Non-Last-Click)',
    'Learn why general marketplace purchases are always Direct and how Referral Card event IDs protect attribution.',
    E'# Direct BUY vs. Referral Card Attribution\n\nGeneral marketplace purchases are always Direct (₦0 referral commission). Only orders opened from a valid Referral Card (`referral_event_id`) generate referral commissions within the 30-day referral validity window and 7-day abandoned checkout protection.',
    'SCOUT',
    3,
    TRUE
  ),
  (
    'buyer-orders-and-fulfilment-sla',
    'BUYERS_ORDERS',
    'Buyer Orders, Delivery Fees & 10-Day Fulfilment SLA',
    'What happens after you confirm an order, how delivery fees are handled, and what the 10-day Seller SLA covers.',
    E'# Buyer Orders & 10-Day Fulfilment SLA\n\nDelivery fees are shown transparently before payment and excluded from commission pools. Sellers operate under a **10-calendar-day fulfilment SLA** while Pending Settlement funds remain held until delivery verification.',
    'BUYER',
    4,
    TRUE
  ),
  (
    'seller-plans-and-listing-media-limits',
    'SELLERS_PLANS',
    'Seller Plans, Listing Quotas, Multi-Image & Video Rules',
    'Compare Starter, Traction, Growth, and Sprawl active listing caps, monthly publications, 10-image limits, and video links.',
    E'# Seller Plans & Listing Entitlements\n\nAll plans support up to 10 images per listing and 10-day listing durations. Verified Sellers can publish listings up to their plan limits (Starter 1/3, Traction 3/10, Growth 5/25, Sprawl 20/100 and up to 5 team seats).',
    'SELLER',
    5,
    TRUE
  ),
  (
    'wallet-balances-and-monthly-payouts',
    'WALLET_PAYOUTS',
    'Wallet Balances, ₦5,000 Threshold & Monthly 15th Payouts',
    'Understand Pending Commission vs. Available vs. Paid balances and how monthly payouts work on the 15th.',
    E'# Wallet Balances & Monthly 15th Payouts\n\nPayouts run on the **15th of each month** for preceding-month Available balances of **₦5,000** (`500,000 kobo`) or more once KYC and Nigerian bank verification are complete. NairaScout is not a bank or deposit-taking institution.',
    'SCOUT',
    6,
    TRUE
  ),
  (
    'two-track-closure-and-appeals',
    'TRUST_SAFETY',
    'Two-Track Voluntary Closure & Independent Appeals',
    'Close Seller capabilities independently without losing your Scout account, or appeal a verification or restriction decision.',
    E'# Two-Track Closure & Independent Appeals\n\nClose Seller capabilities independently under **Account Settings → Closure**, or file an appeal reviewed by an independent Appeals Officer.',
    'ALL',
    7,
    TRUE
  )
ON CONFLICT (slug) DO NOTHING;
