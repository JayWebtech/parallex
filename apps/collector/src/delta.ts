/**
 * Converts cumulative OTLP histogram points into deltas.
 *
 * OpenTelemetry SDKs export cumulative histograms by default: each point is
 * the running total since the stream's start time. We keep the last point per
 * stream and emit the difference. Rules:
 *  - same start time, counts not lower → emit current − previous
 *  - new or restarted stream (start time changed, or count went down) →
 *    emit the full value, since it accumulated after the new start…
 *  - …except a stream first seen after the collector restarted whose start
 *    predates this process: part of it was already counted before the
 *    restart, so it only sets a baseline (emits nothing).
 *
 * State is in memory and per process. That is fine for one collector; to
 * scale out, route each ingest key to the same instance, or ask tenants to
 * export delta temporality (both setup guides do).
 */
export interface Totals {
  count: number;
  sumMs: number;
  buckets: number[];
}

interface Entry extends Totals {
  start: string;
  seenAt: number;
}

const START_SKEW_MS = 60_000;

export class DeltaTracker {
  readonly #streams = new Map<string, Entry>();

  constructor(
    private readonly processStartMs: number,
    private readonly maxStreams = 100_000,
    private readonly ttlMs = 30 * 60_000,
  ) {}

  get size(): number {
    return this.#streams.size;
  }

  delta(key: string, startNs: string, current: Totals, nowMs: number): Totals | null {
    const prev = this.#streams.get(key);
    this.#streams.delete(key);
    this.#streams.set(key, { ...current, start: startNs, seenAt: nowMs });
    this.#evict(nowMs);

    const fresh = prev === undefined || nowMs - prev.seenAt > this.ttlMs;
    if (fresh) {
      const startMs = Number(BigInt(startNs || '0') / 1_000_000n);
      return startMs >= this.processStartMs - START_SKEW_MS ? current : null;
    }
    if (prev.start !== startNs || current.count < prev.count) return current;
    const count = current.count - prev.count;
    if (count === 0) return null;
    return {
      count,
      sumMs: Math.max(0, current.sumMs - prev.sumMs),
      buckets: current.buckets.map((c, i) => Math.max(0, c - (prev.buckets[i] ?? 0))),
    };
  }

  #evict(nowMs: number): void {
    for (const [key, entry] of this.#streams) {
      if (this.#streams.size <= this.maxStreams && nowMs - entry.seenAt <= this.ttlMs) break;
      this.#streams.delete(key);
    }
  }
}
