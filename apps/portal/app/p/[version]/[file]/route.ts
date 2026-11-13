import { TRACKER_MANIFEST, TRACKER_RESPONSE_HEADERS, findTrackerByPath } from '@parallax/tracker';

/**
 * Serves immutable, version-pinned tracker builds at /p/v<version>/<name>.js.
 * The body is exactly the committed file whose SHA-384 is in the snippet's
 * `integrity` attribute.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return TRACKER_MANIFEST.versions.map((v) => {
    const [, , version, file] = v.scriptPath.split('/');
    return { version: version!, file: file! };
  });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ version: string; file: string }> },
) {
  const { version, file } = await ctx.params;
  const tracker = findTrackerByPath(`/p/${version}/${file}`);
  if (!tracker) return new Response('Not found', { status: 404 });
  return new Response(tracker.source, { headers: TRACKER_RESPONSE_HEADERS });
}
