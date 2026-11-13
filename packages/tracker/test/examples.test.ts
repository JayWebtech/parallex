import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_PROJECTS } from '@parallax/shared';
import { describe, expect, it } from 'vitest';
import { currentTracker } from '../src/index.js';

/**
 * The example sites embed the tracker by hand (they are meant to be copied).
 * Keep them on the current version, with its exact SRI hash, and pointed at
 * the demo websites the public demo seeds.
 */
const examples = join(import.meta.dirname, '../../../examples');
const demoSite = (example: string) => DEMO_PROJECTS.find((p) => p.site.example === example)!;

describe('example sites', () => {
  const tracker = currentTracker();

  it('static-site: every page loads the current tracker with SRI', () => {
    const dir = join(examples, 'static-site');
    const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
    expect(pages.length).toBeGreaterThanOrEqual(4);
    for (const page of pages) {
      const html = readFileSync(join(dir, page), 'utf8');
      const tag = html.match(/<script[^>]*px\.js[^>]*>/s)?.[0] ?? '';
      expect(tag, page).toContain(`src="${tracker.scriptPath}"`);
      expect(tag, page).toContain(`integrity="${tracker.sha384}"`);
      expect(tag, page).toContain('crossorigin="anonymous"');
      expect(tag, page).toContain('data-exclude-search="true"');
      expect(tag, page).toContain(`data-website-id="${demoSite('static-site').websiteId}"`);
    }
  });

  it('static-site: the demo traffic only visits pages that exist', () => {
    const files = readdirSync(join(examples, 'static-site'));
    for (const path of demoSite('static-site').site.pages)
      expect(files).toContain(path === '/' ? 'index.html' : path.slice(1));
  });

  it('nextjs-site: next/script props carry the current tracker with SRI', () => {
    const src = readFileSync(join(examples, 'nextjs-site/app/parallax.ts'), 'utf8');
    expect(src).toContain(`${tracker.scriptPath}\``);
    expect(src).toContain(`'${tracker.sha384}'`);
    expect(src).toContain(`'${demoSite('nextjs-site').websiteId}'`);
    expect(src).toContain(`'data-exclude-search': 'true'`);
  });

  it('nextjs-site: the demo traffic only visits pages that exist', () => {
    for (const path of demoSite('nextjs-site').site.pages) {
      const page = path === '/' ? 'app/page.tsx' : `app${path}page.tsx`;
      expect(() => readFileSync(join(examples, 'nextjs-site', page)), page).not.toThrow();
    }
  });
});
