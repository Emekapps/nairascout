import { redirect } from 'next/navigation';
import { getReferralEventDestinationById } from '@/lib/nairascout-store';

export const dynamic = 'force-dynamic';

interface ReferralRedirectPageProps {
  params: Promise<{ referralEventId: string }>;
}

// NS-UI-023: Route /r/[referralEventId] directly to /products/[id]?ref=[referralEventId]
export default async function ReferralRedirectPage({ params }: ReferralRedirectPageProps) {
  const { referralEventId } = await params;
  const decodedId = decodeURIComponent(referralEventId);
  const destination = await getReferralEventDestinationById(decodedId);

  if (destination?.productListingId) {
    const query = new URLSearchParams({ ref: decodedId });
    if (destination.senderHandle) {
      query.set('refScout', destination.senderHandle);
    }
    redirect(`/products/${encodeURIComponent(destination.productListingId)}?${query.toString()}`);
  }

  redirect(`/?refEvent=${encodeURIComponent(decodedId)}`);
}
