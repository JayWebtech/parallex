# Deploy

Production uses the same `docker compose` stack as local development, on one VPS,
with Caddy obtaining and renewing TLS certificates automatically.

## Requirements

- A Linux VPS with Docker Engine and the Compose plugin: 2 vCPU, 4 GB RAM and 40 GB of
  disk are comfortable for the PoC load (~1M API requests/day plus web traffic).
- A DNS name pointing at it (an `A`/`AAAA` record), e.g. `parallax.example.org`.
- Ports 80 and 443 open to the internet. Nothing else needs to be.

Pick the host's region deliberately: it is where all analytics data lives, and you
state it in `DATA_REGION` (shown on `/privacy`).

## First deploy

```sh
git clone <this repository> parallax && cd parallax
sh scripts/init-env.sh          # .env with random secrets (mode 600)
```

Edit `.env`:

| Variable                   | Production value                                          |
| -------------------------- | --------------------------------------------------------- |
| `PUBLIC_URL`               | `https://parallax.example.org`                            |
| `SITE_ADDRESS`             | `parallax.example.org` (a hostname makes Caddy use HTTPS) |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443`                                              |
| `DATA_REGION`              | where the host runs, e.g. `eu-central (Germany)`          |
| `OPERATOR_EMAILS`          | the SCF operators' emails (comma-separated)               |
| `DEMO_OPERATOR_EMAILS`     | optional: a read-only login that only sees demo projects  |
| `COMPOSE_PROFILES`         | `demo` to run the public demo, empty to run without it    |
| `STELLAR_RPC_MAINNET_URL`  | an RPC node, if mainnet contracts must be verifiable      |

Then:

```sh
docker compose up --build -d --wait
```

The one-shot `setup` job runs database migrations and sets Umami's admin password;
`demo-seed` creates the demo tenant when the `demo` profile is on. Open
`https://parallax.example.org`, sign up with an operator email, and the operator
section appears in the sidebar.

Postgres and Umami also publish debug ports bound to `127.0.0.1` only
(`POSTGRES_HOST_PORT`, `UMAMI_HOST_PORT`); they are not reachable from outside the
host. Keep the host firewall closed except for 80 and 443 (and SSH).

## Upgrades

```sh
git pull
docker compose up --build -d --wait
```

Migrations run on every start and are idempotent. Every image and package is pinned,
so a deploy only changes what the pulled commit changes. Renovate opens PRs for
upgrades; an **Umami** upgrade must also vendor the new tracker in the same PR
(`pnpm --filter @parallax/tracker vendor`): tenants keep the old pinned version until
they copy the new snippet.

## Backups

All state is in the `pgdata` volume (both databases) and `caddy_data` (certificates).
A nightly logical backup is enough for the PoC:

```sh
docker compose exec -T postgres pg_dumpall -U postgres | gzip > "backup-$(date +%F).sql.gz"
```

Store backups off the host, encrypted, in the same jurisdiction as `DATA_REGION`.
Restore into a fresh volume with `gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U postgres`.

## Operations

- **Health:** `docker compose ps` shows health checks for Postgres, Umami, portal,
  collector and the demo API. The portal exposes `/api/health`.
- **Logs:** `docker compose logs -f <service>`. Services log JSON lines without IPs;
  Caddy keeps no access log.
- **Rotating secrets:** change a value in `.env` and `docker compose up -d`. Rotating
  `BETTER_AUTH_SECRET` signs everyone out; rotating `DEMO_INGEST_KEY` revokes the old
  demo key on the next start.

## Fly.io and other platforms

The services are plain containers built from the root `Dockerfile` (`--target portal`,
`collector`, `worker`, `edge`, `demo`), so any container platform works. Use a managed
Postgres 18 with the roles from `infra/postgres/init`, run the `builder` target's
setup command once per release, and give Umami a private network address only. Keep
exactly one worker running (it also takes a Postgres advisory lock).
