import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  activateSellerOnboarding,
  getNairaScoutSnapshot,
  SellerPlanId,
} from '@/lib/nairascout-store';

// NS-SEL-001 & NS-VER-001: Seller capability activation & SELLER verification initiation
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
    const seller = await activateSellerOnboarding(identity.userId, {
      sellerType: body.sellerType === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL',
      sellerName: String(body.sellerName || ''),
      logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : null,
      description: String(body.description || ''),
      businessCategory: String(body.businessCategory || 'Fashion & Apparel'),
      businessRegNumber: body.businessRegNumber ? String(body.businessRegNumber) : undefined,
      businessAddress: body.businessAddress ? String(body.businessAddress) : undefined,
      businessContactEmail: body.businessContactEmail
        ? String(body.businessContactEmail)
        : undefined,
      businessContactPhone: body.businessContactPhone
        ? String(body.businessContactPhone)
        : undefined,
      planId: (body.planId || 'starter') as SellerPlanId,
      evidencePaths: Array.isArray(body.evidencePaths)
        ? body.evidencePaths.map(String)
        : [],
      termsAccepted: Boolean(body.termsAccepted),
    });

    return NextResponse.json({
      ok: true,
      seller,
      snapshot: await getNairaScoutSnapshot(identity.userId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Seller onboarding failed.' }, { status: 400 });
  }
}
