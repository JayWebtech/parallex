export interface CollectorConfig {
  /** Max decompressed request body. */
  bodyLimitBytes: number;
  /** Token bucket per ingest key. */
  rateLimit: { perSecond: number; burst: number };
  maxRoutesPerProject: number;
  maxServicesPerProject: number;
  /** How long key lookups (hits and misses) are cached; bounds revocation delay. */
  keyCacheTtlMs: number;
  /** Data points outside [now − past, now + future] are rejected (keeps rollups correct). */
  acceptPastMs: number;
  acceptFutureMs: number;
}

export const DEFAULT_CONFIG: CollectorConfig = {
  bodyLimitBytes: 4 * 1024 * 1024,
  rateLimit: { perSecond: 20, burst: 200 },
  maxRoutesPerProject: 1000,
  maxServicesPerProject: 50,
  keyCacheTtlMs: 60_000,
  acceptPastMs: 2 * 60 * 60_000,
  acceptFutureMs: 5 * 60_000,
};

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : fallback;
};

export function configFromEnv(env: NodeJS.ProcessEnv): CollectorConfig {
  return {
    bodyLimitBytes: num(env.MAX_BODY_BYTES, DEFAULT_CONFIG.bodyLimitBytes),
    rateLimit: {
      perSecond: num(env.RATE_LIMIT_PER_SECOND, DEFAULT_CONFIG.rateLimit.perSecond),
      burst: num(env.RATE_LIMIT_BURST, DEFAULT_CONFIG.rateLimit.burst),
    },
    maxRoutesPerProject: num(env.MAX_ROUTES_PER_PROJECT, DEFAULT_CONFIG.maxRoutesPerProject),
    maxServicesPerProject: num(env.MAX_SERVICES_PER_PROJECT, DEFAULT_CONFIG.maxServicesPerProject),
    keyCacheTtlMs: num(env.KEY_CACHE_TTL_MS, DEFAULT_CONFIG.keyCacheTtlMs),
    acceptPastMs: DEFAULT_CONFIG.acceptPastMs,
    acceptFutureMs: DEFAULT_CONFIG.acceptFutureMs,
  };
}
