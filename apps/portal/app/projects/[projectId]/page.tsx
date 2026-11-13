import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarList } from '@/components/bar-list';
import { KpiTile } from '@/components/kpi-tile';
import { RangePicker } from '@/components/range-picker';
import { StatusBadge } from '@/components/status-badge';
import { TimeSeriesChart } from '@/components/time-series-chart';
import { NotFoundError } from '@/lib/errors';
import { countryName, formatCount, formatDuration, formatPercent } from '@/lib/format';
import { getProject } from '@/lib/projects';
import { parseRange } from '@/lib/ranges';
import { getDeps, requireUser } from '@/lib/server';
import type { WebAnalytics } from '@/lib/web-analytics';
import { getWebAnalytics } from '@/lib/web-analytics';

export const metadata = { title: 'Dashboard' };

type Search = Promise<{ range?: string; from?: string; to?: string }>;

export default async function ProjectDashboard(props: {
  params: Promise<{ projectId: string }>;
  searchParams: Search;
}) {
  const user = await requireUser();
  const [{ projectId }, search] = await Promise.all([props.params, props.searchParams]);
  const deps = getDeps();
  const range = parseRange(search);

  const project = await getProject(deps, user.id, projectId).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  let web: WebAnalytics | null = null;
  try {
    web = await getWebAnalytics(deps, user.id, projectId, range);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    console.error('web analytics unavailable', error);
  }

  const base = `/projects/${project.id}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted mt-1">
            {project.domains.join(', ')} ·{' '}
            <span className="font-mono">
              {project.stellarId.slice(0, 6)}…{project.stellarId.slice(-4)}
            </span>{' '}
            ({project.stellarIdKind}, {project.stellarNetwork})
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`${base}/setup`} className="btn">
            Snippet
          </Link>
        </div>
      </div>

      <RangePicker basePath={base} range={range} />

      {!web ? (
        <p className="card p-6 text-ink-2">
          Analytics are temporarily unavailable. Please refresh in a minute.
        </p>
      ) : web.status === 'pending' ? (
        <p className="rounded-lg bg-warn-bg text-warn-ink p-4">
          ◷ Waiting for operator approval. Tracking starts once the project is approved.
        </p>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <KpiTile
              label="Unique visitors"
              value={formatCount(web.totals.visitors)}
              current={web.totals.visitors}
              previous={web.previous.visitors}
            />
            <KpiTile
              label="Visits"
              value={formatCount(web.totals.visits)}
              current={web.totals.visits}
              previous={web.previous.visits}
            />
            <KpiTile
              label="Pageviews"
              value={formatCount(web.totals.pageviews)}
              current={web.totals.pageviews}
              previous={web.previous.pageviews}
            />
            <KpiTile
              label="Bounce rate"
              value={formatPercent(web.totals.bounceRate)}
              current={web.totals.bounceRate}
              previous={web.previous.bounceRate}
              lowerIsBetter
            />
            <KpiTile
              label="Avg. visit duration"
              value={formatDuration(web.totals.avgVisitSeconds)}
              current={web.totals.avgVisitSeconds}
              previous={web.previous.avgVisitSeconds}
            />
          </div>

          <section className="card p-4">
            <h2 className="text-sm font-medium mb-2">Traffic · {range.label} (UTC)</h2>
            <TimeSeriesChart points={web.series} unit={web.range.unit} />
          </section>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <BarList title="Pages" unit="views" rows={web.breakdowns.path} />
            <BarList title="Referrers" unit="visitors" rows={web.breakdowns.referrer} />
            <BarList
              title="Countries"
              unit="visitors"
              rows={web.breakdowns.country.map((r) => ({ ...r, label: countryName(r.label) }))}
            />
            <BarList title="Devices" unit="visitors" rows={web.breakdowns.device} />
            <BarList title="Browsers" unit="visitors" rows={web.breakdowns.browser} />
            <BarList title="Operating systems" unit="visitors" rows={web.breakdowns.os} />
          </div>
        </>
      )}
    </div>
  );
}
