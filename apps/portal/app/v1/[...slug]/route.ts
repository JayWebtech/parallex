import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const collectorUrl = (
    process.env.COLLECTOR_URL || 'http://collector.railway.internal:4318'
  ).replace(/\/+$/, '');
  const url = `${collectorUrl}/v1/${slug.join('/')}`;

  const headers = new Headers(req.headers);
  headers.delete('host');

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
