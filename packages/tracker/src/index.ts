import { TRACKER_MANIFEST, TRACKER_SOURCES } from './generated.js';
import type { TrackerVersion } from './types.js';

export type { TrackerManifest, TrackerVersion } from './types.js';
export { TRACKER_MANIFEST };

/**
 * Headers for serving a tracker version. Immutable: a version's bytes never
 * change, so browsers and CDNs may cache it for a year. CORS + CORP allow the
 * cross-origin `<script crossorigin="anonymous" integrity=…>` load that SRI needs.
 */
export const TRACKER_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  'content-type': 'application/javascript; charset=utf-8',
  'cache-control': 'public, max-age=31536000, immutable',
  'access-control-allow-origin': '*',
  'cross-origin-resource-policy': 'cross-origin',
  'x-content-type-options': 'nosniff',
};

export function currentTracker(): TrackerVersion {
  const current = TRACKER_MANIFEST.versions.find((v) => v.version === TRACKER_MANIFEST.current);
  if (!current) throw new Error('tracker manifest has no current version');
  return current;
}

/** All collect paths ever published; old snippets keep working after upgrades. */
export function collectPaths(): string[] {
  return [...new Set(TRACKER_MANIFEST.versions.map((v) => v.collectPath))];
}

/** Looks up a tracker by its public path. Returns the exact bytes the SRI hash covers. */
export function findTrackerByPath(
  pathname: string,
): { version: TrackerVersion; source: string } | undefined {
  const version = TRACKER_MANIFEST.versions.find((v) => v.scriptPath === pathname);
  const source = version && TRACKER_SOURCES[version.version];
  return version && source !== undefined ? { version, source } : undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The HTML snippet a tenant pastes into their site. Pins the version and its
 * SRI hash: browsers refuse to run the file if a single byte differs.
 */
export function buildSnippet(input: {
  origin: string;
  websiteId: string;
  version?: TrackerVersion;
}): string {
  const origin = new URL(input.origin).origin;
  if (!UUID.test(input.websiteId)) throw new Error('websiteId must be a UUID');
  const v = input.version ?? currentTracker();
  return (
    `<script defer src="${origin}${v.scriptPath}" ` +
    `data-website-id="${input.websiteId}" data-host-url="${origin}" ` +
    `data-do-not-track="true" data-exclude-search="true" ` +
    `integrity="${v.sha384}" crossorigin="anonymous"></script>`
  );
}
