import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatPercent, relativeChange } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A headline number with its change against the previous period. The change
 * reads through an arrow and words; color only reinforces it.
 */
export function StatCard({
  label,
  value,
  current,
  previous,
  lowerIsBetter = false,
  hint,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  lowerIsBetter?: boolean;
  hint?: ReactNode;
}) {
  const change =
    current === undefined || previous === undefined ? null : relativeChange(current, previous);
  const flat = change !== null && Math.abs(change) < 0.005;
  const good = change === null || flat ? null : change > 0 !== lowerIsBetter;
  const Icon = change === null || flat ? Minus : change > 0 ? TrendingUp : TrendingDown;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[200px]/card:text-3xl">
          {value}
        </CardTitle>
        {change !== null && (
          <CardAction>
            <Badge variant="outline" className="tabular-nums">
              <Icon
                data-icon="inline-start"
                className={cn(
                  good === true && 'text-success',
                  good === false && 'text-destructive',
                )}
              />
              {flat ? '0%' : `${change > 0 ? '+' : '−'}${formatPercent(Math.abs(change))}`}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">
        {hint ?? (change === null ? 'No earlier data to compare' : 'vs. previous period')}
      </CardFooter>
    </Card>
  );
}
