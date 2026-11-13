import type { ApiAnalytics } from './api-analytics';
import { readApi } from './api-analytics';
import type { Deps } from './deps';
import { NotFoundError } from './errors';
import type { OperatorContext } from './operator';
import type { TenantRow } from './operator-data';
import { globalOverview } from './operator-data';
import type { Range } from './ranges';
import { parseRange } from './ranges';
import type { WebAnalytics } from './web-analytics';
import { readWebsite } from './web-analytics';
import { project } from '@parallax/db';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { scopeFilter } from './operator-data';

/** Shared query parameters of /api/v1/metrics/*. */
export function parseQuery(url: string): { range: Range; projectId: string | null } {
  const q = new URL(url).searchParams;
  const range = parseRange({
    range: q.get('range') ?? undefined,
    from: q.get('from') ?? undefined,
    to: q.get('to') ?? undefined,
  });
  return { range, projectId: q.get('project') };
}

const rangeOut = (r: Range) => ({
  key: r.key,
  start: new Date(r.startAt).toISOString(),
  end: new Date(r.endAt).toISOString(),
  unit: r.unit,
});

const projectOut = (t: TenantRow) => ({
  id: t.id,
  name: t.name,
  domains: t.domains,
  status: t.status,
  stellarId: t.stellarId,
  stellarNetwork: t.stellarNetwork,
  isDemo: t.isDemo,
});

async function scopedProject(deps: Pick<Deps, 'db'>, op: OperatorContext, id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError();
  const [p] = await deps.db
    .select()
    .from(project)
    .where(and(eq(project.id, id), ne(project.status, 'removed'), scopeFilter(op)));
  if (!p) throw new NotFoundError();
  return p;
}

export async function webMetrics(
  deps: Pick<Deps, 'db' | 'umami'>,
  op: OperatorContext,
  url: string,
): Promise<
  | {
      range: ReturnType<typeof rangeOut>;
      projects: (ReturnType<typeof projectOut> & { web: TenantRow['web'] })[];
    }
  | { range: ReturnType<typeof rangeOut>; project: { id: string; name: string }; web: WebAnalytics }
> {
  const { range, projectId } = parseQuery(url);
  if (projectId) {
    const p = await scopedProject(deps, op, projectId);
    return {
      range: rangeOut(range),
      project: { id: p.id, name: p.name },
      web: await readWebsite(deps, p.umamiWebsiteId, range),
    };
  }
  const rows = await globalOverview(deps, op, range);
  return { range: rangeOut(range), projects: rows.map((r) => ({ ...projectOut(r), web: r.web })) };
}

export async function apiMetrics(
  deps: Pick<Deps, 'db' | 'umami'>,
  op: OperatorContext,
  url: string,
): Promise<
  | {
      range: ReturnType<typeof rangeOut>;
      projects: (ReturnType<typeof projectOut> & { api: TenantRow['api'] })[];
    }
  | {
      range: ReturnType<typeof rangeOut>;
      project: { id: string; name: string };
      api: Omit<ApiAnalytics, 'keys'>;
    }
> {
  const { range, projectId } = parseQuery(url);
  if (projectId) {
    const p = await scopedProject(deps, op, projectId);
    const { keys, ...api } = await readApi(deps, p.id, range);
    return { range: rangeOut(range), project: { id: p.id, name: p.name }, api };
  }
  const rows = await globalOverview(deps, op, range);
  return { range: rangeOut(range), projects: rows.map((r) => ({ ...projectOut(r), api: r.api })) };
}
