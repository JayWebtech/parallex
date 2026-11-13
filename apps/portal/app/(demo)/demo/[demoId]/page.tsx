import { ArrowUpRight } from 'lucide-react';
import { WebDashboardBody } from '@/components/dashboards/web-dashboard';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { demoCached, demoSpec, getDemoProject, rangeKey } from '@/lib/demo';
import { orNotFound } from '@/lib/page-data';
import { parseRange } from '@/lib/ranges';
import { getDeps } from '@/lib/server';
import type { WebAnalytics } from '@/lib/web-analytics';
import { readWebsite } from '@/lib/web-analytics';

export const metadata = { title: 'Demo · Web analytics' };

export default async function DemoWeb(props: {
  params: Promise<{ demoId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const [{ demoId }, search] = await Promise.all([props.params, props.searchParams]);
  // Demo projects only: a real tenant's ID is a 404, like a missing one.
  const project = await getDemoProject(getDeps(), demoId).catch(orNotFound);
  const range = parseRange({ range: '24h', ...search });
  const web: WebAnalytics | null = await demoCached(`web:${project.id}:${rangeKey(range)}`, () =>
    readWebsite(getDeps(), project.umamiWebsiteId, range),
  ).catch(() => null);
  const site = demoSpec(project.id)?.site;

  return (
    <>
      <PageHeader
        title={project.name}
        badge={<Badge variant="secondary">Demo</Badge>}
        description={
          site
            ? `Web analytics · examples/${site.example}, served at ${site.basePath}/`
            : 'Web analytics'
        }
        actions={
          <>
            {site && (
              <Button
                variant="outline"
                render={<a href={`${site.basePath}/`} target="_blank" rel="noopener" />}
                nativeButton={false}
              >
                Visit the site
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            )}
            <RangePicker current={range.key} from={range.from} to={range.to} />
          </>
        }
      />
      <WebDashboardBody web={web} range={range} />
    </>
  );
}
