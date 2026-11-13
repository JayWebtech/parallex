/** Token bucket per key: `burst` tokens, refilled at `perSecond`. */
export class RateLimiter {
  readonly #buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly perSecond: number,
    private readonly burst: number,
  ) {}

  /** Returns 0 when allowed, otherwise the seconds to wait (for Retry-After). */
  take(key: string, nowMs: number): number {
    const b = this.#buckets.get(key) ?? { tokens: this.burst, at: nowMs };
    b.tokens = Math.min(this.burst, b.tokens + ((nowMs - b.at) / 1000) * this.perSecond);
    b.at = nowMs;
    this.#buckets.set(key, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return 0;
    }
    return Math.max(1, Math.ceil((1 - b.tokens) / this.perSecond));
  }
}

/** Small TTL cache for key lookups (hits and misses alike). */
export class TtlCache<V> {
  readonly #entries = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 10_000,
  ) {}

  get(key: string, nowMs: number): V | undefined {
    const e = this.#entries.get(key);
    if (!e) return undefined;
    if (e.expires <= nowMs) {
      this.#entries.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: V, nowMs: number): void {
    if (this.#entries.size >= this.maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) this.#entries.delete(oldest);
    }
    this.#entries.set(key, { value, expires: nowMs + this.ttlMs });
  }
}
