#!/bin/sh
# Creates .env from .env.example with fresh random secrets. Refuses to
# overwrite an existing .env.
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] && { echo ".env already exists; not touching it."; exit 1; }

hex() { openssl rand -hex "$1"; }
b64() { openssl rand -base64 "$1" | tr -d '\n/+=' ; }
# 32 random bytes as 43 base64url characters, behind the ingest key prefix.
ingest_key() { printf 'plx_in_%s' "$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"; }

sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(b64 24)|" \
  -e "s|^UMAMI_DB_PASSWORD=.*|UMAMI_DB_PASSWORD=$(b64 24)|" \
  -e "s|^PARALLAX_OWNER_PASSWORD=.*|PARALLAX_OWNER_PASSWORD=$(b64 24)|" \
  -e "s|^PARALLAX_APP_PASSWORD=.*|PARALLAX_APP_PASSWORD=$(b64 24)|" \
  -e "s|^PARALLAX_COLLECTOR_PASSWORD=.*|PARALLAX_COLLECTOR_PASSWORD=$(b64 24)|" \
  -e "s|^PARALLAX_WORKER_PASSWORD=.*|PARALLAX_WORKER_PASSWORD=$(b64 24)|" \
  -e "s|^UMAMI_APP_SECRET=.*|UMAMI_APP_SECRET=$(hex 32)|" \
  -e "s|^UMAMI_ADMIN_PASSWORD=.*|UMAMI_ADMIN_PASSWORD=$(b64 24)|" \
  -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(b64 48)|" \
  -e "s|^DEMO_INGEST_KEY=.*|DEMO_INGEST_KEY=$(ingest_key)|" \
  .env.example > .env
chmod 600 .env
echo "Wrote .env with random secrets. Add your email to OPERATOR_EMAILS for operator access."
