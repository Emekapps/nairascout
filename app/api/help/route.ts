import { NextRequest, NextResponse } from 'next/server';
import { getPublishedHelpArticles } from '@/lib/nairascout-store';

// NS-FND-004 & NS-FND-005: Public searchable Help Centre articles endpoint
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? undefined;
  const category = req.nextUrl.searchParams.get('category') ?? undefined;
  try {
    const articles = await getPublishedHelpArticles({ q, category });
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ error: 'Could not load Help Centre articles.' }, { status: 500 });
  }
}
