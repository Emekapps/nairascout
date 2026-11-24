import { NextResponse } from 'next/server';
import { getNigerianStates } from '@/lib/nairascout-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const states = await getNigerianStates();
    return NextResponse.json({ states });
  } catch (err) {
    console.error('[GET /api/states] Failed:', err);
    return NextResponse.json(
      { error: 'Could not load Nigerian states.' },
      { status: 500 }
    );
  }
}
