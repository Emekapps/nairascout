import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import { formatPostgresError } from '@/lib/db';
import {
  getNairaScoutSnapshot,
  updateSellerLogoForActor,
} from '@/lib/nairascout-store';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKET_NAME = 'seller-logos';

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
        fileSizeLimit: MAX_LOGO_BYTES,
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

// NS-SEL-005: Seller storefront profile image upload & storage confinement
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Please select a business profile image to upload.' },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        { error: 'Business profile photo must be between 1 byte and 5 MB.' },
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

    const objectPath = `${identity.userId}/seller-logo-${Date.now()}.${detected.ext}`;

    const { error: uploadError } = await storageClient.storage
      .from(BUCKET_NAME)
      .upload(objectPath, bytes, {
        contentType: detected.mimeType,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error: `Business photo upload failed: ${uploadError.message}. Ensure the public "seller-logos" Supabase Storage bucket and policies exist.`,
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
        { error: 'Failed to resolve public business photo URL from Supabase Storage.' },
        { status: 500 }
      );
    }

    const { hasSellerProfile, previousLogoUrl } = await updateSellerLogoForActor(
      identity.userId,
      publicUrl
    );

    const oldPath = extractScopedStoragePath(previousLogoUrl, identity.userId);
    if (oldPath && oldPath !== objectPath) {
      await storageClient.storage.from(BUCKET_NAME).remove([oldPath]).catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      logoUrl: publicUrl,
      hasSellerProfile,
      snapshot: hasSellerProfile ? await getNairaScoutSnapshot(identity.userId) : undefined,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[POST /api/seller/logo] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not save business profile photo. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    let pendingLogoUrl: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.logoUrl === 'string') {
        pendingLogoUrl = body.logoUrl;
      }
    } catch {
      // Optional JSON body
    }

    const { hasSellerProfile, previousLogoUrl } = await updateSellerLogoForActor(
      identity.userId,
      null
    );

    const targetToDelete = previousLogoUrl || pendingLogoUrl;
    const oldPath = extractScopedStoragePath(targetToDelete, identity.userId);
    if (oldPath) {
      const storageClient = await getStorageClientForActor(req);
      if (storageClient) {
        await storageClient.storage.from(BUCKET_NAME).remove([oldPath]).catch(() => undefined);
      }
    }

    return NextResponse.json({
      ok: true,
      logoUrl: null,
      hasSellerProfile,
      snapshot: hasSellerProfile ? await getNairaScoutSnapshot(identity.userId) : undefined,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[DELETE /api/seller/logo] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not remove business profile photo.' },
      { status: 500 }
    );
  }
}
