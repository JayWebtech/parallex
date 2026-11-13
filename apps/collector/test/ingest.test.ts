import { gzipSync } from 'node:zlib';
import { createTestDb } from '@parallax/db/testing';
import { LATENCY_BUCKETS, product } from '@parallax/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encode, types } from '../src/proto.js';
import { buildServer } from '../src/server.js';
import { createPgStore } from '../src/store.js';
import { countsAt, durationMetric, kv, ns, seedTenant } from './helpers.js';

const NOW = Date.UTC(2026, 10, 13, 12, 30, 15);
const MINUTE = Date.UTC(2026, 10, 13, 12, 30);
const ACCOUNT = 'GBBLEE6GKRUGUF34ALTAQM7NN6WAIKHBLZ3WIIPAGOZ6S7SZ3G2FB3VS';
const SECRET = 'SB6K5QLO3JZ2LIQ2EXEAR7KU7Z7WTCIR2JFDSOJII7HKK2AVPLYRB6ZL';
/** Not the seeded project's own Stellar ID, so it must not appear anywhere. */
const OTHER_ACCOUNT = 'GDAS22PTXC5P4E3NK3VUBXNLFBEQP5IFADACMNDCSJAKU3SOT3TKDYRV';

let db: Awaited<ReturnType<typeof createTestDb>>;
let tenant: Awaited<ReturnType<typeof seedTenant>>;
let clock = NOW;
let app: ReturnType<typeof buildServer>;

beforeAll(async () => {
  db = await createTestDb();
  tenant = await seedTenant(db.db);
});
afterAll(() => db.drop());

beforeEach(async () => {
  clock = NOW;
  await db.pool.query('TRUNCATE api_metrics.request_minute, api_metrics.ingest_warning_day');
  app = buildServer({
    store: createPgStore(db.pool),
    now: () => clock,
    config: { keyCacheTtlMs: 0, rateLimit: { perSecond: 1000, burst: 1000 } },
  });
});

const auth = () => ({ [product.ingestKeyHeader]: tenant.key });

async function rows() {
  const { rows } = await db.pool.query(
    `SELECT service_name, method, route, status_code, source, minute, count,
            duration_sum_ms, duration_buckets
       FROM api_metrics.request_minute ORDER BY route, status_code, source`,
  );
  return rows.map((r) => ({
    ...r,
    minute: new Date(r.minute).getTime(),
    count: Number(r.count),
    duration_buckets: (r.duration_buckets as string[]).map(Number),
  }));
}

const bucketsWith = (index: number, n: number) => {
  const b = new Array<number>(LATENCY_BUCKETS).fill(0);
  b[index] = n;
  return b;
};

function metricsFixture() {
  return durationMetric({
    timeMs: NOW,
    points: [
      {
        attrs: [
          kv('http.request.method', 'GET'),
          kv('http.route', '/accounts/:id'),
          kv('http.response.status_code', 200),
        ],
        counts: countsAt(3, 4), // 4 requests in (25, 50] ms
        sum: 0.16,
      },
      {
        attrs: [
          kv('http.request.method', 'post'),
          kv('http.route', '/tx'),
          kv('http.response.status_code', 503),
        ],
        counts: countsAt(14, 1), // 1 request above 10 s
        sum: 12,
      },
    ],
  });
}

const expectedMetricRows = [
  {
    service_name: 'api',
    method: 'GET',
    route: '/accounts/:id',
    status_code: 200,
    source: 'metrics',
    minute: MINUTE,
    count: 4,
    duration_sum_ms: 160,
    duration_buckets: bucketsWith(3, 4),
  },
  {
    service_name: 'api',
    method: 'POST',
    route: '/tx',
    status_code: 503,
    source: 'metrics',
    minute: MINUTE,
    count: 1,
    duration_sum_ms: 12000,
    duration_buckets: bucketsWith(14, 1),
  },
];

