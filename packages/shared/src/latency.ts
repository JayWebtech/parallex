/**
 * Fixed latency histogram shared by the collector (writes) and the portal
 * (reads). Upper bounds in milliseconds; a final implicit bucket holds
 * everything above the last bound. Changing these requires a data migration.
 *
 * The bounds contain both OpenTelemetry defaults exactly:
 *  - http.server.request.duration (seconds): 0.005 … 10 s
 *  - http.server.duration (legacy, ms): 0, 5 … 10000 ms
 * so SDK histograms with default boundaries map without approximation.
 */
export const LATENCY_BOUNDS_MS = [
  5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000,
] as const;

/** Number of buckets, including the overflow bucket. */
export const LATENCY_BUCKETS = LATENCY_BOUNDS_MS.length + 1;

export function emptyBuckets(): number[] {
  return new Array<number>(LATENCY_BUCKETS).fill(0);
}

/** Index of the bucket a value (ms) falls into: first bound ≥ value. */
export function bucketIndex(ms: number): number {
  for (let i = 0; i < LATENCY_BOUNDS_MS.length; i++) {
    if (ms <= LATENCY_BOUNDS_MS[i]!) return i;
  }
  return LATENCY_BOUNDS_MS.length;
}

export function addBuckets(into: number[], from: readonly number[]): number[] {
  for (let i = 0; i < LATENCY_BUCKETS; i++) into[i] = (into[i] ?? 0) + (from[i] ?? 0);
  return into;
}

/**
 * Estimates a quantile (0–1) from merged buckets by linear interpolation
 * inside the bucket that contains it. Returns null for an empty histogram.
 * Values in the overflow bucket are reported as the last bound (a floor).
 */
export function quantileMs(buckets: readonly number[], q: number): number | null {
  const total = buckets.reduce((s, c) => s + c, 0);
  if (total === 0) return null;
  const rank = q * total;
  let seen = 0;
  for (let i = 0; i < LATENCY_BUCKETS; i++) {
    const c = buckets[i] ?? 0;
    if (c > 0 && seen + c >= rank) {
      if (i === LATENCY_BOUNDS_MS.length) return LATENCY_BOUNDS_MS[i - 1]!;
      const lower = i === 0 ? 0 : LATENCY_BOUNDS_MS[i - 1]!;
      const upper = LATENCY_BOUNDS_MS[i]!;
      return lower + ((upper - lower) * (rank - seen)) / c;
    }
    seen += c;
  }
  return LATENCY_BOUNDS_MS[LATENCY_BOUNDS_MS.length - 1]!;
}
