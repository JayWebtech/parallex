import { quantileMs } from '@parallax/shared';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Deps } from './deps';
import { getProject } from './projects';
import type { Range } from './ranges';
import { fillSeries } from './series';

export interface ApiTotals {
  requests: number;
  /** Share of requests answered 5xx. */
  errorRate: number;
  /** Share answered 4xx. */
  clientErrorRate: number;
  p50: number | null;
  p95: number | null;
}

export interface ApiRoute {
  service: string;
  method: string;
  route: string;
  requests: number;
  status: { s2xx: number; s3xx: number; s4xx: number; s5xx: number; other: number };
  p50: number | null;
  p95: number | null;
}

export interface ApiAnalytics {
  range: { startAt: number; endAt: number; unit: Range['unit'] };
  /** Which rollup table answered (minute ≤ 48 h, hour ≤ 90 d, day beyond). */
  resolution: 'minute' | 'hour' | 'day';
  totals: ApiTotals;
  previous: ApiTotals;
  series: { x: string; requests: number; errors: number }[];
  routes: ApiRoute[];
  services: string[];
  warnings: { secretsRedacted: number; routesOverflowed: number };
  keys: { active: number; lastUsedAt: string | null };
}

const HOUR = 3_600_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Table {
  name: SQL;
  /** Expression yielding a timestamptz for the row. */
  time: SQL;
  resolution: ApiAnalytics['resolution'];
}

function pickTable(range: Pick<Range, 'startAt' | 'endAt'>, nowMs: number): Table {
  const span = range.endAt - range.startAt;
  if (span <= 48 * HOUR && range.startAt >= nowMs - 14 * 24 * HOUR) {
    return { name: sql`api_metrics.request_minute`, time: sql`minute`, resolution: 'minute' };
  }
  if (range.startAt >= nowMs - 90 * 24 * HOUR) {
    return { name: sql`api_metrics.request_hour`, time: sql`hour`, resolution: 'hour' };
  }
  return {
    name: sql`api_metrics.request_day`,
    time: sql`(day::timestamp AT TIME ZONE 'UTC')`,
    resolution: 'day',
  };
}

/**
 * Rows for the given projects and range, keeping one source per (project,
 * service): metrics when the service sent any, otherwise SERVER-span counts.
 * Prevents double counting when a tenant exports both signals.
 */
function scopedRows(
  table: Table,
  projectIds: string | string[],
  startAt: number,
  endAt: number,
): SQL {
  const ids = (Array.isArray(projectIds) ? projectIds : [projectIds]).filter((id) => UUID.test(id));
  // One bound parameter holding a Postgres array literal (drizzle would expand a JS array).
  const idArray = `{${ids.join(',')}}`;
  return sql`
    scoped AS (
      SELECT * FROM ${table.name}
       WHERE project_id = ANY(${idArray}::uuid[])
         AND ${table.time} >= to_timestamp(${startAt}::float8 / 1000)
         AND ${table.time} <= to_timestamp(${endAt}::float8 / 1000)
    ),
    pref AS (
      SELECT project_id, service_name,
             CASE WHEN bool_or(source = 'metrics') THEN 'metrics' ELSE 'traces' END AS src
        FROM scoped GROUP BY project_id, service_name
    ),
    r AS (
      SELECT s.* FROM scoped s
        JOIN pref p ON p.project_id = s.project_id AND p.service_name = s.service_name AND p.src = s.source
    )`;
}

const toBuckets = (b: unknown): number[] => (Array.isArray(b) ? b.map(Number) : []);

function totalsFrom(row: Record<string, unknown> | undefined): ApiTotals {
  const requests = Number(row?.requests ?? 0);
  const buckets = toBuckets(row?.buckets);
  return {
    requests,
    errorRate: requests ? Number(row?.s5xx ?? 0) / requests : 0,
    clientErrorRate: requests ? Number(row?.s4xx ?? 0) / requests : 0,
    p50: quantileMs(buckets, 0.5),
    p95: quantileMs(buckets, 0.95),
  };
}

