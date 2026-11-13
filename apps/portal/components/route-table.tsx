import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ApiRoute } from '@/lib/api-analytics';
import { formatCount, formatMs, formatPercent } from '@/lib/format';

const CLASSES = [
  { key: 's2xx', label: '2xx', className: 'bg-status-2xx' },
  { key: 's3xx', label: '3xx', className: 'bg-status-3xx' },
  { key: 's4xx', label: '4xx', className: 'bg-status-4xx' },
  { key: 's5xx', label: '5xx', className: 'bg-status-5xx' },
] as const;

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-hidden>
      {CLASSES.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${c.className}`} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** Status mix as a thin stacked bar with 2px gaps; exact counts in the label and tooltip. */
function StatusMix({ route }: { route: ApiRoute }) {
  const total = route.requests || 1;
  const label = CLASSES.map((c) => `${c.label} ${formatCount(route.status[c.key])}`).join(', ');
  return (
    <div className="flex h-2 w-32 gap-0.5" role="img" aria-label={label} title={label}>
      {CLASSES.filter((c) => route.status[c.key] > 0).map((c) => (
        <span
          key={c.key}
          className={`h-full rounded-full ${c.className}`}
          style={{ width: `${(route.status[c.key] / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function RouteTable({ routes, showService }: { routes: ApiRoute[]; showService: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Route</TableHead>
            <TableHead className="text-right">Requests</TableHead>
            <TableHead>Status mix</TableHead>
            <TableHead className="text-right">5xx</TableHead>
            <TableHead className="text-right">p50</TableHead>
            <TableHead className="text-right">p95</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routes.map((r) => (
            <TableRow key={`${r.service}|${r.method}|${r.route}`}>
              <TableCell className="max-w-md">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {r.method}
                  </Badge>
                  <span className="truncate font-mono text-[13px]" title={r.route}>
                    {r.route}
                  </span>
                </div>
                {showService && (
                  <div className="mt-1 text-xs text-muted-foreground">{r.service}</div>
                )}
              </TableCell>
              <TableCell className="text-right">{formatCount(r.requests)}</TableCell>
              <TableCell>
                <StatusMix route={r} />
              </TableCell>
              <TableCell className="text-right">
                {formatPercent(r.requests ? r.status.s5xx / r.requests : 0)}
              </TableCell>
              <TableCell className="text-right">{formatMs(r.p50)}</TableCell>
              <TableCell className="text-right">{formatMs(r.p95)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
