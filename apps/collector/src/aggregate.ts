import { addBuckets } from '@parallax/shared';
import type { Sample } from './extract.js';

const keyOf = (s: Sample) =>
  [s.service, s.method, s.route, s.status, s.source, s.minute].join('\u0000');

/**
 * Merges samples with the same dimensions so each row appears once per write
 * (required by INSERT … ON CONFLICT), and sorts rows by key so concurrent
 * upserts lock rows in the same order (no deadlocks).
 */
export function aggregate(samples: Sample[]): Sample[] {
  const rows = new Map<string, Sample>();
  for (const s of samples) {
    const key = keyOf(s);
    const row = rows.get(key);
    if (row) {
      row.count += s.count;
      row.sumMs += s.sumMs;
      addBuckets(row.buckets, s.buckets);
    } else {
      rows.set(key, { ...s, buckets: [...s.buckets] });
    }
  }
  return [...rows.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, r]) => r);
}
