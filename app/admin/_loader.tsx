import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import {
  ensureUserProvisionedInDb,
  getAdminConsoleSnapshot,
  getNairaScoutSnapshot,
} from '@/lib/nairascout-store';
import AdminConsoleView, { AdminSection } from '@/components/AdminConsoleView';

export async function renderAdminPage(section: AdminSection) {
  const cookieStore = await cookies();
  const identity = await extractSessionIdentityFromRequest();

  if (identity && isPostgresConfigured()) {
    try {
      await ensureUserProvisionedInDb(identity, {
        referralEventId: cookieStore.get('ns_ref_event')?.value || null,
        referralScoutUsername: cookieStore.get('ns_ref_scout')?.value || null,
      });
    } catch (err) {
      console.error('[renderAdminPage] PostgreSQL provisioning failed:', formatPostgresError(err), err);
    }
  }

  const snapshot = await getNairaScoutSnapshot(identity?.userId ?? null);

  let initialAdminData = null;
  if (identity && snapshot.activeScout?.adminRole) {
    try {
      initialAdminData = await getAdminConsoleSnapshot(identity.userId);
    } catch {
      initialAdminData = null;
    }
  }

  return (
    <AdminConsoleView
      initialSection={section}
      authenticated={snapshot.authenticated}
      initialAdminData={initialAdminData}
    />
  );
}
