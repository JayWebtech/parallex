import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCount } from '@/lib/format';

export interface BreakdownRow {
  label: string;
  value: number;
}

/**
 * Top-N list with an in-row magnitude bar. Labels and numbers are text;
 * the bar only adds a sense of proportion. Each row's title gives the share.
 */
export function BreakdownCard({
  title,
  unit,
  rows,
  icon: Icon,
}: {
  title: string;
  unit: string;
  rows: BreakdownRow[];
  icon?: LucideIcon;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="text-muted-foreground" aria-hidden />}
          {title}
        </CardTitle>
        <CardDescription>
          Top {rows.length || ''} by {unit}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data in this range</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {rows.map((r) => (
              <li
                key={r.label}
                className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1.5 text-sm"
                title={`${r.label}: ${formatCount(r.value)} (${total ? Math.round((r.value / total) * 100) : 0}%)`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-md bg-chart-1/12"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
                <span className="relative truncate">{r.label}</span>
                <span className="relative tabular-nums text-muted-foreground">
                  {formatCount(r.value)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
