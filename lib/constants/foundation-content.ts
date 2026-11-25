// NS-FND-001, NS-FND-002, NS-FND-003, NS-FND-004: Approved Product Positioning, Compliance Copy & Seed Content

export const NAIRASCOUT_TAGLINE = 'No earning limits.';

export const NAIRASCOUT_VALUE_PROPOSITION =
  'Earn way more from people in your referral network who find buyers for products you recommend.';

export const NAIRASCOUT_EARNINGS_DISCLAIMER =
  'Commissions are earned strictly from genuine, completed, non-reversed qualifying purchases attributed under NairaScout rules. Sending a referral or building a network does not guarantee purchases or income.';

export const NAIRASCOUT_ACCOUNTING_BOUNDARY =
  'NairaScout maintains internal platform accounting records for Pending Settlement orders and Pending Commission balances. NairaScout is not a bank, deposit-taking institution, investment scheme, or general money-transfer service.';

export type HelpArticleCategory =
  | 'GETTING_STARTED'
  | 'SCOUTS_REFERRALS'
  | 'BUYERS_ORDERS'
  | 'SELLERS_PLANS'
  | 'WALLET_PAYOUTS'
  | 'TRUST_SAFETY';

export type HelpAudienceRole = 'ALL' | 'SCOUT' | 'BUYER' | 'SELLER';

export const HELP_ARTICLE_CATEGORIES: Array<{
  id: HelpArticleCategory;
  label: string;
}> = [
  { id: 'GETTING_STARTED', label: 'Getting Started' },
  { id: 'SCOUTS_REFERRALS', label: 'Scouts & Referrals' },
  { id: 'BUYERS_ORDERS', label: 'Buyers & Orders' },
  { id: 'SELLERS_PLANS', label: 'Sellers & Plans' },
  { id: 'WALLET_PAYOUTS', label: 'Wallet & Payouts' },
  { id: 'TRUST_SAFETY', label: 'Trust & Safety' },
];

export const HELP_AUDIENCE_ROLES: Array<{
  id: HelpAudienceRole;
  label: string;
}> = [
  { id: 'ALL', label: 'All' },
  { id: 'SCOUT', label: 'Scout' },
  { id: 'BUYER', label: 'Buyer' },
  { id: 'SELLER', label: 'Seller' },
];

export interface PlatformPolicySeed {
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  version: string;
  effectiveDate: string;
  isPublished: boolean;
}

export interface HelpArticleSeed {
  slug: string;
  category: HelpArticleCategory;
  title: string;
  summary: string;
  bodyMarkdown: string;
  audienceRole: HelpAudienceRole;
  sortOrder: number;
  isPublished: boolean;
}

