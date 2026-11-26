-- NairaScout Module 5 & Blueprint Part B: Scout Profiles, Notification Preferences & Authoritative Withdrawals
-- Requirement IDs: NS-SCT-010 through NS-SCT-095

-- 1. Extend public.scout_profiles with LGA & Private-by-Default visibility (NS-SCT-010, NS-SCT-015)
ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS location_lga text;

ALTER TABLE public.scout_profiles
  ALTER COLUMN profile_visibility SET DEFAULT 'PRIVATE';

ALTER TABLE public.scout_profiles
  DROP CONSTRAINT IF EXISTS scout_profiles_bio_max_len;

ALTER TABLE public.scout_profiles
  ADD CONSTRAINT scout_profiles_bio_max_len CHECK (bio IS NULL OR char_length(bio) <= 250);

-- 2. Extend public.product_referral_events with delivery & deduplicated open timestamps (NS-SCT-056)
ALTER TABLE public.product_referral_events
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

UPDATE public.product_referral_events
SET delivered_at = created_at
WHERE delivered_at IS NULL;

-- 3. Eight-Group Notification Preferences table (NS-SCT-076 - NS-SCT-083)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_code text NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  is_essential boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_user_category_unique UNIQUE (user_id, category_code),
  CONSTRAINT notification_preferences_essential_locked CHECK (
    is_essential = false OR (in_app_enabled = true AND email_enabled = true)
  )
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON public.notification_preferences(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (is_essential = false OR (in_app_enabled = true AND email_enabled = true))
  );

-- Seed 8 default notification groups for all existing users
INSERT INTO public.notification_preferences (user_id, category_code, in_app_enabled, email_enabled, is_essential)
SELECT u.id, g.category_code, true, true, g.is_essential
FROM public.users u
CROSS JOIN (
  VALUES
    ('ACCOUNT_SECURITY', true),
    ('SCOUTS_LIST', false),
    ('PRODUCT_REFERRALS', false),
    ('PURCHASES_ORDERS', true),
    ('COMMISSIONS', false),
    ('WALLET_WITHDRAWALS', true),
    ('PLATFORM_ANNOUNCEMENTS', false),
    ('RESTRICTIONS_VERIFICATION', true)
) AS g(category_code, is_essential)
ON CONFLICT (user_id, category_code) DO NOTHING;

-- 4. Authoritative Withdrawal Requests table (NS-SCT-075)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 500000),
  bank_summary text NOT NULL,
  scheduled_payout_date text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED')),
  failure_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_requested
  ON public.withdrawal_requests(user_id, requested_at DESC);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users read own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Finance admins manage withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Finance admins manage withdrawal requests"
  ON public.withdrawal_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admin_roles par
      WHERE par.user_id = auth.uid()
        AND par.admin_role IN ('SUPER_ADMIN', 'FINANCE_OFFICER', 'ANALYST_VIEWER')
    )
  );
