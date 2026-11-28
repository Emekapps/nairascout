// NS-UI-310, NS-UI-317: Dedicated Seller Hub page
import { loadServerPageSnapshot } from '@/lib/page-snapshot';
import DedicatedAppView from '@/components/DedicatedAppView';

export const dynamic = 'force-dynamic';

export default async function SellerHubPage() {
  const initialSnapshot = await loadServerPageSnapshot();
  return <DedicatedAppView initialSnapshot={initialSnapshot} section="seller-hub" />;
}
