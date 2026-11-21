import { NextRequest, NextResponse } from 'next/server';
import { AccountStatus, AuthorizationError, SellerStatus } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  adminApplyUserAction,
  adminReviewVerification,
  getAdminConsoleSnapshot,
} from '@/lib/nairascout-store';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const signPath = req.nextUrl.searchParams.get('signPath');
    const adminData = getAdminConsoleSnapshot(identity.userId);

    if (signPath) {
      const supabaseAdmin = createSupabaseAdminClient();
      if (supabaseAdmin) {
        const cleanPath = signPath.replace(/^verification-docs\//, '');
        const { data, error } = await supabaseAdmin.storage
          .from('verification-docs')
          .createSignedUrl(cleanPath, 60);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ signedUrl: data.signedUrl, expiresInSeconds: 60 });
      }
      return NextResponse.json({
        signedUrl: null,
        previewDocumentSummary: `Preview signed token (60s TTL) for private object: ${signPath}`,
        expiresInSeconds: 60,
      });
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
      const updated = adminReviewVerification(identity.userId, {
        verificationId: String(body.verificationId || ''),
        decision: body.decision as 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED',
        reviewerNotes: String(body.reviewerNotes || ''),
      });
      return NextResponse.json({
        ok: true,
        verification: updated,
        admin: getAdminConsoleSnapshot(identity.userId),
      });
    }

    if (action === 'user_governance') {
      adminApplyUserAction(identity.userId, {
        targetUserId: String(body.targetUserId || ''),
        actionType: body.actionType,
        accountStatus: body.accountStatus as AccountStatus | undefined,
        sellerStatus: body.sellerStatus as SellerStatus | undefined,
        abuseReportId: body.abuseReportId ? String(body.abuseReportId) : undefined,
        abuseResolution: body.abuseResolution as 'RESOLVED' | 'DISMISSED' | undefined,
        reason: String(body.reason || ''),
      });
      return NextResponse.json({
        ok: true,
        admin: getAdminConsoleSnapshot(identity.userId),
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
