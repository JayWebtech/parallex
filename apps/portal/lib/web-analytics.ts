import type { MetricType, UmamiMetricRow, UmamiStats } from '@parallax/umami';
import type { Deps } from './deps';
import { getProject } from './projects';
import type { Range } from './ranges';
import { fillSeries } from './series';

export interface WebTotals {
  pageviews: number;
  visitors: number;
  visits: number;
  /** 0–1: share of visits with a single pageview. */
  bounceRate: number;
  /** Average visit duration in seconds. */
  avgVisitSeconds: number;
}

export interface Row {
  label: string;
  value: number;
}

export interface WebAnalytics {
  status: 'active' | 'pending';
  range: { startAt: number; endAt: number; unit: Range['unit'] };
  totals: WebTotals;
  /** Same metrics for the preceding period of equal length. */
  previous: WebTotals;
  series: { x: string; pageviews: number; visits: number }[];
  breakdowns: Record<Breakdown, Row[]>;
}

export const BREAKDOWNS = ['path', 'referrer', 'country', 'device', 'browser', 'os'] as const;
export type Breakdown = (typeof BREAKDOWNS)[number] & MetricType;

const ZERO: WebTotals = { pageviews: 0, visitors: 0, visits: 0, bounceRate: 0, avgVisitSeconds: 0 };

export function toTotals(s: Omit<UmamiStats, 'comparison'>): WebTotals {
  return {
    pageviews: s.pageviews,
    visitors: s.visitors,
    visits: s.visits,
    bounceRate: s.visits > 0 ? Math.min(s.bounces, s.visits) / s.visits : 0,
    avgVisitSeconds: s.visits > 0 ? s.totaltime / s.visits : 0,
  };
}

const toRows = (rows: UmamiMetricRow[]): Row[] =>
  rows.map((r) => ({ label: r.x ?? '(none)', value: r.y }));

/**
 * Web analytics for one project, read server-side from Umami. The website ID
 * comes from the project row returned by `getProject`, which only succeeds
 * for the owner; nothing from the request reaches Umami except the range.
 */
export async function getWebAnalytics(
  deps: Pick<Deps, 'db' | 'umami'>,
  userId: string,
  projectId: string,
  range: Range,
): Promise<WebAnalytics> {
  const project = await getProject(deps, userId, projectId);
  return readWebsite(deps, project.umamiWebsiteId, range);
}

/** Shared by tenant and (later) operator views. Callers are responsible for authorization. */
export async function readWebsite(
  deps: Pick<Deps, 'umami'>,
  websiteId: string | null,
  range: Range,
): Promise<WebAnalytics> {
  const window = { startAt: range.startAt, endAt: range.endAt };
  const empty = Object.fromEntries(BREAKDOWNS.map((b) => [b, []])) as unknown as Record<
    Breakdown,
    Row[]
  >;
  if (!websiteId) {
    return {
      status: 'pending',
      range: { ...window, unit: range.unit },
      totals: ZERO,
      previous: ZERO,
      series: [],
      breakdowns: empty,
    };
  }

  const [stats, pageviews, ...breakdowns] = await Promise.all([
    deps.umami.getStats(websiteId, window),
    deps.umami.getPageviews(websiteId, { ...window, unit: range.unit, timezone: 'UTC' }),
    ...BREAKDOWNS.map((type) => deps.umami.getMetrics(websiteId, type, { ...window, limit: 10 })),
  ]);

  const visitsAt = new Map(pageviews.sessions.map((p) => [p.x, p.y]));
  const series = fillSeries(
    pageviews.pageviews.map((p) => ({ x: p.x, pageviews: p.y, visits: visitsAt.get(p.x) ?? 0 })),
    { ...window, unit: range.unit },
    { pageviews: 0, visits: 0 },
  ).map(({ t, pageviews: pv, visits }) => ({ x: new Date(t).toISOString(), pageviews: pv, visits }));
  return {
    status: 'active',
    range: { ...window, unit: range.unit },
    totals: toTotals(stats),
    previous: toTotals(stats.comparison),
    series,
    breakdowns: Object.fromEntries(
      BREAKDOWNS.map((b, i) => [b, toRows(breakdowns[i] ?? [])]),
    ) as Record<Breakdown, Row[]>,
  };
}
