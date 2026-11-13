/**
 * Compatibility with the real OpenTelemetry JS SDK: its exporters (protobuf
 * and JSON encodings, delta and cumulative temporality) talk to a running
 * collector over HTTP, exactly as a tenant's service would.
 */
import { SpanKind } from '@opentelemetry/api';
import { OTLPMetricExporter as JsonMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { AggregationTemporalityPreference } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPMetricExporter as ProtoMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { createTestDb } from '@parallax/db/testing';
import { product } from '@parallax/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';
import { createPgStore } from '../src/store.js';
import { seedTenant } from './helpers.js';

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof buildServer>;
let base: string;
let key: string;

beforeAll(async () => {
  db = await createTestDb();
  ({ key } = await seedTenant(db.db));
  app = buildServer({ store: createPgStore(db.pool) });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(async () => {
  await app.close();
  await db.drop();
});
beforeEach(() => db.pool.query('TRUNCATE api_metrics.request_minute'));

async function totals(source: string) {
  const { rows } = await db.pool.query<{ service_name: string; method: string; route: string; status_code: number; n: string }>(
    `SELECT service_name, method, route, status_code, sum(count) AS n
       FROM api_metrics.request_minute WHERE source = $1
      GROUP BY 1, 2, 3, 4 ORDER BY 3, 4`,
    [source],
  );
  return rows.map((r) => [r.service_name, r.method, r.route, r.status_code, Number(r.n)]);
}

function meter(exporter: ProtoMetricExporter | JsonMetricExporter, service: string) {
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 });
  const provider = new MeterProvider({
    resource: resourceFromAttributes({ 'service.name': service }),
    readers: [reader],
  });
  const histogram = provider
    .getMeter('test')
    .createHistogram('http.server.request.duration', { unit: 's' });
  return { provider, histogram };
}

const headers = () => ({ [product.ingestKeyHeader]: key });

describe('OpenTelemetry JS SDK → collector', () => {
  it('protobuf exporter, delta temporality', async () => {
    const { provider, histogram } = meter(
      new ProtoMetricExporter({
        url: `${base}/v1/metrics`,
        headers: headers(),
        temporalityPreference: AggregationTemporalityPreference.DELTA,
      }),
      'payments-api',
    );
    const route = { 'http.request.method': 'GET', 'http.route': '/accounts/:account_id' };
    histogram.record(0.03, { ...route, 'http.response.status_code': 200 });
    histogram.record(0.04, { ...route, 'http.response.status_code': 200 });
    histogram.record(0.9, { ...route, 'http.response.status_code': 500 });
    await provider.forceFlush();
    histogram.record(0.02, { ...route, 'http.response.status_code': 200 });
    await provider.shutdown();

    expect(await totals('metrics')).toEqual([
      ['payments-api', 'GET', '/accounts/:account_id', 200, 3],
      ['payments-api', 'GET', '/accounts/:account_id', 500, 1],
    ]);
  });

  it('JSON exporter, cumulative temporality (the SDK default) is not double-counted', async () => {
    const { provider, histogram } = meter(
      new JsonMetricExporter({ url: `${base}/v1/metrics`, headers: headers() }),
      'cumulative-api',
    );
    const attrs = { 'http.request.method': 'POST', 'http.route': '/tx', 'http.response.status_code': 201 };
    histogram.record(0.1, attrs);
    histogram.record(0.2, attrs);
    await provider.forceFlush(); // exports cumulative 2
    histogram.record(0.3, attrs);
    await provider.forceFlush(); // exports cumulative 3 → delta 1
    await provider.forceFlush(); // exports cumulative 3 → delta 0
    await provider.shutdown();

    expect(await totals('metrics')).toEqual([['cumulative-api', 'POST', '/tx', 201, 3]]);
  });

  it('protobuf trace exporter: SERVER spans become request counts', async () => {
    const provider = new TracerProvider({
      resource: resourceFromAttributes({ 'service.name': 'horizon-proxy' }),
      spanProcessors: [
        new SimpleSpanProcessor({
          exporter: new OTLPTraceExporter({ url: `${base}/v1/traces`, headers: headers() }),
        }),
      ],
    });
    const tracer = provider.getTracer('test');
    for (const status of [200, 200, 404]) {
      tracer
        .startSpan('GET', {
          kind: SpanKind.SERVER,
          attributes: {
            'http.request.method': 'GET',
            'url.path': '/transactions/262f23e745d9aee3529a559fa26130f1d892dbdf83d642cccc5aaed824a00505',
            'http.response.status_code': status,
          },
        })
        .end();
    }
    tracer.startSpan('outgoing', { kind: SpanKind.CLIENT }).end();
    await provider.forceFlush();
    await provider.shutdown();

    expect(await totals('traces')).toEqual([
      ['horizon-proxy', 'GET', '/transactions/{hash}', 200, 2],
      ['horizon-proxy', 'GET', '/transactions/{hash}', 404, 1],
    ]);
  });
});
