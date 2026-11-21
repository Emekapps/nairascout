import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const refEvent = req.nextUrl.searchParams.get('refEvent');
  const refScout = req.nextUrl.searchParams.get('refScout');

  if (!refEvent && !refScout) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  if (refEvent) {
    res.cookies.set('ns_ref_event', refEvent, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  if (refScout) {
    res.cookies.set('ns_ref_scout', refScout, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
