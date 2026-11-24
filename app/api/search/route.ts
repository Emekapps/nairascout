import { NextRequest, NextResponse } from 'next/server';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { searchGlobalDirectory } from '@/lib/nairascout-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 3) {
    return NextResponse.json({
      query: q,
      products: [],
      categories: [],
      people: [],
    });
  }

  try {
    const identity = await extractSessionIdentityFromRequest(req);
    const result = await searchGlobalDirectory(q, identity?.userId ?? null);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/search] Failed:', err);
    return NextResponse.json(
      { error: 'Could not perform search.' },
      { status: 500 }
    );
  }
}
