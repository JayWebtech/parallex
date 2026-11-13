import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { OperatorOverviewBody, rangeQueryOf } from '@/components/dashboards/operator-overview';
import { Badge } from '@/components/ui/badge';
import { globalOverview } from '@/lib/operator-data';
import { parseRange } from '@/lib/ranges';
import { getDeps, requireOperator } from '@/lib/server';

export const metadata = { title: 'Operator overview' };

export default async function OperatorOverview(props: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { operator } = await requireOperator();
  const range = parseRange(await props.searchParams);
  const rows = await globalOverview(getDeps(), operator, range);

  return (
    <>
      <PageHeader
        title="All projects"
        description={`Every enrolled project, ${range.label.toLowerCase()} (UTC).`}
        badge={
          operator.scope === 'demo' && (
            <Badge variant="secondary">
              <Eye data-icon="inline-start" />
              Read-only · demo projects
            </Badge>
          )
        }
        actions={<RangePicker current={range.key} from={range.from} to={range.to} />}
      />
      <OperatorOverviewBody rows={rows} rangeQuery={rangeQueryOf(range)} />
    </>
  );
}
