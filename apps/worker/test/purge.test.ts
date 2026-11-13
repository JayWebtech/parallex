import { randomUUID } from 'node:crypto';
import { createTestDb } from '@parallax/db/testing';
import { LATENCY_BUCKETS } from '@parallax/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purgeRemovedProjects } from '../src/jobs.js';
import type { WebsiteDeleter } from '../src/jobs.js';

let db: Awaited<ReturnType<typeof createTestDb>>;
const NOW = Date.UTC(2026, 11, 1, 12);
const HOUR = 3_600_000;

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(() => db.drop());

/** A project with web (Umami website), API rows, a warning and an ingest key. */
async function seed(status: 'active' | 'removed', removedHoursAgo?: number) {
  const userId = randomUUID();
  await db.pool.query(`INSERT INTO portal."user" (id, name, email) VALUES ($1, 'u', $2)`, [
    userId,
    `${userId}@example.org`,
  ]);
  const website = randomUUID();
  const { rows } = await db.pool.query<{ id: string }>(
    `INSERT INTO portal.project (owner_id, name, domains, stellar_id, stellar_id_kind, status, umami_website_id, removed_at)
     VALUES ($1, 'P', '{p.example.org}', 'GXXX', 'account', $2, $3, $4) RETURNING id`,
    [
      userId,
      status,
      website,
      removedHoursAgo === undefined ? null : new Date(NOW - removedHoursAgo * HOUR),
    ],
  );
  const id = rows[0]!.id;
  const b = `{${new Array(LATENCY_BUCKETS).fill(0).join(',')}}`;
  for (const [table, col, t] of [
    ['request_minute', 'minute', new Date(NOW - HOUR)],
    ['request_hour', 'hour', new Date(NOW - HOUR)],
    ['request_day', 'day', '2026-11-30'],
  ] as const) {
    await db.pool.query(
      `INSERT INTO api_metrics.${table} (project_id, service_name, method, route, status_code, source, ${col}, count, duration_sum_ms, duration_buckets)
       VALUES ($1, 'api', 'GET', '/r', 200, 'metrics', $2, 1, 1, $3)`,
      [id, t, b],
    );
  }
  await db.pool.query(
    `INSERT INTO api_metrics.ingest_warning_day (project_id, day, secrets_redacted) VALUES ($1, '2026-11-30', 1)`,
    [id],
  );
  await db.pool.query(
    `INSERT INTO api_metrics.ingest_key (project_id, prefix, key_hash) VALUES ($1, 'plx_in_x', $2)`,
    [id, randomUUID()],
  );
  return { id, website };
}

async function remaining(id: string) {
  const counts: Record<string, number> = {};
  for (const t of [
    'request_minute',
    'request_hour',
    'request_day',
    'ingest_warning_day',
    'ingest_key',
  ]) {
    const { rows } = await db.pool.query(
      `SELECT count(*)::int AS n FROM api_metrics.${t} WHERE project_id = $1`,
      [id],
    );
    counts[t] = rows[0].n;
  }
  const { rows } = await db.pool.query(
    `SELECT status, purged_at, umami_website_id FROM portal.project WHERE id = $1`,
    [id],
  );
  return { counts, project: rows[0] };
}

const recorder = (fail?: number): WebsiteDeleter & { deleted: string[] } => {
  const deleted: string[] = [];
  return {
    deleted,
    async deleteWebsite(id) {
      if (fail) throw Object.assign(new Error('umami'), { status: fail });
      deleted.push(id);
    },
  };
};

describe('purgeRemovedProjects', () => {
  it('deletes every piece of data of projects removed longer than the grace period', async () => {
    const old = await seed('removed', 25);
    const umami = recorder();
    expect(await purgeRemovedProjects(db.pool, umami, NOW, 24)).toContain(old.id);
    expect(umami.deleted).toContain(old.website);
    const r = await remaining(old.id);
    expect(Object.values(r.counts).every((n) => n === 0)).toBe(true);
    expect(r.project.status).toBe('removed');
    expect(r.project.purged_at).not.toBeNull();
    expect(r.project.umami_website_id).toBeNull();
    const { rows } = await db.pool.query(
      `SELECT actor_email, action FROM portal.audit_log WHERE target_id = $1`,
      [old.id],
    );
    expect(rows).toEqual([{ actor_email: 'system:worker', action: 'project.purge' }]);
  });

  it('leaves projects inside the grace period, and active ones, alone', async () => {
    const recent = await seed('removed', 1);
    const active = await seed('active');
    await purgeRemovedProjects(db.pool, recorder(), NOW, 24);
    expect((await remaining(recent.id)).counts.request_minute).toBe(1);
    expect((await remaining(active.id)).counts.request_minute).toBe(1);
    expect((await remaining(recent.id)).project.purged_at).toBeNull();
  });

  it('purges a project its owner deleted at once, without the grace period', async () => {
    const mine = await seed('removed', 0);
    await db.pool.query(`UPDATE portal.project SET removed_by = 'owner' WHERE id = $1`, [mine.id]);
    const umami = recorder();
    expect(await purgeRemovedProjects(db.pool, umami, NOW, 24)).toContain(mine.id);
    expect(umami.deleted).toContain(mine.website);
    expect(Object.values((await remaining(mine.id)).counts).every((n) => n === 0)).toBe(true);
  });

  it('retries later when Umami fails, and accepts an already-deleted website', async () => {
    const p = await seed('removed', 48);
    expect(await purgeRemovedProjects(db.pool, recorder(503), NOW, 24)).not.toContain(p.id);
    expect((await remaining(p.id)).counts.request_day).toBe(1);
    expect(await purgeRemovedProjects(db.pool, recorder(404), NOW, 24)).toContain(p.id);
    expect((await remaining(p.id)).counts.request_day).toBe(0);
  });

  it('never purges twice', async () => {
    const p = await seed('removed', 30);
    await purgeRemovedProjects(db.pool, recorder(), NOW, 24);
    expect(await purgeRemovedProjects(db.pool, recorder(), NOW, 24)).not.toContain(p.id);
  });
});
