import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import { getNairaScoutSnapshot, recordUserReauthentication } from '@/lib/nairascout-store';

// NS-AUT-005: Sensitive-action fresh identity confirmation (password or 6-digit email OTP)
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase Auth is not configured.' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const mode = body?.mode === 'otp' ? 'otp' : 'password';

    const ephemeralClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    if (mode === 'password') {
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!password) {
        return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
      }
      const { error } = await ephemeralClient.auth.signInWithPassword({
        email: identity.email,
        password,
      });
      if (error) {
        return NextResponse.json(
          { error: 'Identity confirmation failed. Check your password and try again.' },
          { status: 401 }
        );
      }
    } else {
      const token = typeof body?.otpCode === 'string' ? body.otpCode.trim() : '';
      if (!token) {
        return NextResponse.json({ error: '6-digit verification code is required.' }, { status: 400 });
      }
      const { error } = await ephemeralClient.auth.verifyOtp({
        email: identity.email,
        token,
        type: 'email',
      });
      if (error) {
        return NextResponse.json(
          { error: 'Invalid or expired verification code.' },
          { status: 401 }
        );
      }
    }

    const result = await recordUserReauthentication(
      identity.userId,
      mode === 'otp' ? 'EMAIL_OTP' : 'PASSWORD'
    );
    const snapshot = await getNairaScoutSnapshot(identity.userId);

    return NextResponse.json({
      ok: true,
      lastReauthenticatedAt: result.lastReauthenticatedAt,
      snapshot,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Reauthentication failed.' }, { status: 400 });
  }
}
