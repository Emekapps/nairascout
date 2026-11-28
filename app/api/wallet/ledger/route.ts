import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError } from '@/lib/db';
import { getCursorPaginatedLedgerForActor } from '@/lib/nairascout-store';

// NS-SCT-070 & NS-UI-319: 20-record cursor-paginated Financial Ledger API
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const result = await getCursorPaginatedLedgerForActor(identity.userId, {
      cursor: sp.get('cursor'),
      limit: sp.get('limit') ? Number(sp.get('limit')) : 20,
      status: sp.get('status'),
      from: sp.get('from'),
      to: sp.get('to'),
      product: sp.get('product'),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[GET /api/wallet/ledger] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not load financial ledger.' },
      { status: 500 }
    );
  }
}
