import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps = forwardedProto === 'https' || req.nextUrl.protocol === 'https:';

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            res = NextResponse.next({
              request: {
                headers: req.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, {
                ...options,
                ...(isHttps ? { sameSite: 'none', secure: true } : {}),
              })
            );
          },
        },
      }
    );

    await supabase.auth.getUser();
  }

  const refEvent = req.nextUrl.searchParams.get('refEvent');
  const refScout = req.nextUrl.searchParams.get('refScout');

  if (refEvent) {
    res.cookies.set('ns_ref_event', refEvent, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  if (refScout) {
    res.cookies.set('ns_ref_scout', refScout, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
