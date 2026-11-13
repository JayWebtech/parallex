import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CompareBody } from '@/components/dashboards/compare';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { Button } from '@/components/ui/button';
import { PUBLIC_DEMO_OPERATOR, demoCached, rangeKey } from '@/lib/demo';
import { ValidationError } from '@/lib/errors';
import type { Comparison } from '@/lib/operator-data';
import { compareProjects } from '@/lib/operator-data';
import { orNotFound } from '@/lib/page-data';
import { parseRange } from '@/lib/ranges';
import { getDeps } from '@/lib/server';

export const metadata = { title: 'Demo · Compare projects' };

export default async function DemoCompare(props: {
  searchParams: Promise<{ ids?: string; range?: string; from?: string; to?: string }>;
}) {
  const search = await props.searchParams;
  const range = parseRange({ range: '24h', ...search });
  const ids = (search.ids ?? '').split(',').filter(Boolean);

  let data: Comparison | null = null;
  let problem: string | null = null;
  try {
    // Demo scope: any non-demo ID makes the whole comparison a 404.
    data = await demoCached(`compare:${ids.join(',')}:${rangeKey(range)}`, () =>
      compareProjects(getDeps(), PUBLIC_DEMO_OPERATOR, ids, range),
    );
  } catch (error) {
    if (error instanceof ValidationError) problem = error.message;
    else orNotFound(error);
  }

  return (
    <>
      <PageHeader
        title="Compare projects"
        description={
          data
            ? `${data.projects.map((p) => p.name).join(' · ')} — ${range.label.toLowerCase()} (UTC)`
            : undefined
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/demo/operator" />}
              nativeButton={false}
            >
              <ArrowLeft data-icon="inline-start" />
              All demo projects
            </Button>
            {data && (
              <RangePicker
                current={range.key}
                from={range.from}
                to={range.to}
                params={{ ids: ids.join(',') }}
              />
            )}
          </>
        }
      />
      <CompareBody data={data} problem={problem} range={range} />
    </>
  );
}
