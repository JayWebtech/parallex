// Synthetic visitors for the demo's example sites. Each visit is what the
// pinned tracker would send from a browser: one `event` per pageview, with the
// visitor's user agent, screen, language and referrer, spaced like a person
// reading. Umami computes visitors, visits, bounce rate and duration from them.
import { DEMO_PROJECTS } from '@parallax/shared';
import { COUNTRIES } from './geo.js';
import { between, diurnal, sleep, weighted } from './random.js';

const DEVICES = [
  // [weight, user agent, screen]
  [
    30,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    '1920x1080',
  ],
  [
    14,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15',
    '1512x982',
  ],
  [8, 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0', '2560x1440'],
  [
    6,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
    '1366x768',
  ],
  [
    20,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1',
    '393x852',
  ],
  [
    18,
    'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    '412x915',
  ],
  [
    4,
    'Mozilla/5.0 (iPad; CPU OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1',
    '820x1180',
  ],
];

const REFERRERS = [
  [40, ''],
  [25, 'https://www.google.com/'],
  [6, 'https://duckduckgo.com/'],
  [8, 'https://github.com/'],
  [6, 'https://forum.example.org/t/wallet-sdks'],
  [5, 'https://news.example.com/'],
];

const SITE_WEIGHTS = { 'nextjs-site': 60, 'static-site': 40 };

async function visit({ collectUrl, hostname, stats }) {
  const [, example, site] = weighted(
    DEMO_PROJECTS.map((p) => [SITE_WEIGHTS[p.site.example] ?? 1, p.site.example, p]),
  );
  const [, ua, screen] = weighted(DEVICES);
  const [, , prefix, language] = weighted(COUNTRIES);
  const ip = `${prefix}.${1 + Math.floor(Math.random() * 254)}`;
  const [, referrer] = weighted(REFERRERS);
  // ~45% bounce; the rest read 2-5 pages.
  const pageviews = Math.random() < 0.45 ? 1 : 2 + Math.floor(Math.random() * 4);
  const pages = site.site.pages;
  let page = Math.random() < 0.6 ? pages[0] : pages[Math.floor(Math.random() * pages.length)];
  let cache;

  for (let i = 0; i < pageviews; i++) {
    if (i > 0) {
      await sleep(between(8_000, 90_000));
      const others = pages.filter((p) => p !== page);
      page = others[Math.floor(Math.random() * others.length)];
    }
    try {
      const res = await fetch(collectUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': ua,
          'x-forwarded-for': ip,
          ...(cache ? { 'x-umami-cache': cache } : {}),
        },
        body: JSON.stringify({
          type: 'event',
          payload: {
            website: site.websiteId,
            hostname,
            screen,
            language,
            title: `${site.name} (${example})`,
            url: `${site.site.basePath}${page}`,
            referrer: i === 0 ? referrer : '',
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      cache = (await res.json().catch(() => ({}))).cache ?? cache;
      stats.pageviews++;
    } catch {
      stats.webFailed++;
      return;
    }
  }
}

/** Starts visits at `perHour` on average (shaped by the daily curve) until `until`. */
export async function runWeb({ collectUrl, hostname, perHour, until, stats }) {
  const inFlight = new Set();
  while (Date.now() < until) {
    stats.visits++;
    const v = visit({ collectUrl, hostname, stats }).finally(() => inFlight.delete(v));
    inFlight.add(v);
    // Poisson arrivals: exponential gaps.
    const meanGapMs = 3_600_000 / (perHour * diurnal());
    await sleep(-Math.log(1 - Math.random()) * meanGapMs);
  }
  await Promise.all(inFlight);
}
