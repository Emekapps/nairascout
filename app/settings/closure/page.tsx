import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import { ensureUserProvisionedInDb, getNairaScoutSnapshot } from '@/lib/nairascout-store';
import ClosureView from '@/components/ClosureView';

export const dynamic = 'force-dynamic';

export default async function SettingsClosurePage() {
  const cookieStore = await cookies();
  const identity = await extractSessionIdentityFromRequest();

  if (identity && isPostgresConfigured()) {
    try {
      await ensureUserProvisionedInDb(identity, {
        referralEventId: cookieStore.get('ns_ref_event')?.value || null,
        referralScoutUsername: cookieStore.get('ns_ref_scout')?.value || null,
      });
    } catch (err) {
      console.error('[SettingsClosurePage] PostgreSQL provisioning failed:', formatPostgresError(err), err);
    }
  }

  const initialSnapshot = await getNairaScoutSnapshot(identity?.userId ?? null);
  return <ClosureView initialSnapshot={initialSnapshot} />;
}
