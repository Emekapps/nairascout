import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import { ensureUserProvisionedInDb, getNairaScoutSnapshot } from '@/lib/nairascout-store';
import NotificationsView from '@/components/NotificationsView';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const identity = await extractSessionIdentityFromRequest();

  if (identity && isPostgresConfigured()) {
    try {
      await ensureUserProvisionedInDb(identity, {
        referralEventId: cookieStore.get('ns_ref_event')?.value || null,
        referralScoutUsername: cookieStore.get('ns_ref_scout')?.value || null,
      });
    } catch (err) {
      console.error(
        '[NotificationsPage] PostgreSQL provisioning failed:',
        formatPostgresError(err),
        err
      );
    }
  }

  const initialSnapshot = await getNairaScoutSnapshot(identity?.userId ?? null);
  return <NotificationsView initialSnapshot={initialSnapshot} />;
}
