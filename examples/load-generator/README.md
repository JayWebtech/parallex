# Example: load generator

Drives the other examples so dashboards have something to show. Each part runs only
when its URL is set.

- **API** (`TARGET_URL`, `RPS`): realistic requests to `examples/express-api` with
  random valid Stellar accounts, contracts and transaction hashes, plus a few bad inputs.
- **Web** (`WEB_COLLECT_URL`, `WEB_VISITS_PER_HOUR`): synthetic visitors to the demo's
  example sites. Each visit sends exactly what the pinned tracker sends from a browser
  (one event per pageview, spaced like a person reading), with a realistic mix of
  devices, browsers, languages, referrers and countries. About 45% bounce.

```sh
# One minute of API load against a local example API
TARGET_URL=http://localhost:4000 RPS=20 DURATION_S=60 \
  pnpm --filter @parallax/example-load-generator start
```

`DURATION_S=0` runs forever, with rates following a daily curve (quiet at night UTC).
That is how the public demo runs it (`demo-traffic` in `infra/docker-compose.yml`).

## Countries

Umami derives the country from the client IP. Synthetic visits send an
`X-Forwarded-For` from small per-country samples (`src/geo.js`) that the pinned
country database maps to those countries. The addresses are only lookup input: Umami
never stores IPs, and nothing contacts them. This only works from the private Docker
network, which Umami trusts for that header; on the internet, Caddy replaces it with
the real client address.
