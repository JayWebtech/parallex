import { z } from 'zod';

/**
 * Minimal, typed client for the parts of Umami's REST API (v3.5) Parallax
 * uses. Umami is never exposed publicly: only the portal talks to it, over the
 * internal network, with admin credentials kept server-side.
 *
 * This client is deliberately tenant-agnostic. Tenant scoping happens in the
 * portal, which only ever passes website IDs it loaded from its own database
 * for the signed-in user.
 */

export interface UmamiClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  /** Injected for tests. Defaults to global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface TimeRange {
  /** Epoch milliseconds, inclusive. */
  startAt: number;
  /** Epoch milliseconds, inclusive. */
  endAt: number;
}

export type TimeUnit = 'minute' | 'hour' | 'day' | 'month' | 'year';

/** Dimensions Parallax shows. Umami supports more (see metricsQuerySchema upstream). */
export type MetricType =
  | 'path'
  | 'referrer'
  | 'browser'
  | 'os'
  | 'device'
  | 'country'
  | 'hostname'
  | 'entry'
  | 'exit';

export class UmamiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(`Umami ${status} on ${path}: ${message}`);
    this.name = 'UmamiError';
  }
}

const loginResponse = z.object({
  token: z.string(),
  user: z.object({ passwordChangeRequired: z.boolean().optional() }).loose(),
});

const website = z.object({ id: z.uuid(), name: z.string(), domain: z.string().nullable() }).loose();
export type UmamiWebsite = z.infer<typeof website>;

const statsValues = z.object({
  pageviews: z.number(),
  visitors: z.number(),
  visits: z.number(),
  bounces: z.number(),
  totaltime: z.number(),
});
const stats = statsValues.extend({ comparison: statsValues });
export type UmamiStats = z.infer<typeof stats>;

const point = z.object({ x: z.string(), y: z.number() });
const pageviews = z.object({ pageviews: z.array(point), sessions: z.array(point) });
export type UmamiPageviews = z.infer<typeof pageviews>;

const metricRows = z.array(z.object({ x: z.string().nullable(), y: z.number() }));
export type UmamiMetricRow = z.infer<typeof metricRows>[number];

const activeVisitors = z.object({ visitors: z.number() });

export class UmamiClient {
  readonly #baseUrl: string;
  readonly #username: string;
  readonly #password: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;
  #token: Promise<string> | undefined;

  constructor(options: UmamiClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.#username = options.username;
    this.#password = options.password;
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
  }

  /**
   * Makes sure the admin account uses the configured password. A fresh Umami
   * seeds `admin` / `umami` and (since v3.5) requires a change before use, so
   * on first boot we sign in with the default and set ours.
   */
  async ensureAdminPassword(defaultPassword = 'umami'): Promise<'ok' | 'changed'> {
    if ((await this.#tryLogin(this.#password)) !== null) return 'ok';
    const token = await this.#tryLogin(defaultPassword);
    if (token === null) {
      throw new UmamiError(401, '/api/auth/login', 'neither configured nor default password works');
    }
    await this.#send('POST', '/api/me/password', token, {
      currentPassword: defaultPassword,
      newPassword: this.#password,
    });
    this.#token = undefined;
    return 'changed';
  }

  async createWebsite(input: { name: string; domain: string }): Promise<UmamiWebsite> {
    return website.parse(await this.#request('POST', '/api/websites', input));
  }

  async deleteWebsite(websiteId: string): Promise<void> {
    await this.#request('DELETE', `/api/websites/${encodeURIComponent(websiteId)}`);
  }

  /** Totals for the range plus the same totals for the preceding period of equal length. */
  async getStats(websiteId: string, range: TimeRange): Promise<UmamiStats> {
    return stats.parse(await this.#analytics(websiteId, 'stats', range));
  }

  async getPageviews(
    websiteId: string,
    range: TimeRange & { unit: TimeUnit; timezone: string },
  ): Promise<UmamiPageviews> {
    return pageviews.parse(await this.#analytics(websiteId, 'pageviews', range));
  }

  async getMetrics(
    websiteId: string,
    type: MetricType,
    range: TimeRange & { limit?: number },
  ): Promise<UmamiMetricRow[]> {
    return metricRows.parse(await this.#analytics(websiteId, 'metrics', { ...range, type }));
  }

  async getActiveVisitors(websiteId: string): Promise<number> {
    const path = `/api/websites/${encodeURIComponent(websiteId)}/active`;
    return activeVisitors.parse(await this.#request('GET', path)).visitors;
  }

  #analytics(websiteId: string, endpoint: string, params: object): Promise<unknown> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return this.#request('GET', `/api/websites/${encodeURIComponent(websiteId)}/${endpoint}?${query}`);
  }

  async #request(method: string, path: string, body?: unknown): Promise<unknown> {
    try {
      return await this.#send(method, path, await this.#getToken(), body);
    } catch (error) {
      // Tokens are invalidated by password changes or restarts with a new APP_SECRET.
      if (!(error instanceof UmamiError) || error.status !== 401) throw error;
      this.#token = undefined;
      return this.#send(method, path, await this.#getToken(), body);
    }
  }

  #getToken(): Promise<string> {
    this.#token ??= this.#tryLogin(this.#password).then((token) => {
      if (token === null) {
        this.#token = undefined;
        throw new UmamiError(401, '/api/auth/login', 'admin login failed');
      }
      return token;
    });
    return this.#token;
  }

  async #tryLogin(password: string): Promise<string | null> {
    try {
      const data = await this.#send('POST', '/api/auth/login', null, {
        username: this.#username,
        password,
      });
      return loginResponse.parse(data).token;
    } catch (error) {
      if (error instanceof UmamiError && error.status === 401) return null;
      throw error;
    }
  }

  async #send(method: string, path: string, token: string | null, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await this.#fetch(`${this.#baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) throw new UmamiError(res.status, path.split('?')[0] ?? path, text.slice(0, 200));
    return text === '' ? null : (JSON.parse(text) as unknown);
  }
}
