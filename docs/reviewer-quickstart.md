# Reviewer quickstart

Three ways to evaluate Parallax, from zero effort to your own data. Replace
`https://parallax.example.org` with the public URL you were given (or
`http://localhost:8080` if you run the stack yourself, see the README).

## 0. Just look (1 minute, no account)

Open **`/demo`** and click through the tabs:

| Tab                   | What it shows                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Demo Wallet · Web** | Web analytics of `examples/nextjs-site`: visitors, visits, bounce rate, duration, pages, referrers, countries, devices |
| **Demo Wallet · API** | API analytics of `examples/express-api`: requests, 5xx rate, p50/p95, per-route table                                  |
| **Demo Docs · Web**   | Web analytics of `examples/static-site`                                                                                |
| **Operator view**     | What SCF operators see, scoped to demo projects: all-project table and side-by-side comparison                         |

The demo tenant is fictional. `examples/load-generator` sends synthetic visitors and
API calls around the clock. **Click "Visit the site"** on a web tab, browse a few pages,
then come back: your own visit appears within a minute (unless your browser sends
Do Not Track, which Parallax honors).

The demo is read-only and can only ever show demo projects: a real tenant's project
ID gets a 404 there (`apps/portal/test/e2e/demo.e2e.test.ts`).

## 1. Try it with a website (5 minutes)

1. Open the landing page and click **Enroll your project**. Sign up with any email
   (it is not verified in the PoC) and a password of 10+ characters.
2. **Create a project.** You need a Stellar account (`G…`) or contract (`C…`) that
   exists on mainnet or testnet. No account handy? Create and fund a testnet account
   in one click with Stellar Laboratory's Friendbot, then paste its public key.
3. You land on the **Website snippet** page. Copy the snippet into the `<head>` of any
   page you control. No website handy:

   ```sh
   mkdir try-parallax && cd try-parallax
   echo '<!doctype html><title>Hello</title><h1>Hello</h1>' > index.html
   # paste your snippet into index.html, then:
   npx serve .
   ```

4. Open the page, then open **Web analytics** in the portal. The visit shows up within
   a minute (pick the **24h** range).

What to notice: the snippet pins a tracker version and its SHA-384 hash (`integrity=`),
so a modified file would not run. The browser stores nothing (DevTools → Application:
no cookies, no storage for the tracker), and the request goes to a neutral path that
common ad blockers do not block.

## 2. Instrument an API (5 minutes)

1. In your project, open **API setup** and click **Create key**. Copy it: it is
   shown once.
2. Run the example API with your key:

   ```sh
   pnpm install
   PARALLAX_ENDPOINT=https://parallax.example.org \
   PARALLAX_INGEST_KEY=plx_in_… \
   pnpm --filter @parallax/example-express-api start
   ```

3. In a second terminal, send it traffic for a minute:

   ```sh
   TARGET_URL=http://localhost:4000 RPS=20 DURATION_S=60 \
   pnpm --filter @parallax/example-load-generator start
   ```

4. Open **API analytics**: routes such as `GET /accounts/:accountId` appear with
   request counts, status mix and p50/p95 latency.

For your own API: the **API setup** page has copy-paste configuration for Node.js
(environment variables only, no code change) and for any language through an
OpenTelemetry Collector that sends everything to your own APM and only HTTP metrics
to Parallax (`examples/otel-collector-dual-export`).

What to notice: raw paths are normalized before storage (`/accounts/GABC…` becomes
`/accounts/{account}`), and spans, logs and payloads are dropped on arrival.

## 3. Check isolation yourself (2 minutes)

Sign up a second account in a private window and copy one of the first account's
project URLs (`/projects/<id>`) into it: you get a 404, the same as a project that
does not exist. The same holds for every project API route; the automated version is
`apps/portal/test/e2e/isolation.e2e.test.ts`, which CI runs against the full stack.

## Operator access

SCF operators are configured by email (`OPERATOR_EMAILS`) and see every project,
manage enrollment, issue read-only API keys and read the audit log. That access goes
to SCF privately. The public **Operator view** in `/demo` is the same screen, scoped to
demo projects. A read-only demo operator login can also be configured with
`DEMO_OPERATOR_EMAILS`.
