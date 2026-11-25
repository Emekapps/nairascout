import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import { formatPostgresError } from '@/lib/db';
import {
  getNotificationsForActor,
  markNotificationReadForActor,
} from '@/lib/nairascout-store';

// NS-NOT-001: Retrieve authenticated user's notifications with read/unread counts
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const result = await getNotificationsForActor(identity.userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/notifications] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not load notifications.' },
      { status: 500 }
    );
  }
}

// NS-NOT-001: Mark single notification or all notifications as read in PostgreSQL
export async function PATCH(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await markNotificationReadForActor(identity.userId, {
      notificationId: typeof body?.notificationId === 'string' ? body.notificationId : undefined,
      markAll: body?.markAll === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[PATCH /api/notifications] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not update notification status.' },
      { status: 500 }
    );
  }
}
