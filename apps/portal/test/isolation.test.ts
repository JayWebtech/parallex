/**
 * Tenant isolation at the service layer: every function a portal route or
 * page calls with a project ID must treat another tenant's project exactly
 * like a missing one, and must never read the other tenant's Umami website.
 * test/e2e/isolation.e2e.test.ts proves the same over HTTP against a running stack.
 */
import { randomUUID } from 'node:crypto';
import { project } from '@parallax/db';
import type { Project } from '@parallax/db';
import { createTestDb } from '@parallax/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Deps } from '@/lib/deps';
import { NotFoundError } from '@/lib/errors';
import { createProject, getProject, getSnippet, listProjects } from '@/lib/projects';
import { parseRange } from '@/lib/ranges';
import { getWebAnalytics } from '@/lib/web-analytics';
import { createUser, testDeps, validInput } from './helpers/deps';

let db: Awaited<ReturnType<typeof createTestDb>>;
let deps: Deps;
let fake: ReturnType<typeof testDeps>['fakeUmami'];
let alice: { id: string };
let bob: { id: string };
let aliceProject: Project;
let bobProject: Project;

beforeAll(async () => {
  db = await createTestDb();
  ({ deps, fakeUmami: fake } = testDeps(db.db));
  alice = await createUser(db.db, 'alice@example.org');
  bob = await createUser(db.db, 'bob@example.org');
  aliceProject = await createProject(deps, alice.id, validInput({ name: 'Alice' }));
  bobProject = await createProject(deps, bob.id, validInput({ name: 'Bob' }));
  fake.setStats(aliceProject.umamiWebsiteId!, { pageviews: 1111, visitors: 111, visits: 11 });
  fake.setStats(bobProject.umamiWebsiteId!, { pageviews: 2222, visitors: 222, visits: 22 });
});
afterAll(() => db.drop());

const range = parseRange({ range: '7d' });

/** Every project-scoped entry point the portal exposes. Add new ones here. */
const scopedCalls = {
  getProject: (userId: string, id: string) => getProject(deps, userId, id),
  getSnippet: (userId: string, id: string) => getSnippet(deps, userId, id),
  getWebAnalytics: (userId: string, id: string) => getWebAnalytics(deps, userId, id, range),
};

describe.each(Object.entries(scopedCalls))('%s', (_name, call) => {
  it("lets an owner read their own project", async () => {
    await expect(call(alice.id, aliceProject.id)).resolves.toBeDefined();
  });

  it("returns not-found for another tenant's project", async () => {
    await expect(call(bob.id, aliceProject.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(call(alice.id, bobProject.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the same not-found for unknown and malformed IDs', async () => {
    for (const id of [randomUUID(), 'not-a-uuid', "' OR 1=1 --", '', aliceProject.umamiWebsiteId!]) {
      await expect(call(bob.id, id)).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});

describe('Umami access', () => {
  it("never queries another tenant's website", async () => {
    fake.calls.length = 0;
    await getWebAnalytics(deps, bob.id, bobProject.id, range);
    await getWebAnalytics(deps, bob.id, aliceProject.id, range).catch(() => undefined);
    const read = new Set(fake.analyticsReads());
    expect(read).toEqual(new Set([bobProject.umamiWebsiteId]));
  });

  it("returns only the caller's numbers", async () => {
    const web = await getWebAnalytics(deps, alice.id, aliceProject.id, range);
    expect(web.totals.pageviews).toBe(1111);
    expect(JSON.stringify(web)).not.toContain('2222');
  });
});

describe('listing', () => {
  it("shows each tenant only their own projects", async () => {
    expect((await listProjects(deps, alice.id)).map((p) => p.id)).toEqual([aliceProject.id]);
    expect((await listProjects(deps, bob.id)).map((p) => p.id)).toEqual([bobProject.id]);
  });
});

describe('removed projects', () => {
  it('are invisible even to their owner', async () => {
    const owner = await createUser(db.db);
    const p = await createProject(deps, owner.id, validInput());
    await db.db.update(project).set({ status: 'removed' }).where(eq(project.id, p.id));
    for (const call of Object.values(scopedCalls)) {
      await expect(call(owner.id, p.id)).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(await listProjects(deps, owner.id)).toEqual([]);
  });
});
