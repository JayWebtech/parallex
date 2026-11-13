import { TrendChart } from '@/components/trend-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount, formatDuration, formatMs, formatPercent } from '@/lib/format';
import type { Comparison, TenantRow } from '@/lib/operator-data';
import type { Range } from '@/lib/ranges';

/** Palette slots in fixed order: the first project picked is always chart-1. */
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
const short = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);

const METRICS: [string, (r: TenantRow) => string][] = [
  ['Pageviews', (r) => (r.web ? formatCount(r.web.pageviews) : '–')],
  ['Unique visitors', (r) => (r.web ? formatCount(r.web.visitors) : '–')],
  ['Visits', (r) => (r.web ? formatCount(r.web.visits) : '–')],
  ['Bounce rate', (r) => (r.web ? formatPercent(r.web.bounceRate) : '–')],
  ['Avg. visit duration', (r) => (r.web ? formatDuration(r.web.avgVisitSeconds) : '–')],
  ['API requests', (r) => (r.api ? formatCount(r.api.requests) : '–')],
  ['Server errors (5xx)', (r) => (r.api ? formatPercent(r.api.errorRate) : '–')],
  ['p95 latency', (r) => (r.api ? formatMs(r.api.p95) : '–')],
];

/** 2–4 projects side by side. Shared by the operator area and the public demo. */
export function CompareBody({
  data,
  problem,
  range,
}: {
  data: Comparison | null;
  problem: string | null;
  range: Range;
}) {
  const series = (data?.projects ?? []).map((p, i) => ({
    key: p.id,
    label: short(p.name),
    color: COLORS[i]!,
  }));
  return (
    <>
      {problem || !data ? (
        <Alert>
          <AlertTitle>Pick 2 to 4 projects</AlertTitle>
          <AlertDescription>{problem} Select them in the table on the overview.</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Side by side</CardTitle>
              <CardDescription>Totals for the range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      {data.projects.map((p, i) => (
                        <TableHead key={p.id} className="text-right">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: COLORS[i] }}
                              aria-hidden
                            />
                            {p.name}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {METRICS.map(([label, fmt]) => (
                      <TableRow key={label}>
                        <TableCell className="text-muted-foreground">{label}</TableCell>
                        {data.projects.map((p) => (
                          <TableCell key={p.id} className="text-right font-medium">
                            {fmt(p)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pageviews</CardTitle>
                <CardDescription>Per {range.unit}</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart data={data.web} series={series} unit={range.unit} kind="line" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>API requests</CardTitle>
                <CardDescription>Per {range.unit}</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart data={data.api} series={series} unit={range.unit} kind="line" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
