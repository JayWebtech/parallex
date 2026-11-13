import { formatCount } from '@/lib/format';

export interface BarRow {
  label: string;
  value: number;
}

/**
 * Ranked horizontal bars, one series. Labels and values are text in ink
 * tokens; the bar only shows magnitude. Each row is its own hover target
 * with the exact value and share in a tooltip.
 */
export function BarList({ title, rows, unit }: { title: string; rows: BarRow[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <section className="card p-4">
      <h3 className="text-sm font-medium mb-3 flex justify-between">
        <span>{title}</span>
        <span className="text-muted font-normal">{unit}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">No data in this range</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.label}
              className="group relative grid grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2 py-1 hover:bg-[var(--bar-track)]"
              title={`${r.label}: ${formatCount(r.value)} (${total ? Math.round((r.value / total) * 100) : 0}% of top ${rows.length})`}
            >
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 rounded-r-[4px] opacity-25"
                style={{ width: `${(r.value / max) * 100}%`, background: 'var(--series-1)' }}
              />
              <span className="relative text-sm truncate">{r.label}</span>
              <span className="relative text-sm num text-ink-2">{formatCount(r.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
