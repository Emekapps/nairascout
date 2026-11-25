import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import {
  ensureUserProvisionedInDb,
  getNairaScoutSnapshot,
  getPublishedPlatformPolicies,
} from '@/lib/nairascout-store';
import ProgrammeRulesView from '@/components/trust/ProgrammeRulesView';

export const dynamic = 'force-dynamic';

// NS-FND-006: Live Programme Rules & Platform Boundaries route (/programme-rules)
export default async function ProgrammeRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ policy?: string }>;
}) {
  const params = await searchParams;
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
        '[ProgrammeRulesPage] PostgreSQL provisioning failed:',
        formatPostgresError(err),
        err
      );
    }
  }

  const [policies, snapshot] = await Promise.all([
    getPublishedPlatformPolicies(),
    getNairaScoutSnapshot(identity?.userId ?? null),
  ]);

  return (
    <ProgrammeRulesView
      initialPolicies={policies}
      initialSnapshot={snapshot}
      initialPolicySlug={params.policy || 'programme-rules'}
    />
  );
}
