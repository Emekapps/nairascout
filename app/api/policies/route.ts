import { NextRequest, NextResponse } from 'next/server';
import { getPublishedPlatformPolicies } from '@/lib/nairascout-store';

// NS-FND-003 & NS-FND-006: Public read-only endpoint for published platform policies
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim() || undefined;
  try {
    const policies = await getPublishedPlatformPolicies(slug);
    return NextResponse.json({ policies });
  } catch {
    return NextResponse.json({ error: 'Could not load platform policies.' }, { status: 500 });
  }
}
