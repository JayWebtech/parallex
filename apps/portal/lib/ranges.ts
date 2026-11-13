import type { TimeUnit } from '@parallax/umami';

export const PRESETS = ['24h', '7d', '30d'] as const;
export type Preset = (typeof PRESETS)[number];

export interface Range {
  key: Preset | 'custom';
  label: string;
  /** Epoch ms, inclusive. */
  startAt: number;
  /** Epoch ms, inclusive. */
  endAt: number;
  unit: TimeUnit;
  /** For custom ranges, the YYYY-MM-DD inputs (UTC). */
  from?: string;
  to?: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MAX_CUSTOM_DAYS = 366;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(s: string): number | null {
  if (!ISO_DATE.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s ? null : t;
}

/**
 * Parses `?range=24h|7d|30d` or `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
 * (UTC, inclusive). Anything invalid falls back to 7d, so a bad URL never errors.
 */
export function parseRange(
  params: { range?: string | undefined; from?: string | undefined; to?: string | undefined },
  now = Date.now(),
): Range {
  if (params.range === 'custom' && params.from && params.to) {
    const from = utcDate(params.from);
    const to = utcDate(params.to);
    if (from !== null && to !== null && from <= to && to <= now) {
      const days = Math.round((to - from) / DAY) + 1;
      if (days <= MAX_CUSTOM_DAYS) {
        return {
          key: 'custom',
          label: `${params.from} → ${params.to}`,
          startAt: from,
          endAt: Math.min(to + DAY - 1, now),
          unit: days <= 2 ? 'hour' : 'day',
          from: params.from,
          to: params.to,
        };
      }
    }
  }
  switch (params.range) {
    case '24h':
      return { key: '24h', label: 'Last 24 hours', startAt: now - DAY, endAt: now, unit: 'hour' };
    case '30d':
      return { key: '30d', label: 'Last 30 days', startAt: now - 30 * DAY, endAt: now, unit: 'day' };
    default:
      return { key: '7d', label: 'Last 7 days', startAt: now - 7 * DAY, endAt: now, unit: 'day' };
  }
}
