import { Eye } from 'lucide-react';
import { OperatorOverviewBody, rangeQueryOf } from '@/components/dashboards/operator-overview';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { Badge } from '@/components/ui/badge';
import { PUBLIC_DEMO_OPERATOR, demoCached, rangeKey } from '@/lib/demo';
import { globalOverview } from '@/lib/operator-data';
import { parseRange } from '@/lib/ranges';
import { getDeps } from '@/lib/server';

export const metadata = { title: 'Demo · Operator view' };

/** The SCF operator overview, scoped to demo projects (the same scope a demo operator login gets). */
export default async function DemoOperator(props: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const range = parseRange({ range: '24h', ...(await props.searchParams) });
  const rows = await demoCached(`overview:${rangeKey(range)}`, () =>
    globalOverview(getDeps(), PUBLIC_DEMO_OPERATOR, range),
  );

  return (
    <>
      <PageHeader
        title="Operator view"
        description="What SCF operators see across projects. Here: demo projects only, read-only. Select two to compare."
        badge={
          <Badge variant="secondary">
            <Eye data-icon="inline-start" />
            Read-only · demo projects
          </Badge>
        }
        actions={<RangePicker current={range.key} from={range.from} to={range.to} />}
      />
      <OperatorOverviewBody
        rows={rows}
        rangeQuery={rangeQueryOf(range)}
        compareHref="/demo/operator/compare"
      />
    </>
  );
}
