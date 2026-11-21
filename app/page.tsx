import { getNairaScoutSnapshot } from '@/lib/nairascout-store';
import NairaScoutApp from '@/components/NairaScoutApp';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const initialSnapshot = getNairaScoutSnapshot();
  return <NairaScoutApp initialSnapshot={initialSnapshot} />;
}
