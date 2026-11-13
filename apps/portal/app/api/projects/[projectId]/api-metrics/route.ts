import { getApiAnalytics } from '@/lib/api-analytics';
import { parseRange } from '@/lib/ranges';
import { withUser } from '@/lib/route';
import { getDeps } from '@/lib/server';

/** API analytics for one of the caller's projects. `?range=24h|7d|30d|custom&from&to`. */
export const GET = withUser<{ projectId: string }>(async ({ request, user, params }) => {
  const q = new URL(request.url).searchParams;
  const range = parseRange({
    range: q.get('range') ?? undefined,
    from: q.get('from') ?? undefined,
    to: q.get('to') ?? undefined,
  });
  return Response.json(await getApiAnalytics(getDeps(), user.id, params.projectId, range));
});
