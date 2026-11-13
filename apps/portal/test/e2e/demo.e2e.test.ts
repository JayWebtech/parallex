/**
 * The public demo (/demo) against a running stack with COMPOSE_PROFILES=demo.
 * No account: it must show the demo tenant and nothing else, and answer a real
 * tenant's project ID exactly like a missing one.
 */
import { createDb } from '@parallax/db';
import { DEMO_API_PROJECT, DEMO_PROJECTS } from '@parallax/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { BASE, enroll, setting, signUp } from './session';

const anon = (path: string) => fetch(`${BASE}${path}`, { redirect: 'manual' });
let realProject: string;
let realName: string;

beforeAll(async () => {
  const owner = await signUp();
  realName = `Real-${Date.now()}`;
  realProject = await enroll(owner, realName);
});

describe('public demo', () => {
  it('opens on the first demo project without signing in', async () => {
    const res = await anon('/demo');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(new RegExp(`/demo/${DEMO_PROJECTS[0]!.id}$`));
  });

  it('shows demo web and API dashboards', async () => {
    for (const path of [`/demo/${DEMO_PROJECTS[0]!.id}`, `/demo/${DEMO_API_PROJECT.id}/api`]) {
      const res = await anon(path);
      expect(res.status, path).toBe(200);
      expect(await res.text()).toContain(DEMO_API_PROJECT.name);
    }
  });

  it("answers a real tenant's ID with 404, on every demo page", async () => {
    for (const path of [`/demo/${realProject}`, `/demo/${realProject}/api`]) {
      expect((await anon(path)).status, path).toBe(404);
    }
    const compare = await anon(`/demo/operator/compare?ids=${DEMO_PROJECTS[0]!.id},${realProject}`);
    expect(compare.status).toBe(404);
  });

  it('operator view lists demo projects only', async () => {
    const html = await (await anon('/demo/operator')).text();
    for (const p of DEMO_PROJECTS) expect(html).toContain(p.name);
    expect(html).not.toContain(realName);
  });

  it('serves the example sites with the pinned tracker', async () => {
    for (const p of DEMO_PROJECTS) {
      const res = await anon(`${p.site.basePath}/`);
      expect(res.status, p.site.basePath).toBe(200);
      expect(await res.text()).toContain('/p/v1.0.0/px.js');
    }
  });
});

describe('stored web data', () => {
  it('has a country at most: region and city are always empty', async () => {
    // Umami's database, through the loopback-only debug port of the compose stack.
    const url = `postgresql://postgres:${encodeURIComponent(setting('POSTGRES_PASSWORD') ?? '')}@127.0.0.1:${setting('POSTGRES_HOST_PORT') ?? '55432'}/umami`;
    const { pool } = createDb(url, { max: 1 });
    try {
      const { rows } = await pool.query<{ sessions: number; located: number }>(
        `SELECT count(*)::int AS sessions,
                count(*) FILTER (WHERE region IS NOT NULL OR city IS NOT NULL)::int AS located
           FROM session`,
      );
      expect(rows[0]!.sessions).toBeGreaterThan(0);
      expect(rows[0]!.located).toBe(0);
    } finally {
      await pool.end();
    }
  });
});
