import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  buildClearSessionCookieHeader,
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  closeAccountVoluntarily,
  getNairaScoutSnapshot,
  InvitationPolicy,
  manageRelationshipForActor,
  submitVerificationEvidence,
  updateProfileAndPrivacy,
  VerificationCategory,
} from '@/lib/nairascout-store';

export async function PATCH(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const section = String(body?.section || '');

    if (section === 'profile' || section === 'privacy') {
      updateProfileAndPrivacy(identity.userId, {
        displayName: body.displayName,
        username: body.username,
        bio: body.bio,
        locationState: body.locationState,
        preferredCategories: Array.isArray(body.preferredCategories)
          ? body.preferredCategories.map(String)
          : undefined,
        invitationPolicy: body.invitationPolicy as InvitationPolicy | undefined,
        muteReferrals: typeof body.muteReferrals === 'boolean' ? body.muteReferrals : undefined,
        profileVisibility:
          body.profileVisibility === 'NETWORK_ONLY' ? 'NETWORK_ONLY' : 'PUBLIC',
      });
    } else if (section === 'unblock') {
      manageRelationshipForActor(identity.userId, {
        targetUserId: String(body.targetUserId || ''),
        operation: 'unblock',
      });
    } else if (section === 'verification') {
      submitVerificationEvidence(identity.userId, {
        category: body.category as VerificationCategory,
        evidencePaths: Array.isArray(body.evidencePaths)
          ? body.evidencePaths.map(String)
          : [],
        bankSummary: body.bankSummary ? String(body.bankSummary) : undefined,
      });
    } else {
      return NextResponse.json({ error: 'Unknown settings section.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      snapshot: getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 400 });
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
    if (body?.action !== 'close_account') {
      return NextResponse.json({ error: 'Unknown lifecycle action.' }, { status: 400 });
    }

    closeAccountVoluntarily(identity.userId, body.reason ? String(body.reason) : undefined);

    const res = NextResponse.json({
      ok: true,
      closed: true,
      snapshot: getNairaScoutSnapshot(null),
    });
    res.headers.set('Set-Cookie', buildClearSessionCookieHeader());
    return res;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Account closure failed.' }, { status: 400 });
  }
}
