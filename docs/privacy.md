# Privacy

Parallax counts traffic, not people. This document describes what the software
stores and why tracked sites need no consent banner for it. The same summary is
served to the public at `/privacy`, with the hosting region filled in from
configuration. It describes how the software works and is not legal advice.

## Websites (web analytics)

### What the browser sends

On each pageview, the pinned tracker (`/p/v<version>/px.js`) sends one request to
`/p/e` containing the website ID, page path, page title, hostname, referrer, screen
size and browser language. Like any HTTP request, it also carries the visitor's IP
address and user-agent header.

The snippet sets two attributes, so less leaves the browser to begin with:

- `data-do-not-track="true"`: browsers that send Do Not Track send nothing.
- `data-exclude-search="true"`: query strings are removed before sending, so tokens,
  emails or ad click IDs (`gclid`, `fbclid`, …) in URLs never reach the server. The
  cost is that UTM campaign tags are not reported.

### What is stored

| Stored (in Umami's database)                        | Not stored                                      |
| --------------------------------------------------- | ----------------------------------------------- |
| Page path, title, hostname, timestamp               | IP address (used in memory, then dropped)       |
| Referrer domain and path                            | Full user-agent string (parsed, then dropped)   |
| Country (ISO code)                                  | Region, city, coordinates                       |
| Browser, OS, device type, screen size, language     | Cookies, local storage or any device identifier |
| Visitor hash: `hash(website, IP, user agent, salt)` | Query strings (removed in the browser)          |

- **Country only.** The country is looked up from the IP with a local, country-only
  database (DB-IP Country Lite, pinned by checksum in `infra/geo/geo.lock`). That
  database has no region or city data, Umami is told to ignore CDN geo headers
  (`SKIP_LOCATION_HEADERS`), and Caddy strips them anyway. An end-to-end test
  asserts that region and city are always empty.
- **Daily salt.** The visitor hash uses a salt that rotates every day
  (`SALT_ROTATION=day`). The same person on two days counts as two visitors, and
  nothing links their visits across days. Unique visitors over multi-day ranges are
  therefore an upper bound.
- **Nothing on the device.** The tracker writes no cookies and no storage. It only
  reads a `localStorage` opt-out flag (`umami.disabled`) if a site sets one.
- **No access logs.** Caddy has no `log` directive: client IPs are not written to disk
  at the edge either.

### Why no consent banner

Consent requirements for analytics come mainly from two rules. The ePrivacy rule
covers storing or reading information on the visitor's device: Parallax does
neither. The GDPR covers processing personal data: the IP address and user agent
are processed transiently and not stored, location stops at the country, and the
rotating hash prevents recognizing a visitor across days. This is the same design
as the privacy-focused analytics tools that operate without banners. Each tracked
site stays responsible for its own privacy notice and should mention Parallax there.

### Known limitation

Umami's tracker exposes `umami.identify()`, which a site's own JavaScript could call
to attach an ID it chose to a session. Parallax's snippet and dashboards never use it,
but the PoC does not block it. The full proposal filters `identify` events at the edge.

## APIs (API analytics)

The collector receives OpenTelemetry over OTLP/HTTP and keeps only aggregates:

| Kept, per minute                                     | Dropped on arrival, never written                           |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| Project, service name                                | Spans: names, attributes, events, links, trace and span IDs |
| HTTP method, normalized route, status code           | Logs (acknowledged without being decoded)                   |
| Request count, latency sum and fixed latency buckets | Request and response bodies and headers                     |
|                                                      | Any other metric or attribute                               |

Routes are normalized before storage: Stellar accounts, contracts and muxed
accounts, asset codes, UUIDs, hashes, numeric IDs, dates and long tokens become
placeholders (`/accounts/{account}`), so per-user identifiers in paths are not kept.
Stellar secret seeds found in a path are replaced with `{REDACTED_SECRET}` and only a
counter is kept, so the tenant can be warned. A test sends payloads full of marker
strings in every field and checks that none of them reaches any table.

## Retention

| Data                    | Kept                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Web events and sessions | While the project exists                                                              |
| API metrics per minute  | 14 days                                                                               |
| API metrics per hour    | 90 days                                                                               |
| API metrics per day     | While the project exists (the proposal's ≥24-month target)                            |
| Portal accounts         | Until deleted: email, name, argon2id password hash; sessions without IP or user agent |

## Deleting data

- **Project owners** can delete a project and all its data from the project's
  **Settings** page ("Delete project and all data", confirmed by typing the name).
  The project disappears at once, its ingest keys stop working, and within a minute
  the worker deletes its Umami website (every event and session), all API rollups,
  warnings and keys. It cannot be restored. The project row stays as a tombstone
  (name and Stellar ID, no analytics) for the audit trail.
- **Operators** can remove a project; it can be restored for `PURGE_AFTER_HOURS`
  (24 h by default), after which the same purge runs.

## Data residency and processors

Everything runs in one place: Caddy, the portal, Umami, the collector, the worker
and Postgres share one host (or one private network) in the region set by
`DATA_REGION`, which `/privacy` displays. There are no third-party processors: no
CDN geo service, no external GeoIP API, no hosted analytics, no telemetry (Umami
runs with `DISABLE_TELEMETRY`, `DISABLE_UPDATES` and `PRIVATE_MODE`, which block its
outbound calls).

## Jurisdictions

- **EU/EEA and UK:** designed for the GDPR and the ePrivacy Directive (and UK GDPR /
  PECR) as described above. Hosting in the EU avoids international transfers; if the
  host is outside the EU, the tenant's privacy notice should say so.
- **Elsewhere** (e.g. CCPA/CPRA, LGPD, NDPR): Parallax does not sell or share data
  and stores no direct identifiers, which keeps it outside most notice-and-opt-out
  duties for analytics. Tenants should still confirm their local requirements.
