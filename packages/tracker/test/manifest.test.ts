import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TRACKER_MANIFEST,
  TRACKER_RESPONSE_HEADERS,
  buildSnippet,
  collectPaths,
  currentTracker,
  findTrackerByPath,
} from '../src/index.js';
import { TRACKER_SOURCES } from '../src/generated.js';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const repo = join(root, '..', '..');
const sri = (s: string) => `sha384-${createHash('sha384').update(s, 'utf8').digest('base64')}`;

/** Words that popular filter lists key on; none may appear in public paths. */
const BANNED = ['umami', 'analytics', 'track', 'stats', 'collect', 'pixel', 'beacon', 'telemetry'];

describe('tracker manifest', () => {
  it('has a current version', () => {
    expect(currentTracker().version).toBe(TRACKER_MANIFEST.current);
  });

  describe.each(TRACKER_MANIFEST.versions)('version $version', (v) => {
    const committed = readFileSync(join(root, v.file), 'utf8');

    it('committed file matches the recorded SRI hash', () => {
      expect(sri(committed)).toBe(v.sha384);
    });

    it('generated module serves exactly the committed bytes', () => {
      expect(TRACKER_SOURCES[v.version]).toBe(committed);
      expect(findTrackerByPath(v.scriptPath)?.source).toBe(committed);
    });

    it('posts to its collect path and nowhere else', () => {
      // Minified as `${host}/p/e`; the upstream default must be gone.
      expect(committed).toContain(`}${v.collectPath}\``);
      expect(committed).not.toContain('/api/send');
    });

    it('never writes to browser storage (it only reads an opt-out flag)', () => {
      expect(committed).not.toMatch(/localStorage\.setItem|\.setItem\(|indexedDB|sessionStorage/);
    });

    it('never uses sendBeacon (all third-party pings are blocked by EasyPrivacy)', () => {
      expect(committed).not.toContain('sendBeacon');
    });

    it('never touches cookies', () => {
      expect(committed).not.toMatch(/document\.cookie/);
    });

    it('uses neutral public paths', () => {
      for (const path of [v.scriptPath, v.collectPath]) {
        for (const word of BANNED) expect(path.toLowerCase()).not.toContain(word);
      }
      expect(v.scriptPath).toMatch(/^\/p\/v\d+\.\d+\.\d+\/[a-z0-9-]+\.js$/);
    });

    it('was derived from the Umami image pinned in docker-compose.yml', () => {
      const compose = readFileSync(join(repo, 'infra', 'docker-compose.yml'), 'utf8');
      expect(compose).toContain(v.upstream.image);
    });
  });

  it('keeps every collect path routable after upgrades', () => {
    const caddy = readFileSync(join(repo, 'infra', 'Caddyfile'), 'utf8');
    for (const path of collectPaths()) expect(caddy).toContain(path);
  });
});

describe('buildSnippet', () => {
  const websiteId = '3f2b8c1e-9a4d-4e7f-8b6a-2c1d0e9f8a7b';

  it('pins the version with SRI and loads cross-origin', () => {
    const v = currentTracker();
    const html = buildSnippet({ origin: 'https://parallax.example.org/some/path', websiteId });
    expect(html).toBe(
      `<script defer src="https://parallax.example.org${v.scriptPath}" ` +
        `data-website-id="${websiteId}" data-host-url="https://parallax.example.org" ` +
        `data-do-not-track="true" integrity="${v.sha384}" crossorigin="anonymous"></script>`,
    );
  });

  it('rejects non-UUID website ids', () => {
    expect(() =>
      buildSnippet({ origin: 'https://x.example', websiteId: '"><script>alert(1)</script>' }),
    ).toThrow();
  });
});

describe('response headers', () => {
  it('are immutable and CORS-enabled for SRI', () => {
    expect(TRACKER_RESPONSE_HEADERS['cache-control']).toContain('immutable');
    expect(TRACKER_RESPONSE_HEADERS['access-control-allow-origin']).toBe('*');
  });
});
