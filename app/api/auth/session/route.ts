import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  extractSessionIdentityFromRequest,
  signSessionToken,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  claimFirstAdmin,
  getNairaScoutSnapshot,
  loginWithPassword,
  registerUserAtomic,
} from '@/lib/nairascout-store';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  const refEvent = req.nextUrl.searchParams.get('refEvent');
  const snapshot = getNairaScoutSnapshot(identity?.userId ?? null, refEvent);
  return NextResponse.json({
    authenticated: snapshot.authenticated,
    adminBootstrapAvailable: snapshot.adminBootstrapAvailable,
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
      const res = NextResponse.json({ ok: true, snapshot: getNairaScoutSnapshot(null) });
      res.headers.set('Set-Cookie', buildClearSessionCookieHeader());
      return res;
    }

    if (action === 'register') {
      const refEventCookie = req.cookies.get('ns_ref_event')?.value || null;
      const refScoutCookie = req.cookies.get('ns_ref_scout')?.value || null;

      const { user } = registerUserAtomic({
        email: String(body.email || ''),
        password: String(body.password || ''),
        displayName: String(body.displayName || ''),
        username: body.username ? String(body.username) : undefined,
        locationState: body.locationState ? String(body.locationState) : undefined,
        referralEventId: body.referralEventId ? String(body.referralEventId) : refEventCookie,
        referralScoutUsername: body.referralScoutUsername
          ? String(body.referralScoutUsername)
          : refScoutCookie,
      });

      const token = signSessionToken(user.id, user.email);
      const res = NextResponse.json({
        ok: true,
        token,
        snapshot: getNairaScoutSnapshot(user.id),
      });
      res.headers.set('Set-Cookie', buildSessionCookieHeader(token));
      return res;
    }

    if (action === 'login') {
      const user = loginWithPassword(
        String(body.email || ''),
        String(body.password || '')
      );
      const token = signSessionToken(user.id, user.email);
      const res = NextResponse.json({
        ok: true,
        token,
        snapshot: getNairaScoutSnapshot(user.id),
      });
      res.headers.set('Set-Cookie', buildSessionCookieHeader(token));
      return res;
    }

    if (action === 'claim_admin') {
      const { user } = claimFirstAdmin({
        email: String(body.email || ''),
        password: String(body.password || ''),
        displayName: String(body.displayName || 'Platform Super Admin'),
      });
      const token = signSessionToken(user.id, user.email);
      const res = NextResponse.json({
        ok: true,
        token,
        snapshot: getNairaScoutSnapshot(user.id),
      });
      res.headers.set('Set-Cookie', buildSessionCookieHeader(token));
      return res;
    }

    return NextResponse.json({ error: 'Unknown auth action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Authentication request failed.' }, { status: 400 });
  }
}
