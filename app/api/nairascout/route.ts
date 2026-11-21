import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import {
  extractSessionIdentityFromRequest,
  verifyMutationOrigin,
} from '@/lib/auth/session';
import {
  advanceOrderStatus,
  createOrderFromCheckout,
  createReferralEventForActor,
  getNairaScoutSnapshot,
  inviteToScoutsListForActor,
  manageRelationshipForActor,
  OrderFulfilmentStatus,
  reportAbuseForActor,
  respondToInvitationForActor,
  SellerPlanId,
  submitSupportCaseForActor,
  SupportCase,
  upgradeSellerPlanForActor,
} from '@/lib/nairascout-store';
import {
  AncestorNode,
  calculateThirteenGenerationCommissions,
} from '@/lib/commission-engine';

export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  const refEvent = req.nextUrl.searchParams.get('refEvent');
  return NextResponse.json(getNairaScoutSnapshot(identity?.userId ?? null, refEvent));
}

export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = body?.action as string;

    // Public stateless simulator does not require auth
    if (action === 'simulate_commission') {
      const merchNaira = Number(body.merchandiseNaira || 100000);
      const depth = Math.max(0, Math.min(13, Number(body.depth || 13)));
      const ineligibleGens: number[] = Array.isArray(body.ineligibleGens)
        ? body.ineligibleGens
        : [];
      const isReferral = body.isReferral !== false;

      const syntheticAncestry: AncestorNode[] = Array.from({ length: depth }, (_, i) => {
        const gen = i + 1;
        const isIneligible = ineligibleGens.includes(gen);
        return {
          generation: gen,
          scoutId: `sim_gen_${gen}`,
          handle: `ancestor_g${gen}`,
          displayName: `Generation ${gen} Scout`,
          eligible: !isIneligible,
          ineligibilityReason: isIneligible ? 'Simulated ineligible ancestor (no promotion)' : undefined,
        };
      });

      const breakdown = calculateThirteenGenerationCommissions(
        Math.round(merchNaira * 100),
        syntheticAncestry,
        isReferral
      );
      return NextResponse.json({ breakdown });
    }

    const identity = await extractSessionIdentityFromRequest(req);
    if (!identity) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in or verify via Email OTP.', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    const actorUserId = identity.userId;

    if (action === 'checkout') {
      const order = createOrderFromCheckout(actorUserId, {
        productListingId: String(body.productListingId || ''),
        quantity: Number(body.quantity || 1),
        referralEventId: body.referralEventId ? String(body.referralEventId) : null,
      });
      return NextResponse.json({ order, snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'advance_order') {
      const order = advanceOrderStatus(actorUserId, {
        orderId: String(body.orderId || ''),
        nextStatus: body.nextStatus as OrderFulfilmentStatus,
      });
      return NextResponse.json({ order, snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'refer_product') {
      const event = createReferralEventForActor(actorUserId, {
        productListingId: String(body.productListingId || ''),
        recipientScoutId: String(body.recipientScoutId || ''),
        note: String(body.note || ''),
      });
      return NextResponse.json({ event, snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'invite_scout') {
      const invitation = inviteToScoutsListForActor(
        actorUserId,
        String(body.targetScoutId || '')
      );
      return NextResponse.json({ invitation, snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'respond_invite') {
      respondToInvitationForActor(actorUserId, {
        invitationId: String(body.invitationId || ''),
        decision: body.decision as 'accept' | 'reject' | 'withdraw',
      });
      return NextResponse.json({ snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'manage_contact') {
      manageRelationshipForActor(actorUserId, {
        contactId: body.contactId ? String(body.contactId) : undefined,
        targetUserId: body.targetUserId ? String(body.targetUserId) : undefined,
        operation: body.operation as 'remove' | 'block' | 'unblock',
      });
      return NextResponse.json({ snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'report_abuse') {
      const report = reportAbuseForActor(actorUserId, {
        reportedUserId: String(body.reportedUserId || ''),
        referralEventId: body.referralEventId ? String(body.referralEventId) : null,
        reason: String(body.reason || ''),
        description: String(body.description || ''),
      });
      return NextResponse.json({ report, snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'update_seller_plan') {
      upgradeSellerPlanForActor(actorUserId, body.planId as SellerPlanId);
      return NextResponse.json({ snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    if (action === 'submit_support') {
      const supportCase = submitSupportCaseForActor(actorUserId, {
        topic: (body.topic || 'commission') as SupportCase['topic'],
        subject: String(body.subject || ''),
        details: String(body.details || ''),
      });
      return NextResponse.json({ supportCase, snapshot: getNairaScoutSnapshot(actorUserId) });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
}
