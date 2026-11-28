// NS-UI-310, NS-UI-319: Dedicated Scouts List page
import { loadServerPageSnapshot } from '@/lib/page-snapshot';
import DedicatedAppView from '@/components/DedicatedAppView';

export const dynamic = 'force-dynamic';

export default async function NetworkScoutsPage() {
  const initialSnapshot = await loadServerPageSnapshot();
  return <DedicatedAppView initialSnapshot={initialSnapshot} section="network-scouts" />;
}
