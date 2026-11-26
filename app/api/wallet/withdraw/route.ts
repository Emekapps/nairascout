import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  getNairaScoutSnapshot,
  getWithdrawalRequestsForActor,
  requestWithdrawalForActor,
} from '@/lib/nairascout-store';

// NS-SCT-075: Authoritative server-side withdrawal request (re-queries ledger balances directly)
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const requests = await getWithdrawalRequestsForActor(identity.userId);
    return NextResponse.json({ requests });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load withdrawal requests.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const amountKobo =
      typeof body?.amountKobo === 'number' && Number.isFinite(body.amountKobo)
        ? body.amountKobo
        : undefined;

    const withdrawalRequest = await requestWithdrawalForActor(identity.userId, { amountKobo });
    const snapshot = await getNairaScoutSnapshot(identity.userId);
    const requests = await getWithdrawalRequestsForActor(identity.userId);

    return NextResponse.json({
      ok: true,
      withdrawalRequest,
      requests,
      snapshot,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Withdrawal request could not be processed.' }, { status: 400 });
  }
}
