import { randomBytes } from 'node:crypto';
import { createDb } from './index.js';
import type { DbHandle } from './index.js';
import { runMigrations } from './migrate.js';
import pg from 'pg';

/**
 * A fresh, migrated database per test file. Uses TEST_DATABASE_URL (any
 * database on a server where the user may CREATE DATABASE); defaults to the
 * local Postgres. Dropped in `drop()`.
 */
export async function createTestDb(): Promise<DbHandle & { drop: () => Promise<void> }> {
  const admin = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost/postgres';
  const name = `parallax_test_${randomBytes(6).toString('hex')}`;
  const url = new URL(admin);
  url.pathname = `/${name}`;

  const client = new pg.Client({ connectionString: admin });
  await client.connect();
  await client.query(`CREATE DATABASE ${name}`);
  await client.end();

  await runMigrations(url.toString());
  const handle = createDb(url.toString(), { max: 4 });

  return {
    ...handle,
    async drop() {
      await handle.pool.end();
      const c = new pg.Client({ connectionString: admin });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}
