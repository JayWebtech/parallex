#!/bin/sh
# Downloads the pinned country-only GeoIP database into infra/geo/data/country.mmdb
# and verifies its checksum against geo.lock.
#
#   infra/geo/fetch-geo.sh            fetch the pinned month (no-op if already present and valid)
#   infra/geo/fetch-geo.sh --update   pin the current month, rewrite geo.lock, fetch it
set -eu
cd "$(dirname "$0")"
. ./geo.lock

if [ "${1:-}" = "--update" ]; then
  DBIP_MONTH=$(date -u +%Y-%m)
  DBIP_SHA256=""
fi

url="https://download.db-ip.com/free/dbip-country-lite-${DBIP_MONTH}.mmdb.gz"
mkdir -p data
gz="data/.dbip-${DBIP_MONTH}.mmdb.gz"

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

if [ -f "$gz" ] && [ -n "$DBIP_SHA256" ] && [ "$(sha256 "$gz")" = "$DBIP_SHA256" ] && [ -f data/country.mmdb ]; then
  echo "geo: country.mmdb ($DBIP_MONTH) already present"
  exit 0
fi

download() { if command -v curl >/dev/null; then curl -fsSL -o "$1" "$2"; else wget -q -O "$1" "$2"; fi; }

echo "geo: downloading $url"
if ! download "$gz.tmp" "$url"; then
  echo "geo: download failed. DB-IP keeps only recent months; run '$0 --update' to pin the current one." >&2
  exit 1
fi
actual=$(sha256 "$gz.tmp")
if [ -n "$DBIP_SHA256" ] && [ "$actual" != "$DBIP_SHA256" ]; then
  rm -f "$gz.tmp"
  echo "geo: checksum mismatch for $DBIP_MONTH (expected $DBIP_SHA256, got $actual)" >&2
  exit 1
fi
mv "$gz.tmp" "$gz"
gunzip -c "$gz" > data/country.mmdb.tmp && mv data/country.mmdb.tmp data/country.mmdb

if [ "${1:-}" = "--update" ]; then
  sed -i.bak -e "s/^DBIP_MONTH=.*/DBIP_MONTH=${DBIP_MONTH}/" -e "s/^DBIP_SHA256=.*/DBIP_SHA256=${actual}/" geo.lock
  rm -f geo.lock.bak
  echo "geo: pinned $DBIP_MONTH ($actual) in geo.lock"
fi
echo "geo: country.mmdb ready ($DBIP_MONTH)"
