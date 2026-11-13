import { WebDashboardBody } from '@/components/dashboards/web-dashboard';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { StatusBadge } from '@/components/status-badge';
import { loadOwnedProject, orNotFound } from '@/lib/page-data';
import { parseRange } from '@/lib/ranges';
import { getDeps } from '@/lib/server';
import type { WebAnalytics } from '@/lib/web-analytics';
import { getWebAnalytics } from '@/lib/web-analytics';

export const metadata = { title: 'Web analytics' };

export default async function WebDashboard(props: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { user, project } = await loadOwnedProject(props.params);
  const range = parseRange(await props.searchParams);

  let web: WebAnalytics | null = null;
  try {
    web = await getWebAnalytics(getDeps(), user.id, project.id, range);
  } catch (error) {
    orNotFound(error);
  }

  return (
    <>
      <PageHeader
        title={project.name}
        badge={<StatusBadge status={project.status} />}
        description={`Web analytics · ${project.domains.join(', ')}`}
        actions={<RangePicker current={range.key} from={range.from} to={range.to} />}
      />

      <WebDashboardBody web={web} range={range} />
    </>
  );
}
