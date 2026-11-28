// NS-UI-310, NS-UI-319: Dedicated Commission Calculator page
import { loadServerPageSnapshot } from '@/lib/page-snapshot';
import DedicatedAppView from '@/components/DedicatedAppView';

export const dynamic = 'force-dynamic';

export default async function NetworkCalculatorPage() {
  const initialSnapshot = await loadServerPageSnapshot();
  return <DedicatedAppView initialSnapshot={initialSnapshot} section="network-calculator" />;
}
