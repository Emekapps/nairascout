import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  getNairaScoutSnapshot,
  manageSellerTeamForActor,
} from '@/lib/nairascout-store';

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
    const operation = String(body?.operation || '');

    if (operation === 'invite') {
      await manageSellerTeamForActor(identity.userId, {
        operation: 'invite',
        memberEmail: String(body.memberEmail || ''),
        role: body.role === 'BUSINESS_ADMIN' ? 'BUSINESS_ADMIN' : 'TEAM_MEMBER',
        permissions: {
          canManageListings: Boolean(body.permissions?.canManageListings ?? true),
          canManageOrders: Boolean(body.permissions?.canManageOrders ?? true),
          canViewAnalytics: Boolean(body.permissions?.canViewAnalytics ?? true),
          canManageBilling: Boolean(body.permissions?.canManageBilling ?? false),
          canManageTeam: Boolean(body.permissions?.canManageTeam ?? false),
        },
      });
    } else if (operation === 'revoke') {
      await manageSellerTeamForActor(identity.userId, {
        operation: 'revoke',
        memberId: String(body.memberId || ''),
      });
    } else {
      return NextResponse.json({ error: 'Unknown team operation.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      snapshot: await getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update Seller team.' }, { status: 400 });
  }
}
