import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  platformAdminRoles,
  scoutProfiles,
  sellerProfiles,
  sellerTeamMembers,
  users,
  verificationRecords,
} from '@/lib/db/schema';
import type {
  AccountStatus,
  AdminRole,
  SellerStatus,
  SubscriptionPlan,
  UserAuthContext,
  VerificationStatus,
} from '@/lib/auth/rbac';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface SupabaseSessionIdentity {
  userId: string;
  email: string;
  phone: string | null;
  userMetadata: Record<string, unknown>;
}

/**
 * Verifies same-origin for cookie-authenticated state-changing requests.
 */
export function verifyMutationOrigin(req: NextRequest): boolean {
  const requestedWith = req.headers.get('x-requested-with');
  if (requestedWith === 'XMLHttpRequest' || requestedWith === 'NairaScout') {
    return true;
  }
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

/**
 * Loads UserAuthContext directly from PostgreSQL via Drizzle ORM.
 */
export async function loadDbAuthContext(userId: string): Promise<UserAuthContext | null> {
  const db = getDb();
  if (!db) return null;

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  const adminRows = await db
    .select()
    .from(platformAdminRoles)
    .where(eq(platformAdminRoles.userId, userId))
    .limit(1);

  const ownedSellerRows = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.ownerUserId, userId))
    .limit(1);

  let sellerCtx: UserAuthContext['seller'] = null;
  let targetSeller = ownedSellerRows[0];
  let teamMemberRecord: typeof sellerTeamMembers.$inferSelect | undefined;

  if (!targetSeller) {
    const memberRows = await db
      .select()
      .from(sellerTeamMembers)
      .where(eq(sellerTeamMembers.userId, userId));
    const activeMember = memberRows.find((m) => m.status === 'ACTIVE');
    if (activeMember) {
      teamMemberRecord = activeMember;
      const parentRows = await db
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.id, activeMember.sellerProfileId))
        .limit(1);
      targetSeller = parentRows[0];
    }
  }

  if (targetSeller) {
    const verifRows = await db
      .select()
      .from(verificationRecords)
      .where(eq(verificationRecords.sellerProfileId, targetSeller.id));
    const sellerVerif = verifRows.find((v) => v.category === 'SELLER');

    sellerCtx = {
      sellerProfileId: targetSeller.id,
      sellerType: targetSeller.sellerType,
      sellerStatus: targetSeller.sellerStatus as SellerStatus,
      sellerVerificationStatus: (sellerVerif?.status ?? 'NOT_SUBMITTED') as VerificationStatus,
      subscriptionPlan: targetSeller.subscriptionPlan as SubscriptionPlan,
      subscriptionStatus: targetSeller.subscriptionStatus,
      role: teamMemberRecord ? teamMemberRecord.role : 'BUSINESS_OWNER',
      permissions: teamMemberRecord
        ? teamMemberRecord.permissions
        : {
            canManageListings: true,
            canManageOrders: true,
            canViewAnalytics: true,
            canManageBilling: true,
            canManageTeam: true,
          },
    };
  }

  await db.select().from(scoutProfiles).where(eq(scoutProfiles.userId, userId)).limit(1);

  return {
    userId: user.id,
    email: user.email,
    accountStatus: user.accountStatus as AccountStatus,
    seller: sellerCtx,
    adminRole: (adminRows[0]?.adminRole as AdminRole | undefined) ?? null,
  };
}

/**
 * Extracts verified Supabase Auth identity exclusively via @supabase/ssr.
 * Never issues or accepts mock/in-memory session tokens.
 */
export async function extractSessionIdentityFromRequest(
  req?: NextRequest
): Promise<SupabaseSessionIdentity | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  let bearerJwt: string | undefined;
  if (req) {
    const auth = req.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      bearerJwt = auth.slice(7).trim();
    }
  }

  const { data, error } = bearerJwt
    ? await supabase.auth.getUser(bearerJwt)
    : await supabase.auth.getUser();

  if (error || !data.user || !data.user.email) {
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email,
    phone: data.user.phone ?? null,
    userMetadata: (data.user.user_metadata as Record<string, unknown>) || {},
  };
}
