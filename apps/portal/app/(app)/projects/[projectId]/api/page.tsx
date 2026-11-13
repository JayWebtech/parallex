import { Plug } from 'lucide-react';
import Link from 'next/link';
import { ApiDashboardBody, apiNeverSent } from '@/components/dashboards/api-dashboard';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { ApiAnalytics } from '@/lib/api-analytics';
import { getApiAnalytics } from '@/lib/api-analytics';
import { loadOwnedProject, orNotFound } from '@/lib/page-data';
import { parseRange } from '@/lib/ranges';
import { getDeps } from '@/lib/server';

export const metadata = { title: 'API analytics' };

export default async function ApiDashboard(props: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { user, project } = await loadOwnedProject(props.params);
  const range = parseRange(await props.searchParams);
  let api: ApiAnalytics | null = null;
  try {
    api = await getApiAnalytics(getDeps(), user.id, project.id, range);
  } catch (error) {
    orNotFound(error);
  }
  const neverSent = apiNeverSent(api);

  return (
    <>
      <PageHeader
        title={project.name}
        badge={<StatusBadge status={project.status} />}
        description="API analytics · request volume, errors and latency per route"
        actions={!neverSent && <RangePicker current={range.key} from={range.from} to={range.to} />}
      />

      <ApiDashboardBody
        api={api}
        range={range}
        notConnected={
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Plug />
              </EmptyMedia>
              <EmptyTitle>Connect your API</EmptyTitle>
              <EmptyDescription>
                Keep your APM. Also export OpenTelemetry metrics here to see request volume, error
                rates and p50/p95 latency for every route. Spans, logs and payloads are never
                stored.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                render={<Link href={`/projects/${project.id}/instrument`} />}
                nativeButton={false}
              >
                Set up API analytics
              </Button>
            </EmptyContent>
          </Empty>
        }
      />
    </>
  );
}
