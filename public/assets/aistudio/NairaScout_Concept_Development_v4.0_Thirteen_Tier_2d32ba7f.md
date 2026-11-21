**NAIRASCOUT**

**CONCEPT DEVELOPMENT**

*A Thirteen-Generation Referral Marketing & Social Commerce Platform*

**Version 4.0  \|  Updated 21 November 2026**

Consolidated Concept Foundation

# **Document status and source hierarchy**

This document consolidates the original NairaScout Concept Development v1.0, the approved decisions recorded in the v2.0 refinement pass, and the relevant operating refinements in v3.0. It updates the referral compensation concept from a four-tier limit to a maximum of thirteen generations.

The current 13-generation referral-engine decisions approved during the subsequent product-definition work are treated as the governing baseline where they supersede earlier four-tier wording or older draft figures. The v3.0 refinement document contains a mixture of recommendations and proposed operating rules; recommendations that were not separately approved are not silently promoted to binding product decisions.

| This is a product concept document, not a final legal opinion, payment-provider capability confirmation, financial model, Blueprint, PRD or database specification. Those documents will provide implementation-level detail and validation. |
| :---- |

## **Revision history**

| Version | Source / change | Status |
| :---- | :---- | :---- |
| 1.0 | Original concept: referral marketing and social commerce with four-tier commissions. | Superseded |
| 2.0 | Approved refinements: positioning, seller plans, Scouts List controls, referral-card attribution, product referral graph, commission rounding, privacy, fraud controls and architecture. | Consolidated |
| 3.0 | Additional proposed operating rules covering checkout, referrals, commission operations, Seller operations and Bachs settlement verification. | Recommendations distinguished from approvals |
| 4.0 | Current concept: 13-generation permanent referral ancestry, 20% of eligible NairaScout marketplace commission as referral pool, dynamic generation schedule, revised wallet and payout principles. | Current consolidated concept |

# **Executive summary**

NairaScout is a referral marketing and social commerce marketplace. It enables businesses and individual sellers to reach customers through trusted personal relationships rather than relying only on paid advertising, public audiences or conventional affiliate links. People join as Scouts, discover products, share product referrals with people they know, and may earn commissions when genuine qualifying product sales are generated through the referral system.

The defining feature is a product-commerce referral programme supported by a permanent Scout referral ancestry of up to thirteen generations. A Scout may earn from eligible sales associated with their own referral activity and from qualifying downstream commercial activity within their original referral ancestry. The platform does not pay for recruitment, registration, network size or membership fees. Commissions arise only from qualifying commercial transactions.

The referral system is supported by a marketplace, Seller tools, referral-card-specific purchase attribution, a server-side commission engine, a financial ledger, order fulfilment controls, Scout earnings and payout functions, privacy safeguards, fraud monitoring and administrative governance.

The 13-generation model preserves a maximum 20% referral pool of NairaScout’s eligible marketplace commission revenue. The share allocated to each generation depends on the actual ancestry depth, using the approved schedules. Ineligible ancestors are not replaced by deeper generations; their allocations remain undistributed and are retained by NairaScout.

# **PART A — PRODUCT IDENTITY AND POSITIONING**

## **A1. What is NairaScout?**

NairaScout is a referral marketing and social commerce platform that enables Sellers to market products through interconnected networks of individual product Scouts. A Scout can discover products, buy directly, refer products to others, receive referrals, and earn eligible commissions from genuine purchases generated through the referral system.

NairaScout supports product discovery, referral distribution, referral attribution, checkout, payment collection, order management, fulfilment monitoring, commission calculation, wallet accounting, settlement and reporting.

## **A2. Positioning and tagline**

NairaScout — Don’t limit your affiliate earnings to buyers you find yourself. Earn way more from people in your referral network who find buyers for products you promote.

The platform makes the commercial contribution of product introductions measurable and compensable, including qualifying downstream commercial activity, without turning recruitment itself into a paid activity.

## **A3. Commercial philosophy**

* People are more likely to pay attention to product recommendations from people they know.  
* Many people have useful purchasing and social networks without having large public social-media audiences.  
* A person who introduces a product or connects a seller to a buyer can create commercial value even when that person does not complete the purchase.  
* NairaScout rewards qualifying commercial contribution while keeping the source of each purchase and each commission auditable.

# **PART B — USERS, ACCOUNTS AND PARTICIPATION**

