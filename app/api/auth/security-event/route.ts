import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  getNairaScoutSnapshot,
  recordSecurityEventForActor,
  SecurityEventAction,
} from '@/lib/nairascout-store';

const ALLOWED_EVENTS = new Set<SecurityEventAction>([
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'OTHER_SESSIONS_REVOKED',
  'EMAIL_CHANGE_REQUESTED',
  'MFA_ENABLED',
  'MFA_DISABLED',
]);

// NS-AUT-003, NS-AUT-004, NS-AUT-005 & NS-AUT-006: Audited security events & notifications
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '') as SecurityEventAction;
    if (!ALLOWED_EVENTS.has(action)) {
      return NextResponse.json({ error: 'Unsupported security event.' }, { status: 400 });
    }

    const details =
      body?.details && typeof body.details === 'object'
        ? (body.details as Record<string, unknown>)
        : {};

    await recordSecurityEventForActor(identity.userId, action, details);
    const snapshot = await getNairaScoutSnapshot(identity.userId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to record security event.' }, { status: 400 });
  }
}
