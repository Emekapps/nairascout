import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AuthorizationError, assertCanManageSellerDrafts } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  loadDbAuthContext,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import { formatPostgresError } from '@/lib/db';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per image
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKET_NAME = 'listing-media';

function detectImageFormat(
  bytes: Uint8Array
): { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' } | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mimeType: 'image/png', ext: 'png' };
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', ext: 'webp' };
  }

  return null;
}

function extractScopedStoragePath(publicUrl: string | null, userId: string): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const rawPath = decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
  if (!rawPath.startsWith(`${userId}/`) || rawPath.includes('..')) {
    return null;
  }
  return rawPath;
}

async function getStorageClientForActor(req: NextRequest) {
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    const { data: bucket } = await adminClient.storage.getBucket(BUCKET_NAME);
    if (!bucket) {
      await adminClient.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_IMAGE_BYTES,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
    }
    return adminClient;
  }

  const authHeader = req.headers.get('authorization');
  if (
    authHeader?.toLowerCase().startsWith('bearer ') &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }

  return await createSupabaseServerClient();
}

// NS-SEL-002 & NS-SEL-006: Product listing image upload into Supabase Storage `listing-media`
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const ctx = await loadDbAuthContext(identity.userId);
    assertCanManageSellerDrafts(ctx);

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Please select a product image to upload.' },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Product image must be between 1 byte and 5 MB.' },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WebP images are supported.' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detected = detectImageFormat(bytes);

    if (!detected) {
      return NextResponse.json(
        { error: 'Unsupported or corrupted image file. Use JPG, PNG, or WebP.' },
        { status: 400 }
      );
    }

    const storageClient = await getStorageClientForActor(req);
    if (!storageClient) {
      return NextResponse.json(
        { error: 'Supabase Storage is not configured on this server.' },
        { status: 503 }
      );
    }

    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const objectPath = `${identity.userId}/listing-${Date.now()}-${randomSuffix}.${detected.ext}`;

    const { error: uploadError } = await storageClient.storage
      .from(BUCKET_NAME)
      .upload(objectPath, bytes, {
        contentType: detected.mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error: `Product image upload failed: ${uploadError.message}. Ensure the public "listing-media" Supabase Storage bucket and policies exist.`,
        },
        { status: 400 }
      );
    }

    const { data: urlData } = storageClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(objectPath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl || (!publicUrl.startsWith('https://') && !publicUrl.startsWith('http://'))) {
      return NextResponse.json(
        { error: 'Failed to resolve public product image URL from Supabase Storage.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[POST /api/seller/listings/media] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not upload product image. Please try again.' },
      { status: 500 }
    );
  }
}

// NS-SEL-002 & NS-ACC-017: Scoped removal of uploaded listing media with live Seller privilege check
export async function DELETE(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const ctx = await loadDbAuthContext(identity.userId);
    assertCanManageSellerDrafts(ctx);

    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : null;
    const objectPath = extractScopedStoragePath(url, identity.userId);

    if (objectPath) {
      const storageClient = await getStorageClientForActor(req);
      if (storageClient) {
        await storageClient.storage.from(BUCKET_NAME).remove([objectPath]).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[DELETE /api/seller/listings/media] Failed:', formatPostgresError(err), err);
    return NextResponse.json({ error: 'Could not remove listing image.' }, { status: 500 });
  }
}
