import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  buildSessionCookieHeader,
  signSessionToken,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  getNairaScoutSnapshot,
  requestEmailOtp,
  verifyEmailOtpAndProvision,
} from '@/lib/nairascout-store';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '');
    const email = String(body?.email || '').trim().toLowerCase();

    if (action === 'request') {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, sent: true, mode: 'supabase' });
      }

      const result = requestEmailOtp(email);
      return NextResponse.json({
        ok: true,
        sent: result.sent,
        existingUser: result.existingUser,
        previewOtpCode: result.previewOtpCode,
        mode: 'preview',
      });
    }

    if (action === 'verify') {
      const code = String(body?.code || '').trim();
      const refEventCookie = req.cookies.get('ns_ref_event')?.value || null;
      const refScoutCookie = req.cookies.get('ns_ref_scout')?.value || null;

      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'email',
        });
        if (error || !data.user) {
          return NextResponse.json(
            { error: error?.message || 'OTP verification failed.' },
            { status: 401 }
          );
        }
      }

      const { user, createdNew } = verifyEmailOtpAndProvision({
        email,
        code,
        displayName: body?.displayName ? String(body.displayName) : undefined,
        referralEventId: body?.referralEventId
          ? String(body.referralEventId)
          : refEventCookie,
        referralScoutUsername: body?.referralScoutUsername
          ? String(body.referralScoutUsername)
          : refScoutCookie,
      });

      const token = signSessionToken(user.id, user.email);
      const res = NextResponse.json({
        ok: true,
        createdNew,
        token,
        snapshot: getNairaScoutSnapshot(user.id),
      });
      res.headers.set('Set-Cookie', buildSessionCookieHeader(token));
      return res;
    }

    return NextResponse.json({ error: 'Unknown OTP action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'OTP request failed.' }, { status: 400 });
  }
}
