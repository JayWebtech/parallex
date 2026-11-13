import { auditLog, project } from '@parallax/db';
import { createTestDb } from '@parallax/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/errors';
import { approveProject, createProject, getSnippet, listPendingProjects } from '@/lib/projects';
import { setEnrollmentMode } from '@/lib/settings';
import { TEST_CONTRACT, createUser, testDeps, validInput } from './helpers/deps';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(() => db.drop());

async function expectFields(promise: Promise<unknown>, field: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  expect(Object.keys((error as ValidationError).fieldErrors)).toContain(field);
}

describe('createProject (open enrollment)', () => {
  it('validates, verifies the Stellar ID, and creates an Umami website', async () => {
    const { deps, fakeUmami } = testDeps(db.db);
    const owner = await createUser(db.db);
    const p = await createProject(deps, owner.id, validInput());

    expect(p).toMatchObject({
      status: 'active',
      name: 'Test Project',
      domains: ['app.example.org', 'docs.example.org'],
      stellarIdKind: 'account',
      stellarNetwork: 'testnet',
    });
    expect(p.umamiWebsiteId).toBeTruthy();
    expect(fakeUmami.websites.get(p.umamiWebsiteId!)?.domain).toBe('app.example.org');
  });

  it('accepts contracts and pasted URLs as domains', async () => {
    const { deps } = testDeps(db.db);
    const owner = await createUser(db.db);
    const p = await createProject(
      deps,
      owner.id,
      validInput({ stellarId: TEST_CONTRACT, domains: 'https://WWW.Example.org/path?x=1' }),
    );
    expect(p.stellarIdKind).toBe('contract');
    expect(p.domains).toEqual(['www.example.org']);
  });

  it.each([
    ['name', { name: '' }],
    ['domains', { domains: 'not a domain!' }],
    ['domains', { domains: '' }],
    ['stellarId', { stellarId: 'GABC' }],
    ['stellarId', { stellarId: 'SB6K5QLO3JZ2LIQ2EXEAR7KU7Z7WTCIR2JFDSOJII7HKK2AVPLYRB6ZL' }],
    ['scfUrl', { scfUrl: 'http://insecure.example.org' }],
  ])('rejects an invalid %s', async (field, overrides) => {
    const { deps } = testDeps(db.db);
    const owner = await createUser(db.db);
    await expectFields(createProject(deps, owner.id, validInput(overrides)), field);
  });

  it('rejects IDs that do not exist on any network', async () => {
    const { deps } = testDeps(db.db, {
      stellar: {
        endpoints: testDeps(db.db).deps.stellar.endpoints,
        fetch: async () => new Response('missing', { status: 404 }),
      },
    });
    const owner = await createUser(db.db);
    await expectFields(createProject(deps, owner.id, validInput()), 'stellarId');
  });

  it('enforces the per-user project limit', async () => {
    const { deps } = testDeps(db.db, { maxProjectsPerUser: 1 });
    const owner = await createUser(db.db);
    await createProject(deps, owner.id, validInput());
    await expectFields(createProject(deps, owner.id, validInput()), 'form');
  });

  it('removes the Umami website if the database insert fails', async () => {
    const { deps, fakeUmami } = testDeps(db.db);
    const before = fakeUmami.websites.size;
    // A user id that violates the owner foreign key makes the insert fail.
    await expect(createProject(deps, 'no-such-user', validInput())).rejects.toThrow();
    expect(fakeUmami.websites.size).toBe(before);
  });
});

describe('approval-required enrollment', () => {
  it('keeps new projects pending until an operator approves them', async () => {
    const { deps, fakeUmami } = testDeps(db.db);
    await setEnrollmentMode(deps, 'approval_required', 'operator@example.org');
    try {
      const owner = await createUser(db.db);
      const p = await createProject(deps, owner.id, validInput({ name: 'Needs approval' }));
      expect(p.status).toBe('pending');
      expect(p.umamiWebsiteId).toBeNull();
      expect(await getSnippet(deps, owner.id, p.id)).toBeNull();
      expect((await listPendingProjects(deps)).map((x) => x.id)).toContain(p.id);

      const approved = await approveProject(deps, 'operator@example.org', p.id);
      expect(approved.status).toBe('active');
      expect(fakeUmami.websites.has(approved.umamiWebsiteId!)).toBe(true);
      expect(await getSnippet(deps, owner.id, p.id)).toContain(approved.umamiWebsiteId!);

      const audit = await db.db.select().from(auditLog).where(eq(auditLog.targetId, p.id));
      expect(audit.map((a) => a.action)).toEqual(['project.approve']);
    } finally {
      await setEnrollmentMode(deps, 'open', 'operator@example.org');
    }
  });

  it('records enrollment mode changes in the audit log', async () => {
    const { deps } = testDeps(db.db);
    const rows = await db.db.select().from(auditLog).where(eq(auditLog.action, 'enrollment_mode.set'));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.actorEmail === 'operator@example.org')).toBe(true);
    expect(deps).toBeDefined();
  });

  it('cannot approve a project twice', async () => {
    const { deps } = testDeps(db.db);
    const owner = await createUser(db.db);
    const p = await createProject(deps, owner.id, validInput());
    await expect(approveProject(deps, 'operator@example.org', p.id)).rejects.toThrow();
    const [row] = await db.db.select().from(project).where(eq(project.id, p.id));
    expect(row?.status).toBe('active');
  });
});
