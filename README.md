# Parallax

Privacy-first, multi-tenant **web and API analytics for Stellar ecosystem projects**:
a proof of concept for the SCF RFP "Web and API Analytics for Stellar Ecosystem Projects".

- **Web analytics** on [Umami](https://umami.is) 3.5.0 (pinned image digest): page views, unique
  visitors, referrers, visit duration, bounce rate, country, device, browser. No cookies, no stored
  IPs, country-level geo only.
- **Self-service enrollment**: sign up, register a project with its Stellar account (`G…`) or
  contract (`C…`), which is checksum-validated and checked on mainnet or testnet, then paste one
  version-pinned `<script>` tag with Subresource Integrity.
- **Tenant isolation**: every query is scoped to the signed-in owner; Umami is never exposed and
  tenants never get Umami credentials. Proven by service-level and HTTP end-to-end tests.
- **API analytics** (OpenTelemetry → normalized route metrics) and the **operator view** are later
  phases.

> Status: Phase 2 of 5 (infrastructure, Umami, enrollment, tenant web dashboard).

## Run it locally

Requires Docker and Node 24+ (pnpm via `corepack enable`).

```bash
pnpm install
pnpm env:init        # writes .env with random secrets
pnpm stack:up        # postgres, umami, portal, caddy → http://localhost:8080
```

Then open http://localhost:8080, enroll a project, and paste the snippet into any page.
`pnpm stack:down` stops everything.

## Repository

| Path                       | What                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| `apps/portal`              | Next.js portal: enrollment, tenant dashboard, JSON API, tracker serving |
| `packages/path-normalizer` | Route normalization for API analytics (Stellar-aware)                   |
| `packages/tracker`         | Vendored, version-pinned tracker builds + SRI manifest + ad-block test  |
| `packages/umami`           | Typed internal client for Umami's API (+ in-memory fake for tests)      |
| `packages/db`              | Drizzle schema and migrations (`portal` schema)                         |
| `packages/shared`          | Product name and derived identifiers (rename here)                      |
| `infra/`                   | Compose stack, Caddyfile, Postgres roles, country-only GeoIP pinning    |

## Tests

```bash
pnpm check           # format, lint, typecheck, unit + integration (needs a local Postgres)
pnpm test:adblock    # tracker URLs vs EasyList, EasyPrivacy, uBlock, AdGuard (network)
pnpm test:e2e        # HTTP isolation + real collection against the running stack
```

## License

MIT. The tracker in `packages/tracker/versions/` is derived from Umami (MIT, © Umami Software, Inc.).
IP geolocation by [DB-IP](https://db-ip.com) (CC BY 4.0).
