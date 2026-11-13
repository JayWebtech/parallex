/**
 * Collector load test (autocannon): `pnpm --filter @parallax/collector bench`
 *
 * Starts the collector in-process on a fresh database (TEST_DATABASE_URL or
 * the local Postgres), then replays realistic OTLP/protobuf exports:
 *   - traces: batches of 50 SERVER spans with raw Stellar paths (accounts,
 *     tx hashes) that must be normalized
 *   - metrics: 20 histogram points per export
 * Scenarios:
 *   1. steady 12 req/s for 20 s (≈ 1M requests/day if every request were its own export)
 *   2. burst: as fast as 32 connections allow for 15 s
 * Exits non-zero if the steady p99 exceeds 100 ms or any request fails.
 */
import { createHash, randomBytes } from 'node:crypto';
import autocannon from 'autocannon';
import { createTestDb } from '@parallax/db/testing';
import { product } from '@parallax/shared';
import { encode, types } from '../dist/proto.js';
import { buildServer } from '../dist/server.js';
import { createPgStore } from '../dist/store.js';
import { seedTenant } from '../test/helpers.ts';

const ns = (ms: number) => `${BigInt(Math.round(ms)) * 1_000_000n}`;
const kv = (key: string, v: string | number) =>
  typeof v === 'string'
    ? { key, value: { stringValue: v } }
    : { key, value: { intValue: String(v) } };
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

// Real-looking but random identifiers (not real accounts): normalization must collapse them.
const fakeAccount = () =>
  `G${randomBytes(35)
    .toString('base64')
    .replace(/[^A-Z2-7]/g, 'A')
    .slice(0, 55)}`;
const txHash = () => createHash('sha256').update(randomBytes(8)).digest('hex');
const PATHS = [
  () => `/accounts/${fakeAccount()}`,
  () => `/accounts/${fakeAccount()}/payments`,
  () => `/transactions/${txHash()}`,
  () => `/ledgers/${50_000_000 + Math.floor(Math.random() * 1e6)}/transactions`,
  () => '/fee_stats',
  () => '/health',
];

function tracesBody(now: number): Buffer {
  const spans = Array.from({ length: 50 }, () => {
    const dur = Math.round(5 + Math.random() * 400);
    return {
      name: 'GET',
      kind: 2,
      startTimeUnixNano: ns(now - dur),
      endTimeUnixNano: ns(now),
      attributes: [
        kv('http.request.method', 'GET'),
        kv('url.path', pick(PATHS)()),
        kv('http.response.status_code', pick([200, 200, 200, 200, 404, 500])),
      ],
    };
  });
  return encode(types.traceRequest, {
    resourceSpans: [
      { resource: { attributes: [kv('service.name', 'bench-api')] }, scopeSpans: [{ spans }] },
    ],
  });
}

function metricsBody(now: number): Buffer {
  const bounds = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];
  const dataPoints = Array.from({ length: 20 }, (_, i) => ({
    attributes: [
      kv('http.request.method', 'GET'),
      kv('http.route', `/route/${i}`),
      kv('http.response.status_code', 200),
    ],
    timeUnixNano: ns(now),
    count: '15',
    sum: 0.6,
    bucketCounts: ['0', '0', '5', '5', '5', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
    explicitBounds: bounds,
  }));
  return encode(types.metricsRequest, {
    resourceMetrics: [
      {
        resource: { attributes: [kv('service.name', 'bench-api')] },
        scopeMetrics: [
          {
            metrics: [
              {
                name: 'http.server.request.duration',
                unit: 's',
                histogram: { aggregationTemporality: 1, dataPoints },
              },
            ],
          },
        ],
      },
    ],
  });
}

const db = await createTestDb();
const { key } = await seedTenant(db.db);
const app = buildServer({
  store: createPgStore(db.pool),
  config: { rateLimit: { perSecond: 1e6, burst: 1e6 } },
});
await app.listen({ host: '127.0.0.1', port: 0 });
const address = app.server.address();
const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

const now = Date.now();
const headers = { 'content-type': 'application/x-protobuf', [product.ingestKeyHeader]: key };
const requests = [
  ...Array.from({ length: 20 }, () => ({
    method: 'POST' as const,
    path: '/v1/traces',
    headers,
    body: tracesBody(now),
  })),
  ...Array.from({ length: 5 }, () => ({
    method: 'POST' as const,
    path: '/v1/metrics',
    headers,
    body: metricsBody(now),
  })),
];

async function scenario(name: string, opts: Partial<autocannon.Options>) {
  const r = await autocannon({ url, requests, ...opts });
  const summary = {
    scenario: name,
    requestsPerSec: Math.round(r.requests.average),
    spansPerSec: Math.round(r.requests.average * 0.8 * 50),
    totalRequests: r.requests.total,
    latencyMs: { p50: r.latency.p50, p99: r.latency.p99, max: r.latency.max },
    non2xx: r.non2xx,
    errors: r.errors,
  };
  console.log(JSON.stringify(summary));
  return summary;
}

const steady = await scenario('steady-12rps', { connections: 4, overallRate: 12, duration: 20 });
const burst = await scenario('burst', { connections: 32, duration: 15 });

const { rows } = await db.pool.query(
  `SELECT count(*)::int AS rows, sum(count)::bigint AS requests, count(DISTINCT route)::int AS routes
     FROM api_metrics.request_minute`,
);
console.log(JSON.stringify({ stored: rows[0] }));

await app.close();
await db.drop();

const ok =
  steady.latencyMs.p99 <= 100 &&
  steady.non2xx === 0 &&
  steady.errors === 0 &&
  burst.errors === 0 &&
  burst.non2xx === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
