import { cookies } from 'next/headers';
import {
  extractSessionIdentityFromRequest,
  getAdminMfaAssurance,
} from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import {
  ensureUserProvisionedInDb,
  getAdminConsoleSnapshot,
  getNairaScoutSnapshot,
} from '@/lib/nairascout-store';
import AdminConsoleView, { AdminSection } from '@/components/AdminConsoleView';

// NS-AUT-006: Mandatory Admin TOTP MFA (aal2) gate on all /admin/* routes
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
  let mfaRequired = false;
  let mfaHasFactor = false;

  if (identity && snapshot.activeScout?.adminRole) {
    const mfa = await getAdminMfaAssurance();
    if (mfa.currentLevel !== 'aal2') {
      mfaRequired = true;
      mfaHasFactor = mfa.hasVerifiedTotp;
    } else {
      try {
        initialAdminData = await getAdminConsoleSnapshot(identity.userId);
      } catch {
        initialAdminData = null;
      }
    }
  }

  return (
    <AdminConsoleView
      initialSection={section}
      authenticated={snapshot.authenticated}
      initialAdminData={initialAdminData}
      mfaRequired={mfaRequired}
      mfaHasFactor={mfaHasFactor}
    />
  );
}
