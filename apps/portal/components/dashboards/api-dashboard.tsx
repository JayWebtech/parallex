import { Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { RouteTable, StatusLegend } from '@/components/route-table';
import { StatCard } from '@/components/stat-card';
import { TrendChart } from '@/components/trend-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ApiAnalytics } from '@/lib/api-analytics';
import { formatCount, formatMs, formatPercent } from '@/lib/format';
import type { Range } from '@/lib/ranges';

const SERIES = [
  { key: 'requests', label: 'Requests', color: 'var(--chart-1)' },
  { key: 'errors', label: '5xx errors', color: 'var(--chart-2)' },
];

/** True until the project's API has sent anything (no active key ever used). */
export const apiNeverSent = (api: ApiAnalytics | null) =>
  !!api && api.keys.active === 0 && api.keys.lastUsedAt === null;

/**
 * API analytics for one project. Shared by the tenant dashboard and the public
 * demo; `notConnected` is shown while the API has never sent data.
 */
export function ApiDashboardBody({
  api,
  range,
  notConnected,
}: {
  api: ApiAnalytics | null;
  range: Range;
  notConnected: ReactNode;
}) {
  const neverSent = apiNeverSent(api);
  return (
    <>
      {!api ? null : neverSent ? (
        notConnected
      ) : (
        <>
          {api.warnings.secretsRedacted > 0 && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>
                {formatCount(api.warnings.secretsRedacted)} Stellar secret seed
                {api.warnings.secretsRedacted === 1 ? '' : 's'} appeared in request paths
              </AlertTitle>
              <AlertDescription>
                We redacted them before storing anything, but anyone who saw those URLs has the
                keys. Rotate them, and stop sending secrets in URLs.
              </AlertDescription>
            </Alert>
          )}
          {api.warnings.routesOverflowed > 0 && (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Route limit reached</AlertTitle>
              <AlertDescription>
                {formatCount(api.warnings.routesOverflowed)} data points were grouped under{' '}
                <code className="font-mono">{'{other}'}</code>. Set{' '}
                <code className="font-mono">http.route</code> in your instrumentation to keep routes
                templated.
              </AlertDescription>
            </Alert>
          )}
          {api.routes.some((r) => r.route === '{unknown}') && (
            <Alert>
              <Info />
              <AlertTitle>Some requests have no route</AlertTitle>
              <AlertDescription>
                They are grouped as <code className="font-mono">{'{unknown}'}</code>. Enable your
                web framework&apos;s OpenTelemetry instrumentation so{' '}
                <code className="font-mono">http.route</code> is set (in ESM Node apps, also
                register <code className="font-mono">@opentelemetry/instrumentation/hook.mjs</code>
                ).
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Requests"
              value={formatCount(api.totals.requests)}
              current={api.totals.requests}
              previous={api.previous.requests}
            />
            <StatCard
              label="Server errors (5xx)"
              value={formatPercent(api.totals.errorRate)}
              current={api.totals.errorRate}
              previous={api.previous.errorRate}
              lowerIsBetter
            />
            <StatCard
              label="p50 latency"
              value={formatMs(api.totals.p50)}
              current={api.totals.p50 ?? 0}
              previous={api.previous.p50 ?? 0}
              lowerIsBetter
            />
            <StatCard
              label="p95 latency"
              value={formatMs(api.totals.p95)}
              current={api.totals.p95 ?? 0}
              previous={api.previous.p95 ?? 0}
              lowerIsBetter
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Requests</CardTitle>
              <CardDescription>{range.label}, UTC</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={api.series} series={SERIES} unit={api.range.unit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Routes</CardTitle>
              <CardDescription>
                {api.routes.length} route{api.routes.length === 1 ? '' : 's'} across{' '}
                {api.services.length} service{api.services.length === 1 ? '' : 's'} ·{' '}
                {api.resolution} rollups
              </CardDescription>
              <CardAction>
                <StatusLegend />
              </CardAction>
            </CardHeader>
            <CardContent>
              {api.routes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No requests in this range
                </p>
              ) : (
                <RouteTable routes={api.routes} showService={api.services.length > 1} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
