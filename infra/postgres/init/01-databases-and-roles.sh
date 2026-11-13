#!/bin/sh
# Runs once, on the first start of an empty Postgres volume.
#
# One instance, two databases, least-privilege roles:
#   umami            database owned by role `umami` (Umami runs its own migrations)
#   parallax         database owned by `parallax_owner` (runs our migrations only)
#   parallax_app     runtime role for the portal: data access in `portal`, no DDL
# No role can connect to the other's database.
set -eu

: "${UMAMI_DB_PASSWORD:?}" "${PARALLAX_OWNER_PASSWORD:?}" "${PARALLAX_APP_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v umami_pw="$UMAMI_DB_PASSWORD" \
  -v owner_pw="$PARALLAX_OWNER_PASSWORD" \
  -v app_pw="$PARALLAX_APP_PASSWORD" <<'SQL'
CREATE ROLE umami LOGIN PASSWORD :'umami_pw';
CREATE ROLE parallax_owner LOGIN PASSWORD :'owner_pw';
CREATE ROLE parallax_app LOGIN PASSWORD :'app_pw';

CREATE DATABASE umami OWNER umami;
CREATE DATABASE parallax OWNER parallax_owner;

REVOKE ALL ON DATABASE umami FROM PUBLIC;
REVOKE ALL ON DATABASE parallax FROM PUBLIC;
GRANT CONNECT ON DATABASE parallax TO parallax_app;

-- Umami recommends a UTC database timezone.
ALTER DATABASE umami SET timezone TO 'UTC';
ALTER DATABASE parallax SET timezone TO 'UTC';
SQL

# Nobody but the owner may create objects in public.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname parallax \
  -c 'REVOKE CREATE ON SCHEMA public FROM PUBLIC;'
