const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en');

export function formatCount(n: number): string {
  return n >= 10_000 ? compact.format(n) : whole.format(Math.round(n));
}

/** Axis ticks: compact from 1,000 up ("9K", "12K"), so labels fit a narrow axis. */
export function formatTick(n: number): string {
  return n >= 1_000 ? compact.format(n) : whole.format(Math.round(n));
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(ratio > 0 && ratio < 0.1 ? 1 : 0)}%`;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Relative change; null when there is no baseline to compare with. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

const regions = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatBucket(iso: string, unit: string): string {
  const d = new Date(iso);
  return unit === 'hour'
    ? d.toLocaleString('en', { hour: 'numeric', day: 'numeric', month: 'short', timeZone: 'UTC' })
    : d.toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Latency from merged buckets; the top bucket is open-ended (≥ 10 s). */
export function formatMs(ms: number | null): string {
  if (ms === null) return '–';
  if (ms >= 10_000) return '≥ 10 s';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 1) return '< 1 ms';
  return `${Math.round(ms)} ms`;
}
