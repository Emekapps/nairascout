-- ============================================================================
-- NairaScout PostgreSQL Core, Governance & Commerce Schema Migration
-- Traceability: NS-ACC-001, NS-ACC-002, NS-REF-001, NS-SEL-001, NS-COM-001, NS-GOV-001
-- Matches Drizzle schemas in lib/db/schema.ts and lib/db/commerce-schema.ts
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ENUMS (Decoupled 4-Axis Lifecycle & RBAC Vocabularies — NS-ACC-002)
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM (
    'PENDING_ACTIVATION',
    'PENDING_VERIFICATION',
    'ACTIVE',
    'RESTRICTED',
    'SUSPENDED',
    'CLOSURE_PENDING',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.seller_type AS ENUM ('INDIVIDUAL', 'BUSINESS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.seller_status AS ENUM (
    'NOT_ACTIVATED',
    'ACTIVATION_PENDING',
    'ONBOARDING',
    'ACTIVE',
    'RESTRICTED',
    'SUSPENDED',
    'CLOSURE_PENDING',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_category AS ENUM (
    'CONTACT',
    'IDENTITY',
    'BUSINESS',
    'SELLER',
    'PAYOUT_BANK'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM (
    'NOT_STARTED',
    'NOT_SUBMITTED',
    'SUBMITTED',
    'PENDING',
    'UNDER_REVIEW',
    'ACTION_REQUIRED',
    'VERIFIED',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'REVOKED',
    'SUSPENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('STARTER', 'TRACTION', 'GROWTH', 'SPRAWL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'NOT_SUBSCRIBED',
    'PAYMENT_PENDING',
    'ACTIVE',
    'PAST_DUE',
    'GRACE_PERIOD',
    'SUSPENDED',
    'CANCELLATION_SCHEDULED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_policy AS ENUM ('EVERYONE', 'CONTACTS_ONLY', 'NOBODY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.team_role AS ENUM (
    'BUSINESS_OWNER',
    'BUSINESS_ADMIN',
    'PRODUCT_MANAGER',
    'ORDER_MANAGER',
    'FINANCE_MANAGER',
    'ANALYST_VIEWER',
    'TEAM_MEMBER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.team_member_status AS ENUM ('INVITED', 'ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM (
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'VERIFICATION_OFFICER',
    'TRUST_AND_SAFETY',
    'APPEALS_OFFICER',
    'FINANCE_OFFICER',
    'SUPPORT_OFFICER',
    'OPERATIONS_MANAGER',
    'ANALYST_VIEWER',
    'FINANCE_OPS',
    'SUPPORT_AGENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.abuse_report_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. UNIFIED IDENTITY, SCOUT PROFILE & PERMANENT REFERRAL ANCESTRY (NS-ACC-001, NS-REF-001)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  phone text UNIQUE,
  account_status public.account_status NOT NULL DEFAULT 'ACTIVE',
  restriction_reason text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scout_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  location_state text,
  preferred_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  invitation_policy public.invitation_policy NOT NULL DEFAULT 'EVERYONE',
  mute_referrals boolean NOT NULL DEFAULT false,
  profile_visibility text NOT NULL DEFAULT 'PUBLIC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_ancestry (
  scout_user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  direct_referrer_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  attribution_source text NOT NULL,
  referral_event_id uuid,
  locked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_referral CHECK (scout_user_id <> direct_referrer_id)
);

-- 3. SELLER PROFILES, TEAM SEATS & VERIFICATION RECORDS (NS-SEL-001, NS-SEL-004, NS-VER-001)
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  seller_type public.seller_type NOT NULL,
  seller_name text NOT NULL,
  logo_url text,
  description text,
  business_category text,
  business_reg_number text,
  business_address text,
  business_contact_email text,
  business_contact_phone text,
  seller_status public.seller_status NOT NULL DEFAULT 'ACTIVATION_PENDING',
  subscription_plan public.subscription_plan NOT NULL DEFAULT 'STARTER',
  subscription_status public.subscription_status NOT NULL DEFAULT 'ACTIVE',
  subscription_expires_at timestamptz,
  terms_accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  role public.team_role NOT NULL,
  permissions jsonb NOT NULL,
  status public.team_member_status NOT NULL DEFAULT 'ACTIVE',
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_team_member
  ON public.seller_team_members (seller_profile_id, user_id)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  seller_profile_id uuid REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  category public.verification_category NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'NOT_STARTED',
  evidence_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_notes text,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. SCOUTS LIST CONTACTS, INVITATIONS, BLOCKS & ABUSE REPORTS (NS-NET-001)
CREATE TABLE IF NOT EXISTS public.scouts_list_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT no_self_invite CHECK (sender_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS public.scouts_list_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_invitation_id uuid REFERENCES public.scouts_list_invitations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_scout_contact_pair
  ON public.scouts_list_contacts (owner_user_id, contact_user_id);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reported_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  referral_event_id uuid,
  reason text NOT NULL,
  description text NOT NULL,
  status public.abuse_report_status NOT NULL DEFAULT 'OPEN',
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- 5. PLATFORM ADMIN ROLES, AUDIT LOGS & GOVERNANCE TABLES (NS-GOV-001..NS-GOV-004)
CREATE TABLE IF NOT EXISTS public.platform_admin_roles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  admin_role public.admin_role NOT NULL,
  assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  affected_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capability_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  scope text NOT NULL,
  capability_code text NOT NULL,
  resource_id uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  imposed_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT capability_restriction_scope_check CHECK (scope IN ('ACCOUNT', 'ROLE', 'CAPABILITY', 'RESOURCE')),
  CONSTRAINT capability_restriction_status_check CHECK (status IN ('ACTIVE', 'LIFTED'))
);

CREATE TABLE IF NOT EXISTS public.maker_checker_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  maker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  checker_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  checker_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT maker_checker_distinct_officers CHECK (checker_id IS NULL OR maker_id <> checker_id)
);

CREATE TABLE IF NOT EXISTS public.governance_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appellant_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  target_record_id uuid NOT NULL,
  original_reviewer_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  appeal_reason text NOT NULL,
  evidence_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'OPEN',
  appeals_officer_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT independent_appeals_reviewer CHECK (
    appeals_officer_id IS NULL
    OR original_reviewer_id IS NULL
    OR appeals_officer_id <> original_reviewer_id
  )
);

-- 6. REFERENCE LOOKUP TABLES (NIGERIAN STATES & ADMIN-MANAGED CATEGORIES — NS-GOV-005)
CREATE TABLE IF NOT EXISTS public.nigerian_states (
  code text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  geo_zone text NOT NULL
);

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

-- 7. MARKETPLACE COMMERCE, REFERRALS, ORDERS & INTEGER KOBO LEDGER (NS-COM-001, NS-ORD-001)
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

CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_cases (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  topic text NOT NULL,
  subject text NOT NULL,
  details text NOT NULL,
  status text NOT NULL DEFAULT 'Under Review',
  created_at timestamptz NOT NULL DEFAULT now()
);
