// OpenTelemetry setup, loaded before the app (`node --import ./src/telemetry.js`).
//
// Dual export: the same HTTP server metrics go to the team's own APM *and* to
// Parallax. Parallax receives aggregates only; traces stay with the APM.
//
//   PARALLAX_ENDPOINT=https://parallax.example.org  PARALLAX_INGEST_KEY=plx_in_…
//   APM_OTLP_ENDPOINT=https://apm.example.com       (optional; any OTLP/HTTP backend)
import { register } from 'node:module';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { AggregationTemporality, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';

// The app is ESM: instrumentations only patch ESM imports (express) once this
// loader hook is registered. Without it, http.route is never set and every
// request shows up as {unknown}.
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

const {
  PARALLAX_ENDPOINT,
  PARALLAX_INGEST_KEY,
  APM_OTLP_ENDPOINT,
  OTEL_SERVICE_NAME = 'example-express-api',
  METRICS_EXPORT_INTERVAL_MS = '15000',
} = process.env;

const interval = Number(METRICS_EXPORT_INTERVAL_MS);
const metricReaders = [];
const spanProcessors = [];

if (PARALLAX_ENDPOINT && PARALLAX_INGEST_KEY) {
  metricReaders.push(
    new PeriodicExportingMetricReader({
      exportIntervalMillis: interval,
      exporter: new OTLPMetricExporter({
        url: `${PARALLAX_ENDPOINT.replace(/\/$/, '')}/v1/metrics`,
        headers: { 'x-parallax-key': PARALLAX_INGEST_KEY },
        // Deltas: restarts of this process never double-count.
        temporalityPreference: AggregationTemporality.DELTA,
      }),
    }),
  );
} else {
  console.warn('PARALLAX_ENDPOINT / PARALLAX_INGEST_KEY not set: not exporting to Parallax');
}

if (APM_OTLP_ENDPOINT) {
  const apm = APM_OTLP_ENDPOINT.replace(/\/$/, '');
  metricReaders.push(
    new PeriodicExportingMetricReader({
      exportIntervalMillis: interval,
      exporter: new OTLPMetricExporter({ url: `${apm}/v1/metrics` }),
    }),
  );
  spanProcessors.push(
    new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${apm}/v1/traces` }) }),
  );
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ 'service.name': OTEL_SERVICE_NAME }),
  metricReaders,
  spanProcessors,
  // Express instrumentation sets http.route (e.g. /accounts/:accountId), so
  // Parallax shows route templates without needing its path normalizer.
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});

sdk.start();
process.on('SIGTERM', () => sdk.shutdown().finally(() => process.exit(0)));
