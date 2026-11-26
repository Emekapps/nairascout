-- NairaScout Module 4 & Part B: Auth, Session Security, MFA & Account Recovery
-- Requirement IDs: NS-AUT-001 through NS-AUT-008

-- 1. Extend public.users with consent, verification, reauthentication, cooldown & MFA fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reauthenticated_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawal_cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;

-- Backfill email_verified_at for already ACTIVE users
UPDATE public.users
SET email_verified_at = created_at
WHERE account_status = 'ACTIVE' AND email_verified_at IS NULL;

-- 2. Tiered Support-Assisted Account Recovery Requests (NS-AUT-007)
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
  CONSTRAINT account_recovery_status_check CHECK (
    status IN ('SUBMITTED', 'UNDER_REVIEW', 'RECOMMENDED_APPROVAL', 'APPROVED', 'REJECTED')
  ),
  CONSTRAINT account_recovery_distinct_officers CHECK (
    approved_by IS NULL OR reviewed_by IS NULL OR approved_by <> reviewed_by
  )
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_status_created
  ON public.account_recovery_requests(status, created_at DESC);

ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins inspect account recovery requests" ON public.account_recovery_requests;
CREATE POLICY "Admins inspect account recovery requests"
  ON public.account_recovery_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admin_roles par
      WHERE par.user_id = auth.uid()
        AND par.admin_role IN ('SUPER_ADMIN', 'SUPPORT_OFFICER', 'TRUST_AND_SAFETY', 'ANALYST_VIEWER')
    )
  );

-- 3. NDPA Data Retention Schedule (NS-AUT-008)
CREATE TABLE IF NOT EXISTS public.data_retention_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  retention_days integer NOT NULL,
  legal_basis text NOT NULL,
  purge_action text NOT NULL,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_retention_purge_action_check CHECK (
    purge_action IN ('ARCHIVE', 'ANONYMIZE', 'DELETE', 'RETAIN_PERMANENT')
  )
);

ALTER TABLE public.data_retention_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read data retention schedule" ON public.data_retention_schedule;
CREATE POLICY "Admins read data retention schedule"
  ON public.data_retention_schedule FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admin_roles par
      WHERE par.user_id = auth.uid()
    )
  );

INSERT INTO public.data_retention_schedule (table_name, retention_days, legal_basis, purge_action)
VALUES
  ('audit_logs', 2555, 'Statutory financial & governance audit trail (7 years)', 'RETAIN_PERMANENT'),
  ('commission_ledger_entries', 2555, 'Tax and commercial ledger retention (7 years)', 'RETAIN_PERMANENT'),
  ('referral_ancestry', 36500, 'Permanent immutable attribution slot', 'RETAIN_PERMANENT'),
  ('account_recovery_requests', 365, 'Account recovery security verification & dispute window', 'ANONYMIZE'),
  ('verification_records', 1825, 'NDPA KYC & anti-fraud regulatory retention (5 years)', 'ARCHIVE')
ON CONFLICT (table_name) DO NOTHING;
