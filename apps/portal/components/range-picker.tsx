import Link from 'next/link';
import type { Range } from '@/lib/ranges';

const PRESETS = [
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
] as const;

/** Presets as links (shareable URLs) plus a GET form for a custom UTC date range. */
export function RangePicker({ basePath, range }: { basePath: string; range: Range }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div
        className="inline-flex rounded-lg border border-line bg-surface p-0.5"
        role="group"
        aria-label="Time range"
      >
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`${basePath}?range=${p.key}`}
            aria-current={range.key === p.key ? 'true' : undefined}
            className={`px-3 py-1 rounded-md ${range.key === p.key ? 'bg-[var(--bar-track)] font-semibold' : 'text-ink-2 hover:text-ink'}`}
          >
            {range.key === p.key ? '✓ ' : ''}
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action={basePath} className="inline-flex items-center gap-1">
        <input type="hidden" name="range" value="custom" />
        <input
          type="date"
          name="from"
          max={today}
          defaultValue={range.from}
          required
          className="field !w-auto !py-1 text-sm"
          aria-label="From"
        />
        <span className="text-muted">→</span>
        <input
          type="date"
          name="to"
          max={today}
          defaultValue={range.to}
          required
          className="field !w-auto !py-1 text-sm"
          aria-label="To"
        />
        <button
          type="submit"
          className={`btn !py-1 ${range.key === 'custom' ? 'font-semibold' : ''}`}
        >
          Apply
        </button>
      </form>
    </div>
  );
}
