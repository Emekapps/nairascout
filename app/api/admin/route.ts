import { NextRequest, NextResponse } from 'next/server';
import {
  AccountStatus,
  AuthorizationError,
  CapabilityCode,
  RestrictionScope,
  SellerStatus,
  SubscriptionStatus,
} from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  adminApplyUserAction,
  adminCreateMakerCheckerRequest,
  adminDecideAppeal,
  adminDecideMakerCheckerRequest,
  adminManageRestriction,
  adminReviewVerification,
  getAdminConsoleSnapshot,
  MakerCheckerActionType,
} from '@/lib/nairascout-store';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const signPath = req.nextUrl.searchParams.get('signPath');
    const adminData = await getAdminConsoleSnapshot(identity.userId);

    if (signPath) {
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

export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
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
        abuseReportId: body.abuseReportId ? String(body.abuseReportId) : undefined,
        abuseResolution: body.abuseResolution as 'RESOLVED' | 'DISMISSED' | undefined,
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

    return NextResponse.json({ error: 'Unknown admin action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Admin action failed.' }, { status: 400 });
  }
}