## **B1. Scout Account**

Every registered user starts with a free Scout Account. A Scout does not need to sell products, subscribe to a Seller plan, recruit members or make personal purchases to qualify for referral commissions.

* Discover products and Sellers.  
* Choose product categories and relevant discovery preferences.  
* Maintain a personal Scouts List.  
* Receive product referrals and refer products to others.  
* Purchase products directly or through a valid referral.  
* Participate in the permanent Scout referral network.  
* View their own network information and referral earnings.  
* Use a separate referral earnings wallet and manage payout verification.  
* Manage profile, privacy, notification and delivery preferences.

## **B2. Seller Account**

A Scout may activate Seller capabilities. Seller functionality is attached to the same user identity; it is not a separate unrelated identity. A person who is both a Scout and a Seller retains Scout functionality and is identified by a Seller badge where appropriate.

* Create and manage product listings.  
* Publish listings within plan entitlements.  
* Manage inventory, orders, fulfilment and customer service.  
* Monitor direct and referral-generated sales.  
* Review product referral and sales analytics.  
* Manage settlement information and Seller verification.

## **B3. Participation principles**

* Scout registration is free.  
* No payment is required to become eligible for referral commissions.  
* No commission is earned merely because another person registers or joins a network.  
* A Scout may earn without operating a Seller account.  
* Seller subscriptions purchase actual Seller functionality and are separate from referral earnings.

# **PART C — SELLER SUBSCRIPTION MODEL**

NairaScout supports a free Starter plan and three paid Seller plans. The subscription structure is separate from the referral commission programme.

| Plan | Monthly subscription |
| :---- | :---- |
| Starter | Free |
| Traction | ₦4,500 |
| Growth | ₦35,000 |
| Sprawl | ₦250,000 |

| Capability | Starter | Traction | Growth | Sprawl |
| :---- | :---- | :---- | :---- | :---- |
| Maximum active product listings | 1 | 3 | 5 | 20 |
| Monthly listing publications | 3 | 10 | 25 | 100 |
| Product categories | 1 | 3 | 10 | All categories |
| Listing duration | 10 days | 10 days | 10 days | 10 days |
| Images | 6 per listing | 6 per listing | 6 per listing | 6 per listing |
| Video | None | 1 per listing; 60 sec; 30 MB | 3 per listing; 120 sec; 100 MB each | 5 per listing; 180 sec; 1 GB each |
| Video processing | — | Automatic compression; no automatic thumbnail | Automatic compression; no automatic thumbnail | No automatic compression; automatic thumbnail |
| Sales/referral analytics | Basic | Basic | Advanced | Advanced |
| Order management | Basic | Basic | Advanced | Advanced |
| Inventory management | Basic | Basic | Advanced | Advanced |
| Promotional placements | No | No | Yes | Yes |
| Seller team accounts | No | No | No | Yes |
| Advanced reporting | No | No | No | Yes |

A product, a product listing and a listing publication are distinct concepts. Republishing an expired listing consumes a monthly publication allowance. Ordinary edits to an existing listing do not count as another publication. Basic order and fulfilment functionality is available to all Seller plans; advanced operational tools are plan-dependent.

The listing limits and detailed plan entitlements remain subject to the approved Seller subscription baseline and may be refined through controlled policy changes before launch. A subscription does not create or increase a Scout’s referral commission entitlement.

# **PART D — PRODUCT CATALOGUE AND DISCOVERY**

## **D1. Product listing**

A listing may include product name, description, category, images, video where permitted, price, quantity, specifications, delivery information, return policy, warranty information where applicable, availability and verified Seller identity. Products, listings and listing publications are separately represented in the product model.

## **D2. Product discovery**

Product distribution and discovery may use Scout-selected preferences such as product category, location, price range, preferred brands, product characteristics and delivery availability. The platform should distinguish the general product discovery feed from product referrals sent personally by other Scouts.

## **D3. Product card**

Product cards should display the key product and Seller information, availability and clear BUY and REFER actions. The BUY action on a valid referral card has a different attribution outcome from a BUY action initiated through the general marketplace listing.

# **PART E — SCOUTS LIST AND PRODUCT REFERRALS**

## **E1. Scouts List**

The Scouts List is a reusable directory of contacts a Scout may wish to share products with. Adding a person to a Scouts List is not itself a product referral and does not create a product-specific referral event or commission entitlement.

