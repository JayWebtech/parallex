# Example: OpenTelemetry Collector with two exporters

For services in any language. Your services send OTLP to this collector; it
forwards **everything** to your own APM and **only HTTP server duration
metrics** to Parallax (filtered, converted to delta, gzip).

```bash
docker run --rm -p 4317:4317 -p 4318:4318 \
  -v "$PWD/config.yaml:/etc/otelcol-contrib/config.yaml:ro" \
  -e APM_OTLP_ENDPOINT=https://apm.example.com \
  -e APM_AUTH_HEADER="Bearer …" \
  -e PARALLAX_ENDPOINT=https://parallax.example.org \
  -e PARALLAX_INGEST_KEY=plx_in_… \
  otel/opentelemetry-collector-contrib:0.165.0
```

`config.yaml` is generated from the same template the portal shows on the
**API setup** tab (`apps/portal/lib/instrument.ts`), and a test keeps them
identical. CI validates it with `otelcol-contrib validate`.
