import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { formatPostgresError, isPostgresConfigured } from '@/lib/db';
import {
  ensureUserProvisionedInDb,
  getNairaScoutSnapshot,
  getPublishedHelpArticles,
} from '@/lib/nairascout-store';
import HelpCentreView from '@/components/trust/HelpCentreView';

export const dynamic = 'force-dynamic';

// NS-FND-005: Public Help Centre & Knowledge Base route (/help)
export default async function HelpCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; article?: string }>;
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
        '[HelpCentrePage] PostgreSQL provisioning failed:',
        formatPostgresError(err),
        err
      );
    }
  }

  const [articles, snapshot] = await Promise.all([
    getPublishedHelpArticles(),
    getNairaScoutSnapshot(identity?.userId ?? null),
  ]);

  return (
    <HelpCentreView
      initialArticles={articles}
      initialSnapshot={snapshot}
      initialQuery={params.q || ''}
      initialCategory={params.category || 'ALL'}
      initialArticleSlug={params.article || ''}
    />
  );
}
