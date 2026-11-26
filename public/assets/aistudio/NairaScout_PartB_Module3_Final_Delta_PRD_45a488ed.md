# NAIRASCOUT — PART B & MODULE 3 FINAL GAP-CLOSURE PRD
## Requirement IDs: `NS-ACC-014` through `NS-ACC-017`

**Document Version:** 3.1 (Final Gap Closure for Blueprint Part B & PRD Module 3)  
**Target Codebase:** `nairascout-main`  
**Governing Authorities:** Blueprint Part B (`B1`–`B16`), PRD Module 3 (`3.1`–`3.14`), Module 3 Architectural Review Decisions, and `CUSTOM_INSTRUCTIONS.md` (v1.9)

---

## 1. Context & Instructions for the Google AI Studio Coding Agent

We have completed the comprehensive audit of **Blueprint Part B** and **PRD Module 3** and executed `nairascout_partB_module3_final_delta.sql` in Supabase. Implement the four targeted code updates below (`NS-ACC-014` to `NS-ACC-017`) cleanly without breaking existing functionality or altering `lib/commission-engine.ts`.

---

## 2. Targeted Requirements to Implement

### `NS-ACC-014`: Sprawl Plan 5-Seat Cap & All 6 Seller Team Roles (`P1`, MVP)
* **Governing Refs:** Blueprint `B4.5`, `B6.2`, `B14.18`; Module 3 `3.3.8`, Decisions `2.3`.
* **Backend (`lib/auth/rbac.ts` & Seller Team API/Actions):**
  * Ensure `SellerTeamRole` supports all 6 roles in the isolated Seller namespace:
    * `BUSINESS_OWNER`
    * `BUSINESS_ADMIN`
    * `PRODUCT_MANAGER`
    * `ORDER_MANAGER`
    * `FINANCE_MANAGER`
    * `ANALYST_VIEWER`
  * Enforce a strict maximum of **5 active or invited team seats** (`SPRAWL_MAX_TEAM_SEATS = 5`) per `seller_profile_id` in `assertCanManageSellerTeam` and the invite endpoint/server action, returning HTTP `403` (`SPRAWL_TEAM_SEAT_LIMIT_REACHED`) if a Business Seller attempts to add a 6th seat.
  * Map default granular permissions cleanly per role (e.g., `PRODUCT_MANAGER` -> listings only; `ORDER_MANAGER` -> orders/fulfilment only; `FINANCE_MANAGER` -> read-only Seller financial summaries; `ANALYST_VIEWER` -> read-only analytics).
* **Frontend (`components/SellerHubView.tsx` — Team Tab):**
  * Display a clear seat counter badge (`Seats Used: X / 5`) on the Sprawl Team management card.
  * Populate the role `<select>` dropdown with all 6 Seller Team Roles and disable the Invite button once `5 / 5` seats are occupied.

### `NS-ACC-015`: Read-Only Audit Log Access for `ANALYST_VIEWER` & Appeals Independence (`P0`, MVP)
* **Governing Refs:** Blueprint `B6.3`, `B13.3`; Module 3 `3.5.9`, `3.7.7`, Decisions `2.1` & `3.1`.
* **Backend & UI (`/admin/audit-logs` & `/admin/appeals`):**
  * Grant `ANALYST_VIEWER` read-only (`SELECT`) access to `/admin/audit-logs` and aggregate operational metrics in the Admin Console while strictly hiding and server-blocking all mutation actions (suspensions, verifications, role edits, maker-checker approvals).
  * Enforce in `/admin/appeals` and its server handler that an `APPEALS_OFFICER` (or reviewing admin) **cannot** decide an appeal where `appeals_officer_id === original_reviewer_id` (matching the PostgreSQL `independent_appeals_reviewer` constraint).

### `NS-ACC-016`: Automatic `ON_HOLD` Commission Placement on Fraud Suspension (`P0`, MVP)
* **Governing Refs:** Blueprint `B9.6`, `B14.15`; Module 3 `3.12.6`.
* **Backend (Admin Suspension Handler):**
  * When an authorized `TRUST_AND_SAFETY` officer or `SUPER_ADMIN` suspends an account (`account_status = 'SUSPENDED'`) or imposes a fraud investigation restriction (`reasonCategory === 'FRAUD_INVESTIGATION'`), execute a database transaction that:
    1. Updates `users.account_status = 'SUSPENDED'` (or inserts an active `capability_restrictions` row).
    2. Places any `PENDING` commission allocations belonging to that user into `ON_HOLD` status (preserving all ledger entries and `referral_ancestry` intact).
    3. Appends an immutable record to `audit_logs` capturing `actor_id`, `affected_user_id`, `action`, `previous_value`, `new_value`, and `reason`.

### `NS-ACC-017`: Immediate Server-Side Privilege Re-Evaluation on Role/Status Change (`P0`, MVP)
* **Governing Refs:** Blueprint `B6.5`, `B11.4`; Module 3 `3.8.9`, `3.14.8`.
* **Backend (`lib/auth/session.ts` / server auth loader):**
  * Ensure every protected Server Action and API Route reads live `account_status`, `seller_status`, `seller_team_members.status`, and `platform_admin_roles` directly from PostgreSQL on each request rather than trusting stale client state—so revoking a team member, revoking an admin role, suspending an account, or completing `CLOSED` status immediately blocks protected endpoints on the very next request.
  * Ensure `CLOSED` accounts cannot be silently reactivated via normal login or registration; any restoration requires an explicit, audited `SUPER_ADMIN` reinstatement workflow.

---

## 3. Verification Checklist (Definition of Done)
1. [ ] `npm run build` compiles with zero TypeScript errors.
2. [ ] Sprawl Business Sellers see `Seats Used: X / 5` and can assign all 6 Seller team roles, while a 6th invitation is rejected server-side.
3. [ ] `ANALYST_VIEWER` can view `/admin/audit-logs` in read-only mode with zero write permissions.
4. [ ] Fraud-related account suspension places affected `PENDING` commissions into `ON_HOLD` without deleting ledger rows and writes an immutable `audit_logs` entry.
5. [ ] Revoked team members, revoked admins, and `CLOSED` accounts lose protected access immediately on their next server request.
