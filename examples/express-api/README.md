# Example: Express API with dual OpenTelemetry export

An Express app instrumented with the OpenTelemetry Node SDK. HTTP server
metrics go to **both** your own APM and Parallax; traces go only to your APM.

```bash
pnpm install
PARALLAX_ENDPOINT=http://localhost:8080 \
PARALLAX_INGEST_KEY=plx_in_… \
APM_OTLP_ENDPOINT=http://localhost:4318 \
pnpm --filter @parallax/example-express-api start
```

- `src/telemetry.js`: two `PeriodicExportingMetricReader`s (Parallax with delta
  temporality and the `x-parallax-key` header; your APM unchanged).
- `src/server.js`: routes such as `/accounts/:accountId/payments` and
  `/transactions/:hash`. Express instrumentation sets `http.route`, so
  Parallax shows the templates as-is.

Get an ingest key from your project's **API setup** tab in the portal.
For other languages, use the OpenTelemetry Collector config in
[`../otel-collector-dual-export`](../otel-collector-dual-export).
