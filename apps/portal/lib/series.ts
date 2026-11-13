import type { TimeUnit } from '@parallax/umami';

const STEP: Partial<Record<TimeUnit, number>> = { hour: 3_600_000, day: 86_400_000 };

/** Parses Umami bucket labels ("2026-11-13 10:00:00", ISO with or without zone) as UTC. */
export function parseBucket(x: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(x);
  const iso = x.includes('T') ? x : x.replace(' ', 'T');
  return Date.parse(hasZone || !/\d{2}:\d{2}/.test(iso) ? iso : `${iso}Z`);
}

function truncate(t: number, step: number): number {
  return t - (t % step);
}

/**
 * Returns one point per bucket between start and end (UTC), filling buckets
 * Umami omitted (no traffic) with zeros, so charts show gaps as zero.
 */
export function fillSeries<T extends { x: string }>(
  points: T[],
  range: { startAt: number; endAt: number; unit: TimeUnit },
  zero: Omit<T, 'x'>,
): (T & { t: number })[] {
  const step = STEP[range.unit];
  if (!step) return points.map((p) => ({ ...p, t: parseBucket(p.x) }));
  const byBucket = new Map(points.map((p) => [truncate(parseBucket(p.x), step), p]));
  const out: (T & { t: number })[] = [];
  for (let t = truncate(range.startAt, step); t <= range.endAt; t += step) {
    const p = byBucket.get(t);
    out.push({ ...(p ?? ({ ...zero, x: new Date(t).toISOString() } as T)), t });
  }
  return out;
}
