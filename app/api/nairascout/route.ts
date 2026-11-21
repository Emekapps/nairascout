import { NextRequest, NextResponse } from 'next/server';
import {
  advanceOrderStatus,
  createOrderFromCheckout,
  createReferralEvent,
  getNairaScoutSnapshot,
  inviteToScoutsList,
  manageContact,
  OrderFulfilmentStatus,
  publishSellerListing,
  respondToInvitation,
  SellerPlanId,
  submitSupportCase,
  SupportCase,
  updateInvitePolicy,
  upgradeSellerPlan,
} from '@/lib/nairascout-store';
import {
  AncestorNode,
  calculateThirteenGenerationCommissions,
} from '@/lib/commission-engine';

export async function GET() {
  return NextResponse.json(getNairaScoutSnapshot());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string;

    if (action === 'checkout') {
      const res = createOrderFromCheckout({
        productListingId: String(body.productListingId || ''),
        quantity: Number(body.quantity || 1),
        referralEventId: body.referralEventId ? String(body.referralEventId) : null,
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ order: res.order, snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'advance_order') {
      const res = advanceOrderStatus({
        orderId: String(body.orderId || ''),
        nextStatus: body.nextStatus as OrderFulfilmentStatus,
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ order: res.order, snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'refer_product') {
      const res = createReferralEvent({
        productListingId: String(body.productListingId || ''),
        recipientScoutId: String(body.recipientScoutId || ''),
        note: String(body.note || ''),
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ event: res.event, snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'invite_scout') {
      const res = inviteToScoutsList({ targetScoutId: String(body.targetScoutId || '') });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ invitation: res.invitation, snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'respond_invite') {
      const res = respondToInvitation({
        invitationId: String(body.invitationId || ''),
        action: body.decision as 'accept' | 'reject' | 'withdraw',
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'manage_contact') {
      const res = manageContact({
        contactId: String(body.contactId || ''),
        action: body.operation as 'remove' | 'toggle_block',
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'create_listing') {
      const res = publishSellerListing({
        title: String(body.title || ''),
        category: String(body.category || 'Home & Craft'),
        priceNaira: Number(body.priceNaira || 0),
        deliveryFeeNaira: Number(body.deliveryFeeNaira || 0),
        stock: Number(body.stock || 1),
        description: String(body.description || ''),
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ listing: res.listing, snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'update_seller_plan') {
      upgradeSellerPlan(body.planId as SellerPlanId);
      return NextResponse.json({ snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'update_invite_policy') {
      updateInvitePolicy(body.policy as 'anyone' | 'contacts_only' | 'disabled');
      return NextResponse.json({ snapshot: getNairaScoutSnapshot() });
    }

    if (action === 'submit_support') {
      const res = submitSupportCase({
        topic: (body.topic || 'commission') as SupportCase['topic'],
        subject: String(body.subject || ''),
        details: String(body.details || ''),
      });
      return NextResponse.json({ supportCase: res.supportCase, snapshot: getNairaScoutSnapshot() });
    }

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

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
}
