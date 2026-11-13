import { PLACEHOLDERS } from './placeholders.js';
import { classifySegment, isSecretSeed } from './rules.js';

export interface NormalizeOptions {
  /** Segments kept before the rest of the path is collapsed into `{…}`. Default 12. */
  maxSegments?: number;
  /** Segments longer than this are replaced by `{token}` whatever they contain. Default 128. */
  maxSegmentLength?: number;
}

export interface NormalizeResult {
  /** The normalized route, always starting with `/`. */
  path: string;
  /**
   * Number of Stellar secret seeds found (and redacted) in the input. Anything
   * above zero means the caller is leaking signing keys in URLs and should be warned.
   */
  secretsRedacted: number;
}

export const DEFAULT_MAX_SEGMENTS = 12;
export const DEFAULT_MAX_SEGMENT_LENGTH = 128;
/** Inputs are cut to this many characters before parsing, to bound work per call. */
export const MAX_INPUT_LENGTH = 8192;

const SCHEME_AND_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Removes `scheme://authority` (absolute-form request targets) and any query string or fragment. */
export function stripToPath(raw: string): string {
  let s = raw.trim().slice(0, MAX_INPUT_LENGTH);
  s = s.replace(SCHEME_AND_AUTHORITY, '');
  const cut = s.search(/[?#]/);
  return cut === -1 ? s : s.slice(0, cut);
}

/** Percent-decodes one segment. Malformed escapes leave the segment untouched. */
function safeDecode(segment: string): string {
  if (!segment.includes('%')) return segment;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizeSegment(
  raw: string,
  maxSegmentLength: number,
): { value: string; secret: boolean } {
  const decoded = safeDecode(raw);
  const placeholder = classifySegment(decoded);
  if (placeholder !== null) {
    return { value: placeholder, secret: placeholder === PLACEHOLDERS.secret };
  }
  if (decoded.length > maxSegmentLength) return { value: PLACEHOLDERS.token, secret: false };
  // Keep the decoded form for readability unless decoding would introduce a
  // path separator or control characters into the stored route.
  const value = decoded.includes('/') || CONTROL_CHARS.test(decoded) ? raw : decoded;
  return { value, secret: false };
}

/**
 * Normalizes a raw request path and reports how many secret seeds were redacted.
 *
 * Accepts a bare path, a path with query/fragment, or an absolute URL. Duplicate
 * slashes are collapsed, the trailing slash is removed (except for `/`), each
 * segment is percent-decoded and replaced by a placeholder if it matches a
 * default rule, and paths deeper than `maxSegments` end in `{…}`.
 */
export function normalizePathWithStats(
  rawPath: string,
  options: NormalizeOptions = {},
): NormalizeResult {
  const maxSegments = options.maxSegments ?? DEFAULT_MAX_SEGMENTS;
  const maxSegmentLength = options.maxSegmentLength ?? DEFAULT_MAX_SEGMENT_LENGTH;

  const rawSegments = stripToPath(rawPath)
    .split('/')
    .filter((s) => s !== '');

  const out: string[] = [];
  let secretsRedacted = 0;

  for (const [i, raw] of rawSegments.entries()) {
    if (i >= maxSegments) {
      // Dropped segments are never stored, but still count leaked secrets.
      if (isSecretSeed(safeDecode(raw))) secretsRedacted++;
      continue;
    }
    const { value, secret } = normalizeSegment(raw, maxSegmentLength);
    if (secret) secretsRedacted++;
    out.push(value);
  }
  if (rawSegments.length > maxSegments) out.push(PLACEHOLDERS.truncated);

  return { path: `/${out.join('/')}`, secretsRedacted };
}

/** Normalizes a raw request path into a low-cardinality route. See `normalizePathWithStats`. */
export function normalizePath(rawPath: string, options?: NormalizeOptions): string {
  return normalizePathWithStats(rawPath, options).path;
}
