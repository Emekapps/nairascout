import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
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

const globalForAuth = globalThis as unknown as {
  __nsSessionKey?: Buffer;
};

function getSessionSecretKey(): Buffer {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }
  if (!globalForAuth.__nsSessionKey) {
    globalForAuth.__nsSessionKey = crypto.randomBytes(32);
  }
  return globalForAuth.__nsSessionKey;
}

export const SESSION_COOKIE_NAME = 'ns_session';

export interface SessionTokenPayload {
  userId: string;
  email: string;
  issuedAt: number;
  exp: number;
}

export function signSessionToken(userId: string, email: string): string {
  const now = Date.now();
  const payload: SessionTokenPayload = {
    userId,
    email,
    issuedAt: now,
    exp: now + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecretKey())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | null | undefined): SessionTokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expected = crypto
    .createHmac('sha256', getSessionSecretKey())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

/**
 * Verifies same-origin for cookie-authenticated state-changing requests.
 */
export function verifyMutationOrigin(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return true;
  }
  const requestedWith = req.headers.get('x-requested-with');
  if (requestedWith === 'XMLHttpRequest' || requestedWith === 'NairaScout') {
    return true;
  }
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return true; // Same-origin server/curl call without Origin header
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

export function buildSessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${7 * 24 * 60 * 60}`;
}

export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`;
}

/**
 * Loads UserAuthContext from PostgreSQL via Drizzle ORM if DATABASE_URL is configured.
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
      .where(eq(sellerTeamMembers.userId, userId))
      .limit(1);
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

  // Ensure scoutProfile lookup exists
  await db.select().from(scoutProfiles).where(eq(scoutProfiles.userId, userId)).limit(1);

  return {
    userId: user.id,
    email: user.email,
    accountStatus: user.accountStatus as AccountStatus,
    seller: sellerCtx,
    adminRole: (adminRows[0]?.adminRole as AdminRole | undefined) ?? null,
  };
}

export async function extractSessionIdentityFromRequest(req?: NextRequest): Promise<{
  userId: string;
  email: string;
  token: string | null;
} | null> {
  // 1. Check Supabase SSR auth if configured
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user && data.user.email) {
      return { userId: data.user.id, email: data.user.email, token: null };
    }
  }

  // 2. Check Authorization: Bearer header
  let bearerToken: string | null = null;
  if (req) {
    const auth = req.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      bearerToken = auth.slice(7).trim();
    }
  } else {
    try {
      const hdrs = await headers();
      const auth = hdrs.get('authorization');
      if (auth?.startsWith('Bearer ')) {
        bearerToken = auth.slice(7).trim();
      }
    } catch {
      // ignore outside request scope
    }
  }

  if (bearerToken) {
    const verified = verifySessionToken(bearerToken);
    if (verified) {
      return { userId: verified.userId, email: verified.email, token: bearerToken };
    }
  }

  // 3. Check HttpOnly cookie
  let cookieToken: string | undefined;
  if (req) {
    cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    try {
      const cookieStore = await cookies();
      cookieToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // ignore outside request scope
    }
  }

  if (cookieToken) {
    const verified = verifySessionToken(cookieToken);
    if (verified) {
      return { userId: verified.userId, email: verified.email, token: cookieToken };
    }
  }

  return null;
}
