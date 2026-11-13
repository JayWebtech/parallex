import { createTestDb } from '@parallax/db/testing';
import {
  DEMO_API_PROJECT,
  DEMO_OWNER,
  DEMO_PROJECTS,
  generateKey,
  hashKey,
} from '@parallax/shared';
import { FakeUmami, UmamiClient } from '@parallax/umami';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDemo } from '../src/seed-demo.js';

let db: Awaited<ReturnType<typeof createTestDb>>;
const fake = new FakeUmami('admin', 'pw-pw-pw-pw-pw');
const umami = new UmamiClient({
  baseUrl: 'http://umami.internal:3000',
  username: 'admin',
  password: 'pw-pw-pw-pw-pw',
  fetch: fake.fetch,
});
const publicUrl = 'https://parallax.example.org';

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(() => db.drop());

describe('seedDemo', () => {
  it('creates the demo owner, demo projects with fixed websites, and the ingest key', async () => {
    const key = generateKey('ingest');
    const result = await seedDemo(db.pool, umami, { ingestKey: key, publicUrl });
    expect(result.created).toEqual(DEMO_PROJECTS.map((p) => p.name));

    const { rows: projects } = await db.pool.query(
      `SELECT id, owner_id, is_demo, status, umami_website_id, domains FROM portal.project ORDER BY name`,
    );
    expect(projects).toHaveLength(DEMO_PROJECTS.length);
    for (const p of projects) {
      expect(p).toMatchObject({ owner_id: DEMO_OWNER.id, is_demo: true, status: 'active' });
      expect(p.domains).toEqual(['parallax.example.org']);
    }
    expect([...fake.websites.keys()].sort()).toEqual(DEMO_PROJECTS.map((p) => p.websiteId).sort());

    // No password: the demo owner cannot sign in.
    const { rowCount } = await db.pool.query(`SELECT 1 FROM portal.account WHERE user_id = $1`, [
      DEMO_OWNER.id,
    ]);
    expect(rowCount).toBe(0);

    const { rows: keys } = await db.pool.query(
      `SELECT project_id, key_hash FROM api_metrics.ingest_key WHERE revoked_at IS NULL`,
    );
    expect(keys).toEqual([{ project_id: DEMO_API_PROJECT.id, key_hash: hashKey(key) }]);
  });

  it('is idempotent, rotates the key, and leaves removed demo projects alone', async () => {
    const removed = DEMO_PROJECTS[1]!;
    await db.pool.query(`UPDATE portal.project SET status = 'removed' WHERE id = $1`, [removed.id]);
    const key = generateKey('ingest');
    const result = await seedDemo(db.pool, umami, { ingestKey: key, publicUrl });
    expect(result.created).toEqual([]);

    const { rows } = await db.pool.query(`SELECT status FROM portal.project WHERE id = $1`, [
      removed.id,
    ]);
    expect(rows[0].status).toBe('removed');
    const { rows: keys } = await db.pool.query(
      `SELECT key_hash FROM api_metrics.ingest_key WHERE revoked_at IS NULL`,
    );
    expect(keys).toEqual([{ key_hash: hashKey(key) }]);
  });

  it('refuses a key that is not an ingest key', async () => {
    await expect(seedDemo(db.pool, umami, { ingestKey: 'change-me', publicUrl })).rejects.toThrow(
      /DEMO_INGEST_KEY/,
    );
  });
});
