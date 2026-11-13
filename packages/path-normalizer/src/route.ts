import type { NormalizeOptions } from './normalize.js';
import { normalizePathWithStats, stripToPath } from './normalize.js';
import { PLACEHOLDERS } from './placeholders.js';
import { isSecretSeed } from './rules.js';

/** OpenTelemetry attributes as a flat key → value map (non-string values are ignored). */
export type Attributes = Readonly<Record<string, unknown>>;

export type RouteSource =
  'http.route' | 'url.path' | 'http.target' | 'url.full' | 'http.url' | 'none';

export interface RouteResult {
  route: string;
  /** Which attribute the route was derived from. */
  source: RouteSource;
  secretsRedacted: number;
}

/**
 * Raw-path attributes, best first. `url.*` are the stable HTTP semantic
 * conventions; `http.target` / `http.url` are their pre-1.21 equivalents.
 */
const PATH_ATTRIBUTES = ['url.path', 'http.target', 'url.full', 'http.url'] as const;

function stringAttr(attributes: Attributes, key: string): string | undefined {
  const value = attributes[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * `http.route` is a server-side template (`/users/:id`, `/users/{id}`), so it is
 * used verbatim. Only two safety rails apply: query/fragment are dropped, and
 * any Stellar secret seed is still redacted.
 */
function useTemplate(template: string): RouteResult {
  let secretsRedacted = 0;
  const path = stripToPath(template)
    .split('/')
    .map((segment) => {
      if (!isSecretSeed(segment)) return segment;
      secretsRedacted++;
      return PLACEHOLDERS.secret;
    })
    .join('/');
  const route = path.startsWith('/') ? path : `/${path}`;
  return { route, source: 'http.route', secretsRedacted };
}

/**
 * Derives a normalized route from a span's or data point's attributes.
 *
 * Prefers `http.route` (used as-is), then falls back to `url.path`,
 * `http.target`, `url.full` and `http.url`, which are normalized with
 * `normalizePath`. Returns `{unknown}` when none is present.
 */
export function normalizeRoute(attributes: Attributes, options?: NormalizeOptions): RouteResult {
  const template = stringAttr(attributes, 'http.route');
  if (template !== undefined) return useTemplate(template);

  for (const key of PATH_ATTRIBUTES) {
    const raw = stringAttr(attributes, key);
    if (raw === undefined) continue;
    const { path, secretsRedacted } = normalizePathWithStats(raw, options);
    return { route: path, source: key, secretsRedacted };
  }

  return { route: PLACEHOLDERS.unknown, source: 'none', secretsRedacted: 0 };
}
