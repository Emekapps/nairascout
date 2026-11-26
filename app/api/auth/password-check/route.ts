import { NextRequest, NextResponse } from 'next/server';
import { validateNairaScoutPassword } from '@/lib/auth/password-policy';
import { verifyMutationOrigin } from '@/lib/auth/session';

// NS-AUT-001: Server-side NIST 15-char & compromised password verification before Supabase Auth call
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const password = typeof body?.password === 'string' ? body.password : '';
    const result = await validateNairaScoutPassword(password, {
      email: typeof body?.email === 'string' ? body.email : null,
      username: typeof body?.username === 'string' ? body.username : null,
      displayName: typeof body?.displayName === 'string' ? body.displayName : null,
    });

    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch {
    return NextResponse.json({ error: 'Password validation failed.' }, { status: 400 });
  }
}
