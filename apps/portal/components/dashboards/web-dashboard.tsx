import { AppWindow, Clock, FileText, Laptop, Link2, MapPin, MonitorSmartphone } from 'lucide-react';
import { BreakdownCard } from '@/components/breakdown-card';
import { StatCard } from '@/components/stat-card';
import { TrendChart } from '@/components/trend-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { countryName, formatCount, formatDuration, formatPercent } from '@/lib/format';
import type { Range } from '@/lib/ranges';
import type { WebAnalytics } from '@/lib/web-analytics';

const SERIES = [
  { key: 'pageviews', label: 'Pageviews', color: 'var(--chart-1)' },
  { key: 'visits', label: 'Visits', color: 'var(--chart-2)' },
];

/** Web analytics for one project. Shared by the tenant dashboard and the public demo. */
export function WebDashboardBody({ web, range }: { web: WebAnalytics | null; range: Range }) {
  return (
    <>
      {!web ? (
        <Alert variant="destructive">
          <AlertTitle>Analytics are temporarily unavailable</AlertTitle>
          <AlertDescription>Please refresh in a minute.</AlertDescription>
        </Alert>
      ) : web.status === 'pending' ? (
        <Alert>
          <Clock />
          <AlertTitle>Waiting for approval</AlertTitle>
          <AlertDescription>
            Tracking starts as soon as an operator approves this project.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Unique visitors"
              value={formatCount(web.totals.visitors)}
              current={web.totals.visitors}
              previous={web.previous.visitors}
            />
            <StatCard
              label="Visits"
              value={formatCount(web.totals.visits)}
              current={web.totals.visits}
              previous={web.previous.visits}
            />
            <StatCard
              label="Pageviews"
              value={formatCount(web.totals.pageviews)}
              current={web.totals.pageviews}
              previous={web.previous.pageviews}
            />
            <StatCard
              label="Bounce rate"
              value={formatPercent(web.totals.bounceRate)}
              current={web.totals.bounceRate}
              previous={web.previous.bounceRate}
              lowerIsBetter
            />
            <StatCard
              label="Avg. visit duration"
              value={formatDuration(web.totals.avgVisitSeconds)}
              current={web.totals.avgVisitSeconds}
              previous={web.previous.avgVisitSeconds}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Traffic</CardTitle>
              <CardDescription>{range.label}, UTC</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={web.series} series={SERIES} unit={web.range.unit} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BreakdownCard title="Pages" unit="views" icon={FileText} rows={web.breakdowns.path} />
            <BreakdownCard
              title="Referrers"
              unit="visitors"
              icon={Link2}
              rows={web.breakdowns.referrer}
            />
            <BreakdownCard
              title="Countries"
              unit="visitors"
              icon={MapPin}
              rows={web.breakdowns.country.map((r) => ({ ...r, label: countryName(r.label) }))}
            />
            <BreakdownCard
              title="Devices"
              unit="visitors"
              icon={MonitorSmartphone}
              rows={web.breakdowns.device}
            />
            <BreakdownCard
              title="Browsers"
              unit="visitors"
              icon={AppWindow}
              rows={web.breakdowns.browser}
            />
            <BreakdownCard
              title="Operating systems"
              unit="visitors"
              icon={Laptop}
              rows={web.breakdowns.os}
            />
          </div>
        </>
      )}
    </>
  );
}