export const DEFAULT_PLATFORM_POLICIES_SEED: PlatformPolicySeed[] = [
  {
    slug: 'programme-rules',
    title: 'Programme Rules & Commercial Model',
    summary:
      'Explains the 90% Seller / 10% NairaScout revenue split, 20% of 10% (2%) referral pool across up to 13 generations, 14th-Scout exclusion, and non-last-click event attribution.',
    version: '1.0.0',
    effectiveDate: '2026-11-25T00:00:00.000Z',
    isPublished: true,
    contentMarkdown: `# Programme Rules & Commercial Model

**${NAIRASCOUT_TAGLINE}** ${NAIRASCOUT_VALUE_PROPOSITION}

## 1. One Primary Identity & Scout-First Participation
Every person on NairaScout holds a single primary user identity. Free Scout participation is included at registration, and Seller capabilities attach to that same identity only after explicit Seller onboarding and verification approval.

## 2. Revenue Split (Eligible Merchandise Revenue)
- **Seller Proceeds:** **90%** of eligible merchandise revenue (excluding delivery fees and taxes).
- **NairaScout Platform Fee:** **10%** of eligible merchandise revenue.
- **Referral Commission Pool:** On qualifying referral-attributed purchases, **20% of NairaScout's 10% fee** (**2%** of eligible merchandise revenue) is allocated across the **13 most recent eligible referrers** in the Seller Scout's permanent referral ancestry (**Gen 1 through Gen 13**).
- **14th-Scout Exclusion Rule:** Distribution strictly stops at Generation 13. Ancestors at Generation 14 or deeper receive ₦0.00.
- **No Promotion / No Skipping Rule:** If an ancestor slot in Gen 1–13 is ineligible (e.g., restricted, suspended, or closed), their slot remains occupied at ₦0.00 and is never skipped. Any undistributed share is retained by NairaScout.

## 3. Event-Based Attribution (Non-Last-Click)
- **Direct Marketplace BUY:** Initiating checkout from the general marketplace feed is always recorded as a **Direct Purchase** with **₦0.00** referral commission, even if the buyer previously viewed or received a referral card.
- **Traceable REFER Events:** Commissions are generated only when a buyer initiates checkout from a valid, non-expired \`referral_event_id\`.
- **Referral Validity & Checkout Protection:** Referral events remain valid for **30 calendar days** from creation. Abandoned checkouts opened from a referral card retain attribution protection for **7 calendar days**.
- **Anti-Hijack Rule:** Forwarding someone else's referral URL never reassigns ownership. A Scout must generate their own \`REFER\` action to receive their own traceable \`referral_event_id\`.

## 4. Seller Fulfilment SLA & Listing Duration
- Published listings remain live on the marketplace for **10 calendar days** per publication.
- Sellers operate under a **10-calendar-day fulfilment SLA** from order payment confirmation.

> ${NAIRASCOUT_EARNINGS_DISCLAIMER}`,
  },
  {
    slug: 'payout-policy',
    title: 'Payout & Wallet Policy',
    summary:
      'Details Pending Commission, Available, On Hold, Paid, and Reversed wallet states, the ₦5,000 minimum threshold, the 15th of each month schedule, and platform accounting boundaries.',
    version: '1.0.0',
    effectiveDate: '2026-11-25T00:00:00.000Z',
    isPublished: true,
    contentMarkdown: `# Payout & Wallet Policy

## 1. Distinct Wallet Accounting States
All Scout referral earnings are computed in integer kobo on the server and recorded in an append-only financial ledger:
- **Pending Commission:** Qualifying referral-attributed orders currently awaiting Seller delivery confirmation and clearance of the post-delivery window. Not withdrawable.
- **Available:** Commissions from completed, non-reversed orders that have passed verification and dispute checks.
- **On Hold:** Commissions temporarily paused due to an active order dispute, return review, or compliance check.
- **Paid (Cumulative):** Total historical commissions settled to your verified Nigerian bank account.
- **Reversed (Cumulative):** Linked negative adjustments created when an order is cancelled, refunded, or invalidated.

## 2. Monthly Payout Schedule & Minimum Threshold
- **Payout Day:** Scheduled on the **15th of each calendar month**.
- **Qualifying Window:** Available commissions earned and cleared during the preceding calendar month.
- **Minimum Payout Threshold:** **₦5,000** (\`500,000 kobo\`) cumulative eligible Available balance. Balances below ₦5,000 roll forward automatically until the threshold is met.
- **Verification Requirements:** Completed KYC identity verification and a verified same-name Nigerian bank account are mandatory before any payout release.

## 3. Platform Accounting Boundary
${NAIRASCOUT_ACCOUNTING_BOUNDARY}

> ${NAIRASCOUT_EARNINGS_DISCLAIMER}`,
  },
  {
    slug: 'platform-boundaries',
    title: 'Platform Boundaries & Consumer Protection Notice',
    summary:
      'Clarifies NairaScout platform responsibilities versus Seller obligations for inventory, product authenticity, physical delivery, warranties, and consumer rights.',
    version: '1.0.0',
    effectiveDate: '2026-11-25T00:00:00.000Z',
    isPublished: true,
    contentMarkdown: `# Platform Boundaries & Consumer Protection Notice

## 1. Role of NairaScout
NairaScout operates a social commerce and traceable referral-marketing technology platform connecting verified independent Sellers, Scouts, and Buyers across Nigeria.
- NairaScout provides marketplace discovery, traceable referral attribution, order recording, and internal settlement accounting.
- ${NAIRASCOUT_ACCOUNTING_BOUNDARY}

## 2. Independent Seller Responsibilities
Every Seller on NairaScout operates as an independent merchant and remains solely responsible for:
- **Product Authenticity & Accuracy:** Ensuring all listings, photos, descriptions, prices, and specifications are truthful, lawful, and genuine.
- **Inventory & Packaging:** Maintaining stock availability and securely packaging items for transit.
- **Physical Delivery & 10-Day SLA:** Dispatching orders and completing physical delivery within the **10-calendar-day Seller fulfilment SLA**.
- **Warranties & Statutory Obligations:** Honouring stated return terms, product warranties, and applicable Nigerian consumer protection laws.

## 3. Consumer Protection & Dispute Support
- Nothing in these boundaries waives or restricts a Buyer's statutory consumer rights under Nigerian law.
- Buyers and Scouts may raise fulfilment, authenticity, or attribution cases directly via **Trust & Guide → Support** or appeal governance decisions from **Account Settings**.
- Pending Seller settlements and Pending Commission ledger entries remain held against release until delivery confirmation and dispute checks clear.`,
  },
];

