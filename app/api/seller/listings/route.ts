import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  createSellerDraftListing,
  getNairaScoutSnapshot,
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
    const listing = await createSellerDraftListing(identity.userId, {
      title: String(body.title || ''),
      category: String(body.category || 'Fashion & Apparel'),
      priceNaira: Number(body.priceNaira || 0),
      deliveryFeeNaira: Number(body.deliveryFeeNaira || 0),
      stock: Number(body.stock || 1),
      description: String(body.description || ''),
    });

    return NextResponse.json({
      ok: true,
      listing,
      snapshot: await getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to create draft listing.' }, { status: 400 });
  }
}
