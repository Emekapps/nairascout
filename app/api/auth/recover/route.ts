import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import { verifyMutationOrigin } from '@/lib/auth/session';
import { submitAccountRecoveryRequest } from '@/lib/nairascout-store';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const ALLOWED_RECOVERY_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_RECOVERY_FILE_BYTES = 5 * 1024 * 1024;

// NS-AUT-007: Support-assisted lost-email account recovery intake (anti-enumeration safe)
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const claimedEmail = String(formData.get('claimedEmail') || '').trim();
    const claimedUsername = String(formData.get('claimedUsername') || '').trim();
    const contactEmailForUpdates = String(formData.get('contactEmailForUpdates') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    const file = formData.get('file');

    if (!claimedEmail || !contactEmailForUpdates || reason.length < 15) {
      return NextResponse.json(
        {
          error:
            'Claimed account email, reachable contact email, and a detailed reason (minimum 15 chars) are required.',
        },
        { status: 400 }
      );
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'Please attach a government ID or account ownership evidence file.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_RECOVERY_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Evidence file must be JPG, PNG, WebP, or PDF.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_RECOVERY_FILE_BYTES) {
      return NextResponse.json(
        { error: 'Evidence file must be 5 MB or smaller.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Recovery evidence storage is not configured on this server.' },
        { status: 503 }
      );
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'evidence';
    const objectKey = `recovery/${crypto.randomUUID()}-${safeFileName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('verification-docs')
      .upload(objectKey, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Could not store recovery evidence: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    await submitAccountRecoveryRequest({
      claimedEmail,
      claimedUsername: claimedUsername || null,
      contactEmailForUpdates,
      reason,
      evidencePaths: [`verification-docs/${objectKey}`],
    });

    return NextResponse.json({
      ok: true,
      message:
        'If an account matches those details, your recovery request has been logged for dual-officer Support & Trust review. Updates will be sent to your contact email.',
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Could not submit recovery request.' }, { status: 400 });
  }
}