A Scout may invite another user to join their Scouts List. The recipient may accept or reject. Controls should include invitation expiry, withdrawal of pending invitations, removal of contacts, blocking, abuse reporting and the ability to limit who may send invitations.

## **E2. Invite and Refer are different actions**

| Action | Meaning |
| :---- | :---- |
| Invite | Ask a person to join the Scout’s reusable Scouts List. |
| Refer | Send a specific product to a person through a traceable product referral event. |

The interface should use REFER rather than RECRUIT. NairaScout is a product-referral platform, not a recruitment-compensation platform. A recipient is not obliged to propagate a product referral.

## **E3. Product-specific referral events and paths**

A product may travel through multiple independent referral paths. The same recipient may receive the same product from different Scouts through distinct referral events. Each event must preserve its own source referral and ancestry. The platform must not infer purchase ancestry by simply looking up the recipient’s latest referral.

Repeated sending of the same product by the same Scout to the same recipient through the same ancestry should not create artificial commissionable paths. A genuinely different upstream path may create a distinct referral event. Circular referral paths are rejected.

## **E4. Referral messages and external sharing**

Scouts may attach an optional personal message to a product referral and share valid referral links through supported external communication channels. A referral identifier must identify the specific referral event, not merely the Scout. External referral links must preserve attribution through registration, authentication and checkout.

# **PART F — PERMANENT SCOUT REFERRAL ANCESTRY**

## **F1. Thirteen-generation network**

NairaScout maintains a permanent direct-referrer relationship for each Scout who joins through an attributable referral. Each Scout has no more than one direct referrer. That relationship establishes the Scout’s position in the platform-wide referral ancestry, up to thirteen generations for commission purposes.

Generation 1 is the Scout’s direct referrer; Generation 2 is that referrer’s direct referrer; Generation 3 is the next ancestor, continuing through Generation 13\. The Scout whose transaction generates the commission is not counted as an ancestor.

## **F2. Permanent attribution**

* Referral attribution is established through approved referral links, codes or invitation mechanisms during registration.  
* Once successfully established, the direct-referrer relationship is permanent and is not casually replaceable.  
* Exceptional corrections of proven attribution errors require evidence, authorised approval and a complete audit trail.  
* Account inactivity, closure or suspension does not erase historical ancestry.  
* Ancestry must not contain self-referrals, duplicate parents or circular relationships.  
* An ancestry lookup or index is derived data and must be reconstructable from the authoritative direct-referral records.

## **F3. Network visibility**

A Scout may inspect their own network and generation counts, subject to privacy controls. The platform must not expose another Scout’s private contact details, identity documents, bank information, individual earnings, private conversations or confidential transaction information.

# **PART G — THIRTEEN-GENERATION REFERRAL COMMISSION MODEL**

## **G1. Economic foundation**

For eligible marketplace transactions, the Seller receives 90% of eligible merchandise revenue and NairaScout earns a 10% gross marketplace commission. The referral pool is 20% of NairaScout’s eligible marketplace commission revenue—not 20% of the merchandise sale price. Where the full 10% marketplace commission applies, the maximum referral pool is therefore equivalent to 2% of eligible merchandise revenue.

The 20% is a maximum pool. It is not a promise that the entire pool will be distributed. Any unallocated portion remains with NairaScout.

## **G2. Commission schedules**

The schedule is selected by actual ancestry depth. The applicable schedule is not selected by counting only the ancestors who pass individual eligibility checks. Generation positions remain fixed. If an ancestor is ineligible, that generation receives zero; deeper ancestors are not promoted to fill the gap.

| Actual ancestry depth | Generation | Share of referral pool |
| :---- | :---- | :---- |
| 1 generation | 1 | 1/2 |
| 2 generations | 1 | 1/4 |
| 2 generations | 2 | 1/5 |
| 3 generations | 1 | 1/5 |
| 3 generations | 2 | 1/6 |
| 3 generations | 3 | 1/10 |
| 4–13 generations | 1 | 1/6 |
| 4–13 generations | 2 | 1/10 |
| 4–13 generations | 3 | 1/20 |
| 4–13 generations | 4 | 1/30 |
| 4–13 generations | 5 | 1/40 |
| 4–13 generations | 6 | 1/50 |
| 4–13 generations | 7 | 1/60 |
| 4–13 generations | 8 | 1/70 |
| 4–13 generations | 9 | 1/80 |
| 4–13 generations | 10 | 1/90 |
| 4–13 generations | 11 | 1/100 |
| 4–13 generations | 12 | 1/110 |
| 4–13 generations | 13 | 1/120 |

