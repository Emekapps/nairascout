import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  getNotificationPreferencesForActor,
  updateNotificationPreferencesForActor,
} from '@/lib/nairascout-store';

// NS-SCT-076 - NS-SCT-083: Eight-group notification preferences (locks essential alerts ON)
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const preferences = await getNotificationPreferencesForActor(identity.userId);
    return NextResponse.json({ preferences });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load notification preferences.' }, { status: 500 });
  }
}

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
    const rawList = Array.isArray(body?.preferences) ? body.preferences : [];
    if (rawList.length === 0) {
      return NextResponse.json({ error: 'No preference updates provided.' }, { status: 400 });
    }

    const updates = rawList.map((item: Record<string, unknown>) => ({
      categoryCode: String(item.categoryCode || ''),
      inAppEnabled: typeof item.inAppEnabled === 'boolean' ? item.inAppEnabled : undefined,
      emailEnabled: typeof item.emailEnabled === 'boolean' ? item.emailEnabled : undefined,
    }));

    const preferences = await updateNotificationPreferencesForActor(identity.userId, updates);
    return NextResponse.json({ ok: true, preferences });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update notification preferences.' }, { status: 400 });
  }
}
