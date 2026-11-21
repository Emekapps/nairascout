import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { getAdminConsoleSnapshot, getNairaScoutSnapshot } from '@/lib/nairascout-store';
import AdminConsoleView, { AdminSection } from '@/components/AdminConsoleView';

export async function renderAdminPage(section: AdminSection) {
  const identity = await extractSessionIdentityFromRequest();
  const snapshot = getNairaScoutSnapshot(identity?.userId ?? null);

  let initialAdminData = null;
  if (identity && snapshot.activeScout?.adminRole) {
    try {
      initialAdminData = getAdminConsoleSnapshot(identity.userId);
    } catch {
      initialAdminData = null;
    }
  }

  return (
    <AdminConsoleView
      initialSection={section}
      authenticated={snapshot.authenticated}
      adminBootstrapAvailable={snapshot.adminBootstrapAvailable}
      initialAdminData={initialAdminData}
    />
  );
}