For actual ancestry depth of one, two or three generations, the corresponding shorter schedule applies. For actual ancestry depth of four through thirteen, the extended schedule applies. If an ancestor at any generation is ineligible, that generation’s allocation is zero and no deeper generation moves up.

## **G3. Example of the extended schedule**

If the referral pool is ₦2,000 and all thirteen generations exist and are eligible, the illustrative allocations are:

| Generation | Fraction | Illustrative amount |
| :---- | :---- | :---- |
| 1 | 1/6 | ₦333.33 |
| 2 | 1/10 | ₦200.00 |
| 3 | 1/20 | ₦100.00 |
| 4 | 1/30 | ₦66.67 |
| 5 | 1/40 | ₦50.00 |
| 6 | 1/50 | ₦40.00 |
| 7 | 1/60 | ₦33.33 |
| 8 | 1/70 | ₦28.57 |
| 9 | 1/80 | ₦25.00 |
| 10 | 1/90 | ₦22.22 |
| 11 | 1/100 | ₦20.00 |
| 12 | 1/110 | ₦18.18 |
| 13 | 1/120 | ₦16.67 |
| Total allocated |  | ₦953.97 |
| Undistributed and retained by NairaScout |  | ₦1,046.03 |

The example is illustrative. Actual calculations use the applicable commission pool, exact arithmetic and the approved rounding policy. Individual allocations are rounded to whole kobo; rounding residuals and all other unallocated portions remain with NairaScout. Total allocations may never exceed the referral pool.

## **G4. Why thirteen generations**

The extended ancestry allows legitimate commercial value to be recognised across a deeper referral network while preserving a fixed maximum referral pool. The first four generations receive the larger portions of the extended schedule; generations five through thirteen receive progressively smaller portions. The model rewards qualifying downstream commercial contribution without creating a separate payment for recruiting or registering people.

## **G5. Version control**

Commission schedules, eligibility rules, marketplace commission policy and calculation-engine versions are versioned. A completed transaction retains the exact versions and ancestry snapshot used for its calculation. A future policy change does not silently rewrite historical calculations.

# **PART H — COMMISSION ELIGIBILITY AND TRANSACTION ATTRIBUTION**

## **H1. Qualifying commercial activity only**

* Commissions arise only from genuine qualifying product transactions.  
* No commission is paid for registration, recruitment, adding contacts, network growth alone or subscription purchases.  
* No personal purchase, recruitment quota or Seller subscription is required to earn as a Scout.  
* Cancelled, fraudulent, fully refunded or reversed transactions do not qualify. Partial refunds adjust commissions only against the retained eligible merchandise revenue.

## **H2. Transaction attribution anchor**

For the multi-generation referral commission programme, the seller Scout’s permanent referral ancestry is the default attribution anchor because the Seller’s commercial sale generates NairaScout’s marketplace commission. A single marketplace commission must not generate two referral pools merely because both buyer and Seller are Scouts.

Product referral-card attribution remains a separate, essential commerce rule: a purchase is referral-generated only when checkout is initiated through a valid product referral card or a valid external referral link carrying that specific referral-event identifier. A purchase initiated through the general marketplace listing is direct, even if the buyer previously received a referral for the same product.

## **H3. Referral-card attribution**

Every product referral card has a unique referral-event identifier. The checkout session and resulting order retain that identifier through authentication, payment and order completion. A different referral card does not automatically overwrite an existing checkout attribution. Where multiple independent referral paths exist, the card used to initiate checkout determines the product-referral attribution.

## **H4. Eligibility and no promotion**

Referral relationship eligibility, commission eligibility and payout eligibility are separate determinations. Ancestors are assessed independently. An ineligible ancestor receives no allocation, but deeper ancestors retain their original generation numbers and are not promoted. KYC and verified payout banking are required before payout; they do not necessarily have to be completed before a legitimate commission can be generated.

## **H5. Commissionable revenue**

The 10% marketplace commission is calculated on actual eligible merchandise revenue received, after applicable discounts and refunds. Delivery charges and separately charged taxes are excluded. Cancelled quantities and refunded merchandise amounts are excluded. The 20% referral pool is then calculated from NairaScout’s eligible marketplace commission revenue.

