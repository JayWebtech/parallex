import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/migrate.js';
import { createTestDb } from '../src/testing.js';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(() => db.drop());

describe('migrations', () => {
  it('create every portal table in the portal schema', async () => {
    const { rows } = await db.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'portal' ORDER BY 1`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      'account',
      'audit_log',
      'operator_api_key',
      'project',
      'session',
      'setting',
      'user',
      'verification',
    ]);
  });

  it('are idempotent', async () => {
    const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://localhost/postgres');
    url.pathname = `/${(await db.pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]!.db}`;
    await expect(runMigrations(url.toString())).resolves.toBeUndefined();
  });

  it('put nothing in the public schema', async () => {
    const { rows } = await db.pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(rows).toEqual([]);
  });
});
