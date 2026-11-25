import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import { ensureUserProvisionedInDb, getNairaScoutSnapshot } from '@/lib/nairascout-store';
import NairaScoutApp from '@/components/NairaScoutApp';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{ refEvent?: string; refScout?: string; tab?: string }>;
}

const VALID_TABS = new Set(['marketplace', 'referrals', 'network', 'wallet', 'seller']);

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const refEvent = params.refEvent || cookieStore.get('ns_ref_event')?.value || null;
  const refScout = params.refScout || cookieStore.get('ns_ref_scout')?.value || null;
  const identity = await extractSessionIdentityFromRequest();

  if (identity && isPostgresConfigured()) {
    try {
      await ensureUserProvisionedInDb(identity, {
        referralEventId: refEvent,
        referralScoutUsername: refScout,
      });
    } catch (err) {
      console.error('[HomePage] PostgreSQL provisioning failed:', formatPostgresError(err), err);
    }
  }

  const initialSnapshot = await getNairaScoutSnapshot(identity?.userId ?? null, refEvent);
  const requestedTab = params.tab && VALID_TABS.has(params.tab) ? params.tab : undefined;

  return (
    <NairaScoutApp
      initialSnapshot={initialSnapshot}
      initialRefEvent={params.refEvent ?? null}
      initialTab={
        requestedTab as 'marketplace' | 'referrals' | 'network' | 'wallet' | 'seller' | undefined
      }
    />
  );
}
