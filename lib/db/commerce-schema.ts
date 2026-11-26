import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { CommissionBreakdown } from '@/lib/commission-engine';
import type { ListingVideoLink } from '@/lib/media/video-links';
import { users, sellerProfiles } from './schema';

export const productListings = pgTable('product_listings', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  priceKobo: bigint('price_kobo', { mode: 'number' }).notNull(),
  deliveryFeeKobo: bigint('delivery_fee_kobo', { mode: 'number' }).notNull(),
  stock: integer('stock').notNull(),
  sellerScoutId: uuid('seller_scout_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  sellerProfileId: uuid('seller_profile_id')
    .notNull()
    .references(() => sellerProfiles.id, { onDelete: 'restrict' }),
  sellerName: text('seller_name').notNull(),
  sellerCity: text('seller_city').notNull(),
  status: text('status').default('DRAFT').notNull(), // 'DRAFT' | 'PUBLISHED' | 'EXPIRED'
  imageSeed: text('image_seed').notNull(),
  imageUrl: text('image_url').notNull(),
  imageUrls: jsonb('image_urls').$type<string[]>().default([]).notNull(),
  videoLinks: jsonb('video_links').$type<ListingVideoLink[]>().default([]).notNull(),
  daysRemaining: integer('days_remaining').default(10).notNull(),
  specifications: jsonb('specifications').$type<string[]>().default([]).notNull(),
  returnPolicy: text('return_policy').notNull(),
  warranty: text('warranty').notNull(),
  impressions: integer('impressions').default(0).notNull(),
  referralShares: integer('referral_shares').default(0).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const productReferralEvents = pgTable('product_referral_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  productListingId: text('product_listing_id')
    .notNull()
    .references(() => productListings.id, { onDelete: 'restrict' }),
  senderScoutId: uuid('sender_scout_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  recipientScoutId: uuid('recipient_scout_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  note: text('note').notNull(),
  ancestryPathSignature: text('ancestry_path_signature').notNull(),
  status: text('status').default('active').notNull(), // 'active' | 'expired' | 'converted'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const marketplaceOrders = pgTable('marketplace_orders', {
  id: text('id').primaryKey(),
  buyerScoutId: uuid('buyer_scout_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  buyerDisplayName: text('buyer_display_name').notNull(),
  productListingId: text('product_listing_id')
    .notNull()
    .references(() => productListings.id, { onDelete: 'restrict' }),
  productTitle: text('product_title').notNull(),
  sellerScoutId: uuid('seller_scout_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  sellerName: text('seller_name').notNull(),
  quantity: integer('quantity').notNull(),
  eligibleMerchandiseKobo: bigint('eligible_merchandise_kobo', { mode: 'number' }).notNull(),
  deliveryFeeKobo: bigint('delivery_fee_kobo', { mode: 'number' }).notNull(),
  totalChargedKobo: bigint('total_charged_kobo', { mode: 'number' }).notNull(),
  attributionType: text('attribution_type').notNull(), // 'direct' | 'referral_card'
  referralEventId: uuid('referral_event_id').references(() => productReferralEvents.id, {
    onDelete: 'restrict',
  }),
  fulfilmentStatus: text('fulfilment_status').default('Paid').notNull(),
  fulfilmentDeadline: timestamp('fulfilment_deadline', { withTimezone: true }).notNull(),
  commissionSnapshot: jsonb('commission_snapshot').$type<CommissionBreakdown>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const commissionLedgerEntries = pgTable('commission_ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  reference: text('reference').notNull(),
  orderId: text('order_id')
    .notNull()
    .references(() => marketplaceOrders.id, { onDelete: 'restrict' }),
  referralEventId: uuid('referral_event_id').references(() => productReferralEvents.id, {
    onDelete: 'restrict',
  }),
  beneficiaryScoutId: uuid('beneficiary_scout_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  generation: integer('generation').notNull(),
  fractionLabel: text('fraction_label').notNull(),
  amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(),
  status: text('status').notNull(), // 'Pending' | 'Available' | 'On Hold' | 'Paid' | 'Reversed'
  ruleVersion: text('rule_version').notNull(),
  description: text('description').notNull(),
  linkedToReference: text('linked_to_reference'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const platformNotifications = pgTable('platform_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').default('SYSTEM').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  actionUrl: text('action_url'),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const supportCases = pgTable('support_cases', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  topic: text('topic').notNull(),
  subject: text('subject').notNull(),
  details: text('details').notNull(),
  status: text('status').default('Under Review').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

const globalForDdl = globalThis as unknown as {
  __nsCommerceTablesReady?: Promise<void>;
};

/**
 * Ensures commerce tables exist in PostgreSQL idempotently without modifying lib/db/schema.ts.
 */
export async function ensureCommerceTables(
  executeSql: (query: ReturnType<typeof sql>) => Promise<unknown>
): Promise<void> {
  if (!globalForDdl.__nsCommerceTablesReady) {
    globalForDdl.__nsCommerceTablesReady = (async () => {
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.product_listings (
          id text PRIMARY KEY,
          product_id text NOT NULL,
          title text NOT NULL,
          description text NOT NULL,
          category text NOT NULL,
          price_kobo bigint NOT NULL,
          delivery_fee_kobo bigint NOT NULL,
          stock integer NOT NULL,
          seller_scout_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          seller_profile_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
          seller_name text NOT NULL,
          seller_city text NOT NULL,
          status text NOT NULL DEFAULT 'DRAFT',
          image_seed text NOT NULL,
          image_url text NOT NULL,
          days_remaining integer NOT NULL DEFAULT 10,
          specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
          return_policy text NOT NULL,
          warranty text NOT NULL,
          impressions integer NOT NULL DEFAULT 0,
          referral_shares integer NOT NULL DEFAULT 0,
          published_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.product_referral_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          product_listing_id text NOT NULL REFERENCES public.product_listings(id) ON DELETE RESTRICT,
          sender_scout_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          recipient_scout_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          note text NOT NULL,
          ancestry_path_signature text NOT NULL,
          status text NOT NULL DEFAULT 'active',
          expires_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.marketplace_orders (
          id text PRIMARY KEY,
          buyer_scout_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          buyer_display_name text NOT NULL,
          product_listing_id text NOT NULL REFERENCES public.product_listings(id) ON DELETE RESTRICT,
          product_title text NOT NULL,
          seller_scout_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          seller_name text NOT NULL,
          quantity integer NOT NULL,
          eligible_merchandise_kobo bigint NOT NULL,
          delivery_fee_kobo bigint NOT NULL,
          total_charged_kobo bigint NOT NULL,
          attribution_type text NOT NULL,
          referral_event_id uuid REFERENCES public.product_referral_events(id) ON DELETE RESTRICT,
          fulfilment_status text NOT NULL DEFAULT 'Paid',
          fulfilment_deadline timestamptz NOT NULL,
          commission_snapshot jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.commission_ledger_entries (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          reference text NOT NULL,
          order_id text NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE RESTRICT,
          referral_event_id uuid REFERENCES public.product_referral_events(id) ON DELETE RESTRICT,
          beneficiary_scout_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          generation integer NOT NULL,
          fraction_label text NOT NULL,
          amount_kobo bigint NOT NULL,
          status text NOT NULL,
          rule_version text NOT NULL,
          description text NOT NULL,
          linked_to_reference text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.platform_notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          category text NOT NULL,
          title text NOT NULL,
          body text NOT NULL,
          read boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.support_cases (
          id text PRIMARY KEY,
          user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          topic text NOT NULL,
          subject text NOT NULL,
          details text NOT NULL,
          status text NOT NULL DEFAULT 'Under Review',
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.nigerian_states (
          code text PRIMARY KEY,
          name text NOT NULL UNIQUE,
          geo_zone text NOT NULL
        );
      `);
      await executeSql(sql`
        INSERT INTO public.nigerian_states (code, name, geo_zone) VALUES
          ('AB', 'Abia', 'South East'),
          ('AD', 'Adamawa', 'North East'),
          ('AK', 'Akwa Ibom', 'South South'),
          ('AN', 'Anambra', 'South East'),
          ('BA', 'Bauchi', 'North East'),
          ('BY', 'Bayelsa', 'South South'),
          ('BE', 'Benue', 'North Central'),
          ('BO', 'Borno', 'North East'),
          ('CR', 'Cross River', 'South South'),
          ('DE', 'Delta', 'South South'),
          ('EB', 'Ebonyi', 'South East'),
          ('ED', 'Edo', 'South South'),
          ('EK', 'Ekiti', 'South West'),
          ('EN', 'Enugu', 'South East'),
          ('FC', 'FCT - Abuja', 'North Central'),
          ('GO', 'Gombe', 'North East'),
          ('IM', 'Imo', 'South East'),
          ('JI', 'Jigawa', 'North West'),
          ('KD', 'Kaduna', 'North West'),
          ('KN', 'Kano', 'North West'),
          ('KT', 'Katsina', 'North West'),
          ('KE', 'Kebbi', 'North West'),
          ('KO', 'Kogi', 'North Central'),
          ('KW', 'Kwara', 'North Central'),
          ('LA', 'Lagos', 'South West'),
          ('NA', 'Nasarawa', 'North Central'),
          ('NI', 'Niger', 'North Central'),
          ('OG', 'Ogun', 'South West'),
          ('ON', 'Ondo', 'South West'),
          ('OS', 'Osun', 'South West'),
          ('OY', 'Oyo', 'South West'),
          ('PL', 'Plateau', 'North Central'),
          ('RI', 'Rivers', 'South South'),
          ('SO', 'Sokoto', 'North West'),
          ('TA', 'Taraba', 'North East'),
          ('YO', 'Yobe', 'North East'),
          ('ZA', 'Zamfara', 'North West')
        ON CONFLICT (code) DO NOTHING;
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.listing_categories (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL UNIQUE,
          slug text NOT NULL UNIQUE,
          description text,
          is_active boolean NOT NULL DEFAULT true,
          sort_order integer NOT NULL DEFAULT 0,
          created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        INSERT INTO public.listing_categories (name, slug, sort_order) VALUES
          ('Fashion & Apparel', 'fashion-apparel', 1),
          ('Electronics & Gadgets', 'electronics-gadgets', 2),
          ('Phones & Accessories', 'phones-accessories', 3),
          ('Beauty & Personal Care', 'beauty-personal-care', 4),
          ('Home & Living', 'home-living', 5),
          ('Health & Wellness', 'health-wellness', 6),
          ('Groceries & Provisions', 'groceries-provisions', 7),
          ('Books & Education', 'books-education', 8)
        ON CONFLICT (slug) DO NOTHING;
      `);
      await executeSql(sql`
        ALTER TABLE public.seller_profiles
          ADD COLUMN IF NOT EXISTS logo_url text;
      `);
      await executeSql(sql`
        ALTER TABLE public.product_listings
          ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS video_links jsonb NOT NULL DEFAULT '[]'::jsonb;
      `);
      await executeSql(sql`
        UPDATE public.product_listings
        SET image_urls = jsonb_build_array(image_url)
        WHERE jsonb_array_length(image_urls) = 0
          AND image_url IS NOT NULL
          AND image_url <> '';
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          category text NOT NULL DEFAULT 'SYSTEM',
          title text NOT NULL,
          body text NOT NULL,
          action_url text,
          is_read boolean NOT NULL DEFAULT false,
          read_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
          ON public.notifications(user_id, is_read, created_at DESC);
      `);
      await executeSql(sql`
        INSERT INTO public.notifications (id, user_id, category, title, body, is_read, created_at)
        SELECT id, user_id, UPPER(category), title, body, read, created_at
        FROM public.platform_notifications
        ON CONFLICT (id) DO NOTHING;
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.platform_policies (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          slug text NOT NULL UNIQUE,
          title text NOT NULL,
          summary text NOT NULL,
          content_markdown text NOT NULL,
          version text NOT NULL DEFAULT '1.0.0',
          effective_date timestamptz NOT NULL DEFAULT now(),
          is_published boolean NOT NULL DEFAULT true,
          updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE INDEX IF NOT EXISTS idx_platform_policies_published
          ON public.platform_policies(is_published, slug);
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.help_articles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          slug text NOT NULL UNIQUE,
          category text NOT NULL,
          title text NOT NULL,
          summary text NOT NULL,
          body_markdown text NOT NULL,
          audience_role text NOT NULL DEFAULT 'ALL',
          sort_order integer NOT NULL DEFAULT 0,
          is_published boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await executeSql(sql`
        CREATE INDEX IF NOT EXISTS idx_help_articles_category_published
          ON public.help_articles(is_published, category, sort_order);
      `);
      // NS-AUT-008: Module 4 auth security columns & recovery/retention tables
      await executeSql(sql`
        ALTER TABLE public.users
          ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
          ADD COLUMN IF NOT EXISTS privacy_acknowledged_at timestamptz,
          ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
          ADD COLUMN IF NOT EXISTS last_reauthenticated_at timestamptz,
          ADD COLUMN IF NOT EXISTS withdrawal_cooldown_until timestamptz,
          ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
          claimed_email text NOT NULL,
          claimed_username text,
          contact_email_for_updates text NOT NULL,
          reason text NOT NULL,
          evidence_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
          status text NOT NULL DEFAULT 'SUBMITTED',
          reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
          reviewer_notes text,
          reviewed_at timestamptz,
          approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
          approval_notes text,
          approved_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT account_recovery_distinct_officers CHECK (
            approved_by IS NULL OR reviewed_by IS NULL OR approved_by <> reviewed_by
          )
        );
      `);
      await executeSql(sql`
        CREATE TABLE IF NOT EXISTS public.data_retention_schedule (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          table_name text NOT NULL UNIQUE,
          retention_days integer NOT NULL,
          legal_basis text NOT NULL,
          purge_action text NOT NULL,
          last_run_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
    })().catch((err) => {
      globalForDdl.__nsCommerceTablesReady = undefined;
      throw err;
    });
  }
  await globalForDdl.__nsCommerceTablesReady;
}
