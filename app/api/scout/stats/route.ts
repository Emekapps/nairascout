import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError } from '@/lib/auth/rbac';
import { extractSessionIdentityFromRequest } from '@/lib/auth/session';
import { getScoutOverviewStats } from '@/lib/nairascout-store';
import type { StatsPeriodPreset } from '@/lib/utils/africa-lagos';

const ALLOWED_PERIODS = new Set<StatsPeriodPreset>([
  'today',
  'last_7_days',
  'last_30_days',
  'this_month',
  'previous_month',
  'custom',
]);

// NS-SCT-019 - NS-SCT-026 & NS-SCT-054 - NS-SCT-064: Scout Overview & Referral Statistics (Africa/Lagos)
export async function GET(req: NextRequest) {
  const identity = await extractSessionIdentityFromRequest(req);
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const rawPeriod = req.nextUrl.searchParams.get('period') as StatsPeriodPreset | null;
  const period: StatsPeriodPreset =
    rawPeriod && ALLOWED_PERIODS.has(rawPeriod) ? rawPeriod : 'last_30_days';
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  try {
    const stats = await getScoutOverviewStats(identity.userId, { period, from, to });
    return NextResponse.json(stats);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load Scout statistics.' }, { status: 500 });
  }
}
