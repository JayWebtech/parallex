'use client';

import { Table2 } from 'lucide-react';
import { useId, useState, useSyncExternalStore } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatBucket, formatCount, formatTick } from '@/lib/format';

export interface TrendSeries {
  key: string;
  label: string;
  /** A chart token, e.g. var(--chart-1). Fixed order: the first series is always chart-1. */
  color: string;
}

export type TrendPoint = { x: string } & Record<string, number | string>;

const REDUCED = '(prefers-reduced-motion: reduce)';
/** Charts appear without their entrance animation when the user asks for less motion. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * Counts over time on one axis. Area (stacked visually but not summed) for a
 * project's own series; lines when comparing projects. Hover tooltip, legend
 * for 2+ series, and a table view for every chart.
 */
export function TrendChart({
  data,
  series,
  unit,
  kind = 'area',
  height = 260,
}: {
  data: TrendPoint[];
  series: TrendSeries[];
  unit: string;
  kind?: 'area' | 'line';
  height?: number;
}) {
  const id = useId().replace(/:/g, '');
  const [showTable, setShowTable] = useState(false);
  const animate = !useReducedMotion();
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  ) satisfies ChartConfig;

  if (data.length === 0 || data.every((p) => series.every((s) => !Number(p[s.key])))) {
    return (
      <Empty className="border border-dashed" style={{ minHeight: height }}>
        <EmptyHeader>
          <EmptyTitle>No data in this range</EmptyTitle>
          <EmptyDescription>
            Pick a longer range, or check that your snippet or exporter is sending data.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const axis = {
    x: (
      <XAxis
        dataKey="x"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={32}
        tickFormatter={(v: string) => formatBucket(v, unit)}
      />
    ),
    y: (
      <YAxis
        width={40}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
        tickFormatter={(v: number) => formatTick(v)}
      />
    ),
    tooltip: (
      <ChartTooltip
        cursor={false}
        content={
          <ChartTooltipContent
            indicator="dot"
            labelFormatter={(_, payload) =>
              formatBucket(String(payload?.[0]?.payload?.x ?? ''), unit)
            }
          />
        }
      />
    ),
    // Legend in series order (Recharts sorts alphabetically by default).
    legend:
      series.length > 1 ? <ChartLegend itemSorter={null} content={<ChartLegendContent />} /> : null,
  };

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        {kind === 'area' ? (
          <AreaChart data={data} margin={{ left: 0, right: 8 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} />
            {axis.x}
            {axis.y}
            {axis.tooltip}
            {series.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                fill={`url(#${id}-${s.key})`}
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                isAnimationActive={animate}
              />
            ))}
            {axis.legend}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} />
            {axis.x}
            {axis.y}
            {axis.tooltip}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={animate}
              />
            ))}
            {axis.legend}
          </LineChart>
        )}
      </ChartContainer>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
        >
          <Table2 data-icon="inline-start" />
          {showTable ? 'Hide data table' : 'Show data table'}
        </Button>
      </div>
      {showTable && (
        <div className="max-h-72 overflow-y-auto overscroll-contain rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{unit === 'hour' ? 'Hour (UTC)' : 'Day (UTC)'}</TableHead>
                {series.map((s) => (
                  <TableHead key={s.key} className="text-right">
                    {s.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.x}>
                  <TableCell>{formatBucket(p.x, unit)}</TableCell>
                  {series.map((s) => (
                    <TableCell key={s.key} className="text-right">
                      {formatCount(Number(p[s.key] ?? 0))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
