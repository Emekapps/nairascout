import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import {
  ensureUserProvisionedInDb,
  getNairaScoutSnapshot,
} from '@/lib/nairascout-store';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  const refEvent = req.nextUrl.searchParams.get('refEvent') || req.cookies.get('ns_ref_event')?.value || null;
  const refScout = req.cookies.get('ns_ref_scout')?.value || null;

  if (identity && isPostgresConfigured()) {
    try {
      await ensureUserProvisionedInDb(identity, {
        referralEventId: refEvent,
        referralScoutUsername: refScout,
      });
    } catch (err) {
      console.error('[GET /api/auth/session] PostgreSQL provisioning failed:', formatPostgresError(err), err);
    }
  }

  const snapshot = await getNairaScoutSnapshot(identity?.userId ?? null, refEvent);
  return NextResponse.json({
    authenticated: snapshot.authenticated,
    activeScout: snapshot.activeScout,
    snapshot,
  });
}

export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'logout') {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      const snapshot = await getNairaScoutSnapshot(null);
      return NextResponse.json({ ok: true, snapshot });
    }

    return NextResponse.json(
      { error: 'Use Supabase Auth (@supabase/ssr) + /api/auth/provision for sign-in and registration.' },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Authentication request failed.' }, { status: 400 });
  }
}