export const DEFAULT_HELP_ARTICLES_SEED: HelpArticleSeed[] = [
  {
    slug: 'welcome-to-nairascout',
    category: 'GETTING_STARTED',
    title: 'Welcome to NairaScout: One Identity, No Earning Limits',
    summary:
      'Understand how Scout participation, Seller activation, and Buyer checkout work under one unified NairaScout account.',
    audienceRole: 'ALL',
    sortOrder: 1,
    isPublished: true,
    bodyMarkdown: `# Welcome to NairaScout

**${NAIRASCOUT_TAGLINE}** ${NAIRASCOUT_VALUE_PROPOSITION}

Every member registers once with a single unified identity:
- **Scout by Default:** Every registered account can browse the marketplace, build a Scouts List, and share traceable product referrals for free.
- **Buy Seamlessly:** Shop directly from the marketplace or purchase via a Referral Card received from a Scout in your network.
- **Optional Seller Capabilities:** Individuals and registered businesses can activate Seller tools on the same identity and begin publishing listings once Seller verification is **VERIFIED**.

> ${NAIRASCOUT_EARNINGS_DISCLAIMER}`,
  },
  {
    slug: 'thirteen-generation-commissions-explained',
    category: 'SCOUTS_REFERRALS',
    title: 'How the 13-Generation Referral Pool Works',
    summary:
      'See how 20% of NairaScout’s 10% platform fee is distributed across the 13 most recent eligible referrers.',
    audienceRole: 'SCOUT',
    sortOrder: 2,
    isPublished: true,
    bodyMarkdown: `# How the 13-Generation Referral Pool Works

When a buyer completes a qualifying purchase initiated from a traceable **Referral Card** (\`REFER\`):
1. The Seller receives **90%** of eligible merchandise revenue (excluding delivery and tax).
2. NairaScout earns a **10%** marketplace commission.
3. **20% of that 10% commission** (**2%** of eligible merchandise revenue) enters the referral pool.
4. The pool is allocated across the **13 most recent eligible referrers** (**Gen 1 through Gen 13**) in the Seller Scout's permanent referral ancestry.

### Key Protections
- **14th-Scout Exclusion:** Generations deeper than 13 receive ₦0.00.
- **No Ancestor Skipping:** If an ancestor at any generation slot is ineligible, suspended, or closed, that slot receives ₦0.00 and later ancestors are never promoted to fill it. Undistributed amounts remain with NairaScout.
- **Use the Calculator:** Test exact Naira and kobo allocations anytime in **Network → Calculator**.`,
  },
  {
    slug: 'direct-buy-vs-referral-attribution',
    category: 'SCOUTS_REFERRALS',
    title: 'Direct BUY vs. Referral Card Attribution (Non-Last-Click)',
    summary:
      'Learn why general marketplace purchases are always Direct and how Referral Card event IDs protect attribution.',
    audienceRole: 'SCOUT',
    sortOrder: 3,
    isPublished: true,
    bodyMarkdown: `# Direct BUY vs. Referral Card Attribution

NairaScout uses strict **event-based attribution**, never cookie-based last-click guessing:
- **Direct Marketplace BUY:** Clicking **BUY** on the general discovery feed creates a Direct Order with **₦0.00** referral commission, even if you received a referral earlier.
- **Referral Card Checkout:** Clicking **Buy** from a Referral Card (or a valid referral link carrying a traceable \`referral_event_id\`) attributes the order to that referral event.
- **30-Day Referral Window:** Each referral event remains valid for **30 calendar days** from creation.
- **7-Day Abandoned Checkout Protection:** If a buyer starts checkout from a referral card and pauses, that attribution remains protected for **7 calendar days**.
- **Anti-Hijack Guarantee:** Forwarding another Scout's link never transfers credit. Always use **REFER** to generate your own unique \`referral_event_id\`.`,
  },
  {
    slug: 'scouts-list-invitations-and-privacy',
    category: 'SCOUTS_REFERRALS',
    title: 'Managing Your Scouts List, Invitations & Blocks',
    summary:
      'Keep your referral network clean by setting who can invite you, muting referrals, or blocking abusive accounts.',
    audienceRole: 'SCOUT',
    sortOrder: 4,
    isPublished: true,
    bodyMarkdown: `# Managing Your Scouts List & Privacy

Your **Scouts List** is separate from product referral cards:
- **Send Invitations:** Search public Scout handles or Nigerian states under **Network → Scouts** and invite contacts (max 14-day invitation expiry).
- **Invitation Policy:** Under **Account Settings → Privacy**, choose whether **Everyone**, **Contacts Only**, or **Nobody** can send you Scouts List invitations.
- **Mute Referrals:** Toggle **Mute Incoming Product Referrals** anytime to stop receiving referral cards without closing your account.
- **Block & Report:** You can remove, block, or report any contact directly from the Scouts List. Blocked pairs cannot invite or refer each other.`,
  },
  {
    slug: 'buyer-orders-and-fulfilment-sla',
    category: 'BUYERS_ORDERS',
    title: 'Buyer Orders, Delivery Fees & 10-Day Fulfilment SLA',
    summary:
      'What happens after you confirm an order, how delivery fees are handled, and what the 10-day Seller SLA covers.',
    audienceRole: 'BUYER',
    sortOrder: 5,
    isPublished: true,
    bodyMarkdown: `# Buyer Orders & 10-Day Fulfilment SLA

1. **Transparent Checkout Totals:** You see the exact merchandise subtotal and Seller delivery fee before confirming payment. Delivery fees are excluded from commission calculations.
2. **10-Calendar-Day Seller Fulfilment SLA:** Verified Sellers must process and fulfil paid orders within **10 calendar days**.
3. **Pending Settlement Protection:** Seller proceeds and Pending Commissions are not released until delivery confirmation and review checks pass.
4. **Need Help With an Order?** Open **Trust & Guide → Support** and submit your Order ID for Trust & Safety review.`,
  },
  {
    slug: 'seller-onboarding-and-verification-gate',
    category: 'SELLERS_PLANS',
    title: 'Seller Onboarding & Mandatory Verification Gate',
    summary:
      'How to activate Individual or Business Seller capabilities, create drafts, and pass verification before publishing.',
    audienceRole: 'SELLER',
    sortOrder: 6,
    isPublished: true,
    bodyMarkdown: `# Seller Onboarding & Verification Gate

- **Activate on Your Primary Identity:** Open **Seller Hub** and complete the 4-step setup (Individual or Business Seller, business logo, description, category, plan, and verification document upload).
- **Drafts Allowed Immediately:** You can prepare product drafts while verification is pending.
- **Mandatory VERIFIED Gate:** No product listing can be published to the live marketplace until a Verification Officer reviews your submission and marks Seller verification as **VERIFIED**.
- **Separation of Duties:** Officers cannot approve their own verification records, and any rejected or action-required decision can be appealed under **Account Settings**.`,
  },
  {
    slug: 'seller-plans-and-listing-media-limits',
    category: 'SELLERS_PLANS',
    title: 'Seller Plans, Listing Quotas, Multi-Image & Video Rules',
    summary:
      'Compare Starter, Traction, Growth, and Sprawl active listing caps, monthly publications, 10-image limits, and video links.',
    audienceRole: 'SELLER',
    sortOrder: 7,
    isPublished: true,
    bodyMarkdown: `# Seller Plans & Listing Entitlements

Every Seller plan supports up to **10 product images per listing** (JPEG, PNG, WebP, max 5 MB each) and **10-calendar-day listing duration**:
- **Starter (Free):** 1 active listing · 3 monthly publications · 1 category · 0 video links · No team seats.
- **Traction (₦4,500/mo):** 3 active listings · 10 monthly publications · 3 categories · 1 YouTube/TikTok video link.
- **Growth (₦35,000/mo):** 5 active listings · 25 monthly publications · 10 categories · 3 YouTube/TikTok video links.
- **Sprawl (₦250,000/mo):** 20 active listings · 100 monthly publications · All categories · 5 YouTube/TikTok video links · Up to **5 Business Team seats**.

Verified Sellers can launch the 4-step **Create Listing** wizard anytime via the floating **+** button.`,
  },
  {
    slug: 'wallet-balances-and-monthly-payouts',
    category: 'WALLET_PAYOUTS',
    title: 'Wallet Balances, ₦5,000 Threshold & Monthly 15th Payouts',
    summary:
      'Understand Pending Commission vs. Available vs. Paid balances and how monthly payouts work on the 15th.',
    audienceRole: 'SCOUT',
    sortOrder: 8,
    isPublished: true,
    bodyMarkdown: `# Wallet Balances & Monthly 15th Payouts

- **Pending Commission:** Commissions attached to active orders waiting for Seller fulfilment and post-delivery clearance.
- **Available:** Verified commissions eligible for the next monthly payout cycle.
- **Monthly Payout Schedule:** Payouts run on the **15th of each month** for Available balances earned in the preceding calendar month once your cumulative eligible balance reaches **₦5,000** (\`500,000 kobo\`), your KYC identity is verified, and a same-name Nigerian bank account is confirmed.
- **Accounting Boundary:** ${NAIRASCOUT_ACCOUNTING_BOUNDARY}

> ${NAIRASCOUT_EARNINGS_DISCLAIMER}`,
  },
  {
    slug: 'two-track-closure-and-appeals',
    category: 'TRUST_SAFETY',
    title: 'Two-Track Voluntary Closure & Independent Appeals',
    summary:
      'Close Seller capabilities independently without losing your Scout account, or appeal a verification or restriction decision.',
    audienceRole: 'ALL',
    sortOrder: 9,
    isPublished: true,
    bodyMarkdown: `# Two-Track Closure & Independent Appeals

- **Track 1 — Close Seller Capabilities Only:** You may close your Seller store independently under **Account Settings → Closure** while keeping your Scout identity, referral network, and Wallet fully operational.
- **Track 2 — Close Full Account:** Full account closure checks for open orders, disputes, and pending settlements first, then permanently preserves append-only referral ancestry and financial ledger history while terminating personal access.
- **Independent Appeals:** If your account receives a capability restriction or verification rejection, you can submit an appeal from **Account Settings**. Appeals are always reviewed by an independent Appeals Officer who did not make the original decision.`,
  },
];