# **PART I — PURCHASE JOURNEYS AND CHECKOUT**

## **I1. Direct marketplace purchase**

* Buyer discovers a product through the general marketplace.  
* Buyer selects BUY on the general listing.  
* Buyer completes checkout and payment.  
* The order is classified as a direct marketplace purchase.  
* No referral commission is generated for that purchase.

## **I2. Referral-generated purchase**

* Buyer opens a valid product referral card or external referral link.  
* Buyer selects BUY through that referral entry point.  
* The checkout session captures the unique referral-event identifier.  
* The attribution survives registration, email OTP authentication, payment redirects and eligible checkout resumption.  
* The order is classified as referral-generated and retains its referral event and ancestry evidence.  
* After fulfilment and applicable dispute/refund checks, the commission engine calculates the eligible referral allocations.

## **I3. Checkout expiry and protection**

Referral invitation validity and referral attribution validity are separate configurable controls. A referral expiring before checkout prevents a new referral-attributed checkout through that card. If checkout began while the referral was valid, expiry does not invalidate that checkout or the completed order. The v3.0 refinement proposed a 30-minute normal checkout inactivity period and seven-day abandoned-checkout attribution retention; these timings should be treated as proposed operational settings unless separately approved in the governing PRD.

# **PART J — ORDER FULFILMENT AND COMMISSION RELEASE**

Payment confirmation does not make Seller proceeds or Scout commissions immediately withdrawable. Orders progress through Seller acceptance, processing, dispatch, delivery, buyer confirmation or valid automatic confirmation, and any applicable return, dispute and fraud checks.

The Seller is responsible for fulfilment. The Seller fulfilment deadline established in the refinement material is ten calendar days from confirmed payment. Failure to fulfil may trigger order cancellation and refund procedures, with associated commissions voided or reversed. The platform monitors fulfilment and provides order, dispute and customer-service mechanisms; it does not assume physical delivery responsibility by default.

* Cancelled orders before fulfilment do not generate final commissions.  
* A disputed delivery suspends commission finalisation until the dispute is resolved.  
* If the buyer neither confirms delivery nor reports a problem within the configured period, the order may progress through an automatic delivery-confirmation mechanism, subject to fraud and dispute checks.  
* Partial refunds recalculate the commission pool against retained merchandise value using the original ancestry and applicable rule version.  
* A Seller’s later listing removal or account status change does not erase obligations on an already-paid order.

# **PART K — SCOUT EARNINGS WALLET, LEDGER AND PAYOUTS**

## **K1. Referral earnings wallet**

Each Scout has a referral earnings wallet, separate from Seller proceeds and any customer shopping balance. The wallet is an internal accounting and earnings interface; it is not, by itself, a promise that the corresponding funds are held in a separate bank account or are immediately withdrawable.

The wallet distinguishes Pending, Available, On Hold, Paid and Reversed amounts. Paid and Reversed are historical/cumulative states and must not be confused with current spendable balances. The underlying source of truth is an immutable financial ledger; displayed balances are derived projections.

## **K2. Immutable ledger**

Every financial event is recorded with a unique reference and relevant order, payment, referral event, ancestry snapshot, beneficiary, amount, currency, status, applicable rule version, timestamp and provider reference where applicable. Entries are never edited or deleted; corrections and reversals are new linked entries.

## **K3. Payout policy**

| Payout rule | Current approved policy |
| :---- | :---- |
| Minimum payout | ₦5,000 |
| Frequency | Monthly |
| Scheduled date | 15th of each month |
| Non-business day | Next Nigerian business day |
| Eligible earnings | Commissions that became Available during the preceding calendar month |
| Currency | NGN at launch |
| Conditions | Required KYC and verified same-name Nigerian bank account |

The payout cycle applies to commissions that became Available during the preceding calendar month. Older unpaid balances must be displayed separately and must not automatically be pooled into a later payout cycle unless that policy is expressly changed and approved. NairaScout does not promise on-demand withdrawals.

A payout is marked Paid only after confirmed bank settlement. Failed payouts remain traceable and are restored to the appropriate payable balance through ledger entries; retries use new payout attempts and references without double payment.

## **K4. Reversals and recovery**

Refunds and reversals are recorded as separate immutable transactions linked to the original allocation. The platform does not automatically debit a Scout’s bank account to recover a previously paid commission. Any recovery from future earnings or other lawful recovery process must follow a published, reviewed policy and applicable law.

