import { NextRequest, NextResponse } from 'next/server';
import { checkUsernameAvailability } from '@/lib/nairascout-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username') || '';
  try {
    const result = await checkUsernameAvailability(username);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/auth/check-username] Failed:', err);
    return NextResponse.json(
      { available: false, normalized: username.trim().toLowerCase(), reason: 'Could not verify username.' },
      { status: 500 }
    );
  }
}
