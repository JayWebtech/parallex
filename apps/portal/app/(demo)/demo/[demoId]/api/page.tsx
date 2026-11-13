import { Plug } from 'lucide-react';
import { ApiDashboardBody } from '@/components/dashboards/api-dashboard';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { ApiAnalytics } from '@/lib/api-analytics';
import { readApi } from '@/lib/api-analytics';
import { demoCached, getDemoProject, rangeKey } from '@/lib/demo';
import { orNotFound } from '@/lib/page-data';
import { parseRange } from '@/lib/ranges';
import { getDeps } from '@/lib/server';

export const metadata = { title: 'Demo · API analytics' };

export default async function DemoApi(props: {
  params: Promise<{ demoId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const [{ demoId }, search] = await Promise.all([props.params, props.searchParams]);
  // Demo projects only: a real tenant's ID is a 404, like a missing one.
  const project = await getDemoProject(getDeps(), demoId).catch(orNotFound);
  const range = parseRange({ range: '24h', ...search });
  const api: ApiAnalytics = await demoCached(`api:${project.id}:${rangeKey(range)}`, () =>
    readApi(getDeps(), project.id, range),
  );

  return (
    <>
      <PageHeader
        title={project.name}
        badge={<Badge variant="secondary">Demo</Badge>}
        description="API analytics · examples/express-api, exporting OpenTelemetry metrics"
        actions={<RangePicker current={range.key} from={range.from} to={range.to} />}
      />
      <ApiDashboardBody
        api={api}
        range={range}
        notConnected={
          <Empty className="border border-dashed bg-background">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Plug />
              </EmptyMedia>
              <EmptyTitle>No API connected</EmptyTitle>
              <EmptyDescription>This demo project only has web analytics.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
    </>
  );
}
