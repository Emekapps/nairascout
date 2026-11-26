import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  AppealTargetType,
  closeAccountVoluntarily,
  closeSellerCapabilityVoluntarily,
  getNairaScoutSnapshot,
  InvitationPolicy,
  manageRelationshipForActor,
  submitGovernanceAppealForActor,
  submitVerificationEvidence,
  updateProfileAndPrivacy,
  VerificationCategory,
} from '@/lib/nairascout-store';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// NS-ACC-004 & NS-VER-001: Profile/privacy settings, unblock & KYC/Bank verification evidence submission
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

    // NS-SCT-010 & NS-SCT-015: Profile, LGA, 250-char bio & Private-by-Default visibility
    if (section === 'profile' || section === 'privacy') {
      const vis =
        body.profileVisibility === 'PUBLIC' ||
        body.profileVisibility === 'NETWORK_ONLY' ||
        body.profileVisibility === 'PRIVATE'
          ? body.profileVisibility
          : undefined;

      await updateProfileAndPrivacy(identity.userId, {
        displayName: body.displayName,
        username: body.username,
        bio: body.bio,
        locationState: body.locationState,
        locationLga:
          body.locationLga !== undefined
            ? body.locationLga
              ? String(body.locationLga)
              : null
            : undefined,
        preferredCategories: Array.isArray(body.preferredCategories)
          ? body.preferredCategories.map(String)
          : undefined,
        invitationPolicy: body.invitationPolicy as InvitationPolicy | undefined,
        muteReferrals: typeof body.muteReferrals === 'boolean' ? body.muteReferrals : undefined,
        profileVisibility: vis,
      });
    } else if (section === 'unblock') {
      await manageRelationshipForActor(identity.userId, {
        targetUserId: String(body.targetUserId || ''),
        operation: 'unblock',
      });
    } else if (section === 'verification') {
      await submitVerificationEvidence(identity.userId, {
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
      snapshot: await getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 400 });
  }
}

// NS-GOV-004, NS-SEL-006 & NS-ACC-005: Governance appeals, Seller-only closure & voluntary account closure
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

    if (action === 'submit_appeal') {
      const appeal = await submitGovernanceAppealForActor(identity.userId, {
        targetType: (body.targetType || 'RESTRICTION') as AppealTargetType,
        targetRecordId: String(body.targetRecordId || ''),
        appealReason: String(body.appealReason || ''),
        evidencePaths: Array.isArray(body.evidencePaths) ? body.evidencePaths.map(String) : [],
      });
      return NextResponse.json({
        ok: true,
        appeal,
        snapshot: await getNairaScoutSnapshot(identity.userId),
      });
    }

    if (action === 'close_seller') {
      await closeSellerCapabilityVoluntarily(
        identity.userId,
        body.reason ? String(body.reason) : undefined
      );
      return NextResponse.json({
        ok: true,
        sellerClosed: true,
        snapshot: await getNairaScoutSnapshot(identity.userId),
      });
    }

    if (action === 'close_account') {
      await closeAccountVoluntarily(
        identity.userId,
        body.reason ? String(body.reason) : undefined
      );

      const supabase = await createSupabaseServerClient();
      if (supabase) {
        await supabase.auth.signOut();
      }

      return NextResponse.json({
        ok: true,
        closed: true,
        snapshot: await getNairaScoutSnapshot(null),
      });
    }

    return NextResponse.json({ error: 'Unknown lifecycle action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Lifecycle action failed.' }, { status: 400 });
  }
}
