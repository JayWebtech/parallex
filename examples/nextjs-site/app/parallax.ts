/**
 * The Parallax snippet, as props for next/script. Copy the values from your
 * project's "Snippet" page:
 *  - origin: your Parallax URL (empty here: the demo serves this site from Parallax)
 *  - websiteId: your project's website ID (default: the public demo's Demo Wallet)
 *  - src + integrity: the pinned tracker version and its SRI hash; never edit one without the other
 */
const origin = process.env.NEXT_PUBLIC_PARALLAX_ORIGIN ?? '';

export const parallaxScript = {
  src: `${origin}/p/v1.0.0/px.js`,
  integrity: 'sha384-+Pi9N7EYNykKt2zdDjFh27h3d4fwMqYGUedJYtMj9d78zYeL+7CqMBRe1E4Gt8ox',
  crossOrigin: 'anonymous',
  'data-website-id':
    process.env.NEXT_PUBLIC_PARALLAX_WEBSITE_ID ?? 'f8f136c0-3f82-4a43-8897-693c11c4e0b8',
  'data-do-not-track': 'true',
  // Query strings (and the ad click IDs in them) never leave the browser.
  'data-exclude-search': 'true',
  ...(origin ? { 'data-host-url': origin } : {}),
} as const;
