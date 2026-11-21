import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureUserProvisionedInDb } from '@/lib/nairascout-store';
import { isPostgresConfigured } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const nextRaw = searchParams.get('next') || '/';
  const nextPath = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
    }
  }

  const { data } = await supabase.auth.getUser();
  if (data.user && data.user.email && isPostgresConfigured()) {
    const refEventCookie = req.cookies.get('ns_ref_event')?.value || null;
    const refScoutCookie = req.cookies.get('ns_ref_scout')?.value || null;
    try {
      await ensureUserProvisionedInDb(
        {
          userId: data.user.id,
          email: data.user.email,
          phone: data.user.phone ?? null,
          userMetadata: (data.user.user_metadata as Record<string, unknown>) || {},
        },
        {
          referralEventId: refEventCookie,
          referralScoutUsername: refScoutCookie,
        }
      );
    } catch {
      // Redirect still proceeds; provisioning will retry on next request
    }
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
