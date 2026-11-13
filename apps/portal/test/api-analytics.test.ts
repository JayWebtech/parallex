import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ingestKey } from '@parallax/db';
import type { Project } from '@parallax/db';
import { createTestDb } from '@parallax/db/testing';
import { LATENCY_BUCKETS, hashKey } from '@parallax/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getApiAnalytics } from '@/lib/api-analytics';
import type { Deps } from '@/lib/deps';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  MAX_ACTIVE_INGEST_KEYS,
  createIngestKey,
  listIngestKeys,
  revokeIngestKey,
} from '@/lib/ingest-keys';
import { collectorConfig } from '@/lib/instrument';
import { createProject } from '@/lib/projects';
import { parseRange } from '@/lib/ranges';
import { createUser, testDeps, validInput } from './helpers/deps';

let db: Awaited<ReturnType<typeof createTestDb>>;
let deps: Deps;
let alice: { id: string };
let bob: { id: string };
let aliceProject: Project;
let bobProject: Project;
const NOW = Date.UTC(2026, 10, 13, 12, 30);
const range = parseRange({ range: '24h' }, NOW);

const buckets = (entries: [number, number][]) => {
  const b = new Array<number>(LATENCY_BUCKETS).fill(0);
  for (const [i, n] of entries) b[i] = n;
  return `{${b.join(',')}}`;
};

async function row(
  projectId: string,
  r: Partial<{
    service: string;
    route: string;
    status: number;
    source: string;
    count: number;
    b: string;
    minute: string;
  }>,
) {
  await db.pool.query(
    `INSERT INTO api_metrics.request_minute
       (project_id, service_name, method, route, status_code, source, minute, count, duration_sum_ms, duration_buckets)
     VALUES ($1, $2, 'GET', $3, $4, $5, $6, $7, 0, $8)`,
    [
      projectId,
      r.service ?? 'api',
      r.route ?? '/r',
      r.status ?? 200,
      r.source ?? 'metrics',
      r.minute ?? '2026-11-13T12:00:00Z',
      r.count ?? 1,
      r.b ?? buckets([[0, r.count ?? 1]]),
    ],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  ({ deps } = testDeps(db.db));
  alice = await createUser(db.db);
  bob = await createUser(db.db);
  aliceProject = await createProject(deps, alice.id, validInput({ name: 'Alice' }));
  bobProject = await createProject(deps, bob.id, validInput({ name: 'Bob' }));

  // Alice: /accounts with 90 fast 200s and 10 slow 500s; a traces-only worker service.
  await row(aliceProject.id, { route: '/accounts/{account}', count: 90, b: buckets([[3, 90]]) });
  await row(aliceProject.id, {
    route: '/accounts/{account}',
    status: 500,
    count: 10,
    b: buckets([[9, 10]]),
  });
  await row(aliceProject.id, { service: 'worker', route: '/jobs', source: 'traces', count: 5 });
  // Same service sending both signals: only metrics may count.
  await row(aliceProject.id, { route: '/accounts/{account}', source: 'traces', count: 999 });
  // Bob's data must never show up for Alice.
  await row(bobProject.id, { route: '/bob-only', count: 7 });
});
afterAll(() => db.drop());