async function totals(
  deps: Pick<Deps, 'db'>,
  table: Table,
  projectId: string,
  start: number,
  end: number,
) {
  const res = await deps.db.execute(sql`
    WITH ${scopedRows(table, projectId, start, end)}
    SELECT sum(count) AS requests,
           sum(count) FILTER (WHERE status_code BETWEEN 400 AND 499) AS s4xx,
           sum(count) FILTER (WHERE status_code BETWEEN 500 AND 599) AS s5xx,
           api_metrics.bucket_sum(duration_buckets) AS buckets
      FROM r`);
  return totalsFrom(res.rows[0]);
}

/**
 * API analytics for one project. Authorization: `getProject` only succeeds
 * for the owner; every query below is additionally filtered by that project's ID.
 */
export async function getApiAnalytics(
  deps: Pick<Deps, 'db'>,
  userId: string,
  projectId: string,
  range: Range,
  nowMs = Date.now(),
): Promise<ApiAnalytics> {
  const p = await getProject(deps, userId, projectId);
  return readApi(deps, p.id, range, nowMs);
}

/** Callers are responsible for authorization (tenant: getProject; operators: role check). */
export async function readApi(
  deps: Pick<Deps, 'db'>,
  projectId: string,
  range: Range,
  nowMs = Date.now(),
): Promise<ApiAnalytics> {
  const table = pickTable(range, nowMs);
  const span = range.endAt - range.startAt;
  const prevTable = pickTable({ startAt: range.startAt - span, endAt: range.startAt }, nowMs);
  const unit = range.unit === 'hour' ? sql`'hour'` : sql`'day'`;

  const [current, previous, series, routes, warnings, keys] = await Promise.all([
    totals(deps, table, projectId, range.startAt, range.endAt),
    totals(deps, prevTable, projectId, range.startAt - span, range.startAt - 1),
    deps.db.execute(sql`
      WITH ${scopedRows(table, projectId, range.startAt, range.endAt)}
      SELECT to_char(date_trunc(${unit}, ${table.time} AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS x,
             sum(count) AS requests,
             sum(count) FILTER (WHERE status_code BETWEEN 500 AND 599) AS errors
        FROM r GROUP BY 1 ORDER BY 1`),
    deps.db.execute(sql`
      WITH ${scopedRows(table, projectId, range.startAt, range.endAt)}
      SELECT service_name, method, route,
             sum(count) AS requests,
             sum(count) FILTER (WHERE status_code BETWEEN 200 AND 299) AS s2xx,
             sum(count) FILTER (WHERE status_code BETWEEN 300 AND 399) AS s3xx,
             sum(count) FILTER (WHERE status_code BETWEEN 400 AND 499) AS s4xx,
             sum(count) FILTER (WHERE status_code BETWEEN 500 AND 599) AS s5xx,
             api_metrics.bucket_sum(duration_buckets) AS buckets
        FROM r GROUP BY 1, 2, 3 ORDER BY requests DESC, route LIMIT 200`),
    deps.db.execute(sql`
      SELECT coalesce(sum(secrets_redacted), 0) AS secrets, coalesce(sum(routes_overflowed), 0) AS overflow
        FROM api_metrics.ingest_warning_day
       WHERE project_id = ${projectId}
         AND day >= (to_timestamp(${range.startAt}::float8 / 1000) AT TIME ZONE 'UTC')::date`),
    deps.db.execute(sql`
      SELECT count(*) FILTER (WHERE revoked_at IS NULL) AS active, max(last_used_at) AS last_used
        FROM api_metrics.ingest_key WHERE project_id = ${projectId}`),
  ]);

  const routeRows: ApiRoute[] = routes.rows.map((r) => {
    const requests = Number(r.requests);
    const s = {
      s2xx: Number(r.s2xx ?? 0),
      s3xx: Number(r.s3xx ?? 0),
      s4xx: Number(r.s4xx ?? 0),
      s5xx: Number(r.s5xx ?? 0),
    };
    const buckets = toBuckets(r.buckets);
    return {
      service: String(r.service_name),
      method: String(r.method),
      route: String(r.route),
      requests,
      status: { ...s, other: requests - s.s2xx - s.s3xx - s.s4xx - s.s5xx },
      p50: quantileMs(buckets, 0.5),
      p95: quantileMs(buckets, 0.95),
    };
  });

  const filled = fillSeries(
    series.rows.map((r) => ({
      x: String(r.x),
      requests: Number(r.requests),
      errors: Number(r.errors ?? 0),
    })),
    { startAt: range.startAt, endAt: range.endAt, unit: range.unit },
    { requests: 0, errors: 0 },
  ).map(({ t, requests, errors }) => ({ x: new Date(t).toISOString(), requests, errors }));

  const lastUsed = keys.rows[0]?.last_used;
  return {
    range: { startAt: range.startAt, endAt: range.endAt, unit: range.unit },
    resolution: table.resolution,
    totals: current,
    previous,
    series: filled,
    routes: routeRows,
    services: [...new Set(routeRows.map((r) => r.service))].sort(),
    warnings: {
      secretsRedacted: Number(warnings.rows[0]?.secrets ?? 0),
      routesOverflowed: Number(warnings.rows[0]?.overflow ?? 0),
    },
    keys: {
      active: Number(keys.rows[0]?.active ?? 0),
      lastUsedAt: lastUsed ? new Date(String(lastUsed)).toISOString() : null,
    },
  };
}

