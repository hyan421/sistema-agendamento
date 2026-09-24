import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PoolClient } from 'pg';

import { closeDatabase, pool } from './pool.js';

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(120) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function migrate(): Promise<void> {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [874231]);
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    const applied = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations',
    );
    const appliedVersions = new Set(applied.rows.map((row) => row.version));

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (appliedVersions.has(version)) continue;
      const sql = await readFile(join(migrationsDirectory, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
        version,
      ]);
      console.log(`Migration aplicada: ${version}`);
    }

    await client.query('COMMIT');
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [874231]);
    client.release();
    await closeDatabase();
  }
}

await migrate().catch((error: unknown) => {
  console.error('Falha ao executar migrations.', error);
  process.exitCode = 1;
});
