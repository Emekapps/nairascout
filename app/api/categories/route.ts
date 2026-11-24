import { NextResponse } from 'next/server';
import { getListingCategories } from '@/lib/nairascout-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await getListingCategories({ includeInactive: false });
    return NextResponse.json({ categories });
  } catch (err) {
    console.error('[GET /api/categories] Failed:', err);
    return NextResponse.json(
      { error: 'Could not load listing categories.' },
      { status: 500 }
    );
  }
}
