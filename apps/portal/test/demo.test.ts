import { project } from '@parallax/db';
import type { Project } from '@parallax/db';
import { createTestDb } from '@parallax/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Deps } from '@/lib/deps';
import { PUBLIC_DEMO_OPERATOR, demoCached, getDemoProject, listDemoProjects } from '@/lib/demo';
import { NotFoundError } from '@/lib/errors';
import { compareProjects, globalOverview } from '@/lib/operator-data';
import { createProject } from '@/lib/projects';
import { parseRange } from '@/lib/ranges';
import { createUser, testDeps, validInput } from './helpers/deps';

/**
 * The public demo has no account: these functions are its only authorization.
 * A real tenant must be indistinguishable from a missing project.
 */
let db: Awaited<ReturnType<typeof createTestDb>>;
let deps: Deps;
let real: Project;
let demo: Project;
let demo2: Project;
let removedDemo: Project;
const range = parseRange({ range: '24h' });

beforeAll(async () => {
  db = await createTestDb();
  ({ deps } = testDeps(db.db, { maxProjectsPerUser: 10 }));
  const owner = await createUser(db.db);
  real = await createProject(deps, owner.id, validInput({ name: 'Real Wallet' }));
  demo = await createProject(deps, owner.id, validInput({ name: 'Demo B' }));
  demo2 = await createProject(deps, owner.id, validInput({ name: 'Demo A' }));
  removedDemo = await createProject(deps, owner.id, validInput({ name: 'Demo Gone' }));
  for (const p of [demo, demo2, removedDemo])
    await db.db.update(project).set({ isDemo: true }).where(eq(project.id, p.id));
  await db.db.update(project).set({ status: 'removed' }).where(eq(project.id, removedDemo.id));
});
afterAll(() => db.drop());

describe('public demo scope', () => {
  it('lists live demo projects only', async () => {
    const names = (await listDemoProjects(deps)).map((p) => p.name);
    expect(names).toEqual(['Demo A', 'Demo B']);
  });

  it('serves a demo project, and 404s real, removed and malformed IDs alike', async () => {
    expect((await getDemoProject(deps, demo.id)).id).toBe(demo.id);
    for (const id of [
      real.id,
      removedDemo.id,
      'not-a-uuid',
      '00000000-0000-4000-8000-000000000000',
    ])
      await expect(getDemoProject(deps, id)).rejects.toThrow(NotFoundError);
  });

  it('runs the operator view as a read-only demo operator', async () => {
    expect(PUBLIC_DEMO_OPERATOR).toMatchObject({ scope: 'demo', readOnly: true });
    const rows = await globalOverview(deps, PUBLIC_DEMO_OPERATOR, range);
    expect(rows.map((r) => r.name).sort()).toEqual(['Demo A', 'Demo B']);
  });

  it('refuses to compare a real project with a demo one', async () => {
    await expect(
      compareProjects(deps, PUBLIC_DEMO_OPERATOR, [demo.id, real.id], range),
    ).rejects.toThrow(NotFoundError);
    const ok = await compareProjects(deps, PUBLIC_DEMO_OPERATOR, [demo.id, demo2.id], range);
    expect(ok.projects.map((p) => p.id)).toEqual([demo.id, demo2.id]);
  });
});

describe('demoCached', () => {
  it('shares one result per key within the TTL, and drops failures', async () => {
    let calls = 0;
    const load = async () => ++calls;
    expect(await demoCached('k', load)).toBe(1);
    expect(await demoCached('k', load)).toBe(1);
    expect(await demoCached('k', load, 0)).toBe(2);

    const failing = () => Promise.reject(new Error('down'));
    await expect(demoCached('f', failing)).rejects.toThrow('down');
    expect(await demoCached('f', load)).toBe(3);
  });
});
