import { randomUUID } from 'node:crypto';
import type { UmamiStats } from './client.js';

/**
 * In-memory stand-in for the Umami endpoints Parallax uses, exposed as a
 * `fetch` function. Used by the portal's unit and isolation tests: it records
 * every call so tests can assert which website IDs were queried, and each
 * website returns its own distinguishable numbers.
 */
export interface FakeUmamiCall {
  method: string;
  path: string;
  websiteId: string | undefined;
}

interface FakeWebsite {
  id: string;
  name: string;
  domain: string;
  stats: Omit<UmamiStats, 'comparison'>;
}

export class FakeUmami {
  readonly calls: FakeUmamiCall[] = [];
  readonly websites = new Map<string, FakeWebsite>();
  #password: string;
  #tokens = new Set<string>();

  constructor(
    readonly username = 'admin',
    password = 'umami',
  ) {
    this.#password = password;
  }

  get password(): string {
    return this.#password;
  }

  /** Sets the totals one website returns from /stats. */
  setStats(websiteId: string, stats: Partial<FakeWebsite['stats']>): void {
    const site = this.websites.get(websiteId);
    if (!site) throw new Error(`unknown website ${websiteId}`);
    site.stats = { ...site.stats, ...stats };
  }

  /** Invalidates every issued token, as a password change or new APP_SECRET would. */
  revokeAllTokens(): void {
    this.#tokens.clear();
  }

  /** Websites whose analytics were read, in call order. */
  analyticsReads(): string[] {
    return this.calls.filter((c) => c.method === 'GET' && c.websiteId).map((c) => c.websiteId!);
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, string>) : {};
    const websiteId = /^\/api\/websites\/([^/]+)/.exec(url.pathname)?.[1];
    this.calls.push({ method, path: url.pathname, websiteId });

    if (method === 'POST' && url.pathname === '/api/auth/login') {
      if (body.username !== this.username || body.password !== this.#password) return json(401, {});
      const token = `fake-token-${randomUUID()}`;
      this.#tokens.add(token);
      return json(200, { token, user: { passwordChangeRequired: this.#password === 'umami' } });
    }

    const auth = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '');
    if (!auth || !this.#tokens.has(auth)) return json(401, {});

    if (method === 'POST' && url.pathname === '/api/me/password') {
      if (body.currentPassword !== this.#password) return json(400, {});
      this.#password = body.newPassword ?? '';
      this.#tokens.clear();
      return json(200, {});
    }

    if (method === 'POST' && url.pathname === '/api/websites') {
      const site: FakeWebsite = {
        id: randomUUID(),
        name: body.name ?? '',
        domain: body.domain ?? '',
        stats: { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 },
      };
      this.websites.set(site.id, site);
      return json(200, { id: site.id, name: site.name, domain: site.domain });
    }

    const site = websiteId ? this.websites.get(websiteId) : undefined;
    if (!site) return json(404, {});
    const endpoint = url.pathname.split('/')[4];

    if (method === 'DELETE' && endpoint === undefined) {
      this.websites.delete(site.id);
      return json(200, { ok: true });
    }
    if (method === 'GET' && endpoint === 'stats') {
      const zero = { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 };
      return json(200, { ...site.stats, comparison: zero });
    }
    if (method === 'GET' && endpoint === 'pageviews') {
      const x = new Date(Number(url.searchParams.get('startAt'))).toISOString();
      return json(200, {
        pageviews: [{ x, y: site.stats.pageviews }],
        sessions: [{ x, y: site.stats.visits }],
      });
    }
    if (method === 'GET' && endpoint === 'metrics') {
      return json(200, [{ x: `${url.searchParams.get('type')}:${site.name}`, y: site.stats.pageviews }]);
    }
    if (method === 'GET' && endpoint === 'active') {
      return json(200, { visitors: 0 });
    }
    return json(404, {});
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