// ── Multi-project reads (operator views). Callers enforce operator scope. ──

/** API totals for many projects in one query. Projects without data are absent. */
export async function apiTotalsByProject(
  deps: Pick<Deps, 'db'>,
  projectIds: string[],
  range: Pick<Range, 'startAt' | 'endAt'>,
  nowMs = Date.now(),
): Promise<Map<string, ApiTotals>> {
  if (projectIds.length === 0) return new Map();
  const table = pickTable(range, nowMs);
  const res = await deps.db.execute(sql`
    WITH ${scopedRows(table, projectIds, range.startAt, range.endAt)}
    SELECT project_id,
           sum(count) AS requests,
           sum(count) FILTER (WHERE status_code BETWEEN 400 AND 499) AS s4xx,
           sum(count) FILTER (WHERE status_code BETWEEN 500 AND 599) AS s5xx,
           api_metrics.bucket_sum(duration_buckets) AS buckets
      FROM r GROUP BY project_id`);
  return new Map(res.rows.map((row) => [String(row.project_id), totalsFrom(row)]));
}

/** Requests per time bucket for each project (zero-filled). */
export async function apiSeriesByProject(
  deps: Pick<Deps, 'db'>,
  projectIds: string[],
  range: Range,
  nowMs = Date.now(),
): Promise<Map<string, { x: string; requests: number }[]>> {
  const table = pickTable(range, nowMs);
  const unit = range.unit === 'hour' ? sql`'hour'` : sql`'day'`;
  const res = projectIds.length
    ? await deps.db.execute(sql`
        WITH ${scopedRows(table, projectIds, range.startAt, range.endAt)}
        SELECT project_id,
               to_char(date_trunc(${unit}, ${table.time} AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS x,
               sum(count) AS requests
          FROM r GROUP BY 1, 2 ORDER BY 2`)
    : { rows: [] };
  const out = new Map<string, { x: string; requests: number }[]>();
  for (const id of projectIds) {
    const points = res.rows
      .filter((r) => String(r.project_id) === id)
      .map((r) => ({ x: String(r.x), requests: Number(r.requests) }));
    out.set(
      id,
      fillSeries(points, range, { requests: 0 }).map(({ t, requests }) => ({
        x: new Date(t).toISOString(),
        requests,
      })),
    );
  }
  return out;
}
