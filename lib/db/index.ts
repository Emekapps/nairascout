import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

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

  return drizzle(globalForDb.__pgClient, { schema });
}
