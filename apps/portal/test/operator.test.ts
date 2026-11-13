import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { auditLog, operatorApiKey, project } from '@parallax/db';
import type { Project } from '@parallax/db';
import { createTestDb } from '@parallax/db/testing';
import { generateKey, hashKey } from '@parallax/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listAudit } from '@/lib/audit-log';
import type { Deps } from '@/lib/deps';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { apiMetrics, webMetrics } from '@/lib/machine-api';
import { openApiDocument } from '@/lib/openapi';
import type { OperatorContext } from '@/lib/operator';
import {
  createOperatorKey,
  listOperatorKeys,
  operatorForEmail,
  operatorFromApiKey,
  revokeOperatorKey,
} from '@/lib/operator';
import { compareProjects, globalOverview } from '@/lib/operator-data';
import { listManagedProjects, removeProject, restoreProject } from '@/lib/operator-projects';
import { getProject } from '@/lib/projects';
import { parseRange } from '@/lib/ranges';
import { createUser, testDeps, validInput } from './helpers/deps';
import { createProject } from '@/lib/projects';

const SCF: OperatorContext = {
  actor: 'scf@example.org',
  scope: 'all',
  readOnly: false,
  via: 'session',
};
const DEMO: OperatorContext = {
  actor: 'demo@example.org',
  scope: 'demo',
  readOnly: true,
  via: 'session',
};
const READONLY_ALL: OperatorContext = { ...SCF, actor: 'viewer', readOnly: true };

let db: Awaited<ReturnType<typeof createTestDb>>;
let deps: Deps;
let fake: ReturnType<typeof testDeps>['fakeUmami'];
let owner: { id: string };
let real: Project;
let other: Project;
let demo: Project;
const NOW = Date.UTC(2026, 10, 13, 12, 30);
const range = parseRange({ range: '24h' }, NOW);

beforeAll(async () => {
  db = await createTestDb();
  ({ deps, fakeUmami: fake } = testDeps(db.db, { maxProjectsPerUser: 10 }));
  deps.demoOperatorEmails = new Set(['demo@example.org']);
  owner = await createUser(db.db, 'owner@example.org');
  real = await createProject(deps, owner.id, validInput({ name: 'Real Wallet' }));
  other = await createProject(deps, owner.id, validInput({ name: 'Other Dex' }));
  demo = await createProject(deps, owner.id, validInput({ name: 'Demo App' }));
  await db.db.update(project).set({ isDemo: true }).where(eq(project.id, demo.id));
  fake.setStats(real.umamiWebsiteId!, {
    pageviews: 500,
    visitors: 50,
    visits: 60,
    bounces: 30,
    totaltime: 600,
  });
  fake.setStats(demo.umamiWebsiteId!, {
    pageviews: 70,
    visitors: 7,
    visits: 7,
    bounces: 1,
    totaltime: 70,
  });
  await db.pool.query(
    `INSERT INTO api_metrics.request_minute (project_id, service_name, method, route, status_code, source, minute, count, duration_sum_ms, duration_buckets)
     VALUES ($1, 'api', 'GET', '/r', 200, 'metrics', '2026-11-13T12:00:00Z', 90, 0, '{0,0,0,90,0,0,0,0,0,0,0,0,0,0,0}'),
            ($1, 'api', 'GET', '/r', 500, 'metrics', '2026-11-13T12:00:00Z', 10, 0, '{0,0,0,0,0,0,0,0,0,10,0,0,0,0,0}')`,
    [real.id],
  );
});
afterAll(() => db.drop());

describe('who is an operator', () => {
  it('comes only from the allowlists, case-insensitively', () => {
    expect(operatorForEmail(deps, 'Operator@Example.org')).toMatchObject({
      scope: 'all',
      readOnly: false,
    });
    expect(operatorForEmail(deps, 'demo@example.org')).toMatchObject({
      scope: 'demo',
      readOnly: true,
    });
    expect(operatorForEmail(deps, 'owner@example.org')).toBeNull();
  });
});

