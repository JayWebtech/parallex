/**
 * Operator (SCF) flows over HTTP against a live stack. The stack's
 * OPERATOR_EMAILS must contain E2E_OPERATOR_EMAIL.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { BASE, Session, enroll, operatorSession, signUp } from './session';

let op: Session;
let tenant: Session;
let tenantProject: string;
let otherProject: string;

beforeAll(async () => {
  [op, tenant] = await Promise.all([operatorSession(), signUp()]);
  tenantProject = await enroll(tenant, `OpTenant-${randomUUID().slice(0, 6)}`);
  otherProject = await enroll(tenant, `OpOther-${randomUUID().slice(0, 6)}`);
}, 60_000);

const PAGES = [
  '/operator',
  '/operator/projects',
  '/operator/api-keys',
  '/operator/audit',
  '/operator/api-docs',
];

describe('operator pages', () => {
  it.each(PAGES)('%s: operators 200, tenants 404, anonymous → sign-in', async (path) => {
    expect((await op.request('GET', path)).status).toBe(200);
    expect((await tenant.request('GET', path)).status).toBe(404);
    expect([303, 307]).toContain((await new Session().request('GET', path)).status);
  });

  it('the overview lists every tenant', async () => {
    const html = await (await op.request('GET', '/operator?range=24h')).text();
    expect(html).toContain('OpTenant-');
    expect(html).toContain('OpOther-');
  });

  it('compares two projects side by side', async () => {
    const res = await op.request(
      'GET',
      `/operator/compare?ids=${tenantProject},${otherProject}&range=24h`,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('OpOther-');
    const tooFew = await op.request('GET', `/operator/compare?ids=${tenantProject}`);
    expect(await tooFew.text()).toContain('Pick 2 to 4 projects');
  });
});

describe('remove and restore', () => {
  it('removing hides the project from its owner; restoring brings it back; both are audited', async () => {
    const remove = await op.request('POST', `/api/operator/projects/${otherProject}/remove`, {
      reason: 'e2e',
    });
    expect(remove.status).toBe(200);
    expect((await tenant.request('GET', `/api/projects/${otherProject}`)).status).toBe(404);

    expect(
      (await op.request('POST', `/api/operator/projects/${otherProject}/restore`)).status,
    ).toBe(200);
    expect((await tenant.request('GET', `/api/projects/${otherProject}`)).status).toBe(200);

    const audit = await (await op.request('GET', '/operator/audit')).text();
    expect(audit).toContain(`project:${otherProject}`);
    expect(audit).toContain('project.remove');
    expect(audit).toContain('project.restore');
  });

  it('tenants cannot remove anything, not even their own project', async () => {
    const res = await tenant.request('POST', `/api/operator/projects/${tenantProject}/remove`, {});
    expect(res.status).toBe(404);
  });
});

describe('enrollment mode', () => {
  it('approval-required holds new projects until an operator approves', async () => {
    expect(
      (await op.request('PUT', '/api/operator/enrollment-mode', { mode: 'approval_required' }))
        .status,
    ).toBe(200);
    try {
      const res = await tenant.request('POST', '/api/projects', {
        name: `Pending-${randomUUID().slice(0, 6)}`,
        domains: 'pending.example.org',
        stellarId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      });
      const { project } = (await res.json()) as { project: { id: string; status: string } };
      expect(project.status).toBe('pending');
      const snippet = await (
        await tenant.request('GET', `/api/projects/${project.id}/snippet`)
      ).json();
      expect(snippet).toEqual({ snippet: null });

      expect(
        (await op.request('POST', `/api/operator/projects/${project.id}/approve`)).status,
      ).toBe(200);
      const after = await (
        await tenant.request('GET', `/api/projects/${project.id}/snippet`)
      ).json();
      expect((after as { snippet: string }).snippet).toContain('data-website-id');
    } finally {
      await op.request('PUT', '/api/operator/enrollment-mode', { mode: 'open' });
    }
  });

  it('tenants cannot change it', async () => {
    const res = await tenant.request('PUT', '/api/operator/enrollment-mode', {
      mode: 'approval_required',
    });
    expect(res.status).toBe(404);
  });
});

describe('operator API keys and the machine API', () => {
  const get = (path: string, auth?: string) =>
    fetch(`${BASE}${path}`, { headers: auth ? { authorization: auth } : {} });

  it('a key reads every tenant; sessions, ingest keys and revoked keys cannot', async () => {
    const created = await op.request('POST', '/api/operator/api-keys', { name: 'e2e' });
    expect(created.status).toBe(201);
    const { key, operatorKey } = (await created.json()) as {
      key: string;
      operatorKey: { id: string };
    };

    const web = await get('/api/v1/metrics/web?range=24h', `Bearer ${key}`);
    expect(web.status).toBe(200);
    const body = (await web.json()) as { projects: { id: string }[] };
    expect(body.projects.map((p) => p.id)).toEqual(
      expect.arrayContaining([tenantProject, otherProject]),
    );

    const api = await get(
      `/api/v1/metrics/api?range=24h&project=${tenantProject}`,
      `Bearer ${key}`,
    );
    expect(api.status).toBe(200);
    expect(await api.json()).toMatchObject({ project: { id: tenantProject }, api: { routes: [] } });

    // A logged-in session (even an operator's) is not an API credential.
    expect((await op.request('GET', '/api/v1/metrics/web')).status).toBe(401);
    expect((await get('/api/v1/metrics/web')).status).toBe(401);
    const ingest = await tenant.request('POST', `/api/projects/${tenantProject}/ingest-keys`);
    const { key: ingestKey } = (await ingest.json()) as { key: string };
    expect((await get('/api/v1/metrics/web', `Bearer ${ingestKey}`)).status).toBe(401);

    expect((await op.request('DELETE', `/api/operator/api-keys/${operatorKey.id}`)).status).toBe(
      204,
    );
    expect((await get('/api/v1/metrics/web', `Bearer ${key}`)).status).toBe(401);
  });

  it('tenants cannot create operator keys', async () => {
    expect((await tenant.request('POST', '/api/operator/api-keys', { name: 'x' })).status).toBe(
      404,
    );
  });

  it('publishes an OpenAPI 3.1 description without authentication', async () => {
    const res = await get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(['/api/v1/metrics/web', '/api/v1/metrics/api']);
  });
});
