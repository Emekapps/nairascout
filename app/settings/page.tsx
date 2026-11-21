import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { getNairaScoutSnapshot } from '@/lib/nairascout-store';
import SettingsView from '@/components/SettingsView';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const identity = await extractSessionIdentityFromRequest();
  const initialSnapshot = getNairaScoutSnapshot(identity?.userId ?? null);
  return <SettingsView initialSnapshot={initialSnapshot} />;
}
