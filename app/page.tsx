import { cookies } from 'next/headers';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { getNairaScoutSnapshot } from '@/lib/nairascout-store';
import NairaScoutApp from '@/components/NairaScoutApp';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{ refEvent?: string; refScout?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const refEvent = params.refEvent || cookieStore.get('ns_ref_event')?.value || null;
  const identity = await extractSessionIdentityFromRequest();
  const initialSnapshot = getNairaScoutSnapshot(identity?.userId ?? null, refEvent);

  return (
    <NairaScoutApp
      initialSnapshot={initialSnapshot}
      initialRefEvent={params.refEvent ?? null}
    />
  );
}