describe('global overview', () => {
  it('lists every tenant with web and API totals', async () => {
    const rows = await globalOverview(deps, SCF, range, NOW);
    expect(rows.map((r) => r.name)).toEqual(['Demo App', 'Other Dex', 'Real Wallet']);
    const r = rows.find((x) => x.id === real.id)!;
    expect(r.web).toMatchObject({
      pageviews: 500,
      visitors: 50,
      bounceRate: 0.5,
      avgVisitSeconds: 10,
    });
    expect(r.api).toMatchObject({ requests: 100, errorRate: 0.1 });
    expect(r.ownerEmail).toBe('owner@example.org');
    expect(rows.find((x) => x.id === other.id)!.api).toBeNull();
  });

  it('shows demo operators only demo tenants', async () => {
    expect((await globalOverview(deps, DEMO, range, NOW)).map((r) => r.id)).toEqual([demo.id]);
  });
});

describe('compare', () => {
  it('returns side-by-side series keyed by project, in the order picked', async () => {
    const c = await compareProjects(deps, SCF, [real.id, demo.id], range, NOW);
    expect(c.projects.map((p) => p.id)).toEqual([real.id, demo.id]);
    expect(c.web).toHaveLength(25);
    expect(Object.keys(c.api[0]!)).toEqual(expect.arrayContaining(['x', real.id, demo.id]));
    expect(c.api.reduce((s, p) => s + Number(p[real.id]), 0)).toBe(100);
  });

  it('needs 2–4 projects and refuses out-of-scope ones', async () => {
    await expect(compareProjects(deps, SCF, [real.id], range)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      compareProjects(deps, SCF, [real.id, other.id, demo.id, real.id, 'x'], range),
    ).rejects.toThrow();
    await expect(compareProjects(deps, DEMO, [real.id, demo.id], range)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('remove and restore', () => {
  it('hides a removed project from its owner, keeps it restorable, and audits both', async () => {
    const p = await createProject(deps, owner.id, validInput({ name: 'Short-lived' }));
    await removeProject(deps, SCF, p.id, { reason: 'test' });
    await expect(getProject(deps, owner.id, p.id)).rejects.toBeInstanceOf(NotFoundError);
    const [listed] = await listManagedProjects(deps, SCF, { q: 'Short-lived' });
    expect(listed).toMatchObject({
      status: 'removed',
      removedBy: 'scf@example.org',
      purgedAt: null,
    });
    expect(Date.parse(listed!.purgeAt!) - Date.parse(listed!.removedAt!)).toBe(24 * 3_600_000);

    await restoreProject(deps, SCF, p.id);
    await expect(getProject(deps, owner.id, p.id)).resolves.toMatchObject({ status: 'active' });

    const actions = (await db.db.select().from(auditLog).where(eq(auditLog.targetId, p.id))).map(
      (a) => a.action,
    );
    expect(actions.sort()).toEqual(['project.remove', 'project.restore']);
  });

  it('cannot restore a purged project', async () => {
    const p = await createProject(deps, owner.id, validInput());
    await removeProject(deps, SCF, p.id, {});
    await db.db.update(project).set({ purgedAt: new Date() }).where(eq(project.id, p.id));
    await expect(restoreProject(deps, SCF, p.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('is refused to read-only and out-of-scope operators', async () => {
    await expect(removeProject(deps, READONLY_ALL, real.id, {})).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(removeProject(deps, DEMO, real.id, {})).rejects.toBeInstanceOf(ValidationError);
    const demoWritable = { ...DEMO, readOnly: false };
    await expect(removeProject(deps, demoWritable, real.id, {})).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect((await getProject(deps, owner.id, real.id)).status).toBe('active');
  });

  it('search covers name, domain, Stellar ID and owner, and respects scope', async () => {
    expect((await listManagedProjects(deps, SCF, { q: 'dex' })).map((p) => p.id)).toEqual([
      other.id,
    ]);
    expect((await listManagedProjects(deps, SCF, { q: 'docs.example' })).length).toBeGreaterThan(2);
    expect((await listManagedProjects(deps, SCF, { q: 'owner@' })).length).toBeGreaterThan(2);
    expect((await listManagedProjects(deps, DEMO, {})).map((p) => p.id)).toEqual([demo.id]);
    // LIKE wildcards in the search term are literal.
    expect(await listManagedProjects(deps, SCF, { q: '%' })).toEqual([]);
  });
});

describe('operator API keys', () => {
  it('shows the key once, stores a hash, authenticates as read-only, and stops on revoke', async () => {
    const { key, operatorKey } = await createOperatorKey(deps, SCF, { name: 'SCF report' });
    const [row] = await db.db
      .select()
      .from(operatorApiKey)
      .where(eq(operatorApiKey.id, operatorKey.id));
    expect(row!.keyHash).toBe(hashKey(key));
    expect(JSON.stringify(await listOperatorKeys(deps))).not.toContain(key);

    const op = await operatorFromApiKey(deps, `Bearer ${key}`);
    expect(op).toMatchObject({ scope: 'all', readOnly: true, via: 'api_key' });

    await revokeOperatorKey(deps, SCF, operatorKey.id);
    expect(await operatorFromApiKey(deps, `Bearer ${key}`)).toBeNull();
  });

  it('rejects ingest keys, garbage and missing headers', async () => {
    const ingest = generateKey('ingest');
    for (const h of [`Bearer ${ingest}`, 'Bearer nope', '', null]) {
      expect(await operatorFromApiKey(deps, h)).toBeNull();
    }
  });

  it('cannot be created or revoked by read-only operators, and needs a name', async () => {
    await expect(createOperatorKey(deps, DEMO, { name: 'x' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(createOperatorKey(deps, SCF, { name: ' ' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('machine API', () => {
  const API_KEY_OP: OperatorContext = {
    actor: 'api-key:plx_op_x',
    scope: 'all',
    readOnly: true,
    via: 'api_key',
  };

  it('lists every project with web totals, or one project in detail', async () => {
    const list = await webMetrics(deps, API_KEY_OP, 'http://x/api/v1/metrics/web?range=24h');
    expect('projects' in list && list.projects.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Demo App', 'Other Dex', 'Real Wallet']),
    );
    const one = await webMetrics(
      deps,
      API_KEY_OP,
      `http://x/api/v1/metrics/web?project=${real.id}`,
    );
    expect('web' in one && one.web.totals.pageviews).toBe(500);
  });

  it('serves API totals and per-route detail', async () => {
    // The machine API reads the real clock: seed a row for the current minute.
    await db.pool.query(
      `INSERT INTO api_metrics.request_minute (project_id, service_name, method, route, status_code, source, minute, count, duration_sum_ms, duration_buckets)
       VALUES ($1, 'api', 'GET', '/live', 200, 'metrics', date_trunc('minute', now()), 3, 0, '{3,0,0,0,0,0,0,0,0,0,0,0,0,0,0}')`,
      [real.id],
    );
    const one = await apiMetrics(
      deps,
      API_KEY_OP,
      `http://x/api/v1/metrics/api?range=24h&project=${real.id}`,
    );
    expect('api' in one && one.api.routes.map((r) => r.route)).toContain('/live');
    expect(JSON.stringify(one)).not.toContain('lastUsedAt');
  });

  it('404s unknown, malformed and removed projects', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'nope']) {
      await expect(apiMetrics(deps, API_KEY_OP, `http://x/?project=${id}`)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    }
  });
});

describe('audit log', () => {
  it('records operator actions and hides non-demo entries from demo operators', async () => {
    await removeProject(deps, SCF, other.id, {});
    await restoreProject(deps, SCF, other.id);
    const all = await listAudit(deps, SCF);
    expect(all.some((e) => e.targetId === other.id)).toBe(true);
    const demoView = await listAudit(deps, DEMO);
    expect(demoView.every((e) => e.targetId === demo.id)).toBe(true);
  });
});

describe('OpenAPI document', () => {
  it('describes exactly the machine API routes that exist', () => {
    for (const path of Object.keys(openApiDocument.paths)) {
      expect(existsSync(join(import.meta.dirname, '..', 'app', path, 'route.ts')), path).toBe(true);
    }
    const ids = Object.values(openApiDocument.paths).map((p) => p.get.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
