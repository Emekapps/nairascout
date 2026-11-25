-- ============================================================================
-- NairaScout Immutability Triggers & Fail-Secure Supabase RLS Policies
-- Traceability: NS-REF-004, NS-GOV-001, NS-GOV-003, NS-COM-004, NS-PRI-001, NS-PRI-002
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. APPEND-ONLY & CONTROLLED OVERRIDE IMMUTABILITY TRIGGERS
-- ----------------------------------------------------------------------------

-- NS-REF-004 & NS-GOV-003: Protect referral_ancestry against DELETE and unauthorized UPDATE.
-- Only transactions setting SET LOCAL app.allow_ancestry_override = 'true' (dual-approved
-- SUPER_ADMIN Maker-Checker ANCESTRY_OVERRIDE) may update direct_referrer_id.
CREATE OR REPLACE FUNCTION public.fn_protect_referral_ancestry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'referral_ancestry records are permanent and cannot be deleted (NS-REF-004).'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF current_setting('app.allow_ancestry_override', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'referral_ancestry is immutable; requires dual-approved SUPER_ADMIN Maker-Checker override (NS-REF-004).'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_referral_ancestry ON public.referral_ancestry;
CREATE TRIGGER trg_protect_referral_ancestry
  BEFORE UPDATE OR DELETE ON public.referral_ancestry
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_referral_ancestry();

-- NS-GOV-001: Enforce strict append-only immutability on audit_logs & commission_ledger_entries
CREATE OR REPLACE FUNCTION public.fn_prevent_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is strictly append-only; % is prohibited.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_protect_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_protect_commission_ledger_entries ON public.commission_ledger_entries;
CREATE TRIGGER trg_protect_commission_ledger_entries
  BEFORE UPDATE OR DELETE ON public.commission_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_append_only_mutation();

-- ----------------------------------------------------------------------------
-- 2. RLS ROLE HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ns_is_platform_admin()
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
  );
$$;

CREATE OR REPLACE FUNCTION public.ns_is_super_admin()
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
      AND par.admin_role = 'SUPER_ADMIN'
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY ACROSS ALL PUBLIC TABLES
-- ----------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_ancestry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouts_list_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouts_list_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maker_checker_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nigerian_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. RLS POLICIES (LEAST-PRIVILEGE ACCESS CONTROL)
-- ----------------------------------------------------------------------------

-- users (NS-ACC-001, NS-PRI-001): self read + platform admin read; writes via server/admin
DROP POLICY IF EXISTS users_self_or_admin_select ON public.users;
CREATE POLICY users_self_or_admin_select ON public.users
  FOR SELECT USING (id = auth.uid() OR public.ns_is_platform_admin());

-- scout_profiles (NS-PRI-001): public read for non-closed active profiles, self update
DROP POLICY IF EXISTS scout_profiles_public_select ON public.scout_profiles;
CREATE POLICY scout_profiles_public_select ON public.scout_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.ns_is_platform_admin()
    OR (
      profile_visibility = 'PUBLIC'
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = scout_profiles.user_id
          AND u.account_status NOT IN ('CLOSED', 'SUSPENDED')
      )
    )
  );

DROP POLICY IF EXISTS scout_profiles_self_update ON public.scout_profiles;
CREATE POLICY scout_profiles_self_update ON public.scout_profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- referral_ancestry (NS-REF-001, NS-PRI-001): owner or platform admin read only; no client writes
DROP POLICY IF EXISTS referral_ancestry_self_or_admin_select ON public.referral_ancestry;
CREATE POLICY referral_ancestry_self_or_admin_select ON public.referral_ancestry
  FOR SELECT USING (scout_user_id = auth.uid() OR public.ns_is_platform_admin());

-- seller_profiles (NS-SEL-001): owner, active team member, active public storefront, or admin
DROP POLICY IF EXISTS seller_profiles_select ON public.seller_profiles;
CREATE POLICY seller_profiles_select ON public.seller_profiles
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR public.ns_is_platform_admin()
    OR seller_status = 'ACTIVE'
    OR EXISTS (
      SELECT 1 FROM public.seller_team_members stm
      WHERE stm.seller_profile_id = seller_profiles.id
        AND stm.user_id = auth.uid()
        AND stm.status = 'ACTIVE'
    )
  );

-- seller_team_members (NS-SEL-004): owner, member self, or platform admin
DROP POLICY IF EXISTS seller_team_members_select ON public.seller_team_members;
CREATE POLICY seller_team_members_select ON public.seller_team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.ns_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = seller_team_members.seller_profile_id
        AND sp.owner_user_id = auth.uid()
    )
  );

-- verification_records (NS-VER-001, NS-PRI-002): owner or admin only (never public)
DROP POLICY IF EXISTS verification_records_select ON public.verification_records;
CREATE POLICY verification_records_select ON public.verification_records
  FOR SELECT USING (user_id = auth.uid() OR public.ns_is_platform_admin());

-- scouts_list_invitations & scouts_list_contacts & user_blocks (NS-NET-001)
DROP POLICY IF EXISTS scouts_list_invitations_participant_select ON public.scouts_list_invitations;
CREATE POLICY scouts_list_invitations_participant_select ON public.scouts_list_invitations
  FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid() OR public.ns_is_platform_admin()
  );

DROP POLICY IF EXISTS scouts_list_contacts_participant_select ON public.scouts_list_contacts;
CREATE POLICY scouts_list_contacts_participant_select ON public.scouts_list_contacts
  FOR SELECT USING (
    owner_user_id = auth.uid() OR contact_user_id = auth.uid() OR public.ns_is_platform_admin()
  );

