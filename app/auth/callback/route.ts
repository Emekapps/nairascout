import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import { ensureUserProvisionedInDb } from '@/lib/nairascout-store';
import { isSupabaseConfigured } from '@/lib/supabase/server';

const VALID_EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const rawForwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const safeForwardedHost =
    rawForwardedHost && /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawForwardedHost.trim())
      ? rawForwardedHost.trim()
      : null;
  const rawProto = req.headers.get('x-forwarded-proto');
  const forwardedProto =
    rawProto === 'https' || rawProto === 'http'
      ? rawProto
      : requestUrl.protocol === 'https:'
        ? 'https'
        : 'http';
  const redirectOrigin = safeForwardedHost
    ? `${forwardedProto}://${safeForwardedHost}`
    : requestUrl.origin;
  const isHttps = redirectOrigin.startsWith('https://');

  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const typeParam = requestUrl.searchParams.get('type');
  const authErrorParam =
    requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  const nextRaw = requestUrl.searchParams.get('next') || '/';
  const nextPath =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.startsWith('/\\')
      ? nextRaw
      : '/';

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${redirectOrigin}/auth/login?error=supabase_not_configured`);
  }

  if (authErrorParam) {
    return NextResponse.redirect(
      `${redirectOrigin}/auth/login?error=${encodeURIComponent(authErrorParam)}`
    );
  }

  const cookiesToApply = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: isHttps
        ? {
            sameSite: 'none',
            secure: true,
            path: '/',
          }
        : {
            sameSite: 'lax',
            path: '/',
          },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            cookiesToApply.set(name, { name, value, options });
          });
        },
      },
    }
  );

  let verifiedUser = null;
  let callbackFailure: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      callbackFailure = error.message;
    } else {
      verifiedUser = data.user ?? null;
    }
  } else if (tokenHash && typeParam && VALID_EMAIL_OTP_TYPES.has(typeParam as EmailOtpType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParam as EmailOtpType,
    });
    if (error) {
      callbackFailure = error.message;
    } else {
      verifiedUser = data.user ?? null;
    }
  } else {
    callbackFailure = 'Missing or unsupported authentication confirmation parameters.';
  }

  if (callbackFailure) {
    console.error('[auth/callback] Supabase confirmation failed:', callbackFailure);
    return NextResponse.redirect(
      `${redirectOrigin}/auth/login?error=${encodeURIComponent(callbackFailure)}`
    );
  }

  if (!verifiedUser) {
    const { data: userData } = await supabase.auth.getUser();
    verifiedUser = userData.user ?? null;
  }

  if (verifiedUser && verifiedUser.email && isPostgresConfigured()) {
    const refEventCookie = req.cookies.get('ns_ref_event')?.value || null;
    const refScoutCookie = req.cookies.get('ns_ref_scout')?.value || null;
    try {
      await ensureUserProvisionedInDb(
        {
          userId: verifiedUser.id,
          email: verifiedUser.email,
          phone: verifiedUser.phone?.trim() ? verifiedUser.phone.trim() : null,
          userMetadata: (verifiedUser.user_metadata as Record<string, unknown>) || {},
        },
        {
          referralEventId: refEventCookie,
          referralScoutUsername: refScoutCookie,
        }
      );
    } catch (err) {
      const formatted = formatPostgresError(err);
      console.error('[auth/callback] PostgreSQL provisioning failed:', formatted, err);
    }
  }

  const redirectResponse = NextResponse.redirect(`${redirectOrigin}${nextPath}`);
  for (const { name, value, options } of cookiesToApply.values()) {
    redirectResponse.cookies.set(name, value, {
      ...options,
      ...(isHttps ? { sameSite: 'none', secure: true } : {}),
    });
  }

  return redirectResponse;
}
