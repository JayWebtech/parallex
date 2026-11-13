import { formatPercent, relativeChange } from '@/lib/format';

/**
 * Stat tile: the number is the chart. The delta vs the previous period carries
 * an arrow and words, so its meaning never depends on color alone.
 */
export function KpiTile(props: {
  label: string;
  value: string;
  current: number;
  previous: number;
  /** For bounce rate, a drop is the good direction. */
  lowerIsBetter?: boolean;
}) {
  const change = relativeChange(props.current, props.previous);
  let delta = <span className="text-muted">no earlier data</span>;
  if (change !== null) {
    const up = change > 0;
    const flat = Math.abs(change) < 0.005;
    const good = flat ? null : up !== Boolean(props.lowerIsBetter);
    delta = (
      <span className={good === null ? 'text-muted' : good ? 'text-good' : 'text-critical'}>
        {flat ? '→' : up ? '↑' : '↓'} {formatPercent(Math.abs(change))}
        <span className="text-muted"> vs previous period</span>
      </span>
    );
  }
  return (
    <div className="card p-4">
      <div className="text-sm text-ink-2">{props.label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight num">{props.value}</div>
      <div className="mt-1 text-xs num">{delta}</div>
    </div>
  );
}
