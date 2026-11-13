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

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
/** Native XLM asset contract on testnet: part of the protocol, always deployed. */
const STELLAR_ID =
  process.env.E2E_STELLAR_ID ?? 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

class Session {
  cookie = '';
  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        origin: BASE,
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie();
    if (set.length) this.cookie = set.map((c) => c.split(';')[0]).join('; ');
    return res;
  }
}

async function signUp(): Promise<Session> {
  const s = new Session();
  const email = `e2e-${randomUUID()}@example.org`;
  const res = await s.request('POST', '/api/auth/sign-up/email', {
    email,
    password: `pw-${randomUUID()}`,
    name: 'E2E',
  });
  expect(res.status, await res.clone().text()).toBe(200);
  return s;
}

async function enroll(s: Session, name: string): Promise<string> {
  const res = await s.request('POST', '/api/projects', {
    name,
    domains: `${name.toLowerCase()}.example.org`,
    stellarId: STELLAR_ID,
  });
  const body = (await res.json()) as { project?: { id: string; status: string } };
  expect(res.status, JSON.stringify(body)).toBe(201);
  expect(body.project?.status).toBe('active');
  return body.project!.id;
}

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

beforeAll(async () => {
  [alice, bob] = await Promise.all([signUp(), signUp()]);
  aliceProject = await enroll(alice, 'Alice');
  bobProject = await enroll(bob, 'Bob');
}, 60_000);

describe.each(PROJECT_ROUTES)('$method $file', (route) => {
  it(route.operatorOnly ? 'is hidden from non-operators' : 'serves the owner', async () => {
    const res = await alice.request(route.method, route.path(aliceProject));
    expect(res.status).toBe(route.operatorOnly ? 404 : 200);
  });

  it('answers another tenant with 404', async () => {
    expect((await bob.request(route.method, route.path(aliceProject))).status).toBe(404);
    expect((await alice.request(route.method, route.path(bobProject))).status).toBe(404);
  });

  it('answers unknown and malformed IDs with 404', async () => {
    for (const id of [randomUUID(), 'not-a-uuid']) {
      expect((await bob.request(route.method, route.path(id))).status).toBe(404);
    }
  });

  it('requires a session', async () => {
    const res = await new Session().request(route.method, route.path(aliceProject));
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
