import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { RangePicker } from '@/components/range-picker';
import { CompareBody } from '@/components/dashboards/compare';
import { Button } from '@/components/ui/button';
import { ValidationError } from '@/lib/errors';
import type { Comparison } from '@/lib/operator-data';
import { compareProjects } from '@/lib/operator-data';
import { orNotFound } from '@/lib/page-data';
import { parseRange } from '@/lib/ranges';
import { getDeps, requireOperator } from '@/lib/server';

export const metadata = { title: 'Compare projects' };

export default async function ComparePage(props: {
  searchParams: Promise<{ ids?: string; range?: string; from?: string; to?: string }>;
}) {
  const { operator } = await requireOperator();
  const search = await props.searchParams;
  const range = parseRange(search);
  const ids = (search.ids ?? '').split(',').filter(Boolean);

  let data: Comparison | null = null;
  let problem: string | null = null;
  try {
    data = await compareProjects(getDeps(), operator, ids, range);
  } catch (error) {
    if (error instanceof ValidationError) problem = error.message;
    else orNotFound(error);
  }
  const back = (
    <Button variant="outline" size="sm" render={<Link href="/operator" />} nativeButton={false}>
      <ArrowLeft data-icon="inline-start" />
      All projects
    </Button>
  );

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
            {back}
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
