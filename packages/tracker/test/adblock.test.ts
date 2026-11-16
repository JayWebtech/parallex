/**
 * Checks the tracker URLs against the filter lists most ad blockers ship by
 * default. Needs network (lists are cached for a day in .cache/). Run with
 * `pnpm --filter @parallax/tracker test:adblock`; CI runs it on every push.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { get } from 'node:https';
import { dirname, join } from 'node:path';
import { FiltersEngine, Request } from '@ghostery/adblocker';
import { beforeAll, describe, expect, it } from 'vitest';
import { TRACKER_MANIFEST } from '../src/index.js';

const LISTS = {
  EasyList: 'https://easylist.to/easylist/easylist.txt',
  EasyPrivacy: 'https://easylist.to/easylist/easyprivacy.txt',
  'uBlock filters': 'https://ublockorigin.github.io/uAssets/filters/filters.txt',
  'uBlock privacy': 'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
  'AdGuard Tracking Protection': 'https://filters.adtidy.org/extension/ublock/filters/3.txt',
};

/** Where the tracker is served from, and a tenant site embedding it (third-party context). */
const ORIGIN = process.env.ADBLOCK_TEST_ORIGIN ?? 'https://parallax.example.org';
const TENANT_PAGE = 'https://some-stellar-project.example.com/';

const cacheDir = join(dirname(new URL(import.meta.url).pathname), '..', '.cache', 'filter-lists');
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadList(name: string, url: string): Promise<string> {
  const file = join(cacheDir, `${name.replace(/\W+/g, '-')}.txt`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < DAY_MS) {
    return readFileSync(file, 'utf8');
  }
  const text = await download(url).catch((error: Error) => {
    throw new Error(`${name}: ${error.message}`);
  });
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(file, text);
  return text;
}

/**
 * GET with node:https rather than fetch: Node's bundled undici can throw an
 * uncaught internal assertion (`assert(!this.paused)`) when a pooled
 * connection closes during parallel downloads, which fails the run even though
 * every test passed. Follows up to 5 redirects.
 */
function download(url: string, redirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = get(url, { headers: { 'user-agent': 'parallax-adblock-test' } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(download(new URL(res.headers.location, url).toString(), redirects - 1));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.setTimeout(120_000, () => req.destroy(new Error('timed out')));
    req.on('error', reject);
  });
}

type Kind = 'script' | 'xmlhttprequest';

let engines: [string, FiltersEngine][] = [];

function blockedBy(url: string, type: Kind): string[] {
  const request = Request.fromRawDetails({ url, sourceUrl: TENANT_PAGE, type });
  return engines.filter(([, engine]) => engine.match(request).match).map(([name]) => name);
}

beforeAll(async () => {
  engines = await Promise.all(
    Object.entries(LISTS).map(async ([name, url]) => {
      const engine = FiltersEngine.parse(await loadList(name, url), {
        loadNetworkFilters: true,
        loadCosmeticFilters: false,
      });
      return [name, engine] as [string, FiltersEngine];
    }),
  );
}, 600_000);

describe('ad-blocker filter lists', () => {
  it('are loaded and block well-known trackers (control)', () => {
    expect(blockedBy('https://www.google-analytics.com/analytics.js', 'script')).toContain(
      'EasyPrivacy',
    );
    // Generic path rules are active, not just domain rules. This is also why
    // the tracker is renamed: Umami's and Plausible's default names are blocked
    // on any host.
    expect(blockedBy('https://cdn.example.net/umami.js', 'script')).toContain('EasyPrivacy');
    expect(blockedBy('https://cdn.example.net/plausible.js', 'script')).toContain('EasyPrivacy');
  });

  describe.each(TRACKER_MANIFEST.versions)('tracker $version', (v) => {
    it(`does not block the script ${v.scriptPath}`, () => {
      expect(blockedBy(`${ORIGIN}${v.scriptPath}`, 'script')).toEqual([]);
    });

    // The tracker sends events with fetch (keepalive), which blockers classify
    // as xmlhttprequest. EasyPrivacy blocks *every* third-party `ping`
    // (`$ping,3p`), so the tracker must never use navigator.sendBeacon; see
    // test/manifest.test.ts.
    it(`does not block the collect endpoint ${v.collectPath}`, () => {
      expect(blockedBy(`${ORIGIN}${v.collectPath}`, 'xmlhttprequest')).toEqual([]);
    });
  });
});
