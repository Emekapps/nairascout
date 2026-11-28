// NS-UI-310, NS-UI-317: Dedicated Seller Setup page
import { loadServerPageSnapshot } from '@/lib/page-snapshot';
import DedicatedAppView from '@/components/DedicatedAppView';

export const dynamic = 'force-dynamic';

export default async function SellerSetupPage() {
  const initialSnapshot = await loadServerPageSnapshot();
  return <DedicatedAppView initialSnapshot={initialSnapshot} section="seller-setup" />;
}
