import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  getNairaScoutSnapshot,
  publishSellerListingById,
} from '@/lib/nairascout-store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const listing = publishSellerListingById(identity.userId, id);
    return NextResponse.json({
      ok: true,
      listing,
      snapshot: getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to publish listing.' }, { status: 400 });
  }
}
