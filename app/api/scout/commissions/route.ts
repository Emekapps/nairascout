import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { getScoutCommissionHistory } from '@/lib/nairascout-store';

// NS-SCT-065 - NS-SCT-075: Commission History with 20-record (createdAt, id) cursor pagination
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get('status');
  const productId = req.nextUrl.searchParams.get('productId');
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const cursorCreatedAt = req.nextUrl.searchParams.get('cursorCreatedAt');
  const cursorId = req.nextUrl.searchParams.get('cursorId');

  try {
    const data = await getScoutCommissionHistory(identity.userId, {
      status,
      productId,
      from,
      to,
      cursorCreatedAt,
      cursorId,
      limit: 20,
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load commission history.' }, { status: 500 });
  }
}
