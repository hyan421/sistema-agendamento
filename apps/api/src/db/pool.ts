import { Pool, type QueryResult, type QueryResultRow } from 'pg';

import { env } from '../config/env.js';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, values);
}

export async function verifyDatabaseConnection(): Promise<void> {
  await query('SELECT 1');
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
