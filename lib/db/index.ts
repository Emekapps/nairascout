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
    const dbUrl = process.env.DATABASE_URL!.trim();
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    const disableSsl = dbUrl.includes('sslmode=disable');

    globalForDb.__pgClient = postgres(dbUrl, {
      prepare: false,
      max: 10,
      ...(isLocal || disableSsl ? {} : { ssl: 'require' }),
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

export interface FormattedPostgresError {
  code: string | null;
  message: string;
  detail: string | null;
  hint: string | null;
  constraint: string | null;
  table: string | null;
  column: string | null;
  summary: string;
}

export function formatPostgresError(err: unknown): FormattedPostgresError {
  const seen = new Set<unknown>();
  let current: unknown = err;
  let pgLike: Record<string, unknown> | null = null;
  let topMessage = err instanceof Error ? err.message : String(err);

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const rec = current as Record<string, unknown>;
    if (
      typeof rec.code === 'string' ||
      typeof rec.detail === 'string' ||
      typeof rec.constraint_name === 'string' ||
      typeof rec.table_name === 'string'
    ) {
      pgLike = rec;
      break;
    }
    current = rec.cause;
  }

  const code = typeof pgLike?.code === 'string' ? pgLike.code : null;
  const pgMessage =
    typeof pgLike?.message === 'string' && pgLike.message.trim()
      ? pgLike.message.trim()
      : topMessage;
  const detail = typeof pgLike?.detail === 'string' && pgLike.detail.trim() ? pgLike.detail.trim() : null;
  const hint = typeof pgLike?.hint === 'string' && pgLike.hint.trim() ? pgLike.hint.trim() : null;
  const constraint =
    typeof pgLike?.constraint_name === 'string'
      ? pgLike.constraint_name
      : typeof pgLike?.constraint === 'string'
        ? pgLike.constraint
        : null;
  const table =
    typeof pgLike?.table_name === 'string'
      ? pgLike.table_name
      : typeof pgLike?.table === 'string'
        ? pgLike.table
        : null;
  const column =
    typeof pgLike?.column_name === 'string'
      ? pgLike.column_name
      : typeof pgLike?.column === 'string'
        ? pgLike.column
        : null;

  const parts: string[] = [];
  if (code) {
    parts.push(`[PG ${code}] ${pgMessage}`);
  } else {
    parts.push(pgMessage || 'Unknown PostgreSQL error');
  }
  if (table || constraint) {
    parts.push(
      `(${[table ? `table: ${table}` : null, column ? `column: ${column}` : null, constraint ? `constraint: ${constraint}` : null]
        .filter(Boolean)
        .join(', ')})`
    );
  }
  if (detail) {
    parts.push(`— ${detail}`);
  }

  return {
    code,
    message: pgMessage,
    detail,
    hint,
    constraint,
    table,
    column,
    summary: parts.join(' '),
  };
}
