# @parallax/path-normalizer

Turns raw request paths into low-cardinality route templates, with first-class
support for Stellar identifiers. Built for API analytics: grouping
`/accounts/GBBL…B3VS/payments` and `/accounts/GDAS…DYRV/payments` into one
`/accounts/{account}/payments` row instead of one row per account.

- Stellar IDs are validated with `@stellar/stellar-sdk` StrKey checksums, not regexes alone.
- **Secret seeds (`S…`) are always redacted**, and counted so you can warn whoever is leaking them.
- Pure functions, no I/O, ESM, fully typed.

```sh
npm install @parallax/path-normalizer
```

## Usage

```ts
import {
  createCardinalityGuard,
  normalizePath,
  normalizePathWithStats,
  normalizeRoute,
} from '@parallax/path-normalizer';

normalizePath(
  '/accounts/GBBLEE6GKRUGUF34ALTAQM7NN6WAIKHBLZ3WIIPAGOZ6S7SZ3G2FB3VS/payments?limit=10',
);
// → '/accounts/{account}/payments'

normalizePathWithStats('/sign/SB6K5QLO3JZ2LIQ2EXEAR7KU7Z7WTCIR2JFDSOJII7HKK2AVPLYRB6ZL');
// → { path: '/sign/{REDACTED_SECRET}', secretsRedacted: 1 }

// From OpenTelemetry span / data point attributes:
normalizeRoute({ 'http.route': '/users/:id', 'url.path': '/users/42' });
// → { route: '/users/:id', source: 'http.route', secretsRedacted: 0 }
normalizeRoute({ 'http.target': '/ledgers/52480123/transactions?order=desc' });
// → { route: '/ledgers/{id}/transactions', source: 'http.target', secretsRedacted: 0 }

// One guard per tenant caps distinct routes; overflow maps to {other}.
const guard = createCardinalityGuard({ maxRoutes: 1000, known: routesAlreadyStored });
guard.admit('/ledgers/{id}/transactions'); // → same route, or '{other}' once over budget
```

## Rules

Each path segment is percent-decoded and checked against these rules, in order.
The first match wins.

| Segment                                                                                                          | Becomes               |
| ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| Muxed account `M…` (69 chars, valid StrKey)                                                                      | `{muxed_account}`     |
| Account `G…` (56 chars, valid StrKey)                                                                            | `{account}`           |
| Contract `C…` (56 chars, valid StrKey)                                                                           | `{contract}`          |
| Secret seed `S…` (56 chars, valid StrKey)                                                                        | `{REDACTED_SECRET}`   |
| Liquidity pool `L…` (56 chars, valid StrKey)                                                                     | `{liquidity_pool}`    |
| Claimable balance `B…` (58 chars, valid StrKey)                                                                  | `{claimable_balance}` |
| Asset `CODE:G…` / `CODE-G…` (code 1–12 alphanumerics, optional `-1`/`-2`)                                        | `{asset}`             |
| UUID, any version, any case                                                                                      | `{uuid}`              |
| ULID                                                                                                             | `{ulid}`              |
| `0x` + 16 or more hex digits, or bare hex of 32+ (md5, sha1, sha256/tx hash, Horizon pool/claimable-balance ids) | `{hash}`              |
| Digits only                                                                                                      | `{id}`                |
| ISO date `YYYY-MM-DD`, optionally with time and offset                                                           | `{date}`              |
| Opaque token: 20+ chars of `[A-Za-z0-9._~+=-]` that look random (see below)                                      | `{token}`             |
| 40+ characters of `[A-Z2-7]` only (StrKey-shaped with a bad checksum)                                            | `{token}`             |
| Any segment longer than `maxSegmentLength` (default 128)                                                         | `{token}`             |

Strings that look like StrKeys but fail the checksum are not treated as Stellar IDs. They usually match the token rule instead.

**Token heuristic.** A segment is treated as a token when it switches between
letters and digits at least 4 times (`ckl2x7y8z0000abcd1234`), or when it mixes upper
and lower case and its lowercase runs average fewer than 3 characters. Random
base64 averages about 1.7; camelCase words such as `MyBlogPost2024AboutStellar`
average more than 3. Separators break letter/digit adjacency, so slugs like
`how-to-build-on-stellar-2024` are kept. On random base64url input the rule
misses about 1.6% of 20-character tokens and 0.2% of 32-character ones. Use the
cardinality guard to bound what slips through.

**Path mechanics:**

- Absolute URLs are reduced to their path. Query strings and fragments are dropped.
- Duplicate slashes are collapsed. The trailing slash is removed, except on `/`.
- Malformed percent-escapes are left as they are. A segment is kept in its encoded form if decoding would introduce `/` or control characters.
- Paths deeper than `maxSegments` (default 12) are cut and end in `/{…}`.
- Inputs are capped at 8 KiB.

**`http.route`.** When present and non-empty, it is a server-side template and is used verbatim. The only exceptions: query and fragment are stripped, a leading `/` is ensured, and secret seeds are still redacted. Otherwise the route comes from the first present attribute among `url.path`, `http.target`, `url.full` and `http.url`, normalized as above. If none is present the result is `{unknown}`.

## API

| Export                                           | Description                                                |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `normalizePath(path, options?)`                  | Normalized route string.                                   |
| `normalizePathWithStats(path, options?)`         | `{ path, secretsRedacted }`.                               |
| `normalizeRoute(attributes, options?)`           | `{ route, source, secretsRedacted }` from OTel attributes. |
| `createCardinalityGuard({ maxRoutes?, known? })` | `{ admit(route), size, rejected }`. Default budget: 1000.  |
| `classifySegment(segment)`                       | Placeholder for one decoded segment, or `null`.            |
| `PLACEHOLDERS`                                   | All placeholder strings.                                   |

`options`: `{ maxSegments?: number; maxSegmentLength?: number }`.

## License

MIT
