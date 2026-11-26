import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { getScoutActivityFeed } from '@/lib/nairascout-store';

// NS-SCT-035 - NS-SCT-044: Chronological 8-category Scout Activity Feed
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get('category');
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const page = Number(req.nextUrl.searchParams.get('page') || 1);

  try {
    const feed = await getScoutActivityFeed(identity.userId, {
      category,
      from,
      to,
      page,
      pageSize: 20,
    });
    return NextResponse.json(feed);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load Scout activity feed.' }, { status: 500 });
  }
}
