import { NextRequest, NextResponse } from 'next/server';
import {
  AccountStatus,
  assertAdminRole,
  AuthorizationError,
  CapabilityCode,
  RestrictionScope,
  SellerStatus,
  SubscriptionStatus,
} from '@/lib/auth/rbac';
import {
  assertAdminAal2Session,
  extractSessionIdentityFromRequest,
  loadDbAuthContext,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  adminApplyUserAction,
  adminApproveRecoveryRequest,
  adminCreateMakerCheckerRequest,
  adminDecideAppeal,
  adminDecideMakerCheckerRequest,
  adminManageRestriction,
  adminReinstateClosedAccount,
  adminReviewRecoveryRequest,
  adminReviewVerification,
  getAdminConsoleSnapshot,
  GovernanceReasonCategory,
  MakerCheckerActionType,
} from '@/lib/nairascout-store';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const ALLOWED_REASON_CATEGORIES = new Set<GovernanceReasonCategory>([
  'GENERAL',
  'FRAUD_INVESTIGATION',
  'SPAM_ABUSE',
  'DISPUTE',
]);

function normalizeReasonCategory(raw: unknown): GovernanceReasonCategory {
  if (typeof raw === 'string' && ALLOWED_REASON_CATEGORIES.has(raw as GovernanceReasonCategory)) {
    return raw as GovernanceReasonCategory;
  }
  return 'GENERAL';
}

// NS-GOV-001, NS-ACC-015 & NS-PRI-002: Admin governance console read & role-gated verification-docs signed URL access
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    // NS-AUT-006: Mandatory Admin TOTP MFA (aal2) gate on all admin endpoints
    await assertAdminAal2Session(req);
    const signPath = req.nextUrl.searchParams.get('signPath');
    const adminData = await getAdminConsoleSnapshot(identity.userId);

    if (signPath) {
      // NS-ACC-015 & NS-AUT-007: ANALYST_VIEWER is strictly read-only and cannot mint private document signed URLs
      const ctx = await loadDbAuthContext(identity.userId);
      assertAdminRole(ctx, [
        'VERIFICATION_OFFICER',
        'PLATFORM_ADMIN',
        'APPEALS_OFFICER',
        'TRUST_AND_SAFETY',
        'SUPPORT_OFFICER',
      ]);

      const supabaseAdmin = createSupabaseAdminClient();
      if (!supabaseAdmin) {
        return NextResponse.json(
          { error: 'Supabase service role key is not configured for signed document access.' },
          { status: 503 }
        );
      }

      const cleanPath = signPath.replace(/^verification-docs\//, '');
      const { data, error } = await supabaseAdmin.storage
        .from('verification-docs')
        .createSignedUrl(cleanPath, 60);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ signedUrl: data.signedUrl, expiresInSeconds: 60 });
    }

    return NextResponse.json(adminData);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load admin console.' }, { status: 400 });
  }
}

