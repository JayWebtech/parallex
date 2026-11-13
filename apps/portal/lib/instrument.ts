import { product } from '@parallax/shared';

/**
 * Copy-paste setup snippets. `KEY` is replaced with the real key right after
 * creation, otherwise with a placeholder. The collector template is kept in
 * sync with examples/otel-collector-dual-export/config.yaml by a test.
 */
export const KEY_PLACEHOLDER = '<your-ingest-key>';

/** Node.js, zero code: metrics to Parallax, traces to your own APM. */
export function nodeEnvSnippet(endpoint: string, key = KEY_PLACEHOLDER): string {
  return `# Metrics → ${product.name} (HTTP server request durations)
OTEL_METRICS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=${endpoint}/v1/metrics
OTEL_EXPORTER_OTLP_METRICS_HEADERS=${product.ingestKeyHeader}=${key}
OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta

# Traces → your own APM (unchanged)
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://your-apm.example.com/v1/traces

OTEL_SERVICE_NAME=my-api
NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"`;
}

/** Any language: an OpenTelemetry Collector with two exporters. */
export function collectorConfig(
  endpoint = '${env:PARALLAX_ENDPOINT}',
  key = '${env:PARALLAX_INGEST_KEY}',
): string {
  return `# OpenTelemetry Collector (contrib): everything to your own APM, and HTTP
# server duration metrics (only) to ${product.name}.
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch: {}
  # ${product.name} only needs request duration histograms; drop everything else.
  filter/${product.slug}:
    error_mode: ignore
    metrics:
      metric:
        - 'name != "http.server.request.duration" and name != "http.server.duration"'
  # Send deltas, so a restart of this collector never double-counts.
  cumulativetodelta: {}

exporters:
  otlphttp/apm:
    endpoint: \${env:APM_OTLP_ENDPOINT}
    headers:
      authorization: \${env:APM_AUTH_HEADER}
  otlphttp/${product.slug}:
    endpoint: ${endpoint}
    headers:
      ${product.ingestKeyHeader}: ${key}
    compression: gzip

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/apm]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/apm]
    metrics/${product.slug}:
      receivers: [otlp]
      processors: [filter/${product.slug}, cumulativetodelta, batch]
      exporters: [otlphttp/${product.slug}]
`;
}
