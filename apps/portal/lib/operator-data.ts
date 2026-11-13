import { project, user } from '@parallax/db';
import type { Project } from '@parallax/db';
import type { UmamiClient } from '@parallax/umami';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { ApiTotals } from './api-analytics';
import { apiSeriesByProject, apiTotalsByProject } from './api-analytics';
import type { Deps } from './deps';
import { NotFoundError, ValidationError } from './errors';
import type { OperatorContext } from './operator';
import type { Range } from './ranges';
import { fillSeries } from './series';
import type { WebTotals } from './web-analytics';
import { toTotals } from './web-analytics';

/** Restricts a query to what the operator may see (demo operators: demo tenants only). */
export function scopeFilter(op: OperatorContext): SQL | undefined {
  return op.scope === 'demo' ? eq(project.isDemo, true) : undefined;
}

export interface TenantRow {
  id: string;
  name: string;
  domains: string[];
  status: Project['status'];
  stellarId: string;
  stellarIdKind: Project['stellarIdKind'];
  stellarNetwork: Project['stellarNetwork'];
  scfUrl: string | null;
  isDemo: boolean;
  ownerEmail: string;
  createdAt: string;
  /** Null when the project has no website yet or Umami could not be reached. */
  web: WebTotals | null;
  /** Null when the project sent no API data in the range. */
  api: Pick<ApiTotals, 'requests' | 'errorRate' | 'p95'> | null;
}

const WEB_CONCURRENCY = 8;

/** Runs `fn` over `items` with at most `limit` calls in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

async function webTotals(umami: UmamiClient, websiteId: string | null, range: Range) {
  if (!websiteId) return null;
  try {
    return toTotals(
      await umami.getStats(websiteId, { startAt: range.startAt, endAt: range.endAt }),
    );
  } catch {
    return null;
  }
}

async function scopedProjects(deps: Pick<Deps, 'db'>, op: OperatorContext, ids?: string[]) {
  return deps.db
    .select({ p: project, ownerEmail: user.email })
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(
      and(
        ne(project.status, 'removed'),
        scopeFilter(op),
        ids ? inArray(project.id, ids) : undefined,
      ),
    )
    .orderBy(project.name);
}

function toRow(
  r: { p: Project; ownerEmail: string },
  web: WebTotals | null,
  api: ApiTotals | undefined,
): TenantRow {
  return {
    id: r.p.id,
    name: r.p.name,
    domains: r.p.domains,
    status: r.p.status,
    stellarId: r.p.stellarId,
    stellarIdKind: r.p.stellarIdKind,
    stellarNetwork: r.p.stellarNetwork,
    scfUrl: r.p.scfUrl,
    isDemo: r.p.isDemo,
    ownerEmail: r.ownerEmail,
    createdAt: r.p.createdAt.toISOString(),
    web,
    api:
      api && api.requests > 0
        ? { requests: api.requests, errorRate: api.errorRate, p95: api.p95 }
        : null,
  };
}

/**
 * Every tenant the operator may see, with web and API totals for the range.
 * API totals come from one query; web totals from Umami per website (bounded
 * concurrency). For hundreds of tenants, a read-only role on Umami's database
 * would replace the per-website calls (see docs/architecture.md).
 */
export async function globalOverview(
  deps: Pick<Deps, 'db' | 'umami'>,
  op: OperatorContext,
  range: Range,
  nowMs = Date.now(),
): Promise<TenantRow[]> {
  const rows = await scopedProjects(deps, op);
  const [web, api] = await Promise.all([
    mapLimit(rows, WEB_CONCURRENCY, (r) => webTotals(deps.umami, r.p.umamiWebsiteId, range)),
    apiTotalsByProject(
      deps,
      rows.map((r) => r.p.id),
      range,
      nowMs,
    ),
  ]);
  return rows.map((r, i) => toRow(r, web[i] ?? null, api.get(r.p.id)));
}

export interface Comparison {
  projects: TenantRow[];
  /** One point per bucket; each project's value under its ID. */
  web: ({ x: string } & Record<string, number | string>)[];
  api: ({ x: string } & Record<string, number | string>)[];
}

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

/** Side-by-side series for 2–4 projects within the operator's scope. */
export async function compareProjects(
  deps: Pick<Deps, 'db' | 'umami'>,
  op: OperatorContext,
  ids: string[],
  range: Range,
  nowMs = Date.now(),
): Promise<Comparison> {
  const unique = [...new Set(ids)];
  if (unique.length < MIN_COMPARE || unique.length > MAX_COMPARE) {
    throw new ValidationError({ ids: `Pick ${MIN_COMPARE} to ${MAX_COMPARE} projects.` });
  }
  if (!unique.every((id) => /^[0-9a-f-]{36}$/i.test(id))) throw new NotFoundError();
  const rows = await scopedProjects(deps, op, unique);
  if (rows.length !== unique.length) throw new NotFoundError();
  // Keep the order the operator picked (it drives series colors).
  rows.sort((a, b) => unique.indexOf(a.p.id) - unique.indexOf(b.p.id));

  const window = { startAt: range.startAt, endAt: range.endAt };
  const [webSeries, webTotalsList, apiSeries, apiTotals] = await Promise.all([
    Promise.all(
      rows.map(async (r) => {
        if (!r.p.umamiWebsiteId) return [];
        try {
          const pv = await deps.umami.getPageviews(r.p.umamiWebsiteId, {
            ...window,
            unit: range.unit,
            timezone: 'UTC',
          });
          return fillSeries(pv.pageviews, range, { y: 0 }).map(({ t, y }) => ({ t, y }));
        } catch {
          return [];
        }
      }),
    ),
    Promise.all(rows.map((r) => webTotals(deps.umami, r.p.umamiWebsiteId, range))),
    apiSeriesByProject(deps, unique, range, nowMs),
    apiTotalsByProject(deps, unique, range, nowMs),
  ]);

  const buckets = fillSeries([], range, {}).map(({ t }) => t);
  const web = buckets.map((t) => {
    const point: { x: string } & Record<string, number | string> = { x: new Date(t).toISOString() };
    rows.forEach((r, i) => {
      point[r.p.id] = webSeries[i]?.find((p) => p.t === t)?.y ?? 0;
    });
    return point;
  });
  const api = buckets.map((t) => {
    const x = new Date(t).toISOString();
    const point: { x: string } & Record<string, number | string> = { x };
    for (const r of rows)
      point[r.p.id] = apiSeries.get(r.p.id)?.find((p) => p.x === x)?.requests ?? 0;
    return point;
  });

  return {
    projects: rows.map((r, i) => toRow(r, webTotalsList[i] ?? null, apiTotals.get(r.p.id))),
    web,
    api,
  };
}
