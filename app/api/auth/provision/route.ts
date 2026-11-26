import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import { formatPostgresError } from '@/lib/db';
import {
  ensureUserProvisionedInDb,
  getNairaScoutSnapshot,
} from '@/lib/nairascout-store';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// NS-ACC-001, NS-ACC-017 & NS-REF-001: Authenticated idempotent PostgreSQL Scout provisioning & CLOSED guard
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json(
      { error: 'Valid Supabase Auth session required.', code: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const refEventCookie = req.cookies.get('ns_ref_event')?.value || null;
    const refScoutCookie = req.cookies.get('ns_ref_scout')?.value || null;

    const referralEventId =
      typeof body?.referralEventId === 'string' && body.referralEventId.trim()
        ? body.referralEventId.trim()
        : refEventCookie;

    const referralScoutUsername =
      typeof body?.referralScoutUsername === 'string' && body.referralScoutUsername.trim()
        ? body.referralScoutUsername.trim()
        : refScoutCookie;

    const { createdNew, userId } = await ensureUserProvisionedInDb(identity, {
      displayName: typeof body?.displayName === 'string' ? body.displayName : undefined,
      username: typeof body?.username === 'string' ? body.username : undefined,
      locationState: typeof body?.locationState === 'string' ? body.locationState : undefined,
      referralEventId,
      referralScoutUsername,
    });

    const snapshot = await getNairaScoutSnapshot(userId, referralEventId);
    return NextResponse.json({
      ok: true,
      createdNew,
      userId,
      snapshot,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === 'ACCOUNT_CLOSED') {
        const supabase = await createSupabaseServerClient();
        if (supabase) {
          await supabase.auth.signOut().catch(() => undefined);
        }
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    const formatted = formatPostgresError(err);
    console.error('[POST /api/auth/provision] PostgreSQL provisioning failed:', formatted, err);
    return NextResponse.json(
      {
        error: `PostgreSQL provisioning failed: ${formatted.summary}`,
        code: formatted.code ?? 'PROVISIONING_ERROR',
        detail: formatted.detail,
        hint: formatted.hint,
        constraint: formatted.constraint,
        table: formatted.table,
        column: formatted.column,
      },
      { status: 500 }
    );
  }
}
