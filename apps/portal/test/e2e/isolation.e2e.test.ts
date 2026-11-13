/**
 * End-to-end tenant isolation against a running stack (docker compose).
 *
 *   E2E_BASE_URL=http://localhost:8080 pnpm --filter @parallax/portal test:e2e
 *
 * Two strangers sign up and enroll; real tracker events go through Caddy to
 * Umami; each tenant sees only their own visits, and every project-scoped
 * route answers the other tenant (and anonymous callers) as if the project did
 * not exist.
 */
import { createHash, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { currentTracker } from '@parallax/tracker';
import { PROJECT_ROUTES } from './routes';
import { BASE, Session, enroll, signUp } from './session';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

async function websiteId(s: Session, projectId: string): Promise<string> {
  const res = await s.request('GET', `/api/projects/${projectId}/snippet`);
  const { snippet } = (await res.json()) as { snippet: string };
  return /data-website-id="([^"]+)"/.exec(snippet)![1]!;
}

/** What the pinned tracker sends for a pageview. */
async function sendPageview(website: string, path: string) {
  const res = await fetch(`${BASE}${currentTracker().collectPath}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': BROWSER_UA,
      origin: 'https://tenant.example.org',
    },
    body: JSON.stringify({
      type: 'event',
      payload: {
        website,
        hostname: 'tenant.example.org',
        url: path,
        referrer: '',
        title: 'E2E',
        screen: '1440x900',
        language: 'en-US',
      },
    }),
  });
  expect(res.status, await res.clone().text()).toBe(200);
}

let alice: Session;
let bob: Session;
let aliceProject: string;
let bobProject: string;
/** Throwaway keys the route matrix may revoke. */
let aliceRouteKey: string;
let bobRouteKey: string;

async function newKey(s: Session, projectId: string): Promise<{ id: string; key: string }> {
  const res = await s.request('POST', `/api/projects/${projectId}/ingest-keys`);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { key: string; ingestKey: { id: string } };
  return { id: body.ingestKey.id, key: body.key };
}

beforeAll(async () => {
  [alice, bob] = await Promise.all([signUp(), signUp()]);
  aliceProject = await enroll(alice, 'Alice');
  bobProject = await enroll(bob, 'Bob');
  aliceRouteKey = (await newKey(alice, aliceProject)).id;
  bobRouteKey = (await newKey(bob, bobProject)).id;
}, 60_000);

describe.each(PROJECT_ROUTES)('$method $file', (route) => {
  it(route.operatorOnly ? 'is hidden from non-operators' : 'serves the owner', async () => {
    const res = await alice.request(
      route.method,
      route.path(aliceProject, { keyId: aliceRouteKey }),
    );
    expect(res.status).toBe(route.operatorOnly ? 404 : (route.ownerStatus ?? 200));
  });

  it('answers another tenant with 404', async () => {
    const a = route.path(aliceProject, { keyId: aliceRouteKey });
    const b = route.path(bobProject, { keyId: bobRouteKey });
    expect((await bob.request(route.method, a)).status).toBe(404);
    expect((await alice.request(route.method, b)).status).toBe(404);
    if (route.method === 'DELETE') {
      // Own project, but the other tenant's key ID.
      const mixed = route.path(aliceProject, { keyId: bobRouteKey });
      expect((await alice.request(route.method, mixed)).status).toBe(404);
    }
  });

  it('answers unknown and malformed IDs with 404', async () => {
    for (const id of [randomUUID(), 'not-a-uuid']) {
      expect(
        (await bob.request(route.method, route.path(id, { keyId: randomUUID() }))).status,
      ).toBe(404);
    }
  });

  it('requires a session', async () => {
    const res = await new Session().request(
      route.method,
      route.path(aliceProject, { keyId: aliceRouteKey }),
    );
    if (route.kind === 'api') expect(res.status).toBe(401);
    else expect([303, 307]).toContain(res.status);
  });
});

describe('collection and dashboards', () => {
  it('records real tracker events and shows each tenant only their own', async () => {
    const [aliceSite, bobSite] = await Promise.all([
      websiteId(alice, aliceProject),
      websiteId(bob, bobProject),
    ]);
    await sendPageview(aliceSite, '/alice/one');
    await sendPageview(aliceSite, '/alice/two');
    await sendPageview(bobSite, '/bob/only');

    const read = async (s: Session, id: string) =>
      (await (await s.request('GET', `/api/projects/${id}/web?range=24h`)).json()) as {
        totals: { pageviews: number };
        breakdowns: { path: { label: string }[] };
      };
    const a = await read(alice, aliceProject);
    const b = await read(bob, bobProject);
    expect(a.totals.pageviews).toBe(2);
    expect(b.totals.pageviews).toBe(1);
    expect(a.breakdowns.path.map((r) => r.label).sort()).toEqual(['/alice/one', '/alice/two']);
    expect(JSON.stringify(b)).not.toContain('/alice/');
  });

  it('a tenant cannot inject events into an unknown website', async () => {
    const res = await fetch(`${BASE}${currentTracker().collectPath}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': BROWSER_UA },
      body: JSON.stringify({
        type: 'event',
        payload: { website: randomUUID(), hostname: 'x', url: '/' },
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('API analytics end to end', () => {
  const metric = (route: string, status: number, n: number) => ({
    resourceMetrics: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'e2e-api' } }] },
        scopeMetrics: [
          {
            metrics: [
              {
                name: 'http.server.request.duration',
                unit: 's',
                histogram: {
                  aggregationTemporality: 1,
                  dataPoints: [
                    {
                      attributes: [
                        { key: 'http.request.method', value: { stringValue: 'GET' } },
                        { key: 'http.route', value: { stringValue: route } },
                        { key: 'http.response.status_code', value: { intValue: String(status) } },
                      ],
                      timeUnixNano: `${BigInt(Date.now()) * 1_000_000n}`,
                      count: String(n),
                      sum: 0.03 * n,
                      bucketCounts: [
                        '0',
                        '0',
                        '0',
                        String(n),
                        '0',
                        '0',
                        '0',
                        '0',
                        '0',
                        '0',
                        '0',
                        '0',
                        '0',
                        '0',
                        '0',
                      ],
                      explicitBounds: [
                        0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  });

  async function ingest(key: string, body: unknown, signal = 'metrics') {
    return fetch(`${BASE}/v1/${signal}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-parallax-key': key },
      body: JSON.stringify(body),
    });
  }

  it('routes OTLP through the edge, stores per-tenant aggregates, and keeps tenants apart', async () => {
    const aliceKey = await newKey(alice, aliceProject);
    const bobKey = await newKey(bob, bobProject);
    expect((await ingest(aliceKey.key, metric('/accounts/:id', 200, 4))).status).toBe(200);
    expect((await ingest(aliceKey.key, metric('/accounts/:id', 503, 1))).status).toBe(200);
    expect((await ingest(bobKey.key, metric('/bob/secret-route', 200, 2))).status).toBe(200);
    expect((await ingest(aliceKey.key, { resourceLogs: [] }, 'logs')).status).toBe(200);
    expect((await ingest('plx_in_nope', metric('/x', 200, 1))).status).toBe(401);

    const read = async (s: Session, id: string) =>
      (await (await s.request('GET', `/api/projects/${id}/api-metrics?range=24h`)).json()) as {
        totals: { requests: number; errorRate: number };
        routes: { route: string; requests: number; status: { s5xx: number } }[];
      };
    const a = await read(alice, aliceProject);
    expect(a.totals.requests).toBe(5);
    expect(a.routes).toMatchObject([{ route: '/accounts/:id', requests: 5, status: { s5xx: 1 } }]);
    expect(JSON.stringify(a)).not.toContain('/bob/');
    const b = await read(bob, bobProject);
    expect(b.routes.map((r) => r.route)).toEqual(['/bob/secret-route']);
  });
});

describe('listing and CSRF', () => {
  it("lists only the caller's projects", async () => {
    const res = await bob.request('GET', '/api/projects');
    const { projects } = (await res.json()) as { projects: { id: string }[] };
    expect(projects.map((p) => p.id)).toEqual([bobProject]);
  });

  it('rejects cross-origin mutations', async () => {
    const res = await alice.request(
      'POST',
      '/api/projects',
      { name: 'x' },
      { origin: 'https://evil.example' },
    );
    expect(res.status).toBe(403);
  });
});

describe('tracker delivery', () => {
  it('serves the pinned bytes with SRI-compatible headers', async () => {
    const t = currentTracker();
    const res = await fetch(`${BASE}${t.scriptPath}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const body = Buffer.from(await res.arrayBuffer());
    expect(`sha384-${createHash('sha384').update(body).digest('base64')}`).toBe(t.sha384);
  });

  it('does not expose Umami beyond the collect endpoint', async () => {
    for (const path of ['/script.js', '/api/auth/verify', '/login', '/api/websites', '/api/send']) {
      const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
      expect(res.headers.get('x-powered-by') ?? '', path).not.toMatch(/umami/i);
      expect(await res.text(), path).not.toMatch(/umami/i);
    }
  });
});
