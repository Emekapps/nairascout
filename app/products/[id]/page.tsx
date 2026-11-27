import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowLeft, Package } from 'lucide-react';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import { ensureUserProvisionedInDb, getNairaScoutSnapshot } from '@/lib/nairascout-store';
import ProductDetailView from '@/components/products/ProductDetailView';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string; refEvent?: string; refScout?: string }>;
}

// NS-UI-023: Dedicated Product Detail Page (/products/[id]) with referral link & cookie attribution
export default async function ProductDetailPage({ params, searchParams }: ProductPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const refEvent =
    query.ref || query.refEvent || cookieStore.get('ns_ref_event')?.value || null;
  const refScout = query.refScout || cookieStore.get('ns_ref_scout')?.value || null;

  const identity = await extractSessionIdentityFromRequest();

  if (identity && isPostgresConfigured()) {
    try {
      await ensureUserProvisionedInDb(identity, {
        referralEventId: refEvent,
        referralScoutUsername: refScout,
      });
    } catch (err) {
      console.error('[ProductDetailPage] PostgreSQL provisioning failed:', formatPostgresError(err), err);
    }
  }

  const snapshot = await getNairaScoutSnapshot(identity?.userId ?? null, refEvent);
  const decodedId = decodeURIComponent(id);
  const product =
    snapshot.products.find((p) => p.id === decodedId || p.productId === decodedId) ??
    snapshot.sellerListings.find((p) => p.id === decodedId || p.productId === decodedId) ??
    null;

  if (!product) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <Package className="w-8 h-8 text-muted-foreground mx-auto" aria-hidden="true" />
          <h1 className="font-sans text-xl font-bold text-foreground">
            Product Listing Unavailable
          </h1>
          <p className="text-sm text-muted-foreground">
            This product listing may have expired, been unpublished, or does not exist.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#2E5339] text-[#FFFFFF] dark:bg-[#3A6B49] dark:text-[#FFFFFF]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  const activeReferralEvent = refEvent
    ? (snapshot.referralsInbox.find(
        (r) => r.id === refEvent && r.productListingId === product.id
      ) ?? null)
    : null;

  return (
    <ProductDetailView
      initialSnapshot={snapshot}
      product={product}
      initialReferralEvent={activeReferralEvent}
    />
  );
}