// NS-GOV-001, NS-VER-003, NS-GOV-002, NS-GOV-003, NS-GOV-004, NS-ACC-015, NS-ACC-016 & NS-ACC-017: Admin mutations
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    // NS-AUT-006: Mandatory Admin TOTP MFA (aal2) gate on all admin mutations
    await assertAdminAal2Session(req);
    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'review_verification') {
      const updated = await adminReviewVerification(identity.userId, {
        verificationId: String(body.verificationId || ''),
        decision: body.decision as
          | 'UNDER_REVIEW'
          | 'VERIFIED'
          | 'REJECTED'
          | 'ACTION_REQUIRED'
          | 'APPROVED',
        reviewerNotes: String(body.reviewerNotes || ''),
      });
      return NextResponse.json({
        ok: true,
        verification: updated,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    if (action === 'user_governance') {
      await adminApplyUserAction(identity.userId, {
        targetUserId: String(body.targetUserId || ''),
        actionType: body.actionType,
        accountStatus: body.accountStatus as AccountStatus | undefined,
        sellerStatus: body.sellerStatus as SellerStatus | undefined,
        subscriptionStatus: body.subscriptionStatus as SubscriptionStatus | undefined,
        reasonCategory: normalizeReasonCategory(body.reasonCategory),
        abuseReportId: body.abuseReportId ? String(body.abuseReportId) : undefined,
        abuseResolution: body.abuseResolution as 'RESOLVED' | 'DISMISSED' | undefined,
        reason: String(body.reason || ''),
      });
      return NextResponse.json({
        ok: true,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    if (action === 'reinstate_closed_account') {
      await adminReinstateClosedAccount(identity.userId, {
        targetUserId: String(body.targetUserId || ''),
        reason: String(body.reason || ''),
      });
      return NextResponse.json({
        ok: true,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    if (action === 'manage_restriction') {
      if (body.operation === 'LIFT') {
        await adminManageRestriction(identity.userId, {
          operation: 'LIFT',
          restrictionId: String(body.restrictionId || ''),
          reason: String(body.reason || ''),
        });
      } else {
        await adminManageRestriction(identity.userId, {
          operation: 'IMPOSE',
          targetUserId: String(body.targetUserId || ''),
          scope: (body.scope || 'CAPABILITY') as RestrictionScope,
          capabilityCode: body.capabilityCode as CapabilityCode,
          reasonCategory: normalizeReasonCategory(body.reasonCategory),
          reason: String(body.reason || ''),
          expiresInDays: body.expiresInDays ? Number(body.expiresInDays) : null,
        });
      }
      return NextResponse.json({
        ok: true,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    if (action === 'maker_checker_create') {
      const requestRecord = await adminCreateMakerCheckerRequest(identity.userId, {
        actionType: body.actionType as MakerCheckerActionType,
        targetUserId: String(body.targetUserId || ''),
        targetEntityId: body.targetEntityId ? String(body.targetEntityId) : null,
        payload: (body.payload && typeof body.payload === 'object' ? body.payload : {}) as Record<
          string,
          unknown
        >,
        reason: String(body.reason || ''),
      });
      return NextResponse.json({
        ok: true,
        request: requestRecord,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    if (action === 'maker_checker_decide') {
      const decided = await adminDecideMakerCheckerRequest(identity.userId, {
        requestId: String(body.requestId || ''),
        decision: body.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED',
        checkerNotes: String(body.checkerNotes || ''),
      });
      return NextResponse.json({
        ok: true,
        request: decided,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    if (action === 'decide_appeal') {
      const appeal = await adminDecideAppeal(identity.userId, {
        appealId: String(body.appealId || ''),
        decision: body.decision as 'UNDER_REVIEW' | 'UPHELD' | 'OVERTURNED',
        decisionNotes: String(body.decisionNotes || ''),
      });
      return NextResponse.json({
        ok: true,
        appeal,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    // NS-AUT-007: Stage 1 review & recommendation for lost-email account recovery
    if (action === 'review_recovery') {
      const recovery = await adminReviewRecoveryRequest(identity.userId, {
        requestId: String(body.requestId || ''),
        decision: body.decision as 'UNDER_REVIEW' | 'RECOMMENDED_APPROVAL' | 'REJECTED',
        reviewerNotes: String(body.reviewerNotes || ''),
      });
      return NextResponse.json({
        ok: true,
        recovery,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    // NS-AUT-007: Stage 2 distinct officer approval for account recovery
    if (action === 'approve_recovery') {
      const result = await adminApproveRecoveryRequest(identity.userId, {
        requestId: String(body.requestId || ''),
        approvalNotes: String(body.approvalNotes || ''),
      });
      return NextResponse.json({
        ok: true,
        recovery: result.request,
        withdrawalCooldownUntil: result.withdrawalCooldownUntil,
        admin: await getAdminConsoleSnapshot(identity.userId),
      });
    }

    return NextResponse.json({ error: 'Unknown admin action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Admin action failed.' }, { status: 400 });
  }
}
