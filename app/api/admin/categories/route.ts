import { NextRequest, NextResponse } from 'next/server';
import { ALL_PLATFORM_ADMIN_ROLES, AuthorizationError, assertAdminRole } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  loadDbAuthContext,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  adminCreateListingCategory,
  adminUpdateListingCategory,
  getAdminConsoleSnapshot,
  getListingCategories,
} from '@/lib/nairascout-store';

// NS-GOV-005: Admin-managed product listing categories (read for platform admins, write for SUPER_ADMIN)
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const ctx = await loadDbAuthContext(identity.userId);
    assertAdminRole(ctx, ALL_PLATFORM_ADMIN_ROLES);
    const categories = await getListingCategories({ includeInactive: true });
    return NextResponse.json({ categories });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load categories.' }, { status: 400 });
  }
}

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
    const category = await adminCreateListingCategory(identity.userId, {
      name: String(body?.name || ''),
      description: typeof body?.description === 'string' ? body.description : null,
      isActive: body?.isActive !== false,
      sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) : 0,
    });

    return NextResponse.json({
      ok: true,
      category,
      categories: await getListingCategories({ includeInactive: true }),
      admin: await getAdminConsoleSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Could not create listing category.' }, { status: 400 });
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
    const category = await adminUpdateListingCategory(identity.userId, {
      id: String(body?.id || ''),
      name: typeof body?.name === 'string' ? body.name : undefined,
      description:
        body?.description !== undefined
          ? body.description === null
            ? null
            : String(body.description)
          : undefined,
      isActive: typeof body?.isActive === 'boolean' ? body.isActive : undefined,
      sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });

    return NextResponse.json({
      ok: true,
      category,
      categories: await getListingCategories({ includeInactive: true }),
      admin: await getAdminConsoleSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Could not update listing category.' }, { status: 400 });
  }
}
