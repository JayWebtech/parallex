import { StatCard } from '@/components/stat-card';
import { TenantTable } from '@/components/tenant-table';
import { formatCount } from '@/lib/format';
import type { TenantRow } from '@/lib/operator-data';

/** Operator overview: totals plus the project table. Shared with the public demo. */
export function OperatorOverviewBody({
  rows,
  rangeQuery,
  compareHref,
}: {
  rows: TenantRow[];
  rangeQuery: string;
  compareHref?: string;
}) {
  const sum = (f: (r: TenantRow) => number) => rows.reduce((t, r) => t + f(r), 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Projects"
          value={formatCount(rows.length)}
          hint={`${rows.filter((r) => r.status === 'pending').length} awaiting approval`}
        />
        <StatCard
          label="Pageviews"
          value={formatCount(sum((r) => r.web?.pageviews ?? 0))}
          hint="Across all projects"
        />
        <StatCard
          label="Visitors"
          value={formatCount(sum((r) => r.web?.visitors ?? 0))}
          hint="Sum per project; one person on two projects counts twice"
        />
        <StatCard
          label="API requests"
          value={formatCount(sum((r) => r.api?.requests ?? 0))}
          hint="Across all projects"
        />
      </div>
      <TenantTable rows={rows} rangeQuery={rangeQuery} compareHref={compareHref} />
    </>
  );
}

/** Query string that keeps the selected range across links. */
export function rangeQueryOf(range: { key: string; from?: string; to?: string }): string {
  return range.key === 'custom'
    ? `range=custom&from=${range.from}&to=${range.to}`
    : `range=${range.key}`;
}