DROP POLICY IF EXISTS user_blocks_self_select ON public.user_blocks;
CREATE POLICY user_blocks_self_select ON public.user_blocks
  FOR SELECT USING (blocker_id = auth.uid() OR public.ns_is_platform_admin());

-- abuse_reports (NS-NET-001, NS-GOV-002)
DROP POLICY IF EXISTS abuse_reports_reporter_or_admin_select ON public.abuse_reports;
CREATE POLICY abuse_reports_reporter_or_admin_select ON public.abuse_reports
  FOR SELECT USING (reporter_id = auth.uid() OR public.ns_is_platform_admin());

-- platform_admin_roles, audit_logs, capability_restrictions, maker_checker_requests, governance_appeals
DROP POLICY IF EXISTS platform_admin_roles_self_or_super_select ON public.platform_admin_roles;
CREATE POLICY platform_admin_roles_self_or_super_select ON public.platform_admin_roles
  FOR SELECT USING (user_id = auth.uid() OR public.ns_is_platform_admin());

DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT USING (public.ns_is_platform_admin());

DROP POLICY IF EXISTS capability_restrictions_self_or_admin_select ON public.capability_restrictions;
CREATE POLICY capability_restrictions_self_or_admin_select ON public.capability_restrictions
  FOR SELECT USING (user_id = auth.uid() OR public.ns_is_platform_admin());

DROP POLICY IF EXISTS maker_checker_requests_admin_select ON public.maker_checker_requests;
CREATE POLICY maker_checker_requests_admin_select ON public.maker_checker_requests
  FOR SELECT USING (public.ns_is_platform_admin());

DROP POLICY IF EXISTS governance_appeals_self_or_admin_select ON public.governance_appeals;
CREATE POLICY governance_appeals_self_or_admin_select ON public.governance_appeals
  FOR SELECT USING (appellant_user_id = auth.uid() OR public.ns_is_platform_admin());

-- Reference lookup tables (public read; SUPER_ADMIN write for categories — NS-GOV-005)
DROP POLICY IF EXISTS nigerian_states_public_select ON public.nigerian_states;
CREATE POLICY nigerian_states_public_select ON public.nigerian_states
  FOR SELECT USING (true);

DROP POLICY IF EXISTS listing_categories_select ON public.listing_categories;
CREATE POLICY listing_categories_select ON public.listing_categories
  FOR SELECT USING (is_active = true OR public.ns_is_platform_admin());

DROP POLICY IF EXISTS listing_categories_super_admin_write ON public.listing_categories;
CREATE POLICY listing_categories_super_admin_write ON public.listing_categories
  FOR ALL USING (public.ns_is_super_admin())
  WITH CHECK (public.ns_is_super_admin());

-- product_listings (NS-SEL-003, NS-VER-002): public sees PUBLISHED; seller sees own drafts
DROP POLICY IF EXISTS product_listings_select ON public.product_listings;
CREATE POLICY product_listings_select ON public.product_listings
  FOR SELECT USING (
    status = 'PUBLISHED'
    OR seller_scout_id = auth.uid()
    OR public.ns_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.seller_team_members stm
      WHERE stm.seller_profile_id = product_listings.seller_profile_id
        AND stm.user_id = auth.uid()
        AND stm.status = 'ACTIVE'
    )
  );

-- product_referral_events (NS-REF-002): sender, recipient, or admin
DROP POLICY IF EXISTS product_referral_events_participant_select ON public.product_referral_events;
CREATE POLICY product_referral_events_participant_select ON public.product_referral_events
  FOR SELECT USING (
    sender_scout_id = auth.uid()
    OR recipient_scout_id = auth.uid()
    OR public.ns_is_platform_admin()
  );

-- marketplace_orders (NS-ORD-001): buyer, seller, active seller team, or admin
DROP POLICY IF EXISTS marketplace_orders_participant_select ON public.marketplace_orders;
CREATE POLICY marketplace_orders_participant_select ON public.marketplace_orders
  FOR SELECT USING (
    buyer_scout_id = auth.uid()
    OR seller_scout_id = auth.uid()
    OR public.ns_is_platform_admin()
  );

-- commission_ledger_entries (NS-COM-004): beneficiary Scout or admin
DROP POLICY IF EXISTS commission_ledger_entries_beneficiary_select ON public.commission_ledger_entries;
CREATE POLICY commission_ledger_entries_beneficiary_select ON public.commission_ledger_entries
  FOR SELECT USING (beneficiary_scout_id = auth.uid() OR public.ns_is_platform_admin());

-- platform_notifications & support_cases
DROP POLICY IF EXISTS platform_notifications_self_select ON public.platform_notifications;
CREATE POLICY platform_notifications_self_select ON public.platform_notifications
  FOR SELECT USING (user_id = auth.uid() OR public.ns_is_platform_admin());

DROP POLICY IF EXISTS platform_notifications_self_update ON public.platform_notifications;
CREATE POLICY platform_notifications_self_update ON public.platform_notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS support_cases_self_or_admin_select ON public.support_cases;
CREATE POLICY support_cases_self_or_admin_select ON public.support_cases
  FOR SELECT USING (user_id = auth.uid() OR public.ns_is_platform_admin());

-- ----------------------------------------------------------------------------
-- 5. PRIVATE STORAGE BUCKET POLICIES (verification-docs — NS-PRI-002)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS verification_docs_owner_insert ON storage.objects;
CREATE POLICY verification_docs_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS verification_docs_owner_or_admin_select ON storage.objects;
CREATE POLICY verification_docs_owner_or_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.ns_is_platform_admin()
    )
  );