# **PART L — SCOUT AND SELLER EXPERIENCES**

## **L1. Scout dashboard**

The Scout experience is mobile-first and provides a clear view of the Scout’s referral activity, network and own earnings. The dashboard may include available, pending and on-hold amounts; total paid and lifetime earnings; direct referrals and total network counts; referral link sharing; recent activity; and guidance about the programme.

## **L2. Thirteen-generation network explorer**

Scouts can view their own network by generation, including generation counts and permitted profile information. The explorer is for transparency and network management, not a recruitment contest. It must not expose other Scouts’ private contact details, identity data, bank details, private transactions or wallet balances. Unrestricted network exports and platform-wide user searches are not permitted.

## **L3. Earnings and commission history**

Scouts can view their own commission records by generation, date, status and payout period. A commission detail may explain the eligible marketplace commission, referral pool, generation, schedule fraction, eligibility result and amount, without revealing buyer identities or confidential Seller information. Pending and on-hold amounts must not be presented as withdrawable.

## **L4. Seller dashboard**

Seller reporting distinguishes original listing impressions and interactions, referral distribution and engagement, direct orders, referral-generated orders, units sold, eligible merchandise revenue, NairaScout commission, referral commission expenses and net Seller proceeds. Dashboards use aggregate statistics and privacy-preserving views.

## **L5. Privacy and communication controls**

Scouts can manage appropriate profile visibility, notification preferences, referral consent and unwanted contact controls. Essential financial, security and legal notices cannot be silently disabled. Product referrals support optional personal messages, but the platform should apply anti-spam, blocking and abuse-reporting controls.

# **PART M — NOTIFICATIONS, SUPPORT AND TRUST**

NairaScout provides in-app notifications for product referrals, Scouts List invitations, order events, delivery confirmations, commission status changes, holds and reversals, payout scheduling and outcomes, KYC and bank verification, security events, policy updates and support cases. Email notifications may be configurable where appropriate. Notification frequency should be controlled to avoid spam.

The help centre explains the referral programme, thirteen generations, permanent attribution, eligibility, referral pool, generation schedule, ineligible ancestors, commission statuses, payout timing, refunds, prohibited conduct, privacy, disputes and appeals. Scouts should have a support and appeal route for account, attribution, commission and payout issues.

# **PART N — ADMINISTRATION AND GOVERNANCE**

The administrative system supports user and Seller verification, product moderation, category and subscription management, referral ancestry administration, commission schedule configuration, financial operations, payouts, disputes, fraud investigations, reporting, support, policy management, access control and audit logs.

Sensitive actions—including commission schedule changes, referral attribution corrections, manual financial adjustments, hold releases, payout overrides, fraud-rule changes and privileged access—require role-based permissions, documented reasons, audit trails and appropriate maker-checker approval. No administrator may silently rewrite historical referral ancestry or financial records.

Commission schedules and policy changes are versioned, tested and approved before their effective date. Material changes are communicated to Scouts and Sellers, with acceptance records where required. Operational reviews should cover programme performance, financial reconciliation, integrity, support and governance.

# **PART O — FRAUD PREVENTION AND NETWORK INTEGRITY**

Fraud prevention applies across identity, accounts, referral ancestry, product referrals, orders, payments, fulfilment, commission calculation, wallets, bank accounts, payouts and administration.

* Prevent self-referral, duplicate and circular ancestry, artificial network construction and attribution manipulation.  
* Detect fictitious or collusive purchases, Seller collusion, refund abuse, payout fraud and account takeover.  
* Use multiple risk signals; shared devices, IP addresses, addresses, family relationships or high genuine sales volume do not alone establish fraud.  
* Risk scores and alerts are indicators, not findings of guilt. Apply proportionate restrictions and human review.  
* Hold only affected amounts where practical; do not automatically freeze unrelated earnings or an entire network.  
* Maintain case records, evidence, decisions, notifications and an appeal process.  
* Preserve historical ancestry and financial records. Corrections and reversals must be separately recorded.

# **PART P — TECHNICAL AND DATA ARCHITECTURE DIRECTION**

The product will be implemented as a modular web application with clear boundaries between identity, Scout management, Seller management, subscriptions, catalogue, discovery, referral management, referral attribution, ancestry, orders, payments, commission calculation, wallets and ledger, Seller settlements, payouts, notifications, fraud, administration and reporting.

