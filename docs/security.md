# Security

How Parallax protects tenants, their visitors and itself. The threat model for the
PoC: a malicious tenant or stranger on the internet trying to read another tenant's
data, tamper with the tracker, abuse ingestion, or escalate to operator access; and
a compromised upstream dependency.

## Tracker supply chain

The script that runs on tenants' websites is the most sensitive artifact, so it is
pinned three times over:

1. **Vendored and reviewable.** `packages/tracker/versions/<version>/px.js` is
   extracted from the pinned Umami image (tag _and_ digest), with only the collect
   path rewritten. It is committed, so every change shows up in a diff. CI re-derives
   it from the image and fails if a single byte differs
   (`pnpm --filter @parallax/tracker vendor --verify`).
2. **Subresource Integrity.** `tracker-versions.json` records the SHA-384 hash of
   each version. Snippets carry `integrity="sha384-…" crossorigin="anonymous"`, so
   browsers refuse to run a modified file, even one served by a compromised Parallax.
3. **No silent updates.** Each version has its own immutable URL
   (`/p/v1.0.0/px.js`, `Cache-Control: immutable`, one year). Upgrading means a
   tenant deliberately copies a new snippet; old versions and collect paths keep
   working.

Tests assert that the served bytes match the manifest hash, that the example sites
embed the current version with its hash, and (daily, in CI) that neither the script
URL nor the collect endpoint is blocked by EasyList, EasyPrivacy, uBlock Origin or
AdGuard filter lists.

## Dependencies and images

- **Exact versions everywhere.** npm dependencies are pinned exactly (`save-exact`,
  lockfile, `pnpm install --frozen-lockfile` in CI and Docker). Docker images are
  pinned by tag and digest, in `infra/docker-compose.yml` and the `Dockerfile`. GitHub
  Actions are pinned by commit SHA.
- **No install scripts.** `onlyBuiltDependencies: []` in `pnpm-workspace.yaml`:
  dependencies cannot run code at install time.
- **Cooling-off period.** pnpm refuses package versions younger than 3 days
  (`minimumReleaseAge`), and Renovate waits the same before proposing upgrades
  (`renovate.json`), which avoids most hijacked-release incidents.
- **Audit.** CI fails on known high-severity vulnerabilities in production
  dependencies (`pnpm audit --prod --audit-level high`).
- **Renovate** proposes every upgrade as a reviewed PR. Umami upgrades are labeled
  and never automerged, because they require vendoring a new tracker version.
- **Signed package manager.** Corepack verifies the pnpm release signature before
  use.

## Keys and secrets

- **No secrets in the repo.** All configuration comes from environment variables,
  documented in `.env.example`; `scripts/init-env.sh` generates a `.env` with random
  secrets and mode 600.
- **API keys are hashed.** Ingest keys (`plx_in_…`) and operator keys (`plx_op_…`)
  are 256 random bits, shown once at creation, and stored only as SHA-256 hashes (a
  slow hash adds nothing for 256-bit random secrets and would make every OTLP export
  slower). The typed prefix makes leaked keys easy to find with secret scanners.
  Keys can be revoked; revoked keys stop working within a minute.
- **Passwords** use argon2id (`@node-rs/argon2`), 10–128 characters.
- **Umami admin credentials** never leave the server. Umami is not reachable from the
  internet; tenants and operators never get Umami accounts.

## Isolation

- **Tenants** only reach their own projects: every query filters by owner on the
  server, and a project the user does not own answers 404, exactly like a missing one,
  so IDs cannot be probed. Umami website IDs are read from the project row, never
  taken from the request.
- **Operators** are allowlisted by email (`OPERATOR_EMAILS`); there is no way to
  become one from inside the app. Demo operators and API keys are read-only. Every
  operator change is written to an append-only audit log.
- **The public demo** reads through `apps/portal/lib/demo.ts`, which only returns
  live `is_demo` projects; a real tenant's ID is a 404 there too.
- **Tests enforce it.** Service-level tests cover every tenant function. An HTTP
  end-to-end matrix runs every project-scoped route as owner, as another tenant and
  anonymously against the full stack. `route-inventory.test.ts` fails the build if a
  new route is not in that matrix or lacks a guard.
- **Database roles** are least-privilege per service (see `docs/architecture.md`):
  for example, the collector can read only a key's hash with its project's ID and
  status, and write minute rows.

## Web application

- **Sessions:** Better Auth cookies (HttpOnly, SameSite=Lax). Mutating API routes also
  reject requests whose `Origin` is not the portal (CSRF defense in depth).
- **Headers:** a strict Content-Security-Policy (`default-src 'self'`, no third-party
  origins), `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Content-Type-Options: nosniff`. The example sites get their own strict CSP.
- **Input:** every request body is validated with zod; Stellar IDs are validated as
  StrKeys (checksum included) and checked for existence on the network.

## Abuse and rate limits

| Surface           | Limit                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up           | `SIGNUP_RATE_LIMIT` per client IP per 5 minutes (default 5)                                                                            |
| Sign-in           | 10 per IP per minute; 100 requests per minute overall per IP on auth routes                                                            |
| Projects          | `MAX_PROJECTS_PER_USER` active projects per account (default 10)                                                                       |
| OTLP ingest       | per key: `COLLECTOR_RATE_LIMIT_PER_SECOND` sustained (20) with a burst of `COLLECTOR_RATE_LIMIT_BURST` (200); `429` with `Retry-After` |
| OTLP payloads     | 5 MB at the edge; 4 MB after gzip decompression (a gzip bomb gets `413`)                                                               |
| Route cardinality | `MAX_ROUTES_PER_PROJECT` distinct routes per project (default 1,000), the rest grouped as `{other}`                                    |
| Late data         | points older than 2 hours get an OTLP partial-success rejection                                                                        |
| Public demo       | identical requests share one result for 30 s, so traffic cannot fan out to Umami                                                       |

## Network exposure

Only Caddy publishes ports (80/443). Postgres and Umami bind to `127.0.0.1` for local
debugging only. Umami's single public path is the event endpoint `/p/e`; its UI and
API are internal. Caddy keeps no access logs, so client IPs are not written to disk.

## Reporting a vulnerability

Please report security issues privately to the maintainers (GitHub security
advisories on the repository) rather than in a public issue.
