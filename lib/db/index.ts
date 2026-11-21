import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AuthorizationError } from '@/lib/auth/rbac';
import * as schema from './schema';
import * as commerceSchema from './commerce-schema';

const combinedSchema = { ...schema, ...commerceSchema };

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getDb() {
  if (!isPostgresConfigured()) {
    return null;
  }

  if (!globalForDb.__pgClient) {
    globalForDb.__pgClient = postgres(process.env.DATABASE_URL!, {
      prepare: false,
      max: 10,
    });
  }

  return drizzle(globalForDb.__pgClient, { schema: combinedSchema });
}

export type NairaScoutDb = NonNullable<ReturnType<typeof getDb>>;

export function requireDb(): NairaScoutDb {
  const db = getDb();
  if (!db) {
    throw new AuthorizationError(
      'PostgreSQL database (DATABASE_URL) is not configured in environment secrets.',
      503,
      'DB_NOT_CONFIGURED'
    );
  }
  return db;
}
