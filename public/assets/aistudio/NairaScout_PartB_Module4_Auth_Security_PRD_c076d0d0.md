# NAIRASCOUT — MODULE 4 & BLUEPRINT PART B IMPLEMENTATION PRD
## Registration, Authentication, Session Security, MFA & Account Recovery (`NS-AUT-001` – `NS-AUT-008`)

**Document Version:** 4.0 (Approved Baseline + NIST/OWASP/NDPA Review Decisions)  
**Target Codebase:** `nairascout-main`  
**Governing Authorities:** Blueprint Part B (`B1`, `B11`, `B13`), PRD Module 4 (`4.1`–`4.12`), Module 4 Review Decisions (`1`–`7`), and `CUSTOM_INSTRUCTIONS.md` (v2.0)

---

## 1. Context & Instructions for the Google AI Studio Coding Agent

We have executed `nairascout_partB_module4_auth_security.sql` in Supabase. Implement the **8 authentication, security, session, MFA, and recovery requirements (`NS-AUT-001` through `NS-AUT-008`)** below across our Next.js App Router, Drizzle schema, Account Settings, and Admin Console—without breaking existing registration, OTP checkout attribution, or `lib/commission-engine.ts`.

---

## 2. Detailed Implementation Requirements

### `NS-AUT-001`: NIST 15-Character Password & Compromised-Password Validation (`P0`, MVP)
* **Governing Refs:** Module 4 `4.6.1`, Decision `2` (NIST SP 800-63B-4).
* **Shared Validator (`lib/auth/password-policy.ts`):**
  * Enforce **minimum length: `15` characters** and **maximum length: at least `64` characters** (allow spaces and Unicode characters; do **not** require mandatory uppercase/number/symbol composition rules).
  * Reject passwords matching the user's email prefix, username, display name, or a built-in blocklist of common/compromised passwords (plus optional HaveIBeenPwned k-anonymity prefix check `https://api.pwnedpasswords.com/range/{sha1Prefix}` with safe non-blocking fallback if offline).
* **UI & Server Enforcement:**
  * Apply `validateNairaScoutPassword()` in Registration (`Screen 6`), Change Password, and Reset Password forms with a live character counter (`X / 15 min chars`) and strength meter, plus server-side validation before calling Supabase Auth.

### `NS-AUT-002`: Registration Consent, `PENDING_ACTIVATION` → `ACTIVE`, & Anti-Enumeration (`P0`, MVP)
* **Governing Refs:** Blueprint `B9.1`, `B11.3`; Module 4 `4.1.4`, `4.2.5`, `4.3.5`, `4.4.3`, Decision `1` & Safeguard `1`.
* **Registration Form (`Screen 6`):**
  * Require an explicit unchecked checkbox: *"I agree to the NairaScout Terms of Service and acknowledge the Privacy Notice"* before enabling **Create Free Scout Account**.
  * Persist `terms_accepted_at` and `privacy_acknowledged_at` in `public.users`.
* **OTP Lifecycle & Resend Timer:**
  * Configure OTP UI and backend rate guards for **10-minute validity**, **60-second countdown timer** before allowing **Resend Code**, and **max 5 failed attempts** per OTP.
  * When an unverified user signs in while `account_status === 'PENDING_ACTIVATION'`, direct them straight to the Email Verification screen rather than granting protected Scout/Seller actions.
* **Anti-Enumeration Messages:**
  * Login failure: `"Invalid email or password."`
  * Password reset & OTP requests: `"If an account matches this email address, instructions have been sent."` Never leak whether an email exists.

### `NS-AUT-003`: Complete Forgot Password & Reset Password Flow (`P1`, MVP)
* **Governing Refs:** Module 4 `4.6.4`–`4.6.6`, Decision `3`.
* **Routes & UI:**
  * Add **"Forgot password?"** link on the Sign In screen leading to `/auth/forgot-password` (sends `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${origin}/auth/reset-password' })` with anti-enumeration confirmation).
  * Build `/auth/reset-password` enforcing the **15-character NIST password policy (`NS-AUT-001`)**, updating the password via `supabase.auth.updateUser({ password })`, calling `supabase.auth.signOut({ scope: 'others' })` to revoke all other active sessions, logging `PASSWORD_RESET_COMPLETED` to `audit_logs`, and creating an in-app security notification.

### `NS-AUT-004`: Session Idle Timeout (`30 min`), Absolute Lifetime (`7 days`) & Multi-Device Revocation (`P0`, MVP)
* **Governing Refs:** Blueprint `B11.4`; Module 4 `4.8.4`–`4.8.6`, Decision `3`.
* **Client + Server Session Guard:**
  * Track last user activity timestamp (`ns_last_activity`) and session start timestamp (`ns_session_started_at`).
  * Automatically sign out and redirect to Sign In with a clear banner (*"Signed out after 30 minutes of inactivity"* or *"Session expired after 7 days"*) when idle time exceeds **30 minutes** (`1,800,000 ms`) or session age exceeds **7 days**.
