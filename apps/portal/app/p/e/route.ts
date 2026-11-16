import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const umamiUrl = (process.env.UMAMI_URL || 'http://umami.railway.internal:3000').replace(
    /\/+$/,
    '',
  );
  const url = `${umamiUrl}/p/e`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  // Country comes from our own country-only DB, never from CDN headers (matching Caddyfile).
  headers.delete('cf-ipcountry');
  headers.delete('cf-ipcity');
  headers.delete('cf-region-code');
  headers.delete('x-vercel-ip-country');
  headers.delete('x-vercel-ip-city');
  headers.delete('cloudfront-viewer-country');
  headers.delete('cloudfront-viewer-city');

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: req.body,
    // @ts-expect-error duplex required for streaming in Node runtime
    duplex: 'half',
  });

  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete('x-middleware-rewrite');
  responseHeaders.delete('x-nextjs-rewrite');

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}
