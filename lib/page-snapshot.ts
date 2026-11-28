import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import {
  ensureUserProvisionedInDb,
  getNairaScoutSnapshot,
  type NairaScoutSnapshot,
} from '@/lib/nairascout-store';

// NS-UI-310: Shared server page snapshot loader for dedicated App Router pages
export async function loadServerPageSnapshot(options?: {
  referralEventQuery?: string | null;
  referralScoutUsername?: string | null;
}): Promise<NairaScoutSnapshot> {
  const cookieStore = await cookies();
  const refEvent =
    options?.referralEventQuery || cookieStore.get('ns_ref_event')?.value || null;
  const refScout =
    options?.referralScoutUsername || cookieStore.get('ns_ref_scout')?.value || null;
  const identity = await extractSessionIdentityFromRequest();

  if (identity && isPostgresConfigured()) {
    try {
      await ensureUserProvisionedInDb(identity, {
        referralEventId: refEvent,
        referralScoutUsername: refScout,
      });
    } catch (err) {
      console.error('[loadServerPageSnapshot] PostgreSQL provisioning failed:', formatPostgresError(err), err);
    }
  }

  return getNairaScoutSnapshot(identity?.userId ?? null, refEvent);
}