describe('POST /v1/metrics', () => {
  it('stores exact minute rows from an OTLP/JSON histogram', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: auth(),
      payload: metricsFixture(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
    expect(await rows()).toEqual(expectedMetricRows);
  });

  it('stores the same rows from OTLP/protobuf, plain and gzipped', async () => {
    const body = encode(types.metricsRequest, metricsFixture());
    const plain = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: { ...auth(), 'content-type': 'application/x-protobuf' },
      payload: body,
    });
    expect(plain.statusCode).toBe(200);
    expect(plain.headers['content-type']).toBe('application/x-protobuf');
    expect(await rows()).toEqual(expectedMetricRows);

    await db.pool.query('TRUNCATE api_metrics.request_minute');
    const gz = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: { ...auth(), 'content-type': 'application/x-protobuf', 'content-encoding': 'gzip' },
      payload: gzipSync(body),
    });
    expect(gz.statusCode).toBe(200);
    expect(await rows()).toEqual(expectedMetricRows);
  });

  it('adds up repeated deliveries for the same minute', async () => {
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/metrics',
        headers: auth(),
        payload: metricsFixture(),
      });
    }
    const [first] = await rows();
    expect(first).toMatchObject({
      count: 8,
      duration_sum_ms: 320,
      duration_buckets: bucketsWith(3, 8),
    });
  });

  it('turns cumulative streams into deltas', async () => {
    const send = (timeMs: number, n: number) =>
      app.inject({
        method: 'POST',
        url: '/v1/metrics',
        headers: auth(),
        payload: durationMetric({
          timeMs,
          startMs: NOW - 1000, // stream started after the collector did
          temporality: 2,
          points: [{ attrs: [kv('http.route', '/c')], counts: countsAt(0, n), sum: n * 0.001 }],
        }),
      });
    await send(NOW, 3);
    clock = NOW + 60_000;
    await send(NOW + 60_000, 5); // cumulative 5 → delta 2 in the next minute
    const r = await rows();
    expect(r.map((x) => [x.minute, x.count])).toEqual([
      [MINUTE, 3],
      [MINUTE + 60_000, 2],
    ]);
  });

  it('rejects points outside the accepted window with partial success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: auth(),
      payload: durationMetric({
        timeMs: NOW - 3 * 60 * 60_000,
        points: [{ attrs: [], counts: countsAt(0, 1), sum: 0.001 }],
      }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      partialSuccess: {
        rejectedDataPoints: 1,
        errorMessage: expect.stringContaining('time window'),
      },
    });
    expect(await rows()).toEqual([]);
  });

  it('normalizes raw paths and redacts secrets, counting a warning', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: auth(),
      payload: durationMetric({
        timeMs: NOW,
        points: [
          {
            attrs: [kv('url.path', `/accounts/${ACCOUNT}/payments`)],
            counts: countsAt(0, 1),
            sum: 0,
          },
          { attrs: [kv('url.path', `/sign/${SECRET}`)], counts: countsAt(0, 1), sum: 0 },
        ],
      }),
    });
    expect((await rows()).map((r) => r.route)).toEqual([
      '/accounts/{account}/payments',
      '/sign/{REDACTED_SECRET}',
    ]);
    const { rows: w } = await db.pool.query(
      'SELECT secrets_redacted FROM api_metrics.ingest_warning_day',
    );
    expect(w).toEqual([{ secrets_redacted: '1' }]);
  });

  it('maps exponential histograms onto the fixed buckets', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: auth(),
      payload: {
        resourceMetrics: [
          {
            resource: { attributes: [kv('service.name', 'exp')] },
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: 'http.server.request.duration',
                    unit: 's',
                    exponentialHistogram: {
                      aggregationTemporality: 1,
                      dataPoints: [
                        {
                          timeUnixNano: ns(NOW),
                          count: '3',
                          sum: 0.06,
                          scale: 0,
                          zeroCount: '0',
                          // scale 0: bucket i covers (2^i, 2^(i+1)] seconds… offset -5 → (1/32, 1/16] s
                          positive: { offset: -5, bucketCounts: ['3'] },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const [r] = await rows();
    // upper bound 1/16 s = 62.5 ms → (50, 75] bucket
    expect(r).toMatchObject({ service_name: 'exp', count: 3, duration_buckets: bucketsWith(4, 3) });
  });
});

describe('POST /v1/traces', () => {
  const span = (kind: number, attrs: ReturnType<typeof kv>[], durMs: number) => ({
    traceId: 'AAECAwQFBgcICQoLDA0ODw==',
    spanId: 'AAECAwQFBgc=',
    name: 'GET /accounts/:id SPAN-NAME-MARKER',
    kind,
    startTimeUnixNano: ns(NOW - durMs),
    endTimeUnixNano: ns(NOW),
    attributes: attrs,
    events: [{ name: 'EVENT-MARKER', timeUnixNano: ns(NOW) }],
  });

  it('counts SERVER spans only, with their duration, and discards everything else', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/traces',
      headers: auth(),
      payload: {
        resourceSpans: [
          {
            resource: { attributes: [kv('service.name', 'api'), kv('host.name', 'HOST-MARKER')] },
            scopeSpans: [
              {
                spans: [
                  span(
                    2,
                    [
                      kv('http.request.method', 'GET'),
                      kv('url.path', `/accounts/${ACCOUNT}`),
                      kv('http.response.status_code', 200),
                      kv('user.email', 'EMAIL-MARKER@example.org'),
                    ],
                    40,
                  ),
                  span(
                    2,
                    [
                      kv('http.request.method', 'GET'),
                      kv('url.path', `/accounts/${ACCOUNT}`),
                      kv('http.response.status_code', 200),
                    ],
                    60,
                  ),
                  span(
                    3,
                    [kv('http.request.method', 'GET'), kv('url.full', 'https://horizon/x')],
                    10,
                  ), // CLIENT: ignored
                  span(1, [], 5), // INTERNAL: ignored
                ],
              },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const r = await rows();
    expect(r).toEqual([
      {
        service_name: 'api',
        method: 'GET',
        route: '/accounts/{account}',
        status_code: 200,
        source: 'traces',
        minute: MINUTE,
        count: 2,
        duration_sum_ms: 100,
        duration_buckets: (() => {
          const b = bucketsWith(3, 1); // 40 ms
          b[4] = 1; // 60 ms
          return b;
        })(),
      },
    ]);
  });

  it('accepts protobuf traces', async () => {
    const body = encode(types.traceRequest, {
      resourceSpans: [
        {
          resource: { attributes: [kv('service.name', 'api')] },
          scopeSpans: [
            {
              spans: [
                { ...span(2, [kv('http.route', '/p')], 7), traceId: undefined, spanId: undefined },
              ],
            },
          ],
        },
      ],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/traces',
      headers: { ...auth(), 'content-type': 'application/x-protobuf' },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect((await rows()).map((x) => [x.route, x.count])).toEqual([['/p', 1]]);
  });
});

describe('POST /v1/logs', () => {
  it('acknowledges and stores nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: auth(),
      payload: {
        resourceLogs: [{ scopeLogs: [{ logRecords: [{ body: { stringValue: 'LOG-MARKER' } }] }] }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });
});

describe('nothing but aggregates reaches the database', () => {
  it('no marker from spans, events, logs or extra attributes is stored anywhere', async () => {
    const markers = [
      'SPAN-NAME-MARKER',
      'EVENT-MARKER',
      'HOST-MARKER',
      'EMAIL-MARKER',
      'LOG-MARKER',
      SECRET,
      OTHER_ACCOUNT,
      'AAECAwQF',
    ];
    await app.inject({
      method: 'POST',
      url: '/v1/traces',
      headers: auth(),
      payload: {
        resourceSpans: [
          {
            resource: { attributes: [kv('service.name', 'api'), kv('host.name', 'HOST-MARKER')] },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: 'AAECAwQFBgcICQoLDA0ODw==',
                    name: 'SPAN-NAME-MARKER',
                    kind: 2,
                    startTimeUnixNano: ns(NOW - 5),
                    endTimeUnixNano: ns(NOW),
                    attributes: [
                      kv('url.path', `/sign/${SECRET}/${OTHER_ACCOUNT}`),
                      kv('user.email', 'EMAIL-MARKER'),
                    ],
                    events: [{ name: 'EVENT-MARKER' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: auth(),
      payload: {
        resourceLogs: [{ scopeLogs: [{ logRecords: [{ body: { stringValue: 'LOG-MARKER' } }] }] }],
      },
    });
    const { rows: tables } = await db.pool.query<{ s: string; t: string }>(
      `SELECT table_schema AS s, table_name AS t FROM information_schema.tables
        WHERE table_schema IN ('portal', 'api_metrics', 'public')`,
    );
    const dump: string[] = [];
    for (const { s, t } of tables) {
      const { rows: all } = await db.pool.query(`SELECT * FROM "${s}"."${t}"`);
      dump.push(JSON.stringify(all));
    }
    const text = dump.join('\n');
    for (const m of markers) expect(text, m).not.toContain(m);
    expect(text).toContain('/sign/{REDACTED_SECRET}/{account}');
  });
});

describe('authentication and limits', () => {
  it('rejects missing, malformed and unknown keys with 401', async () => {
    for (const headers of [
      {},
      { [product.ingestKeyHeader]: 'nope' },
      { [product.ingestKeyHeader]: `${product.keyPrefixes.ingest}${'A'.repeat(43)}` },
    ]) {
      const res = await app.inject({ method: 'POST', url: '/v1/metrics', headers, payload: {} });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 16 });
    }
  });

  it('accepts the key as a Bearer token too', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { authorization: `Bearer ${tenant.key}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
  });

  it('stops accepting a key once revoked (cache TTL 0 here)', async () => {
    const other = await seedTenant(db.db, 'revoked');
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/v1/logs',
        headers: { [product.ingestKeyHeader]: other.key },
        payload: {},
      });
    expect((await send()).statusCode).toBe(200);
    await db.pool.query('UPDATE api_metrics.ingest_key SET revoked_at = now() WHERE id = $1', [
      other.keyId,
    ]);
    expect((await send()).statusCode).toBe(401);
  });

  it('stops accepting keys of removed projects', async () => {
    const other = await seedTenant(db.db, 'removed');
    await db.pool.query(`UPDATE portal.project SET status = 'removed' WHERE id = $1`, [
      other.projectId,
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { [product.ingestKeyHeader]: other.key },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('rate-limits per key with Retry-After', async () => {
    const limited = buildServer({
      store: createPgStore(db.pool),
      now: () => clock,
      config: { rateLimit: { perSecond: 1, burst: 2 } },
    });
    const send = () =>
      limited.inject({ method: 'POST', url: '/v1/logs', headers: auth(), payload: {} });
    expect((await send()).statusCode).toBe(200);
    expect((await send()).statusCode).toBe(200);
    const third = await send();
    expect(third.statusCode).toBe(429);
    expect(third.headers['retry-after']).toBe('1');
    clock += 1000;
    expect((await send()).statusCode).toBe(200);
  });

  it('caps the decompressed body size (zip bombs included)', async () => {
    const small = buildServer({ store: createPgStore(db.pool), config: { bodyLimitBytes: 1024 } });
    const big = Buffer.alloc(64 * 1024, 0);
    for (const [headers, payload] of [
      [{ 'content-type': 'application/x-protobuf' }, big],
      [{ 'content-type': 'application/x-protobuf', 'content-encoding': 'gzip' }, gzipSync(big)],
    ] as const) {
      const res = await small.inject({
        method: 'POST',
        url: '/v1/metrics',
        headers: { ...auth(), ...headers },
        payload,
      });
      expect(res.statusCode).toBe(413);
    }
  });

  it('rejects unsupported content types and encodings', async () => {
    const ct = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: { ...auth(), 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(ct.statusCode).toBe(415);
    const enc = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: { ...auth(), 'content-type': 'application/json', 'content-encoding': 'br' },
      payload: '{}',
    });
    expect(enc.statusCode).toBe(415);
  });

  it('answers malformed protobuf with 400 and a google.rpc.Status body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/metrics',
      headers: { ...auth(), 'content-type': 'application/x-protobuf' },
      payload: Buffer.from([0xff, 0xff, 0xff]),
    });
    expect(res.statusCode).toBe(400);
    expect(types.status.toObject(types.status.decode(res.rawPayload))).toMatchObject({ code: 3 });
  });
});
