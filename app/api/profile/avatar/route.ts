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
  updateScoutAvatarForActor,
} from '@/lib/nairascout-store';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_AVATAR_DIMENSION_PX = 200; // 200 x 200 px minimum
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function detectImageFormat(
  bytes: Uint8Array
): { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' } | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mimeType: 'image/png', ext: 'png' };
  }

  // WEBP: "RIFF" .... "WEBP"
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

// NS-SCT-012: Pure-TS image header parser enforcing >= 200x200px & rejecting animated PNG/WebP
function parseImageDimensionsAndCheckStatic(
  bytes: Uint8Array,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
): { width: number; height: number; isAnimated: boolean } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (mimeType === 'image/png') {
    if (bytes.length < 24) return null;
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    let offset = 8;
    let isAnimated = false;
    while (offset + 8 <= bytes.length) {
      const chunkLen = view.getUint32(offset, false);
      const chunkType =
        String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      if (chunkType === 'acTL') {
        isAnimated = true;
        break;
      }
      if (chunkType === 'IDAT' || chunkType === 'IEND') break;
      offset += 12 + chunkLen;
    }
    return { width, height, isAnimated };
  }

  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      if (offset + 4 > bytes.length) break;
      const segLen = view.getUint16(offset + 2, false);
      if (segLen < 2) break;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof && offset + 9 <= bytes.length) {
        const height = view.getUint16(offset + 5, false);
        const width = view.getUint16(offset + 7, false);
        return { width, height, isAnimated: false };
      }
      offset += 2 + segLen;
    }
    return null;
  }

  // WebP
  if (bytes.length < 30) return null;
  const chunkId = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkId === 'VP8X') {
    const flags = bytes[20];
    const isAnimated = Boolean(flags & 0x02);
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height, isAnimated };
  }
  if (chunkId === 'VP8L') {
    if (bytes[20] !== 0x2f) return null;
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height, isAnimated: false };
  }
  if (chunkId === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return { width, height, isAnimated: false };
  }
  return null;
}

function extractScopedStoragePath(publicUrl: string | null, userId: string): string | null {
  if (!publicUrl) return null;
  const marker = '/storage/v1/object/public/avatars/';
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
    const { data: bucket } = await adminClient.storage.getBucket('avatars');
    if (!bucket) {
      await adminClient.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: MAX_AVATAR_BYTES,
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

// NS-ACC-003 & NS-SCT-012: Authenticated Scout avatar upload with >= 200x200 px & static image validation
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
      return NextResponse.json({ error: 'Please select an image file to upload.' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: 'Avatar image must be between 1 byte and 5 MB.' },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WebP images are supported. Animated GIFs are not permitted.' },
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

    const meta = parseImageDimensionsAndCheckStatic(bytes, detected.mimeType);
    if (!meta) {
      return NextResponse.json(
        { error: 'Could not verify image dimensions. Upload a valid static JPG, PNG, or WebP.' },
        { status: 400 }
      );
    }
    if (meta.isAnimated) {
      return NextResponse.json(
        { error: 'Animated images are not supported for profile photos. Upload a static image.' },
        { status: 400 }
      );
    }
    if (meta.width < MIN_AVATAR_DIMENSION_PX || meta.height < MIN_AVATAR_DIMENSION_PX) {
      return NextResponse.json(
        {
          error: `Profile photo must be at least ${MIN_AVATAR_DIMENSION_PX} × ${MIN_AVATAR_DIMENSION_PX} pixels (received ${meta.width} × ${meta.height}).`,
        },
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

    const objectPath = `${identity.userId}/avatar-${Date.now()}.${detected.ext}`;

    const { error: uploadError } = await storageClient.storage
      .from('avatars')
      .upload(objectPath, bytes, {
        contentType: detected.mimeType,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error: `Avatar upload failed: ${uploadError.message}. Ensure the public "avatars" Supabase Storage bucket and policies exist.`,
        },
        { status: 400 }
      );
    }

    const { data: urlData } = storageClient.storage
      .from('avatars')
      .getPublicUrl(objectPath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl || (!publicUrl.startsWith('https://') && !publicUrl.startsWith('http://'))) {
      return NextResponse.json(
        { error: 'Failed to resolve public avatar URL from Supabase Storage.' },
        { status: 500 }
      );
    }

    const { previousAvatarUrl } = await updateScoutAvatarForActor(identity.userId, publicUrl);

    const oldPath = extractScopedStoragePath(previousAvatarUrl, identity.userId);
    if (oldPath && oldPath !== objectPath) {
      await storageClient.storage.from('avatars').remove([oldPath]).catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      avatarUrl: publicUrl,
      snapshot: await getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[POST /api/profile/avatar] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not save profile avatar. Please try again.' },
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
    const { previousAvatarUrl } = await updateScoutAvatarForActor(identity.userId, null);

    const oldPath = extractScopedStoragePath(previousAvatarUrl, identity.userId);
    if (oldPath) {
      const storageClient = await getStorageClientForActor(req);
      if (storageClient) {
        await storageClient.storage.from('avatars').remove([oldPath]).catch(() => undefined);
      }
    }

    return NextResponse.json({
      ok: true,
      avatarUrl: null,
      snapshot: await getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[DELETE /api/profile/avatar] Failed:', formatPostgresError(err), err);
    return NextResponse.json(
      { error: 'Could not remove profile avatar.' },
      { status: 500 }
    );
  }
}