The preferred technology direction is Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth, Supabase PostgreSQL and Storage, Drizzle ORM, TanStack Query, TanStack Table, Vercel and GitHub/GitHub Codespaces. Bachs Connect is a prospective payment and payout integration subject to capability, contractual and compliance verification.

Financial and referral decisions are made on trusted server-side services, never by the browser. PostgreSQL transactions, idempotency, uniqueness constraints, access controls, audit logs, immutable ledger entries and reconciliation are fundamental. The commission engine must be independently testable and must not rely on client-supplied commission values.

The architecture should distinguish permanent Scout referral ancestry from product-specific referral events. Product referral events and referral-card attribution explain how a particular buyer entered checkout; the permanent ancestry provides the multi-generation Scout relationship used by the commission programme. The commission calculation stores a transaction-level ancestry snapshot so later network changes cannot rewrite the historical calculation.

# **PART Q — BUSINESS MODEL AND REVENUE**

| Revenue source | Description |
| :---- | :---- |
| Seller subscriptions | Starter, Traction, Growth and Sprawl plans provide progressively broader Seller capabilities. |
| Marketplace transaction commission | NairaScout earns 10% of eligible merchandise revenue, subject to the approved commissionable-revenue rules. |
| Additional commercial opportunities | Potential future services and promotional opportunities, subject to separate business and product approval. |

From NairaScout’s eligible marketplace commission revenue, up to 20% forms the referral pool. The remainder is retained by NairaScout before operating costs. Payment processing fees, hosting, support, fraud losses, taxes, refunds and other operating costs must be modelled separately. The commercial model should be tested across direct and referral-generated sales, Seller plans, transaction values, referral depth, refund rates and payment costs.

# **PART R — LEGAL, REGULATORY AND CONSUMER-PROTECTION PRINCIPLES**

NairaScout’s referral programme must be designed and operated around genuine product sales, not recruitment. No Scout is paid merely for recruiting another Scout, and no Scout pays to qualify for commissions. Seller subscriptions must correspond to actual Seller functionality. The platform must not promise guaranteed income or returns.

The multi-generation compensation model requires specialist legal and compliance review before launch. Review should cover its legal characterisation, consumer protection, advertising and earnings claims, tax treatment, privacy and data protection, identity verification, payment collection, Seller settlement, commission disbursement, financial recordkeeping, dispute resolution and applicable Nigerian regulatory requirements. This concept document is not a legal opinion or confirmation that any licence or regulatory approval is unnecessary.

# **PART S — PAYMENT PROVIDER AND SETTLEMENT DEPENDENCIES**

Bachs-hosted checkout and Bachs Connect are contemplated components of the payment workflow, but the final architecture must be based on verified product capabilities and contractual terms. NairaScout must not assume that connected-account balances constitute escrow or that one checkout automatically supports the required multi-beneficiary distribution.

Before committing to the settlement design, confirm and test payment collection, fund retention pending fulfilment, Seller transfers, multiple Scout payouts, partial refunds, failed transfers, payout status notifications, reconciliation, transaction fees, dispute handling and the applicable contractual/regulatory structure. NairaScout’s internal ledger remains the authoritative record of its financial obligations regardless of provider integration details.

# **PART T — MVP AND DELIVERY PRIORITIES**

The MVP should prove the complete commercial loop and the correctness of the thirteen-generation referral and commission engine before adding complex promotional or predictive features.

## **T1. Scout MVP**

* Registration, authentication and Scout profile.  
* Referral attribution at registration and permanent ancestry records.  
* Product discovery, Scouts List, product referrals and Referrals Inbox.  
* Direct and referral-card-attributed purchases.  
* Thirteen-generation ancestry lookup and commission calculation.  
* Referral earnings wallet, commission history and payout status.  
* KYC, bank verification, notifications and support.

## **T2. Seller MVP**

* Seller activation and verification.  
* Seller subscription management.  
* Product creation, listing and publication.  
* Inventory, basic order management and fulfilment.  
* Seller settlement history and basic sales/referral analytics.

## **T3. Platform MVP**

* Product catalogue and moderation.  
* Permanent Scout ancestry and product-specific referral-event management.  
* Referral attribution service.  
* Versioned 13-generation commission engine.  
* Immutable ledger and reconciliation.  
* Payment-provider integration after capability verification.  
* Order fulfilment, refunds, reversals and disputes.  
* Fraud monitoring, administration, role-based access and audit.

