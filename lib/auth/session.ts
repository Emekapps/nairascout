import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  capabilityRestrictions,
  platformAdminRoles,
  scoutProfiles,
  sellerProfiles,
  sellerTeamMembers,
  users,
  verificationRecords,
} from '@/lib/db/schema';
import {
  ActiveRestrictionDTO,
  CapabilityCode,
  normalizeAdminRole,
  normalizeTeamRole,
  RestrictionScope,
  SubscriptionPlan,
  UserAuthContext,
} from '@/lib/auth/rbac';
import {
  normalizeAccountStatus,
  normalizeSellerStatus,
  normalizeSubscriptionStatus,
  normalizeVerificationStatus,
} from '@/lib/auth/transitions';
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
 * Loads UserAuthContext directly from PostgreSQL via Drizzle ORM,
 * including granular capability_restrictions and normalized 4-axis statuses.
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

  let activeRestrictions: ActiveRestrictionDTO[] = [];
  try {
    const restrictionRows = await db
      .select()
      .from(capabilityRestrictions)
      .where(
        and(
          eq(capabilityRestrictions.userId, userId),
          eq(capabilityRestrictions.status, 'ACTIVE')
        )
      );
    const now = Date.now();
    activeRestrictions = restrictionRows
      .filter((r) => !r.expiresAt || r.expiresAt.getTime() > now)
      .map((r) => ({
        id: r.id,
        scope: r.scope as RestrictionScope,
        capabilityCode: r.capabilityCode as CapabilityCode,
        resourceId: r.resourceId ?? null,
        reason: r.reason,
        status: 'ACTIVE',
        imposedBy: r.imposedBy,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
  } catch {
    // Graceful safety if capability_restrictions table check hasn't been reached yet
    activeRestrictions = [];
  }

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
      sellerStatus: normalizeSellerStatus(targetSeller.sellerStatus),
      sellerVerificationStatus: normalizeVerificationStatus(sellerVerif?.status ?? 'NOT_STARTED'),
      subscriptionPlan: targetSeller.subscriptionPlan as SubscriptionPlan,
      subscriptionStatus: normalizeSubscriptionStatus(targetSeller.subscriptionStatus),
      role: teamMemberRecord ? normalizeTeamRole(teamMemberRecord.role) : 'BUSINESS_OWNER',
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
    accountStatus: normalizeAccountStatus(user.accountStatus),
    activeRestrictions,
    seller: sellerCtx,
    adminRole: normalizeAdminRole(adminRows[0]?.adminRole),
  };
}

/**
 * Extracts verified Supabase Auth identity exclusively via @supabase/ssr.
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