describe('getApiAnalytics', () => {
  it("returns the owner's routes with status mix and latency percentiles", async () => {
    const a = await getApiAnalytics(deps, alice.id, aliceProject.id, range, NOW);
    expect(a.resolution).toBe('minute');
    expect(a.totals.requests).toBe(105);
    expect(a.totals.errorRate).toBeCloseTo(10 / 105);
    expect(a.routes.map((r) => [r.service, r.route, r.requests, r.status.s5xx])).toEqual([
      ['api', '/accounts/{account}', 100, 10],
      ['worker', '/jobs', 5, 0],
    ]);
    const accounts = a.routes[0]!;
    expect(accounts.p50).toBeGreaterThan(25);
    expect(accounts.p50).toBeLessThanOrEqual(50);
    expect(accounts.p95).toBeGreaterThan(750);
    expect(accounts.p95).toBeLessThanOrEqual(1000);
    expect(a.services).toEqual(['api', 'worker']);
  });

  it('prefers metrics over traces per service (no double counting)', async () => {
    const a = await getApiAnalytics(deps, alice.id, aliceProject.id, range, NOW);
    expect(JSON.stringify(a)).not.toContain('999');
  });

  it("never includes another tenant's data and hides their project", async () => {
    const a = await getApiAnalytics(deps, alice.id, aliceProject.id, range, NOW);
    expect(JSON.stringify(a)).not.toContain('/bob-only');
    await expect(getApiAnalytics(deps, alice.id, bobProject.id, range, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(getApiAnalytics(deps, bob.id, aliceProject.id, range, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('fills the series with one bucket per hour', async () => {
    const a = await getApiAnalytics(deps, alice.id, aliceProject.id, range, NOW);
    expect(a.series.length).toBe(25);
    expect(a.series.reduce((s, p) => s + p.requests, 0)).toBe(105);
  });

  it('reads hour and day rollups for longer ranges', async () => {
    const thirty = await getApiAnalytics(
      deps,
      alice.id,
      aliceProject.id,
      parseRange({ range: '30d' }, NOW),
      NOW,
    );
    expect(thirty.resolution).toBe('hour');
    const old = await getApiAnalytics(
      deps,
      alice.id,
      aliceProject.id,
      parseRange({ range: 'custom', from: '2026-01-01', to: '2026-03-01' }, NOW),
      NOW,
    );
    expect(old.resolution).toBe('day');
  });
});

describe('ingest keys', () => {
  it('shows the plaintext once and stores only a hash', async () => {
    const { key, ingestKey: view } = await createIngestKey(deps, alice.id, aliceProject.id);
    const [stored] = await db.db.select().from(ingestKey).where(eq(ingestKey.id, view.id));
    expect(stored!.keyHash).toBe(hashKey(key));
    expect(JSON.stringify(stored)).not.toContain(key);
    const listed = await listIngestKeys(deps, alice.id, aliceProject.id);
    expect(JSON.stringify(listed)).not.toContain(key);
    expect(listed.map((k) => k.prefix)).toContain(view.prefix);
  });

  it(`allows at most ${MAX_ACTIVE_INGEST_KEYS} active keys`, async () => {
    const owner = await createUser(db.db);
    const p = await createProject(deps, owner.id, validInput());
    for (let i = 0; i < MAX_ACTIVE_INGEST_KEYS; i++) await createIngestKey(deps, owner.id, p.id);
    await expect(createIngestKey(deps, owner.id, p.id)).rejects.toBeInstanceOf(ValidationError);
    const [first] = await listIngestKeys(deps, owner.id, p.id);
    await revokeIngestKey(deps, owner.id, p.id, first!.id);
    await expect(createIngestKey(deps, owner.id, p.id)).resolves.toBeDefined();
  });

  it("cannot be listed, created or revoked on another tenant's project", async () => {
    const { ingestKey: aliceKey } = await createIngestKey(deps, alice.id, aliceProject.id);
    await expect(listIngestKeys(deps, bob.id, aliceProject.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(createIngestKey(deps, bob.id, aliceProject.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    // Bob passes Alice's key ID under his own project: still not found.
    await expect(revokeIngestKey(deps, bob.id, bobProject.id, aliceKey.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      revokeIngestKey(deps, bob.id, aliceProject.id, aliceKey.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    const [still] = await db.db.select().from(ingestKey).where(eq(ingestKey.id, aliceKey.id));
    expect(still!.revokedAt).toBeNull();
  });
});

describe('setup snippets', () => {
  it('the example collector config is the template the portal shows', () => {
    const example = readFileSync(
      join(import.meta.dirname, '../../../examples/otel-collector-dual-export/config.yaml'),
      'utf8',
    );
    expect(example).toBe(collectorConfig());
  });
});