## **T4. Defer until the core loop is proven**

* Advanced AI product recommendations.  
* Sophisticated predictive analytics.  
* Complex advertising packages and promotional campaigns.  
* Automated logistics integrations.  
* Advanced Seller team workflows beyond launch requirements.

# **PART U — CORE PRODUCT PRINCIPLES**

* Product commerce—not recruitment—is the source of referral commissions.  
* Every Scout has at most one permanent direct referrer; historical ancestry is not casually replaced.  
* The maximum referral depth is thirteen generations.  
* The referral pool is 20% of NairaScout’s eligible marketplace commission revenue.  
* Actual ancestry depth determines the applicable schedule; ineligible ancestors are not skipped or replaced.  
* Product referral-card attribution is event-specific and persists through checkout and order processing.  
* Direct marketplace purchases do not generate referral commissions.  
* Financial calculations use exact arithmetic and integer kobo; ledger records are immutable.  
* Commissions become available only after fulfilment and applicable risk, refund and dispute conditions.  
* Scouts’ private information and financial details are protected.  
* No income is guaranteed, and all commissions depend on qualifying genuine transactions.

# **PART V — DOCUMENTS THAT FOLLOW THIS CONCEPT**

This Concept Development document establishes the product vision, principles and operating model. It is the foundation for the more detailed documents below:

* Product Blueprint — product structure, operating model, user journeys and system boundaries.  
* Product Requirements Document (PRD) — functional and non-functional requirements.  
* Business and Financial Model — unit economics, revenue, costs, liquidity and scenarios.  
* Technical Architecture Specification — application, service and integration architecture.  
* Database Design Specification — entities, relationships, constraints and indexes.  
* Referral Ancestry and Commission Engine Specification — permanent ancestry, snapshots, eligibility and 13-generation calculations.  
* Payment and Financial Operations Specification — collection, liabilities, ledger, settlement, refunds, payouts and reconciliation.  
* UI/UX Specification — Scout, Seller and administrative interfaces.  
* Security, Privacy and Fraud Specification.  
* Testing and Quality Assurance Plan.  
* Deployment and Operations Guide.

# **PART W — BUSINESS MODEL SUMMARY**

| Participant | Contribution | Value received |
| :---- | :---- | :---- |
| Scout | Discovers, shares and refers products; may create commercial reach through a referral ancestry. | May earn commissions from qualifying sales according to generation, eligibility and schedule. |
| Seller | Lists, prices, stocks and fulfils products. | Accesses marketplace demand and a distributed product-referral network. |
| Buyer | Discovers and purchases products. | Receives the purchased product and applicable customer protections. |
| NairaScout | Provides marketplace, referral attribution, checkout, order, financial and trust infrastructure. | Earns Seller subscriptions and retained marketplace commission revenue. |

The commercial cycle is: Seller lists a product → Scouts discover and share it → a buyer enters through the marketplace or a specific referral event → buyer purchases → Seller fulfils → eligible commission is calculated and recorded → qualifying commissions become available and are paid under the payout policy.

# **Appendix — Key terminology**

| Term | Meaning |
| :---- | :---- |
| Scout | A registered NairaScout participant with a free Scout Account. |
| Seller | A Scout with activated Seller capabilities. |
| Scouts List | A Scout’s reusable directory of contacts; not itself a product referral chain. |
| Direct referrer | The one Scout directly attributed as having referred a new Scout into the permanent ancestry. |
| Generation | An ancestor’s position in a Scout’s permanent referral ancestry, from 1 to 13\. |
| Referral event | A specific product referral from one Scout to a recipient, with its own unique identifier and ancestry context. |
| Referral-card attribution | The rule that the specific referral card or valid external referral link used to initiate checkout determines the product-referral attribution. |
| Referral pool | Up to 20% of NairaScout’s eligible marketplace commission revenue allocated for generation-based Scout commissions. |
| Eligible marketplace commission revenue | NairaScout’s commission revenue calculated on actual eligible merchandise revenue after applicable discounts and refunds, excluding delivery and separately charged taxes. |
| Undistributed referral allocation | Any portion of the referral pool not allocated to eligible Scouts; retained by NairaScout. |
| Available commission | A commission that has passed the required fulfilment, dispute, refund and integrity checks and is eligible for the applicable payout cycle. |

