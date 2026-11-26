import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  assertAdminAal2Session,
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  adminUpsertHelpArticle,
  adminUpsertPlatformPolicy,
  getAdminConsoleSnapshot,
  getAdminContentSnapshot,
} from '@/lib/nairascout-store';

// NS-FND-007: Super Admin & Platform Admin policy and Help Centre content management
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    await assertAdminAal2Session(req);
    const content = await getAdminContentSnapshot(identity.userId);
    return NextResponse.json(content);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load platform content.' }, { status: 400 });
  }
}

async function handleUpsert(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    await assertAdminAal2Session(req);
    const body = await req.json();
    const kind = body?.kind;

    if (kind === 'policy') {
      const policy = await adminUpsertPlatformPolicy(identity.userId, {
        id: typeof body?.id === 'string' ? body.id : undefined,
        slug: String(body?.slug || ''),
        title: String(body?.title || ''),
        summary: String(body?.summary || ''),
        contentMarkdown: String(body?.contentMarkdown || ''),
        version: String(body?.version || '1.0.0'),
        effectiveDate: typeof body?.effectiveDate === 'string' ? body.effectiveDate : undefined,
        isPublished: body?.isPublished !== false,
      });

      const [content, admin] = await Promise.all([
        getAdminContentSnapshot(identity.userId),
        getAdminConsoleSnapshot(identity.userId),
      ]);
      return NextResponse.json({ ok: true, policy, ...content, admin });
    }

    if (kind === 'article') {
      const article = await adminUpsertHelpArticle(identity.userId, {
        id: typeof body?.id === 'string' ? body.id : undefined,
        slug: String(body?.slug || ''),
        category: String(body?.category || 'GETTING_STARTED'),
        title: String(body?.title || ''),
        summary: String(body?.summary || ''),
        bodyMarkdown: String(body?.bodyMarkdown || ''),
        audienceRole: String(body?.audienceRole || 'ALL'),
        sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) : 0,
        isPublished: body?.isPublished !== false,
      });

      const [content, admin] = await Promise.all([
        getAdminContentSnapshot(identity.userId),
        getAdminConsoleSnapshot(identity.userId),
      ]);
      return NextResponse.json({ ok: true, article, ...content, admin });
    }

    return NextResponse.json({ error: 'Unsupported content kind.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Could not save content update.' }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  return handleUpsert(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpsert(req);
}