* **Account Settings → Security Tab:**
  * Add a **"Sign out of all other devices"** button calling `supabase.auth.signOut({ scope: 'others' })` and logging `OTHER_SESSIONS_REVOKED` to `audit_logs`.

### `NS-AUT-005`: Sensitive-Action Reauthentication Guard (`P0`, MVP)
* **Governing Refs:** Blueprint `B11.5`; Module 4 `4.8.8`, Decision `3`.
* **Behavior:**
  * Before allowing a user to:
    1. Change their registered email address
    2. Change their password
    3. Add or edit a withdrawal payout bank destination
    4. Disable Two-Factor Authentication (2FA)
  * Check `users.last_reauthenticated_at`. If older than **10 minutes** (or `null`), display a **Confirm Your Identity** modal requiring fresh password entry (or fresh 6-digit email OTP), update `last_reauthenticated_at = NOW()`, and then proceed.
  * When changing email address (`supabase.auth.updateUser({ email: newEmail })`), clearly show `"Pending verification of new email"` until the new address is confirmed—never overwrite `public.users.email` as verified prematurely.

### `NS-AUT-006`: Mandatory Privileged Admin TOTP MFA & Optional User 2FA (`P0`, MVP)
* **Governing Refs:** Module 4 `4.10.6`–`4.10.7`, Decision `5`.
* **Implementation via Supabase Auth MFA (`supabase.auth.mfa`):**
  * **Account Settings → Security Tab:** Add a **Two-Factor Authentication (Authenticator App / TOTP)** setup card (`enroll` QR code + 6-digit verification + `unenroll` protected by `NS-AUT-005` reauthentication) updating `users.mfa_enabled`.
  * **Mandatory Admin Gate (`/admin/*`):** When any user with a row in `public.platform_admin_roles` navigates to `/admin/*`, check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. If `currentLevel !== 'aal2'`, render an inline **Administrator 2FA Verification / Setup Gate** requiring TOTP enrollment or 6-digit TOTP verification before revealing any Admin Console data or endpoints.

### `NS-AUT-007`: Tiered Support-Assisted Account Recovery & 24-Hour Financial Cooling-Off (`P1`, MVP)
* **Governing Refs:** Blueprint `B11.3`; Module 4 `4.7.3`–`4.7.8`, Decision `6`.
* **User Flow (`/auth/recover` — linked via `"Lost access to your email?"` on Sign In):**
  * Form collects: `claimedEmail` (old email), `claimedUsername` (optional), `contactEmailForUpdates` (new reachable email), `reason`, and government ID / ownership evidence upload to private bucket `verification-docs/recovery/...`.
  * Inserts a row into `public.account_recovery_requests` (`status = 'SUBMITTED'`).
* **Admin Review & Approval (`/admin/recoveries` — `SUPPORT_OFFICER`, `TRUST_AND_SAFETY`, `SUPER_ADMIN`):**
  * Officer reviews submitted evidence (via 60-second signed URL) and recommends approval; a **distinct** authorized officer (`approved_by !== reviewed_by`) approves the recovery.
  * Upon approval:
    1. Updates the user's email in Supabase Auth Admin (`supabase.auth.admin.updateUserById`) and `public.users.email`.
    2. Revokes all existing sessions (`supabase.auth.admin.signOut(userId)`).
    3. Sets `users.withdrawal_cooldown_until = NOW() + INTERVAL '24 hours'`.
    4. Appends `ACCOUNT_RECOVERY_APPROVED` to `audit_logs` and notifies both old and new email addresses.
* **24-Hour Cooling-Off Enforcement:**
  * Block payout bank destination changes and wallet withdrawal requests whenever `users.withdrawal_cooldown_until > NOW()`, displaying the exact remaining cooldown time.

### `NS-AUT-008`: Drizzle Schema & Audit Sync (`lib/db/schema.ts`)
* Add `termsAcceptedAt`, `privacyAcknowledgedAt`, `emailVerifiedAt`, `lastReauthenticatedAt`, `withdrawalCooldownUntil`, and `mfaEnabled` to `users` in `lib/db/schema.ts`, plus the `accountRecoveryRequests` and `dataRetentionSchedule` table definitions matching `nairascout_partB_module4_auth_security.sql`.

---

## 3. Verification Checklist (Definition of Done)
1. [ ] `npm run build` compiles with zero TypeScript errors.
2. [ ] Passwords shorter than **15 characters** or on the common-password blocklist are rejected on signup, password change, and password reset.
3. [ ] OTP resend button enforces a **60-second countdown** and anti-enumeration messaging is used across login, reset, and OTP forms.
4. [ ] Idle sessions automatically sign out after **30 minutes**; changing password revokes other active sessions.
5. [ ] Sensitive changes (email, password, bank payout, disabling 2FA) prompt for fresh reauthentication.
6. [ ] Admin users without `aal2` TOTP MFA are gated from `/admin` until TOTP is enrolled and verified.
7. [ ] Support-assisted email-loss recovery enforces dual-officer review/approval, revokes old sessions, and locks withdrawals/payout edits for **24 hours**.
